/// <reference types="cypress" />

export {};

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Authenticates the user in Next.js 16 SSR + Supabase context
       * by setting edge cookies, local storage, and intercepting auth endpoints.
       */
      loginAsTestUser(): Chainable<void>;

      /**
       * Intercepts backend FastAPI and Supabase endpoints with fixture data
       * ensuring deterministic, zero-flakiness dashboard operation.
       */
      setupDashboardMocks(): Chainable<void>;
    }
  }
}
