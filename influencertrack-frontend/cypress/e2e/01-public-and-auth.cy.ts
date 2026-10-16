describe('01 - Public Landing Page & Passwordless Auth Flow', () => {
  beforeEach(() => {
    // Clear cookies & storage to ensure clean public session
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  it('renders landing page with Hero, ROI Calculator slider, and Pricing', () => {
    cy.visit('/');

    // 1. Verify Branding & Header
    cy.contains('Collabo').should('be.visible');
    cy.contains('Log in').should('be.visible');
    cy.contains('Start Free Trial').should('be.visible');

    // 2. Verify Hero Live Demo section
    cy.contains(/From WhatsApp Chaos/i).should('be.visible');
    cy.contains(/to Campaign Clarity/i).should('be.visible');

    // 3. Verify ROI Calculator and test slider interaction
    cy.contains('Calculate your ROI').scrollIntoView().should('be.visible');
    cy.get('input[type="range"]')
      .should('be.visible')
      .invoke('val', 50)
      .trigger('input')
      .trigger('change');

    cy.contains('50').should('be.visible');
    cy.contains(/Est\. Hours Saved/i).should('be.visible');

    // 4. Verify Premium Pricing section
    cy.contains(/Simple, transparent pricing|Pick your plan|Pricing/i).scrollIntoView().should('be.visible');
  });

  it('navigates to passwordless login and verifies 6-digit OTP input auto-advance', () => {
    cy.visit('/login');

    // Verify login screen elements
    cy.contains('Welcome to Collabo').should('be.visible');
    cy.contains('Sign in or create your account.').should('be.visible');
    cy.get('input[type="email"]').should('be.visible').and('have.attr', 'placeholder', 'you@brand.com');

    // Intercept Supabase OTP API
    cy.intercept('POST', '**/auth/v1/otp*', {
      statusCode: 200,
      body: {},
    }).as('sendOtpCall');

    // Enter email and submit
    cy.get('input[type="email"]').type('creator_brand@example.com');
    cy.contains('button', 'Continue with Email').should('not.be.disabled').click();

    cy.wait('@sendOtpCall');

    // Verify OTP view is shown
    cy.contains('Check your inbox').should('be.visible');
    cy.contains('creator_brand@example.com').should('be.visible');

    // Verify 6 OTP inputs are rendered
    cy.get('input[maxlength="1"]').should('have.length', 6);

    // Verify auto-advance focus behavior
    cy.get('input[maxlength="1"]').first().focus().type('1');
    cy.focused().should('have.value', '').type('2');
    cy.focused().should('have.value', '').type('3');
    cy.focused().should('have.value', '').type('4');
    cy.focused().should('have.value', '').type('5');
    cy.focused().should('have.value', '').type('6');

    // Verify verify code button is active
    cy.contains('button', 'Verify Code').should('not.be.disabled');
  });
});
