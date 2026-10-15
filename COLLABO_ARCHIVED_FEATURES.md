# Collabo — Forensic Audit of Archived, Disabled & Hidden Features

**Document Version:** 1.0  
**Audit Date:** October 15, 2026  
**Auditor:** Principal Forensic Software Engineer  
**Repository:** `collabo-part-2` (`mycollabo.online`)  
**Target File:** `COLLABO_ARCHIVED_FEATURES.md`

---

## Executive Summary

During the development and production hardening of Collabo, multiple advanced modules—ranging from an affiliate link tracking engine and in-app notifications to Telegram bot integrations and visual calendar schedules—were **archived, unmounted, or hidden from the UI** to simplify the initial user experience and streamline deployment.

This forensic audit inspected:
1. **Git Commit History:** Specific refactoring commits (`82212bd`, `835c572`, `4cec9b2`, `3dfedeb`, `35e84cc`, `923e374`, `6adb887`).
2. **The Archived Feature Vault:** The `_feature_archive_v1/` directory in the repository root, which houses archived snapshots of backend routers, database migrations, and frontend components.
3. **Frontend Routes & Navigation:** All routes in `influencertrack-frontend/app/` compared against `DashboardLayout.tsx` and `ProfileDropdown.tsx`.
4. **Unused / Orphaned Components:** Components in `components/`, `components/landing/`, and hooks in `hooks/`.
5. **Backend Routers & Schedulers:** FastAPI mounts in `app/main.py`, service files, and APScheduler cron jobs.
6. **Database Schema vs. UI Discrepancies:** Unused tables and columns in `supabase_migrations/` and backend migration files (`supabase_migrations_v2.sql` through `v6.sql`).

Below is the complete, exhaustive catalog of every hidden, unlinked, commented out, stubbed, or archived feature, accompanied by exact file paths, line references, and precise instructions to restore them.

---

## 1. Hidden / Unlinked Frontend Pages & UI Sections

### 1.1 Content Calendar Page (`/calendar`)
* **File Path (Archived):** `_feature_archive_v1/frontend/app/(dashboard)/calendar/page.tsx`
* **Original Route:** `/calendar` (inside `app/(dashboard)/calendar/page.tsx`)
* **Associated Orphaned Files:**
  * `influencertrack-frontend/components/DayViewModal.tsx`
  * `influencertrack-frontend/hooks/useCalendarStats.ts`
* **What It Does:**
  A comprehensive full-month visual content calendar for influencer campaign deadlines.
  * Displays a responsive monthly calendar grid showing campaign deliverable deadlines categorized by date.
  * Uses `useCalendarStats` to calculate:
    * Total deliverables due this month
    * Completed / received deliverables
    * Overdue deliverables
    * Upcoming deliverables within the next 7 days
  * Each calendar cell displays platform icons (Instagram, YouTube, etc.), influencer handles, and status pill badges.
  * Clicking any day cell opens `DayViewModal`, allowing the brand to view all campaigns due on that specific date and click directly into `EditCampaignModal`.
  * Fully paginated backend fetching (`/campaigns/?limit=200&offset=...`) to ensure campaigns do not drop off the calendar view.
* **Current Status:**
  * Deleted from `influencertrack-frontend/app/(dashboard)/calendar/page.tsx` in commit `835c572`.
  * Removed from `navItems` array in `DashboardLayout.tsx` in commit `35e84cc`.
  * **Traces Remaining:**
    1. `Calendar` icon is still imported from `lucide-react` on line 10 of `influencertrack-frontend/components/DashboardLayout.tsx`.
    2. `OnboardingTour.tsx` (lines 80–91) still contains Step 5 targeting `#tour-nav-calendar` ("Never Miss Deadlines"), which currently fails to highlight because the sidebar link was removed.
    3. `DayViewModal.tsx` and `useCalendarStats.ts` are still present in the frontend tree as dead code.
