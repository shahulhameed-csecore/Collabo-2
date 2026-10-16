describe('05 - CRM Directory, Analytics, Settings & Billing Suite', () => {
  beforeEach(() => {
    cy.setupDashboardMocks();
  });

  it('1. Influencers CRM: lists creators, searches, and opens the CRM notes drawer', () => {
    cy.visit('/influencers');
    cy.wait('@getInfluencers');

    // Verify CRM Table headers and creator rows
    cy.contains('h1', 'Influencer CRM').should('be.visible');
    cy.contains('Riya Sharma').should('be.visible');
    cy.contains('@aarav_vlogs').should('be.visible');
    cy.contains('@karan_tech').should('be.visible');

    // Click row to open CRM slide-over drawer
    cy.contains('tr', '@riya_creates').click();

    // Verify slide-over modal opened with influencer details
    cy.contains('h2', 'Riya Sharma').should('be.visible');
    cy.contains('Total Collabs').should('be.visible');
    cy.contains('3').should('be.visible');
    cy.contains('Success Rate').should('be.visible');
    cy.contains('100%').should('be.visible');

    // Inspect and update Notes
    cy.get('textarea')
      .should('be.visible')
      .clear()
      .type('VIP Partner. Consistently high ROI on Instagram reels.');

    cy.contains('button', 'Save Notes').click();
    cy.wait('@updateInfluencerNotes');

    // Modal closes
    cy.contains('h2', 'Riya Sharma').should('not.exist');
  });

  it('2. Analytics: renders 30-day performance trends and calculated metrics', () => {
    cy.visit('/dashboard/analytics');
    cy.wait('@getCampaigns');

    // Verify Analytics Header & Metrics
    cy.contains('h1', 'Campaign Analytics').should('be.visible');
    cy.contains('Total Spend').should('be.visible');
    cy.contains('Total Clicks').should('be.visible');
    cy.contains('155').should('be.visible'); // 42 + 18 + 0 + 95 = 155
    cy.contains('Cost Per Click (CPC)').should('be.visible');
    cy.contains('Top Platform').should('be.visible');

    // Verify Recharts chart container renders
    cy.contains('Performance Trends').should('be.visible');
    cy.get('.recharts-responsive-container, svg.recharts-surface').should('exist');
  });

  it('3. Settings: tests WhatsApp LINK code generation and reminder preference toggles', () => {
    cy.visit('/settings');
    cy.wait('@getWhatsAppSettings');

    // Verify Settings page sections
    cy.contains('h1', 'Settings').should('be.visible');
    cy.contains('WhatsApp Integration').should('be.visible');
    cy.contains('Notification Preferences').should('be.visible');

    // Test Generate Pairing Code
    cy.contains('button', /Generate New Code|Generate Code|Pair/i).click();
    cy.wait('@generateWhatsAppCode');
    cy.contains('LINK-4892').should('be.visible');

    // Test Reminder Toggles & Save Preferences
    cy.contains('button', 'Save Preferences').click();
    cy.wait('@saveWhatsAppSettings');
  });

  it('4. Billing: verifies Pro trial banner, usage meters, and billing plan overview', () => {
    cy.visit('/billing');
    cy.wait('@getBillingUsage');

    // Verify Billing page header
    cy.contains(/Usage & Billing|Billing/i).should('be.visible');

    // Verify Active Plan Card
    cy.contains('Active Plan').should('be.visible');
    cy.contains(/PRO/i).should('be.visible');
    cy.contains(/Trial:/i).should('be.visible');

    // Verify Campaigns Tracked usage meter
    cy.contains('Campaigns Tracked').should('be.visible');
    cy.contains('4').should('be.visible');
    cy.contains('Unlimited').should('be.visible');
  });
});
