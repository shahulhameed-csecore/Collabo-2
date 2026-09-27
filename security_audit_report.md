# Collabo-2 Application Security & Architecture Audit

As an elite Application Security Architect and Performance Optimizer, I have rigorously analyzed the provided `collabo-part-2` codebase. Below is a meticulous breakdown of critical flaws identified during the teardown, categorized into four core domains, complete with specific remediation strategies.

---

## 1. 🐛 Bugs (Functional & Logic Errors)

### Missing Array Emptiness Checks in Bulk Operations
**File:** `influencertrack-backend/app/api/campaigns.py` (Line 22)
**Issue:** In `bulk_update_status`, the endpoint accepts `payload.campaign_ids`. If an empty array is passed, the Supabase `.in_("id", payload.campaign_ids)` query will either throw a PostgREST syntax error or inadvertently match unexpected records.
**Remediation:** 
```python
# Vulnerable Code
current_campaigns = client.table("campaigns").select("id, status...").in_("id", payload.campaign_ids).execute()

# Remediated Code
if not payload.campaign_ids:
    return {"message": "No campaigns specified"}
current_campaigns = client.table("campaigns").select("id, status...").in_("id", payload.campaign_ids).execute()
```

### Unescaped SQL LIKE Clauses
**File:** `influencertrack-backend/app/api/whatsapp.py` (Line 95)
**Issue:** `message_id` is blindly formatted into an `.ilike()` clause: `.ilike("special_notes", f"%[wa_msg:{message_id}]%")`. If `message_id` contains `%` or `_`, it will act as a wildcard, matching the wrong campaigns and causing false-positive deduplication.
**Remediation:** Escape wildcard characters in `message_id` before using it in the `ilike` pattern.

---

## 2. 🛡️ Security Issues (Vulnerabilities & Threat Modeling)

### Subscription Stacking (Replay/Logic Attack)
**File:** `influencertrack-backend/app/api/billing.py` (Line 254)
**Issue:** In the `razorpay_webhook` endpoint, the logic blindly adds `timedelta(days=30)` to the user's current `trial_ends_at` date whenever an `order.paid` event is received. It does **not** track which Razorpay `order_id` has been processed. An attacker could potentially intercept and replay the valid webhook payload (if signature verification relies on static headers) or trigger duplicate events, allowing them to stack years of "Pro" subscription for the price of one month.
**Remediation:** Track processed `order_id`s in a database table or add the `order_id` to the subscription record to guarantee idempotency.

### Broken Access Control (BAC) in Razorpay Verification
**File:** `influencertrack-backend/app/api/billing.py` (Line 128)
**Issue:** The `/verify-payment` route blindly fetches the order from Razorpay and upgrades the currently authenticated user (`user.user.id`). It does not verify that the Razorpay `order_id` was actually created *for* the current user. A malicious user could pay for an order on Account A, and then submit the payment details to Account B, upgrading both if the webhook also fires.
**Remediation:** 
```python
order = client.order.fetch(req.razorpay_order_id)
if order.get("notes", {}).get("user_id") != user.user.id:
    raise HTTPException(status_code=403, detail="Order does not belong to this user")
```

---

## 3. 🧩 Feature Flaws (UX/UI & Business Logic)

### Short Code Collision (500 Internal Server Error)
**File:** `influencertrack-backend/app/api/campaigns.py` (Line 133 & 187)
**Issue:** The system generates a random 8-character `short_code` for magic links using `secrets.choice`. It inserts this directly into the database without checking for uniqueness. As the database grows, a collision will trigger a Postgres `Unique Violation` constraint, causing a 500 error for the user with no retry logic.
**Remediation:** Implement a retry loop (e.g., attempt to generate and insert up to 3 times) or use a structurally unique ID like a NanoID combined with a timestamp.

### Client-Side Auth Redirection (UX Friction)
**File:** `influencertrack-frontend/app/page.tsx` (Line 36)
**Issue:** The landing page checks for `supabase.auth.getUser()` inside a `useEffect` and pushes the user to `/dashboard` if authenticated. This causes a jarring "flash" of the landing page for returning users before the redirect kicks in.
**Remediation:** Move the authentication check to Next.js `middleware.ts` to intercept the request at the edge and perform a server-side redirect before the landing page ever renders.

---

## 4. ⚡ Efficiency Issues (Performance & Optimization)

### Blocking the Async Event Loop (CRITICAL)
**Files:** ALL API Routes (`whatsapp.py`, `campaigns.py`, `billing.py`, etc.)
**Issue:** FastAPI endpoints are declared as `async def`, but they use the synchronous `supabase-py` client (`client.table(...).execute()`) and the synchronous `razorpay.Client`. Synchronous I/O operations inside an `async def` function block the entire asyncio event loop. If 10 users hit the DB simultaneously, the API will process them serially, plummeting throughput to near zero.
**Remediation:**
Either:
1. Drop the `async` keyword from the route definitions so FastAPI automatically runs them in a separate threadpool:
```python
# Vulnerable
@router.get("/")
async def get_campaigns(...):
    client.table(...).execute() # Blocks the loop!

# Remediated
@router.get("/")
def get_campaigns(...):
    client.table(...).execute() # Safely runs in threadpool
```
2. Wrap the synchronous calls using `fastapi.concurrency.run_in_threadpool`.
3. Switch to the async version of the Supabase client (`postgrest-py` async capabilities).

### N+1 Network Calls (O(N) DB Inserts)
**File:** `influencertrack-backend/app/api/campaigns.py` (Line 76)
**Issue:** In `bulk_update_status`, notifications are created by iterating over the valid campaigns and calling `create_notification` for each one. Under the hood, this executes `asyncio.gather(*tasks)`, which makes *N* separate HTTP POST requests to the Supabase REST API simultaneously. For large bulk updates, this will exhaust connection limits or trigger rate limits.
**Remediation:** Construct an array of notification objects and perform a single bulk `.insert([notif1, notif2, ...]).execute()` call to the database.
