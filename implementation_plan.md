# InfluencerTrack Frontend: Implementation Plan

## Overview
We are building a complete, production-grade Next.js 15 frontend for InfluencerTrack. This is a multi-tenant SaaS dashboard that sits on top of our hardened FastAPI backend and communicates with Supabase for authentication.

---

## User Review Required

> [!IMPORTANT]
> **Authentication Strategy:** The backend uses Supabase JWTs for all API calls (RLS enforced). The frontend needs to handle:
> 1. A **Login / Signup** page using the Supabase JS client.
> 2. Storing the JWT and attaching it to every `axios` call as `Authorization: Bearer <token>`.
> 3. Protecting all dashboard routes — redirect unauthenticated users to `/login`.
>
> **I will build the full login/signup flow unless you tell me otherwise.**

> [!IMPORTANT]
> **API Contract Correction:** Your specified endpoint `GET /campaigns/{user_id}` does not match our actual backend. Our backend uses `GET /campaigns/` (no user_id needed — the server reads the user from the JWT). I will use the correct endpoint.

---

## Open Questions

> [!WARNING]
> **Do you already have a Supabase project URL and `ANON_KEY` for the frontend?** We need these in the frontend's `.env.local` so the Supabase JS client can handle user sessions. The values are the same as in your backend `.env`.

---

## Proposed File Structure

```
influencertrack-frontend/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── dashboard/
│   │   └── page.tsx            ← Main dashboard
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── DashboardLayout.tsx
│   ├── CampaignTable.tsx
│   └── CreateCampaignModal.tsx
├── lib/
│   ├── api.ts                  ← Axios client
│   ├── supabase.ts             ← Supabase browser client
│   └── types.ts                ← All TypeScript interfaces
├── .env.local.example
└── next.config.ts
```

---

## Proposed Changes

### Phase 1: Project Scaffolding
#### [NEW] `influencertrack-frontend/` (full Next.js 15 project)
- Scaffold with `npx create-next-app@latest` using `--typescript`, `--tailwind`, `--app`, `--eslint` flags.
- Install: `axios`, `@supabase/supabase-js`, `lucide-react`, `sonner` (for toasts).
- Initialize `shadcn/ui` with the `neutral` base color.

---

### Phase 2: Foundation Layer
#### [NEW] `lib/types.ts`
All TypeScript interfaces: `Campaign`, `CampaignStatus`, `ExtractedData`, `CreateCampaignPayload`, `ApiError`.

#### [NEW] `lib/supabase.ts`
Supabase browser client factory using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

#### [NEW] `lib/api.ts`
Axios instance that reads the Supabase session and automatically injects the `Authorization: Bearer` header on every request. Handles 401s by redirecting to login.

---

### Phase 3: Auth Pages
#### [NEW] `app/(auth)/login/page.tsx`
Clean, branded login form using Supabase `signInWithPassword`. Redirects to `/dashboard` on success.

#### [NEW] `app/(auth)/signup/page.tsx`
Signup form for new brand accounts. Redirects to login after confirmation.

---

### Phase 4: Core Dashboard Components
#### [NEW] `components/DashboardLayout.tsx`
- Sidebar with logo, navigation links, and a user profile section at the bottom (avatar + email + sign out).
- Responsive: collapses to a hamburger menu on mobile.

#### [NEW] `components/CampaignTable.tsx`
- A rich, sortable table with color-coded status badges.
- `Green` = `active`, `Amber` = `draft`, `Rose/Red` = `overdue/cancelled`, `Slate` = `completed`.
- Full loading skeleton state (pulsing placeholder rows).
- A beautiful "no campaigns yet" empty state with a CTA to create the first one.
- Inline status update via a dropdown on each row.
- A delete button with a confirmation dialog.

#### [NEW] `components/CreateCampaignModal.tsx`
The star feature — a 3-step modal:
- **Step 1:** Drag-and-drop file upload zone. "Extract with AI" button with a loading state ("AI is analyzing your screenshot...").
- **Step 2:** Human-in-the-loop review form, pre-filled with AI-extracted data. Shows a clear amber warning banner with the missing/incomplete fields if `requires_human_review=true`. User can correct any fields.
- **Step 3:** Submits to `POST /campaigns/`. Closes modal with a success toast.

---

### Phase 5: Page Assembly
#### [NEW] `app/dashboard/page.tsx`
Wraps the `DashboardLayout` and renders `CampaignTable` + a floating action button to open `CreateCampaignModal`. Handles data fetching via `GET /campaigns/`.

#### [NEW] `app/layout.tsx`
Root layout with font config, `Toaster` (sonner), and a Supabase session provider.

---

## Verification Plan

### Automated Tests
- `npm run build` — Verify no TypeScript or linting errors in the final build.

### Manual Verification
1. Login with test account `shahulhameededit@gmail.com`.
2. Navigate to Dashboard — verify campaigns table loads.
3. Click "New Campaign" → upload a screenshot → verify AI auto-fills the form.
4. Edit a field, submit → verify the campaign appears in the table.
5. Change a campaign status → verify table updates instantly.
6. Resize browser to 375px width → verify mobile layout is clean.