* **How to Restore It:**
  1. Copy `_feature_archive_v1/frontend/app/(dashboard)/calendar/page.tsx` back to `influencertrack-frontend/app/(dashboard)/calendar/page.tsx`.
  2. In `influencertrack-frontend/components/DashboardLayout.tsx`, add the calendar entry back into `navItems`:
     ```tsx
     const navItems = [
       { href: '/dashboard',           label: 'Campaigns',   icon: LayoutDashboard },
       { href: '/calendar',            label: 'Calendar',    icon: Calendar, id: 'tour-nav-calendar' },
       { href: '/influencers',         label: 'Influencers', icon: Users },
       { href: '/dashboard/analytics', label: 'Analytics',   icon: BarChart3 },
       { href: '/settings',            label: 'Settings',    icon: Settings },
       { href: '/billing',             label: 'Billing',     icon: CreditCard },
     ];
     ```

---

### 1.2 Platform Admin Analytics Dashboard (`/admin/analytics`)
* **File Path:** `influencertrack-frontend/app/admin/analytics/page.tsx`
* **Route:** `/admin/analytics`
* **What It Does:**
  An internal executive dashboard displaying high-level system-wide SaaS metrics:
  * **Total Campaigns:** Live database count queried from `public.campaigns`.
  * **Active Users:** Live count queried from `public.subscriptions`.
  * **AI Extraction Success Rate:** Displaying platform AI efficiency (mocked/computed at 94.2%).
  * **Total Platform Revenue:** MRR / revenue tracker (₹24,500 placeholder).
  * Styled with a dark glassmorphic layout, header logo, and an amber "Admin Only" badge.
* **Current Status:**
  * The page is **100% written, styled, and functional**.
  * It is completely **hidden and unlinked** from both `DashboardLayout.tsx` sidebar and `ProfileDropdown.tsx`.
  * It can only be accessed by manually typing `https://mycollabo.online/admin/analytics` into the browser bar.
* **How to Restore It:**
  1. Add an admin link to `influencertrack-frontend/components/ProfileDropdown.tsx` within the `menuItems` array:
     ```tsx
     {
       label: 'Admin Analytics',
       icon: Activity,
       href: '/admin/analytics',
       description: 'Platform metrics',
     }
     ```
  2. (Optional) Protect the route by checking if `user.email` belongs to admin domain/whitelisted addresses.

---

### 1.3 Dedicated Pricing Page (`/pricing`)
* **File Path:** `influencertrack-frontend/app/pricing/page.tsx`
* **Route:** `/pricing`
* **What It Does:**
  A standalone public pricing page displaying pricing tiers:
  * **Starter Tier (₹0):** 5 Active campaigns, 10 AI extractions/mo, Manual reminders.
  * **Pro Tier (₹300/mo or ₹3,000/yr):** Unlimited campaigns, Unlimited AI extractions, Automated WhatsApp reminders, Priority support.
  * Includes a feature comparison matrix and FAQ accordion.
* **Current Status:**
  * The page exists and is functional.
  * However, the main landing page (`app/page.tsx`) embeds its own inline `PremiumPricing` component and sets navbar links to anchor hash `#pricing`. As a result, the standalone `/pricing` route is orphaned from main navigation.
* **How to Restore It:**
  Update landing page footer and navbar links in `influencertrack-frontend/app/page.tsx` to point to `/pricing` instead of anchor `#pricing`, or redirect `/pricing` to `/#pricing`.

---

### 1.4 Link Analytics Modal (`trackingModalCampaign`)
* **File Path (Archived Diff):** `influencertrack-frontend/components/CampaignTable.tsx` (Commit `82212bd`)
* **What It Does:**
  A specialized performance modal that opens when a user inspects a campaign's tracking link in `CampaignTable.tsx`:
  * Displays **Total Clicks** in a large emerald stat display (`c.clicks`).
  * Calculates and displays **Cost Per Click (CPC)** dynamically:
    $$\text{CPC} = \frac{\text{payment\_amount}}{\text{clicks}}$$
  * Displays the target **Destination URL** with an external link launcher.
  * Allows one-click copying of the branded short link `${baseUrl}/t/${c.short_code}`.
* **Current Status:**
  * 131 lines of JSX and state (`trackingModalCampaign`) were deleted from `CampaignTable.tsx` in commit `82212bd`.
* **How to Restore It:**
  1. Restore the `trackingModalCampaign` state in `CampaignTable.tsx`:
     ```tsx
     const [trackingModalCampaign, setTrackingModalCampaign] = useState<Campaign | null>(null);
     ```
  2. Re-insert the "Link Analytics" button in the table actions column and render the modal markup from commit `82212bd` (lines 678–741).

