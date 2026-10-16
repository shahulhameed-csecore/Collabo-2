describe('04 - Public Creator Portal (Magic Link Proof Upload)', () => {
  const token = 'test-magic-token-uuid';

  beforeEach(() => {
    // Clear all auth to verify public creator accessibility
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  it('allows creator to access portal without login and submit proof of posting', () => {
    // Intercept proof upload API
    cy.intercept('POST', `**/campaigns/${token}/upload-proof`, {
      statusCode: 200,
      body: { message: 'Proof uploaded successfully!' },
    }).as('submitProof');

    // 1. Visit public creator URL
    cy.visit(`/submit-proof/${token}`);

    // Verify page renders without redirecting to /login
    cy.url().should('include', `/submit-proof/${token}`);
    cy.contains('h1', 'Upload Proof of Posting').should('be.visible');
    cy.contains('Please upload your post screenshot or video').should('be.visible');

    // Submit button initially disabled
    cy.contains('button', 'Submit Proof').should('be.disabled');

    // 2. Select / Drag-and-drop a proof image
    const proofFile = {
      contents: Cypress.Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
      fileName: 'instagram_story_proof.png',
      mimeType: 'image/png',
    };

    cy.get('input[type="file"]').selectFile(proofFile, { force: true });

    // File name is displayed and submit button is enabled
    cy.contains('instagram_story_proof.png').should('be.visible');
    cy.contains('button', 'Submit Proof').should('not.be.disabled');

    // 3. Submit proof
    cy.contains('button', 'Submit Proof').click();
    cy.wait('@submitProof');

    // 4. Verify transition to Success Confirmation state
    cy.contains('h1', 'Proof Submitted!').should('be.visible');
    cy.contains('Thank you. The brand has been notified and will review your content shortly.').should('be.visible');
  });
});
