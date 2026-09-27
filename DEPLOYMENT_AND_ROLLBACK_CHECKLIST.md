# Deployment and Rollback Checklist

This document details the exact steps required to safely deploy the remediated Collabo application to production and gracefully roll back if issues arise.

---

## 1. Pre-Deployment (Staging)

- [ ] **Dependency Verification**: Verify that backend dependencies (`structlog`, `slowapi`) are correctly declared in `requirements.txt`.
- [ ] **Environment Variables**:
  - Ensure `WHATSAPP_APP_SECRET` and `WHATSAPP_WEBHOOK_VERIFY_TOKEN` are populated securely in the production environment.
  - Verify `TELEGRAM_WEBHOOK_SECRET` is properly set.
- [ ] **Local Build Test**: Run `npm run build` in the frontend directory to ensure the new Next.js dynamic imports compile properly.
- [ ] **Type Checking**: Verify `tsc --noEmit` passes successfully in the frontend given the new `PaginatedCampaigns` schema definitions.

## 2. Database Migration

- [ ] Connect to the production Supabase project via the Supabase CLI or SQL Editor.
- [ ] Execute `supabase_migrations/13_add_campaign_indexes.sql`.
- [ ] Verify index creation by running:
  ```sql
  SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'campaigns';
  ```

## 3. Backend Deployment (FastAPI on Render/Vercel)

- [ ] Trigger deployment from the main branch.
- [ ] **Smoke Test**: Once live, verify `GET /api/v1/health` returns `200 OK`.
- [ ] **Test Webhooks**: Send a test WhatsApp and Telegram message to the respective bots and verify processing via server logs.
- [ ] Monitor CPU and memory usage graphs to confirm that threading mitigations for `gemini.py` are active and preventing CPU lockups.

## 4. Frontend Deployment (Next.js on Vercel)

- [ ] Trigger deployment from the main branch.
- [ ] **Smoke Test**: Navigate to `/dashboard` and verify that the campaign list loads successfully.
- [ ] **Smoke Test**: Navigate to `/dashboard/analytics` and verify that the Recharts dynamic chunk downloads correctly without console errors.

---

## 5. Rollback Procedure

If severe regressions occur (e.g., webhook failure, 500 API errors):

### Backend & Frontend Code Reversion
1. Immediately revert the deployment to the previous known-good commit via Vercel / Render dashboards.
2. Confirm that the application API endpoints reflect the previous state.

### Database Reversion
If the added indexes cause unexpected locks (highly unlikely for `CREATE INDEX CONCURRENTLY`, but as a precaution):
1. Connect to the Supabase SQL editor.
2. Drop the newly created indexes:
   ```sql
   DROP INDEX IF EXISTS idx_campaigns_user_id;
   DROP INDEX IF EXISTS idx_campaigns_status;
   DROP INDEX IF EXISTS idx_campaigns_platform;
   DROP INDEX IF EXISTS idx_campaigns_created_at;
   DROP INDEX IF EXISTS idx_campaigns_deadline;
   ```

### Post-Rollback Investigation
- Aggregate backend logs via Sentry to identify the root cause of the regression.
- Validate the rollback state by observing the resolution of previously failing metrics.