---

### 1.5 Multi-Version Proof Submission History Drawer
* **File Path (Archived Diff):** `influencertrack-frontend/components/CampaignTable.tsx` (Commit `82212bd`)
* **What It Does:**
  When creators submit revisions of their posts via the Magic Link, Collabo preserves previous iterations in `campaigns.proof_history` (a JSONB array of `{ url, uploaded_at }`).
  * In `CampaignTable.tsx`, campaigns with status `content_received` displayed a `Clock` icon button next to the proof link.
  * Hovering/clicking opened a popover drawer titled **"Previous Submissions"**.
  * Displayed "Version 1", "Version 2", etc., along with Indian standard date formatting (`toLocaleDateString('en-IN')`) and links to view earlier draft uploads.
  * Displayed a purple notification dot badge on the globe icon if multiple proof versions existed.
* **Current Status:**
  * Removed from `CampaignTable.tsx` in commit `82212bd`.
  * `campaigns.proof_history` column definition in `types.ts` (line 31) is still active:
    `proof_history: { url: string; uploaded_at: string }[] | null;`
* **How to Restore It:**
  Re-insert the proof history popover markup into `influencertrack-frontend/components/CampaignTable.tsx` adjacent to line 590 where `c.status === 'content_received'` is rendered.

---

### 1.6 Destination URL Field in Campaign Modals
* **File Path (Archived Diff):** `influencertrack-frontend/components/EditCampaignModal.tsx` (Commit `82212bd`)
* **What It Does:**
  An input field allowing brand managers to define the target product page (e.g., `https://mybrand.com/summer-sale`) for short link generation.
* **Current Status:**
  * Removed from `EditCampaignModal.tsx` in commit `82212bd` to simplify the modal to core fields only.
* **How to Restore It:**
  Add the input field back into `influencertrack-frontend/components/EditCampaignModal.tsx`:
  ```tsx
  <Field label="Destination URL (for Tracking Link)" icon={Rocket}>
    <input
      type="url"
      value={form.destination_url || ''}
      onChange={e => fieldChange('destination_url', e.target.value)}
      placeholder="https://mybrand.com/summer-sale"
      className={inputCls()}
    />
  </Field>
  ```

---

## 2. Archived / Unused Frontend Components & Hooks

### 2.1 `NotificationDropdown.tsx`
* **File Path (Archived):** `_feature_archive_v1/frontend/components/NotificationDropdown.tsx` (254 lines)
* **Purpose & Props:**
  A real-time notification bell dropdown for the top navigation bar.
  * **Props:** None (self-contained client component).
  * Subscribes to Supabase Realtime WebSocket changes on table `public.notifications` (`INSERT` and `UPDATE` events filtered by `user_id`).
  * Queries past 30 days of unread notifications on mount.
  * Displays notification unread badge count with emerald glow.
  * Categorizes alerts with custom color-coded icons:
    * `success`: CheckCircle2 (emerald)
    * `warning`: AlertCircle (amber)
    * `error`: XCircle (rose)
    * `info`: Info (blue)
  * Supports "Mark all as read" (Supabase batch update) and single-click read-and-redirect via `link_url`.
* **Where It Used to Live:**
  Mounted inside the top-right header of `influencertrack-frontend/components/DashboardLayout.tsx` directly to the left of the theme toggle and profile dropdown.
* **Restoration Steps:**
  1. Copy `_feature_archive_v1/frontend/components/NotificationDropdown.tsx` to `influencertrack-frontend/components/NotificationDropdown.tsx`.
  2. Import and mount it inside `DashboardLayout.tsx`:
     ```tsx
     import { NotificationDropdown } from '@/components/NotificationDropdown';
     // In header JSX:
     <NotificationDropdown />
     ```

---

### 2.2 `DayViewModal.tsx`
* **File Path:** `influencertrack-frontend/components/DayViewModal.tsx` (104 lines)
* **Purpose & Props:**
  * **Props:**
    * `isOpen: boolean`
    * `onClose: () => void`
    * `dateStr: string | null` (Format: `YYYY-MM-DD`)
    * `campaigns: Campaign[]`
    * `onSelectCampaign: (campaign: Campaign) => void`
  * Renders a modal listing all campaigns due on a specific calendar day. Displays creator avatars, platform icons, deliverables, payment amounts, and status badges.
