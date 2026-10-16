describe('02 - Dashboard KPIs, AI Campaign Extraction & Filtering', () => {
  beforeEach(() => {
    cy.setupDashboardMocks();
    cy.visit('/dashboard');
    cy.wait('@getCampaigns');
  });

  it('renders all 4 dashboard KPI cards and performance stats', () => {
    // 1. Verify KPI StatCards
    cy.get('#stat-total').within(() => {
      cy.contains('Total Campaigns').should('be.visible');
      cy.contains('4').should('be.visible');
    });

    cy.get('#stat-active').within(() => {
      cy.contains('Active Now').should('be.visible');
      cy.contains('1').should('be.visible');
    });

    cy.get('#stat-overdue').within(() => {
      cy.contains('Overdue').should('be.visible');
    });

    cy.get('#stat-spend').within(() => {
      cy.contains('Pending Spend').should('be.visible');
    });

    // 2. Verify sidebar Performance widget & upcoming deadlines
    cy.contains('Upcoming Deadlines').should('be.visible');
    cy.contains('Performance').should('be.visible');
    cy.contains('Success Rate').should('be.visible');
  });

  it('opens Create Campaign modal, extracts WhatsApp screenshot with AI without burning Gemini quota, and submits', () => {
    // Open modal via header shortcut
    cy.contains('button', 'New').click();

    // Verify modal header
    cy.contains('h2', 'New Campaign').should('be.visible');
    cy.contains('Upload a screenshot or fill manually').should('be.visible');

    // Upload a mock screenshot into dropzone
    const mockImage = {
      contents: Cypress.Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
      fileName: 'whatsapp_deal_chat.png',
      mimeType: 'image/png',
    };

    cy.get('input[type="file"]').first().selectFile(mockImage, { force: true });

    // Verify file name appears
    cy.contains('whatsapp_deal_chat.png').should('be.visible');

    // Trigger AI extraction (intercepted by cypress to preserve Gemini quota)
    cy.contains('button', 'Extract with AI').should('not.be.disabled').click();
    cy.wait('@extractWithAi');

    // Verify transition to Review step
    cy.contains('h2', 'Review & Confirm').should('be.visible');
    cy.contains(/AI extracted everything!/i).should('be.visible');

    // Verify auto-populated inputs from fixture
    cy.get('input[placeholder="@riya_creates"]').should('have.value', '@pooja_trends');
    cy.get('input[placeholder="Riya Sharma"]').should('have.value', 'Pooja Verma');
    cy.get('input[type="date"]').should('have.value', '2026-10-28');
    cy.get('input[placeholder="0 for gifted deal"]').should('have.value', '18000');
    cy.get('textarea[placeholder*="1 Reel"]').should('contain.value', '1 Reel + 2 Story frames');

    // Submit campaign
    cy.contains('button', /Save Campaign|Launch Campaign/i).click();
    cy.wait('@createCampaign');

    // Modal should close and success notification shown
    cy.contains('h2', 'Review & Confirm').should('not.exist');
  });

  it('tests status filtering tabs and search input in CampaignTable', () => {
    // Verify all 4 campaigns initially visible in table
    cy.contains('@riya_creates').should('be.visible');
    cy.contains('@aarav_vlogs').should('be.visible');
    cy.contains('@neha_style').should('be.visible');
    cy.contains('@karan_tech').should('be.visible');

    // Filter: Active
    cy.get('#status-filter-active').click();
    cy.contains('@riya_creates').should('be.visible');
    cy.contains('@aarav_vlogs').should('not.exist');
    cy.contains('@neha_style').should('not.exist');
    cy.contains('@karan_tech').should('not.exist');

    // Filter: In Review (content_received)
    cy.get('#status-filter-content_received').click();
    cy.contains('@aarav_vlogs').should('be.visible');
    cy.contains('@riya_creates').should('not.exist');

    // Filter: Paid
    cy.get('#status-filter-paid').click();
    cy.contains('@karan_tech').should('be.visible');
    cy.contains('@aarav_vlogs').should('not.exist');

    // Reset filter to All
    cy.get('#status-filter-all').click();
    cy.contains('@riya_creates').should('be.visible');
    cy.contains('@aarav_vlogs').should('be.visible');

    // Test Search input
    cy.get('#campaign-search').type('riya');
    cy.contains('@riya_creates').should('be.visible');
    cy.contains('@aarav_vlogs').should('not.exist');
    cy.contains('@neha_style').should('not.exist');
    cy.contains('@karan_tech').should('not.exist');

    // Clear search
    cy.get('#campaign-search').clear();
    cy.contains('@aarav_vlogs').should('be.visible');
    cy.contains('@karan_tech').should('be.visible');
  });
});
