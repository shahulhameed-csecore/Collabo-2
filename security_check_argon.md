# Security Check Argon: Comprehensive Application Security Audit & Hardening Report

**Project:** Collabo Platform (Micro-Influencer Campaign Management SaaS)  
**Classification:** Internal Confidential / Security Audit  
**Auditor Role:** Principal Application Security Engineer  
**Date:** October 2026  
**Status:** Findings Documented & Remediation Ready  

---

## Executive Summary

An exhaustive security audit was conducted on the Collabo codebase across all architectural tiers:
- **Frontend:** Next.js 16 App Router (`influencertrack-frontend`), routing proxies, OAuth callback flows, and API clients.
- **Backend:** FastAPI Core Engine (`influencertrack-backend`), billing endpoints, campaign workflows, file upload parsers, and external integrations (Meta WhatsApp Cloud API, Telegram, Razorpay).
- **Database & Storage:** Supabase PostgreSQL migrations (`supabase_migrations`), Row Level Security (RLS) policies, RPC helper routines, and storage bucket permissions.
- **AI / LLM Pipelines:** Google Gemini extraction workflows, multi-modal sanitization, prompt injection mitigations, and context generation.

While robust defenses exist in several areas (such as SlowAPI rate-limiting, HMAC-SHA256 signature verification for Meta/Razorpay webhooks, and chunked upload streaming), **4 Critical**, **4 High**, **4 Medium**, and **2 Low** vulnerabilities were identified.

---

## Vulnerability Overview Matrix

| ID | Title | Severity | Component | Impact |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Unrevoked RLS Policy Allows Self-Upgrade to Pro | **Critical** | Database RLS | Direct privilege escalation to free lifetime Pro subscription |
| **SEC-02** | Payment Replay Flaw in Razorpay Verification | **Critical** | Backend Billing | Unlimited subscription extensions via replayed payment tokens |
| **SEC-03** | Cross-Tenant IDOR & Service-Role Privilege Escalation | **Critical** | Backend Campaigns / Reminders | Unauthorized reminder triggers & WhatsApp/notification spamming |
| **SEC-04** | Unauthorized AI Extraction Quota Depletion | **Critical** | Database RPC | Denial of Service on competitor accounts via `increment_ai_extractions` |
| **SEC-05** | Open Redirect in OAuth Callback Flow | **High** | Frontend Auth | Redirection to malicious domains via unvalidated `next` parameter |
| **SEC-06** | Unauthenticated PII Disclosure & User Harvesting | **High** | Database RPC | Public email scraping via `get_email_by_username` |
| **SEC-07** | HTML & Link Injection in Transactional Emails | **High** | Backend Reminders / Uploads | Email spoofing and phishing via unescaped dynamic parameters |
| **SEC-08** | Low-Entropy WhatsApp/Telegram Pairing Codes | **High** | Backend Settings / WhatsApp | Account linking hijack via 4-digit code guessing (10k keyspace) |
| **SEC-09** | Unbounded Text / Document Token Consumption | **Medium** | Backend AI Pipeline | High Google AI bills and worker DoS from 10MB raw text submissions |
| **SEC-10** | Algorithm Confusion Risk in JWT Decoding | **Medium** | Backend Dependencies | Potential auth bypass if symmetric algorithms are accepted with JWKS |
| **SEC-11** | Missing Rate Limiting on Financial Endpoints | **Medium** | Backend Billing / Webhooks | Resource exhaustion / API throttling on Razorpay order creation |
| **SEC-12** | Missing Content-Security-Policy on Frontend Pages | **Medium** | Frontend Next.js Config | Increased exposure to client-side injection and unauthorized framing |
| **SEC-13** | Unvalidated Username Parameter in Settings | **Low** | Backend Settings | Non-standard characters or oversized string ingestion |
| **SEC-14** | Plaintext High-Privilege Secrets in Local `.env` | **Low** | Backend Configuration | Exposure of Service Role key and Google App password on local disk |