* **Current State:**
  Orphaned. The file exists in `components/`, but is not imported anywhere because the Calendar page was archived.
* **Intended Location:**
  Used exclusively by `calendar/page.tsx` when a day grid item is clicked.

---

### 2.3 `useCalendarStats.ts`
* **File Path:** `influencertrack-frontend/hooks/useCalendarStats.ts` (60 lines)
* **Purpose & Arguments:**
  * **Input:** `(campaigns: Campaign[], currentDate: Date)`
  * **Output:** Object containing:
    * `monthTotalDeliverables: number`
    * `monthCompletedDeliverables: number`
    * `monthOverdueDeliverables: number`
    * `upcomingSevenDaysCount: number`
* **Current State:**
  Orphaned hook. Not imported anywhere in active code.
* **Intended Location:**
  Used by `calendar/page.tsx` for header metric cards.

---

### 2.4 Orphaned Landing Page Components (`components/landing/`)
A prior iteration of the landing page used separate modular sections before being redesigned into dashboard-centric visual showcases. The following components remain in `influencertrack-frontend/components/landing/` but are **not imported in `app/page.tsx`**:

| Component Name | File Path | What It Does / Props | Replaced By / Status |
|---|---|---|---|
| `BeforeAfter.tsx` | `components/landing/BeforeAfter.tsx` | Split-screen text comparison between spreadsheet chaos and Collabo | Superseded by `BeforeAfterDashboard.tsx` |
| `BentoFeatures.tsx` | `components/landing/BentoFeatures.tsx` | Bento-grid layout of features (Magic Links, AI parsing, etc.) | Superseded by `BentoBenefits.tsx` |
| `HeroSection.tsx` | `components/landing/HeroSection.tsx` | Classic hero header with email input CTA | Superseded by `HeroLiveDemo.tsx` |
| `InteractiveShowcase.tsx`| `components/landing/InteractiveShowcase.tsx` | Interactive tabbed UI demo with clickable campaign status simulator | Orphaned; fully functional interactive demo |
| `MagicMomentTimeline.tsx`| `components/landing/MagicMomentTimeline.tsx` | Step-by-step visual timeline of a campaign from DM to payout | Orphaned |
| `PricingSection.tsx` | `components/landing/PricingSection.tsx` | Basic pricing cards | Superseded by `PremiumPricing.tsx` |
| `ProblemSection.tsx` | `components/landing/ProblemSection.tsx` | 3-column breakdown of spreadsheet fatigue | Superseded by `PainPointCards.tsx` |
| `QuickHowItWorks.tsx` | `components/landing/QuickHowItWorks.tsx` | 3-step simple icon flow | Superseded by `SimplifiedWorkflow.tsx` |
| `SocialProof.tsx` | `components/landing/SocialProof.tsx` | Logos and quote testimonials from Indian D2C brands | Orphaned |
| `LandingComponents.tsx` | `components/landing/LandingComponents.tsx` | Monolithic file holding legacy sub-components | Deprecated |

---

### 2.5 Deleted Authentication Pages (From Git History)
* **Commit:** `923e37425da57817342d441794be4eef0c3de956`
* **Deleted Files:**
  * `frontend/app/forgot-password/page.tsx`
  * `frontend/app/reset-password/page.tsx`
* **Why Removed:**
  Email password resets were simplified during development to rely on Supabase magic links and Google OAuth. The custom branded password reset and email confirmation screens were removed.

---

## 3. Backend Endpoints, Services & Cron Jobs (Unmounted or Stubbed)

