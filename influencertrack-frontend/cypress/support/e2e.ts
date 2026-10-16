// Import custom commands
import './commands';

// Ignore benign hydration / cross-origin script errors in Next.js
Cypress.on('uncaught:exception', (err) => {
  if (
    err.message.includes('Hydration') ||
    err.message.includes('Minified React error') ||
    err.message.includes('ResizeObserver') ||
    err.message.includes('Script error.')
  ) {
    return false;
  }
  return true;
});