---

## Detailed Vulnerability Analysis & Production Fixes

---

### [CRITICAL] SEC-01: Insecure Supabase RLS Policy Permits Direct Subscription Privilege Escalation

- **Location:**
  - [supabase_migrations/01_subscriptions.sql:L23-26](file:///c:/Users/shahu/Desktop/collabo-part-2%20-%20Copy/supabase_migrations/01_subscriptions.sql#L23-L26)
  - [supabase_migrations/05_security_and_rls.sql:L53-62](file:///c:/Users/shahu/Desktop/collabo-part-2%20-%20Copy/supabase_migrations/05_security_and_rls.sql#L53-L62)
- **Vulnerability Breakdown:**
  In `01_subscriptions.sql`, an RLS policy was originally created allowing any authenticated user to update their own subscription record:
  ```sql
  CREATE POLICY "Users can update their own subscription"
  ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id);
  ```
  In `05_security_and_rls.sql`, the migration attempted to lock down write permissions:
  ```sql
  DROP POLICY IF EXISTS "subscriptions_select" ON public.subscriptions;
  CREATE POLICY "subscriptions_select" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
  ```
  Because the drop statement targeted `"subscriptions_select"`, the policy named `"Users can update their own subscription"` was **never dropped**.
  
  Any authenticated user using the Supabase client library with the public anonymous key can issue:
  ```javascript
  const { error } = await supabase
    .from('subscriptions')
    .update({ tier: 'pro', is_paid: true, trial_ends_at: '2099-01-01T00:00:00Z' })
    .eq('user_id', currentUser.id);
  ```
  PostgreSQL allows this update, granting the user permanent Pro features without payment.

- **The Remediation Patch:**
  Apply a new SQL migration (`17_security_audit_hardening.sql`) to revoke all client-side write access to `subscriptions`:

```sql
-- Migration: Revoke client-side write permissions on subscriptions
DROP POLICY IF EXISTS "Users can update their own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_update" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_insert" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_delete" ON public.subscriptions;

-- Ensure read-only access for authenticated users
DROP POLICY IF EXISTS "subscriptions_select" ON public.subscriptions;
CREATE POLICY "subscriptions_select" ON public.subscriptions
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Enforce RLS
ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY;
```

---

### [CRITICAL] SEC-02: Payment Replay Vulnerability in Razorpay Verification Allows Infinite Pro Extensions

- **Location:**
  - [influencertrack-backend/app/api/billing.py:L148-228](file:///c:/Users/shahu/Desktop/collabo-part-2%20-%20Copy/influencertrack-backend/app/api/billing.py#L148-L228)
- **Vulnerability Breakdown:**
  In `verify_payment()`, the backend verifies the Razorpay signature and checks `order.get("notes", {}).get("user_id") == user.user.id`.
  However, unlike `process_razorpay_webhook_db()` (which inserts into `processed_transactions` to enforce idempotency), **`verify_payment()` never checks whether `razorpay_payment_id` or `razorpay_order_id` has already been credited**.
  
  When `parsed_trial > now`, lines 196–205 execute:
  ```python
  new_expiry = parsed_trial + timedelta(days=days_to_add)
  await service_client.table("subscriptions").update({
      "tier": "pro",
      "trial_ends_at": new_expiry.isoformat(),
      "is_paid": True,
  }).eq("user_id", user.user.id).execute()
  ```
  A user who pays ₹300 once can send 12 requests in a row to `POST /billing/verify-payment` using the same payment ID. Each request succeeds and appends another 30 days, giving them a 1-year subscription for the price of 1 month.

- **The Remediation Patch:**
  Insert an atomic record into `processed_transactions` before executing the subscription extension in `verify_payment`:

```python
# influencertrack-backend/app/api/billing.py
        # 1. Verify Payment Signature
        await run_in_threadpool(
            client.utility.verify_payment_signature,
            {
                'razorpay_payment_id': req.razorpay_payment_id,
                'razorpay_order_id': req.razorpay_order_id,
                'razorpay_signature': req.razorpay_signature
            }
        )

        service_client = await get_service_client()

        # 2. Idempotency Guard: Ensure transaction has not already been credited
        try:
            await service_client.table("processed_transactions").insert({
                "order_id": req.razorpay_order_id,
                "payment_id": req.razorpay_payment_id,
                "user_id": user.user.id,
                "event_type": "payment.verified"
            }).execute()
        except Exception as db_err:
            err_str = str(db_err).lower()
            if any(k in err_str for k in ["duplicate key", "unique constraint", "23505"]):
                raise HTTPException(status_code=400, detail="This payment has already been credited.")
            raise db_err
```

---

### [CRITICAL] SEC-03: Cross-Tenant IDOR & Service-Role Privilege Escalation in Manual Bulk Reminders

- **Location:**
  - [influencertrack-backend/app/api/campaigns.py:L93-112](file:///c:/Users/shahu/Desktop/collabo-part-2%20-%20Copy/influencertrack-backend/app/api/campaigns.py#L93-L112)
  - [influencertrack-backend/app/services/reminders.py:L623-668](file:///c:/Users/shahu/Desktop/collabo-part-2%20-%20Copy/influencertrack-backend/app/services/reminders.py#L623-L668)
- **Vulnerability Breakdown:**
  The `bulk_remind` endpoint accepts an arbitrary array of `campaign_ids`:
  ```python
  @router.post("/bulk/remind", response_model=dict)
  async def bulk_remind(request: Request, payload: BulkDelete, background_tasks: BackgroundTasks, client=Depends(get_user_supabase_client)):
      ...
      background_tasks.add_task(run_reminders)
  ```
  `bulk_remind` does not verify that the campaign IDs belong to the calling user. In `process_manual_reminders`:
  ```python
  supabase = await get_supabase_admin() # Bypasses all RLS
  c_resp = await (supabase.table("campaigns").select("*, user_settings(*)").in_("id", campaign_ids).execute())
  ```
  Because it uses `supabase_admin`, it retrieves campaigns across **all tenants** and sends WhatsApp messages and in-app notifications to influencers and creators belonging to other accounts.

- **The Remediation Patch:**
  Filter requested `campaign_ids` against `user.user.id` using the authenticated client before scheduling background reminders:

```python
# influencertrack-backend/app/api/campaigns.py
@router.post("/bulk/remind", response_model=dict)
@limiter.limit("5/minute")
async def bulk_remind(
    request: Request,
    payload: BulkDelete,
    background_tasks: BackgroundTasks,
    client=Depends(get_user_supabase_client),
    user: AuthenticatedUser = Depends(get_current_user),
):
    if not payload.campaign_ids:
        raise HTTPException(status_code=400, detail="No campaigns specified")

    # Strictly scope query to the authenticated user's tenant
    owned_res = await client.table("campaigns").select("id").in_("id", payload.campaign_ids).eq("user_id", user.user.id).execute()
    valid_ids = [c["id"] for c in (owned_res.data or [])]

    if not valid_ids:
        raise HTTPException(status_code=404, detail="No matching campaigns found under your account.")

    from app.services.reminders import process_manual_reminders
    import httpx
    
    async def run_reminders():
        async with httpx.AsyncClient() as hc:
            await process_manual_reminders(valid_ids, hc)
            
    background_tasks.add_task(run_reminders)
    return {"message": f"Reminders queued for {len(valid_ids)} campaigns"}
```

---

### [CRITICAL] SEC-04: Insecure `SECURITY DEFINER` RPC Allows Arbitrary User Quota Exhaustion

- **Location:**
  - [supabase_migrations/02_phase2_schema.sql:L48-55](file:///c:/Users/shahu/Desktop/collabo-part-2%20-%20Copy/supabase_migrations/02_phase2_schema.sql#L48-L55)
- **Vulnerability Breakdown:**
  The database migration contains:
  ```sql
  CREATE OR REPLACE FUNCTION increment_ai_extractions(p_user_id UUID)
  RETURNS void AS $$
  BEGIN
      UPDATE public.subscriptions 
      SET ai_extractions_count = COALESCE(ai_extractions_count, 0) + 1 
      WHERE user_id = p_user_id;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
  ```
  Running as `SECURITY DEFINER` without verifying `auth.uid() = p_user_id` allows any authenticated user to execute `supabase.rpc('increment_ai_extractions', { p_user_id: victim_uuid })` to exhaust another user's AI extraction budget and lock them out of AI features.

- **The Remediation Patch:**
  Add a strict caller assertion and enforce `search_path`:

```sql
-- Migration: Secure increment_ai_extractions
CREATE OR REPLACE FUNCTION public.increment_ai_extractions(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.role() <> 'service_role' AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Access Denied: You cannot modify extraction counters for other users.';
    END IF;

    UPDATE public.subscriptions 
    SET ai_extractions_count = COALESCE(ai_extractions_count, 0) + 1 
    WHERE user_id = p_user_id;
END;
$$;
```

---

### [HIGH] SEC-05: Open Redirect Vulnerability in Next.js OAuth Callback Handler

- **Location:**
  - [influencertrack-frontend/app/auth/callback/route.ts:L8, L33](file:///c:/Users/shahu/Desktop/collabo-part-2%20-%20Copy/influencertrack-frontend/app/auth/callback/route.ts#L8)
- **Vulnerability Breakdown:**
  In `app/auth/callback/route.ts`:
  ```typescript
  const next = searchParams.get('next') ?? '/dashboard';
  ...
  return NextResponse.redirect(`${origin}${next}`);
  ```
  If `next` is supplied as `//attacker.com` or `/\attacker.com`, `${origin}//attacker.com` resolves to a protocol-relative URI, causing browsers to redirect to `attacker.com` after authenticating.

- **The Remediation Patch:**
  Sanitize the redirect target to ensure it is strictly a local relative path:

```typescript
// influencertrack-frontend/app/auth/callback/route.ts
function getSafeRedirectUrl(nextParam: string | null, defaultPath = '/dashboard'): string {
  if (!nextParam) return defaultPath;
  if (nextParam.startsWith('/') && !nextParam.startsWith('//') && !nextParam.startsWith('/\\')) {
    return nextParam;
  }
  return defaultPath;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const safeNext = getSafeRedirectUrl(searchParams.get('next'), '/dashboard');

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(...);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, origin));
    }
  }

  return NextResponse.redirect(new URL('/login?error=oauth', origin));
}
```

---

### [HIGH] SEC-06: Unauthenticated PII Disclosure via `get_email_by_username`

- **Location:**
  - [supabase_migrations/04_auth_helpers.sql:L9-30](file:///c:/Users/shahu/Desktop/collabo-part-2%20-%20Copy/supabase_migrations/04_auth_helpers.sql#L9-L30)
- **Vulnerability Breakdown:**
  The migration declares:
  ```sql
  CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
  RETURNS TEXT SECURITY DEFINER ...
  GRANT EXECUTE ON FUNCTION public.get_email_by_username(TEXT) TO anon, authenticated;
  ```
  Any anonymous internet actor holding the Supabase public anon key can enumerate usernames and query `get_email_by_username` to extract real user email addresses.

- **The Remediation Patch:**
  Revoke execute privileges from anonymous and authenticated roles; restrict to `service_role`:

```sql
-- Migration: Revoke public execution of get_email_by_username
REVOKE EXECUTE ON FUNCTION public.get_email_by_username(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_email_by_username(TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_email_by_username(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(TEXT) TO service_role;
```

---

### [HIGH] SEC-07: HTML & Link Injection in Transactional Emails

- **Location:**
  - [influencertrack-backend/app/services/reminders.py:L214, L258](file:///c:/Users/shahu/Desktop/collabo-part-2%20-%20Copy/influencertrack-backend/app/services/reminders.py#L214)
  - [influencertrack-backend/app/api/uploads.py:L37](file:///c:/Users/shahu/Desktop/collabo-part-2%20-%20Copy/influencertrack-backend/app/api/uploads.py#L37)
- **Vulnerability Breakdown:**
  Dynamic creator names (`inf_name`) are formatted directly into raw HTML email strings without escaping:
  ```python
  html = f"... <strong style=\"color:#34d399;\">{inf_name}</strong> ..."
  ```
  Because `influencer_name` is user-provided, setting an influencer name to HTML tags or hyperlink anchors causes the payload to render inside the brand owner's email inbox.

- **The Remediation Patch:**
  Sanitize all dynamic email strings using Python's `html.escape()`:

```python
import html

def _build_reminder_email(inf_name: str, deadline_ist: str) -> tuple[str, str]:
    safe_name = html.escape(str(inf_name or "Creator"))
    safe_deadline = html.escape(str(deadline_ist or ""))
    subject = f"⏰ Action Required: Campaign for {safe_name} is due soon"
    html_body = f"""...
        Your campaign with <strong style="color:#34d399;">{safe_name}</strong>
        is due in less than <strong style="color:#fbbf24;">48 hours</strong>.
        ...
        <p style="margin:0;color:#f8fafc;font-size:22px;font-weight:700;">{safe_deadline}</p>
    ..."""
    return subject, html_body
```

---

### [HIGH] SEC-08: Weak Entropy on WhatsApp/Telegram Pairing Codes

- **Location:**
  - [influencertrack-backend/app/api/settings.py:L263-270, L302-308](file:///c:/Users/shahu/Desktop/collabo-part-2%20-%20Copy/influencertrack-backend/app/api/settings.py#L263-L270)
  - [influencertrack-backend/app/api/whatsapp.py:L135-156](file:///c:/Users/shahu/Desktop/collabo-part-2%20-%20Copy/influencertrack-backend/app/api/whatsapp.py#L135-L156)
- **Vulnerability Breakdown:**
  Pairing codes are generated with only 4 numeric digits (`LINK-\d{4}`), giving a space of only 10,000 combinations. Codes remain active in Redis for 10 minutes without lockouts or rate limits on failed pairing messages.

- **The Remediation Patch:**
  Use `secrets.choice` across alphanumeric characters (6-character keyspace = ~2.17 billion combinations) and apply a rate limit on failed pairing attempts:

```python
# influencertrack-backend/app/api/settings.py
import secrets
import string

def generate_pairing_code_str() -> str:
    alphabet = string.ascii_uppercase + string.digits
    body = "".join(secrets.choice(alphabet) for _ in range(6))
    return f"LINK-{body}"
```

---

### [MEDIUM] SEC-09: Unbounded Text / Document Token Consumption

- **Location:**
  - [influencertrack-backend/app/api/extract.py:L30-39](file:///c:/Users/shahu/Desktop/collabo-part-2%20-%20Copy/influencertrack-backend/app/api/extract.py#L30-L39)
  - [influencertrack-backend/app/services/gemini.py:L285-296](file:///c:/Users/shahu/Desktop/collabo-part-2%20-%20Copy/influencertrack-backend/app/services/gemini.py#L285-L296)
- **Vulnerability Breakdown:**
  While the endpoint limits file upload sizes to 10MB, plain text (`.txt`) and Word (`.docx`) files read the entire 10MB into memory and forward it to Gemini in the prompt, which can exhaust token quotas or lead to worker denial-of-service.

- **The Remediation Patch:**
  Truncate incoming text extracts to a maximum of 30,000 characters:

```python
# influencertrack-backend/app/services/gemini.py
MAX_TEXT_EXTRACT_CHARS = 30_000

if mime_type.startswith("text/") or filename.endswith(".txt"):
    text_fallback = file_bytes.decode('utf-8', errors='ignore')[:MAX_TEXT_EXTRACT_CHARS]
    contents.append(text_fallback)
```

---

### [MEDIUM] SEC-10: Algorithm Confusion Risk in JWT Decoding

- **Location:**
  - [influencertrack-backend/app/api/dependencies.py:L32-37](file:///c:/Users/shahu/Desktop/collabo-part-2%20-%20Copy/influencertrack-backend/app/api/dependencies.py#L32-L37)
- **Vulnerability Breakdown:**
  `jwt.decode()` is called with `algorithms=["HS256", "ES256", "RS256"]` against a key obtained from `PyJWKClient`. Passing symmetric and asymmetric algorithms simultaneously creates an algorithm confusion risk if the parser is manipulated.

- **The Remediation Patch:**
  Restrict JWKS decoding strictly to asymmetric algorithms (`["RS256", "ES256"]`).

---

### [MEDIUM] SEC-11: Missing Rate Limiting on Financial & Order Endpoints

- **Location:**
  - [influencertrack-backend/app/api/billing.py:L115, L148](file:///c:/Users/shahu/Desktop/collabo-part-2%20-%20Copy/influencertrack-backend/app/api/billing.py#L115)
- **Vulnerability Breakdown:**
  Neither `/billing/create-razorpay-order` nor `/billing/verify-payment` have `@limiter.limit` decorators, leaving them susceptible to order spam.

- **The Remediation Patch:**
  Add `@limiter.limit("10/minute")` to order creation and verification routes.

---

### [MEDIUM] SEC-12: Missing Content-Security-Policy on Frontend Pages

- **Location:**
  - [influencertrack-frontend/next.config.ts:L26-50](file:///c:/Users/shahu/Desktop/collabo-part-2%20-%20Copy/influencertrack-frontend/next.config.ts#L26-L50)
- **Vulnerability Breakdown:**
  While backend API responses set CSP, the Next.js frontend pages lack a `Content-Security-Policy` header in `next.config.ts`.

- **The Remediation Patch:**
  Inject a Content-Security-Policy into `next.config.ts` headers allowing only verified assets (Supabase, Razorpay, Google Fonts).

---

### [LOW] SEC-13: Unvalidated Username Parameter in Settings

- **Location:**
  - [influencertrack-backend/app/api/settings.py:L19-25](file:///c:/Users/shahu/Desktop/collabo-part-2%20-%20Copy/influencertrack-backend/app/api/settings.py#L19-L25)
- **The Remediation Patch:**
  Enforce schema restrictions via Pydantic:
  ```python
  username: Optional[str] = Field(None, min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_.-]+$")
  ```

---

### [LOW] SEC-14: Plaintext Secrets in Local `.env`

- **Location:**
  - [influencertrack-backend/.env:L1-10](file:///c:/Users/shahu/Desktop/collabo-part-2%20-%20Copy/influencertrack-backend/.env#L1-L10)
- **The Remediation Patch:**
  Ensure developer environments use non-production secrets and rotate keys if machines or backups are compromised.

---

## 3. Implementation Plan

Upon your confirmation, the security patches will be implemented in the following sequence:

1. **Step 1:** Apply backend fixes to `billing.py` (SEC-02 replay guard, SEC-11 rate limiting) and `campaigns.py` (SEC-03 tenant ownership check).
2. **Step 2:** Write and register database migration `supabase_migrations/17_security_audit_hardening.sql` (SEC-01 RLS fix, SEC-04 RPC caller validation, SEC-06 anonymous access revocation).
3. **Step 3:** Apply frontend fixes to `app/auth/callback/route.ts` (SEC-05 open redirect) and `next.config.ts` (SEC-12 CSP header).
4. **Step 4:** Sanitize email templates in `reminders.py` and `uploads.py` (SEC-07 HTML escaping) and upgrade pairing code entropy in `settings.py` (SEC-08).