### 3.1 Affiliate Link Tracker Engine (`tracker.py`)
* **File Path (Archived):** `_feature_archive_v1/backend/api/tracker.py` (138 lines)
* **Endpoint:** `GET /t/{short_code}`
* **Functionality:**
  A hardened URL redirection and click-attribution engine:
  1. **SSRF & Anti-Redirect Protection (`is_safe_url`):**
     * Validates URL scheme (`http`/`https`).
     * Prevents DNS rebinding and internal IP access (`localhost`, `127.0.0.1`, RFC-1918 private IPs).
     * Decodes decimal, octal, or hex obfuscated IP addresses (e.g. `0x7f000001` or `2130706433`) using `socket.inet_aton`.
  2. **Bot & Crawler Filtering:**
     * Inspects incoming `User-Agent`.
     * Ignores link previews and bots (Applebot, Googlebot, Bingbot, WhatsApp crawler, Telegram preview, Facebook External Hit, Twitterbot, Slackbot, Discordbot, curl, puppeteer).
  3. **Atomic Click Increment:**
     * Executes Supabase RPC `increment_campaign_clicks(p_short_code)` to atomically increment `campaigns.clicks`.
  4. **First-Click Notification with Redis Mutex:**
     * If `clicks == 0`, acquires a 30-day Redis lock `notif_first_click:{short_code}` using `SET NX EX`.
     * If acquired, triggers `create_notification()` alerting the brand owner: *"First Click Recorded! The tracking link for @creator just got its first click."*
  5. Returns HTTP `302 Found` redirecting the visitor to `destination_url`.
* **Current State:**
  * File deleted from `influencertrack-backend/app/api/tracker.py` in commit `82212bd`.
  * Trailing imports cleaned up in commit `3dfedeb`.
  * Preserved in `_feature_archive_v1/backend/api/tracker.py`.
* **How to Restore It:**
  1. Copy `_feature_archive_v1/backend/api/tracker.py` to `influencertrack-backend/app/api/tracker.py`.
  2. Mount the router in `influencertrack-backend/app/main.py`:
     ```python
     from app.api import tracker
     app.include_router(tracker.router)
     ```
  3. Re-execute `_feature_archive_v1/database/07_tracking_links.sql` in Supabase.

---

### 3.2 Telegram Bot Webhook Router (`telegram.py`)
* **File Path (Archived):** `_feature_archive_v1/backend/api/telegram.py` (469 lines)
* **Endpoint:** `POST /webhook/telegram`
* **Functionality:**
  Complete bidirectional Telegram bot integration:
  1. **Secret Header Verification:** Enforces `X-Telegram-Bot-Api-Secret-Token`.
  2. **Account Linking:** Supports `/start LINK-1234` deep linking. Resolves the 4-digit pairing code from Redis and links `telegram_chat_id` and `telegram_username` to the brand's `user_settings` record.
  3. **Multimodal AI Extraction:** Downloads photos, voice notes, and documents directly from Telegram Bot API servers (up to 16MB) and streams them into Google Gemini 3.5 Flash for campaign extraction.
  4. **Interactive Inline Keyboard Menus:**
     * Replies with formatted campaign summaries and buttons: `[Approve ✅]`, `[Edit ✏️]`, `[Reject ❌]`.
     * Handles `callback_query` events allowing users to modify deadlines, payment amounts, and statuses directly in chat without opening the web dashboard.
  5. **Deduplication:** Inserts `update_id` into `public.webhook_events` to prevent duplicate processing during Telegram retry storms.
* **Current State:**
  * Unmounted and deleted in commit `4cec9b2`.
  * **Traces Remaining:**
    1. `influencertrack-backend/app/services/telegram.py` is **still present** in the backend (provides `send_telegram_message` and `download_telegram_media`).
    2. Endpoints `POST /settings/telegram/generate-code` and `POST /settings/telegram/unlink` are **still active** in `influencertrack-backend/app/api/settings.py` (lines 259–296).
    3. `generateTelegramCode` and `unlinkTelegram` are **still present** in `influencertrack-frontend/lib/api.ts` (lines 280–288).
* **How to Restore It:**
  1. Copy `_feature_archive_v1/backend/api/telegram.py` to `influencertrack-backend/app/api/telegram.py`.
  2. Mount the router in `influencertrack-backend/app/main.py`:
     ```python
     from app.api import telegram
     app.include_router(telegram.router)
     ```
  3. Set `TELEGRAM_BOT_TOKEN` in Render environment variables.
  4. Restore the Telegram UI section in `influencertrack-frontend/app/(dashboard)/settings/page.tsx`.

---

