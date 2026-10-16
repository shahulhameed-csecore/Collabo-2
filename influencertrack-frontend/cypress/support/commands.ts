/// <reference types="cypress" />

const TEST_USER = {
  id: 'test-user-id-001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'test@mycollabo.online',
  email_confirmed_at: '2026-01-01T00:00:00Z',
  phone: '',
  confirmed_at: '2026-01-01T00:00:00Z',
  last_sign_in_at: new Date().toISOString(),
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { name: 'Test Brand', full_name: 'Test Brand' },
  identities: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const TEST_SESSION = {
  access_token: 'cypress-test-mock-access-token-xyz',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'cypress-test-mock-refresh-token-xyz',
  user: TEST_USER,
};

Cypress.Commands.add('loginAsTestUser', () => {
  // 1. Edge Middleware Auth Cookie (proxy.ts)
  cy.setCookie('collabo-test-session', encodeURIComponent(JSON.stringify(TEST_USER)), {
    domain: 'localhost',
    path: '/',
    httpOnly: false,
    secure: false,
  });

  // 2. Supabase SSR auth cookies
  const base64Session = `base64-${btoa(JSON.stringify(TEST_SESSION))}`;
  cy.setCookie('sb-icwwdjirxvggzrfbpoia-auth-token', base64Session, {
    domain: 'localhost',
    path: '/',
    httpOnly: false,
    secure: false,
  });

  // 3. Inject Supabase session into localStorage for browser client (createBrowserClient)
  cy.on('window:before:load', (win) => {
    win.localStorage.setItem('sb-icwwdjirxvggzrfbpoia-auth-token', JSON.stringify(TEST_SESSION));
  });

  // 4. Intercept Supabase Auth & Account queries
  cy.intercept('GET', '**/auth/v1/user*', {
    statusCode: 200,
    body: TEST_USER,
  }).as('getSupabaseUser');

  cy.intercept('POST', '**/auth/v1/token*', {
    statusCode: 200,
    body: TEST_SESSION,
  }).as('postSupabaseToken');

  cy.intercept('GET', '**/rest/v1/subscriptions*', {
    statusCode: 200,
    body: [
      {
        tier: 'pro',
        trial_ends_at: '2026-11-15T00:00:00Z',
        is_paid: true,
      },
    ],
  }).as('getSubscriptions');

  cy.intercept('GET', '**/rest/v1/user_settings*', {
    statusCode: 200,
    body: [
      {
        username: 'Test Brand',
      },
    ],
  }).as('getUserSettings');
});

Cypress.Commands.add('setupDashboardMocks', () => {
  // 1. Ensure user is logged in
  cy.loginAsTestUser();

  // 2. Intercept backend Campaigns API
  cy.intercept('GET', '**/campaigns/?*', { fixture: 'campaigns.json' }).as('getCampaignsQuery');
  cy.intercept('GET', '**/campaigns/', { fixture: 'campaigns.json' }).as('getCampaigns');
  cy.intercept('GET', '**/campaigns', { fixture: 'campaigns.json' }).as('getCampaignsNoSlash');

  cy.intercept('POST', '**/campaigns/', (req) => {
    const payload = req.body;
    req.reply({
      statusCode: 201,
      body: {
        id: `c-new-${Date.now()}`,
        user_id: TEST_USER.id,
        influencer_name: payload.influencer_name || 'New Creator',
        influencer_handle: payload.influencer_handle,
        platform: payload.platform || 'Instagram',
        deliverables: payload.deliverables || '1 Post',
        deadline: payload.deadline || '2026-10-30',
        payment_amount: payload.payment_amount || 0,
        special_notes: payload.special_notes || '',
        status: payload.status || 'draft',
        proof_url: null,
        proof_history: null,
        magic_link_token: `token-${Date.now()}`,
        destination_url: payload.destination_url || null,
        short_code: `cd${Date.now().toString().slice(-4)}`,
        clicks: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
  }).as('createCampaign');

  cy.intercept('PUT', '**/campaigns/*', (req) => {
    req.reply({
      statusCode: 200,
      body: {
        ...req.body,
        id: req.url.split('/').pop(),
        updated_at: new Date().toISOString(),
      },
    });
  }).as('updateCampaign');

  cy.intercept('PATCH', '**/campaigns/*/status', (req) => {
    req.reply({
      statusCode: 200,
      body: {
        status: req.body.status,
        updated_at: new Date().toISOString(),
      },
    });
  }).as('updateCampaignStatus');

  // 3. AI Extraction endpoint (Protects Gemini token quota)
  cy.intercept('POST', '**/extract/', { fixture: 'extracted_campaign.json' }).as('extractWithAi');
  cy.intercept('POST', '**/extract', { fixture: 'extracted_campaign.json' }).as('extractWithAiNoSlash');

  // 4. Billing usage
  cy.intercept('GET', '**/billing/usage', { fixture: 'billing_usage.json' }).as('getBillingUsage');

  // 5. Settings / WhatsApp
  cy.intercept('GET', '**/settings/whatsapp', { fixture: 'settings_whatsapp.json' }).as('getWhatsAppSettings');
  cy.intercept('POST', '**/settings/whatsapp/generate-code', {
    statusCode: 200,
    body: { code: 'LINK-4892' },
  }).as('generateWhatsAppCode');
  cy.intercept('POST', '**/settings/whatsapp', (req) => {
    req.reply({
      statusCode: 200,
      body: {
        message: 'Settings updated successfully',
        ...req.body,
        whatsapp_verified: true,
      },
    });
  }).as('saveWhatsAppSettings');
  cy.intercept('POST', '**/settings/whatsapp/verify', {
    statusCode: 200,
    body: { message: 'Verification successful' },
  }).as('verifyWhatsApp');

  // 6. Influencers CRM
  cy.intercept('GET', '**/influencers/', { fixture: 'influencers.json' }).as('getInfluencers');
  cy.intercept('GET', '**/influencers', { fixture: 'influencers.json' }).as('getInfluencersNoSlash');
  cy.intercept('PATCH', '**/influencers/*', (req) => {
    req.reply({
      statusCode: 200,
      body: {
        handle: req.url.split('/').pop(),
        notes: req.body.notes,
        name: 'Updated Creator',
        platform: 'Instagram',
        total_campaigns: 3,
        success_rate: 100,
        last_collaboration: new Date().toISOString(),
      },
    });
  }).as('updateInfluencerNotes');

  // 7. Supabase notifications
  cy.intercept('GET', '**/rest/v1/notifications*', { fixture: 'notifications.json' }).as('getNotifications');
  cy.intercept('PATCH', '**/rest/v1/notifications*', {
    statusCode: 200,
    body: [],
  }).as('markNotificationsRead');

  // 8. Public Creator Proof Upload
  cy.intercept('POST', '**/campaigns/*/upload-proof', {
    statusCode: 200,
    body: { message: 'Proof uploaded successfully!' },
  }).as('uploadProof');
});
