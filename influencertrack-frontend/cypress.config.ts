import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1440,
    viewportHeight: 900,
    video: false,
    screenshotOnRunFailure: true,
    chromeWebSecurity: false,
    defaultCommandTimeout: 10000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    env: {
      API_URL: process.env.CYPRESS_API_URL || 'http://localhost:10000',
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://icwwdjirxvggzrfbpoia.supabase.co',
      TEST_EMAIL: process.env.CYPRESS_TEST_EMAIL || 'test@mycollabo.online',
      TEST_PASSWORD: process.env.CYPRESS_TEST_PASSWORD || 'TestPassword123!',
    },
    setupNodeEvents(on, config) {
      return config;
    },
  },
});