### 3.3 Stubbed Monthly Report Background Job (`monthly_report_job`)
* **File Path:** `influencertrack-backend/app/main.py` (lines 195–208)
* **Current Code:**
  ```python
  # Optional: Schedule monthly report generation
  # Runs on the 1st of every month at 00:00 UTC
  async def monthly_report_job():
      logger.info("Starting monthly report background job...")
      # Add logic here to iterate over users and email reports if desired
      pass

  scheduler.add_job(
      monthly_report_job,
      "cron",
      day=1,
      hour=0,
      minute=0,
      id="monthly_report_job",
      replace_existing=True,
  )
  ```
* **Functionality:**
  Intended to run on the 1st of every calendar month at 00:00 UTC to generate automated PDF/Excel summaries of influencer ROI, spending, and completed deliverables and email them to brand owners.
* **Current State:**
  The APScheduler cron registration is live, but the function body is a stubbed `pass`. (Note: The manual report generation endpoint `GET /campaigns/reports/monthly` in `app/api/reports.py` is fully implemented and works via client download).

---

### 3.4 Active Backend Notifications with Missing Frontend Viewer
* **File Path:** `influencertrack-backend/app/services/notifications.py`
* **Functionality:**
  Provides `create_notification(service_client, user_id, title, message, type, link_url)` to write alerts into `public.notifications`.
* **Current State:**
  * Actively invoked across backend routines:
    * `app/api/uploads.py` (line 63): Notifies brand when creator submits proof via Magic Link.
    * `app/api/settings.py` (line 99): Notifies brand when WhatsApp connection succeeds.
    * `app/services/reminders.py` (lines 556, 658): Notifies brand when campaign deadlines are 48h away or overdue.
    * `app/api/campaigns.py` (line 300): Notifies brand upon bulk campaign actions.
  * **The Forensic Flaw:** The backend is diligently recording notifications to PostgreSQL, but because `NotificationDropdown.tsx` was deleted in commit `82212bd`, **users cannot view or interact with any notifications in the UI**.

---

## 4. Database Columns & Tables Built for Archived Features

The following database tables and schema columns exist in SQL migrations but are either unrendered, uncalled, or orphaned from the active user interface:

### 4.1 Database Columns

| Column Name | Table | Added In Migration | Purpose / Original Intent | Current UI State |
|---|---|---|---|---|
| `health_score` | `campaigns` | `supabase_migrations_v6.sql` (Line 7) | Categorized campaign risk (`'Healthy'`, `'At Risk'`, `'Critical'`) based on creator responsiveness | Defaults to `'Healthy'`; never displayed or edited in frontend |
| `short_code` | `campaigns` | `07_tracking_links.sql` & `_v2.sql` | 6-character unique identifier for URL redirection (`/t/{short_code}`) and Magic Links (`/submit-proof?c=...`) | Still generated for Magic Links, but redirection engine was deleted |
| `clicks` | `campaigns` | `07_tracking_links.sql` & `_v2.sql` | Atomic counter tracking visitor clicks on creator affiliate links | Incremented by RPC `increment_campaign_clicks`; hidden from UI |
| `destination_url` | `campaigns` | `07_tracking_links.sql` & `_v2.sql` | Target redirect URL (e.g. brand store URL) | Removed from `EditCampaignModal.tsx`; hidden from UI |
| `proof_history` | `campaigns` | `09_add_proof_history.sql` (Line 7) | JSONB array storing previous deliverables when revisions are requested (`[{url, uploaded_at}]`) | Stored in DB, but history drawer removed from `CampaignTable.tsx` |
| `telegram_chat_id` | `user_settings` | `supabase_migrations_v5.sql` (Line 5) | Telegram chat ID for proactive deadline alerts | Telegram router unmounted; unused |
| `telegram_username`| `user_settings` | `supabase_migrations_v4.sql` (Line 4) | Telegram handle for bot matching | Settings UI card removed; endpoints still save it |
| `notification_preferences` | `user_settings` | `supabase_migrations_v6.sql` (Line 10) | JSONB dictionary for custom alert frequency and channel toggles | No UI settings exist to configure this column |
| `reminder_48h_sent`| `campaigns` | `06_reminders_schema.sql` (Line 7) | Boolean flag preventing duplicate 48h deadline reminders | Fully utilized by backend `reminders.py`, not displayed in UI |
| `overdue_alert_sent`| `campaigns`| `06_reminders_schema.sql` (Line 8) | Boolean flag preventing duplicate overdue alerts | Fully utilized by backend `reminders.py`, not displayed in UI |

