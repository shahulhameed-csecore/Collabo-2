describe('03 - Restored Platform Modules E2E Suite', () => {
  beforeEach(() => {
    cy.setupDashboardMocks();
    cy.visit('/dashboard');
    cy.wait('@getCampaigns');
  });

  it('1. Notification Bell: displays unread badge, lists items, and marks all as read', () => {
    // 1. Verify unread badge count (2 unread in notifications.json)
    cy.get('#notification-bell-btn').should('be.visible').within(() => {
      cy.get('span').should('contain.text', '2');
    });

    // 2. Open notification dropdown
    cy.get('#notification-bell-btn').click();

    // 3. Inspect notification header and items
    cy.contains('h3', 'Notifications').should('be.visible');
    cy.contains('2 New').should('be.visible');
    cy.contains('New Proof Uploaded').should('be.visible');
    cy.contains('@aarav_vlogs submitted proof of posting').should('be.visible');
    cy.contains('Deadline Alert (48h)').should('be.visible');

    // 4. Test "Mark all as read"
    cy.contains('button', 'Mark all as read').click();
    cy.wait('@markNotificationsRead');

    // Unread indicators should clear
    cy.contains('2 New').should('not.exist');
  });

  it('2. Proof Revision History Drawer: renders version history for content_received campaign', () => {
    // Locate the content_received row for @aarav_vlogs
    cy.contains('tr', '@aarav_vlogs').within(() => {
      cy.contains('In Review').should('be.visible');

      // The Clock icon for viewing history
      cy.get('button[title="View Proof History"]').should('be.visible');

      // Latest proof globe link with purple indicator
      cy.get('a[title="View Latest Proof of Posting"]')
        .should('be.visible')
        .and('have.attr', 'href', 'https://youtube.com/watch?v=sample-proof-latest');

      // Verify the Previous Submissions popover
      cy.get('.group\\/history, [class*="group/history"]').invoke('addClass', 'hover');
      cy.contains('Previous Submissions').should('be.exist');
      cy.contains('Version 1').should('be.exist');
      cy.contains('Version 2').should('be.exist');
    });
  });

  it('3. Content Calendar: navigates via sidebar, renders grid and stats, opens DayViewModal & EditCampaignModal', () => {
    // Navigate via sidebar calendar link
    cy.get('[id*="tour-nav-calendar"]').first().click();
    cy.url().should('include', '/calendar');
    cy.wait('@getCampaignsQuery');

    // Verify Calendar Header & useCalendarStats summary cards
    cy.contains('h1', 'Content Calendar').should('be.visible');
    cy.contains('Due Next 7 Days').should('be.visible');
    cy.contains('Overdue').should('be.visible');
    cy.contains('Total This Month').should('be.visible');

    // Verify day cell with deadlines renders campaign pill (e.g., Aarav Patel on day 18)
    cy.contains(/Aarav Patel|@aarav_vlogs/).should('be.visible');

    // Click day cell containing the event to open DayViewModal
    cy.contains(/Aarav Patel|@aarav_vlogs/).parents('.border-b.border-r').click();

    // Verify DayViewModal opened
    cy.contains('h3', 'Campaign Deadlines').should('be.visible');
    cy.contains('@aarav_vlogs').should('be.visible');

    // Click campaign inside DayViewModal to trigger EditCampaignModal
    cy.contains('button', /Edit Campaign Details|Aarav Patel/).first().click();

    // Verify EditCampaignModal rendered
    cy.contains('h2', 'Edit Campaign').should('be.visible');
    cy.get('#edit-campaign-form').should('be.visible');

    // Close modal
    cy.get('button').filter(':has(svg.lucide-x)').last().click();
    cy.contains('h2', 'Edit Campaign').should('not.exist');
  });

  it('4. Affiliate Link Tracking & Analytics Modal: verifies Destination URL input and click analytics modal', () => {
    // 1. Verify Destination URL input in EditCampaignModal
    cy.contains('tr', '@riya_creates').within(() => {
      cy.get('button[title*="Edit"]').click();
    });

    cy.contains('h2', 'Edit Campaign').should('be.visible');
    cy.contains('label', 'Destination URL (for Tracking Link)').should('be.visible');
    cy.get('input[type="url"]').should('have.value', 'https://mybrand.com/sale');

    // Close edit modal
    cy.get('button').filter(':has(svg.lucide-x)').last().click();

    // 2. Click the Click Analytics button in CampaignTable for @riya_creates
    cy.contains('tr', '@riya_creates').within(() => {
      // Button displays click count: 42 clicks
      cy.contains('button', '42 clicks').click();
    });

    // 3. Verify Link Analytics Modal contents
    cy.contains('h2', 'Link Analytics').should('be.visible');
    cy.contains('Riya Sharma').should('be.visible');
    cy.contains('Total Clicks').should('be.visible');
    cy.contains('42').should('be.visible');

    // Verify calculated CPC: ₹15000 / 42 = ₹357.14
    cy.contains('Cost Per Click (CPC)').should('be.visible');
    cy.contains('₹357.14').should('be.visible');

    // Verify Destination URL
    cy.contains('https://mybrand.com/sale').should('be.visible');

    // Close analytics modal
    cy.contains('button', 'Close Analytics').click();
    cy.contains('h2', 'Link Analytics').should('not.exist');

    // 4. Verify Copy Tracking Link button exists on row
    cy.contains('tr', '@riya_creates').within(() => {
      cy.contains('button', 'Copy Link').should('be.visible');
    });
  });
});