---

### 4.2 Database Tables

| Table Name | Defined In | Purpose | Status in Current Application |
|---|---|---|---|
| `public.campaign_events` | `supabase_migrations_v6.sql` (Lines 12–43) | Stores an activity audit log / timeline of status updates, proof submissions, and reminder dispatches with RLS policies | Fully migrated with RLS; no backend endpoint or frontend view currently reads or writes to it |
| `public.notifications` | `_feature_archive_v1/database/11_notifications.sql` & `12_notifications_grants.sql` | Stores user-facing in-app alerts with Realtime publication support and `cleanup_old_notifications()` | Actively populated by backend services; completely invisible in frontend UI |
| `public.influencer_profiles` | `02_phase2_schema.sql` (Lines 10–37) | Stores unique creator CRM records (`handle`, `platform`, `name`, `notes`) | Active via `/influencers` route |
| `public.webhook_events` | `14_webhook_cleanup.sql` | Prevents replay attacks and duplicate webhook deliveries from Meta and Telegram | Active in WhatsApp webhook; Telegram logic unmounted |

---

## 5. Deleted Features Found in Git History or Documentation

### 5.1 Telegram Bot Integration
* **Reference:** Commit `4cec9b2a7c711af0d840649084af240cf25bdf32` ("refactor: gracefully archive and remove Telegram integration to declutter UI and backend") and `DOCUMENTATION.md` Section 4.B.
* **What Was Removed:**
  * Backend API route `app/api/telegram.py` (468 lines).
  * Webhook mount `app.include_router(telegram.router)` in `app/main.py`.
  * Telegram connection card, username input, and pairing code generator in `influencertrack-frontend/app/(dashboard)/settings/page.tsx`.
* **Rationale for Removal:**
  Indian D2C brands and micro-influencers conduct >95% of communication on WhatsApp. Maintaining a parallel Telegram bot added cognitive clutter to the settings UI and duplicate webhook maintenance.

---

### 5.2 Content Calendar View
* **Reference:** Commit `835c57225a2ae4799965e46a0a12f3e8bba8744b` ("refactor: gracefully archive Calendar view to simplify frontend") and Commit `35e84cc42ec3d274bfd9338f36c533e498c41ec3`.
* **What Was Removed:**
  * Route file `influencertrack-frontend/app/(dashboard)/calendar/page.tsx`.
  * Sidebar navigation entry in `DashboardLayout.tsx`.
* **Rationale for Removal:**
  Users prioritized the central table view with bulk actions and quick status filters. The calendar was deemed non-essential for Phase 1 MVP launch.

---

### 5.3 Click Tracking & Affiliate Attribution Engine
* **Reference:** Commit `82212bdad9658fdd65d280e7965c10afd4671818` ("refactor: forcefully archive tracking, notifications, and proof history features") and Commit `3dfedeb`.
* **What Was Removed:**
  * Backend router `app/api/tracker.py` (`/t/{short_code}`).
  * `07_tracking_links.sql` migration.
  * Destination URL input in `EditCampaignModal.tsx`.
  * Link Analytics modal and "Copy Link" action in `CampaignTable.tsx`.
* **Rationale for Removal:**
  Tracking link redirection requires configuring custom subdomains (e.g. `clk.mycollabo.online`) and handling bot crawling. Archived to focus on core workflow automation (AI extraction → reminders → proof).

---

### 5.4 In-App Realtime Notification System
* **Reference:** Commit `82212bdad9658fdd65d280e7965c10afd4671818`.
* **What Was Removed:**
  * Frontend bell icon dropdown `components/NotificationDropdown.tsx`.
  * `11_notifications.sql` migration file (though `12_notifications_grants.sql` was left behind).
* **Rationale for Removal:**
  Email and WhatsApp alerts already notify users directly on their phones. Removing the bell icon simplified the top bar.

---

### 5.5 Proof Submission Revision History Drawer
* **Reference:** Commit `82212bdad9658fdd65d280e7965c10afd4671818`.
* **What Was Removed:**
  * Multi-version submission popover in `CampaignTable.tsx`.
  * `09_add_proof_history.sql` migration file.
* **Rationale for Removal:**
  Streamlined table rows to only display the latest active `proof_url`.

---

### 5.6 Automated Monthly Report Emailing
* **Reference:** `influencertrack-backend/app/main.py` line 195.
* **What Was Removed / Deferred:**
  * Background job `monthly_report_job` was registered in APScheduler, but implementation was deferred (`pass`).
* **Rationale for Removal:**
  Users can generate and download monthly reports on-demand via the Analytics tab (`GET /campaigns/reports/monthly`).

---

### 5.7 Direct Creator Payouts (RazorpayX / IMPS)
* **Reference:** `DOCUMENTATION.md` Section 8 ("Weaknesses / Areas for Improvement - No Direct Payment Gateway (Yet)").
* **What Was Removed / Deferred:**
  * Automated banking payout integration. Collabo tracks whether a campaign is `paid` via status state machine, but the actual transfer of funds is handled manually by the brand via bank transfer/UPI.

---

## 6. Quick-Restore Matrix

The following matrix provides a prioritization and effort ranking to restore any or all of the archived features:

| Feature Name | Category | Completeness | Effort to Restore | Exact Files Involved |
|---|---|---|---|---|
| **Content Calendar (`/calendar`)** | UI / Frontend | 100% | **Easy** (<15 mins) | • Copy `_feature_archive_v1/frontend/app/(dashboard)/calendar/page.tsx` → `influencertrack-frontend/app/(dashboard)/calendar/page.tsx`<br>• Add to `navItems` in `DashboardLayout.tsx`<br>• (Already has `DayViewModal.tsx` & `useCalendarStats.ts`) |
| **In-App Realtime Notifications** | UI / Frontend | 100% | **Easy** (<15 mins) | • Copy `_feature_archive_v1/frontend/components/NotificationDropdown.tsx` → `influencertrack-frontend/components/`<br>• Mount in `DashboardLayout.tsx`<br>• Backend services are *already* creating notifications! |
| **Platform Admin Analytics** | UI / Frontend | 95% | **Easy** (<10 mins) | • Add menu link in `influencertrack-frontend/components/ProfileDropdown.tsx`<br>• Page is already built at `app/admin/analytics/page.tsx` |
| **Link Analytics Modal & Tracking** | UI / Backend | 100% | **Medium** (<30 mins) | • Copy `_feature_archive_v1/backend/api/tracker.py` → `influencertrack-backend/app/api/tracker.py`<br>• Mount in `main.py`<br>• Restore modal in `CampaignTable.tsx`<br>• Restore `destination_url` input in `EditCampaignModal.tsx` |
| **Proof Revision History Drawer** | UI / Frontend | 100% | **Easy** (<15 mins) | • Re-insert popover JSX in `CampaignTable.tsx` (from git commit `82212bd` diff) |
| **Telegram Bot Integration** | Bot / Backend | 95% | **Medium** (<45 mins) | • Copy `_feature_archive_v1/backend/api/telegram.py` → `influencertrack-backend/app/api/telegram.py`<br>• Mount in `main.py`<br>• Add `TELEGRAM_BOT_TOKEN` in Render `.env`<br>• Re-insert Telegram card in `settings/page.tsx` |
| **Monthly Email Reports Cron Job** | Backend Job | 40% | **Medium** (<1 hour) | • Implement user loop in `monthly_report_job` in `app/main.py`<br>• Call `generate_pdf_report()` and send via Resend |
| **Campaign Activity Timeline** | DB / UI | 30% | **Hard** (2–3 hours) | • `campaign_events` table exists in Supabase<br>• Need backend API in `campaigns.py`<br>• Need frontend Timeline component in `CampaignTable.tsx` |

---

## Conclusion & Architectural Recommendation

Collabo's codebase contains an exceptionally well-engineered set of archived modules. Because the core author adopted a disciplined archiving strategy (preserving snapshots in `_feature_archive_v1/` and keeping data structures active in `types.ts` and `user_settings`), **almost every single archived feature can be fully restored in under an hour** without database schema redesigns or regressions.
