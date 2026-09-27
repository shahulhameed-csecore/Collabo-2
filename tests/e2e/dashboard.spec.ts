import { test, expect } from '@playwright/test';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Allow-Headers': '*',
};

test.describe('Dashboard Interactions', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Supabase getUser to accept our fake local storage token
    await page.route('**/auth/v1/user*', async route => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 200, headers: corsHeaders });
      }
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        json: { id: 'test-user', aud: 'authenticated', role: 'authenticated', email: 'test@collabo.com' }
      });
    });
  });

  test('displays empty state when no campaigns exist', async ({ page }) => {
    // Mock the backend response to simulate zero campaigns.
    await page.route('**/campaigns/**', async route => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 200, headers: corsHeaders });
      }
      await route.fulfill({ status: 200, headers: corsHeaders, json: { data: [], count: 0 } });
    });

    await page.goto('/dashboard');
    
    // Use robust accessible selectors based on actual UI text
    const emptyStateMessage = page.getByText(/No campaigns yet/i);
    const createBtn = page.getByRole('button', { name: /Create First Campaign/i }).first();

    // Explicitly wait for the message to ensure the page has loaded the mocked data
    await emptyStateMessage.waitFor({ state: 'visible', timeout: 15000 });

    // Assertions
    await expect(emptyStateMessage).toBeVisible();
    await expect(createBtn).toBeVisible();
  });

  test('mobile sidebar behavior', async ({ page, isMobile }) => {
    // Only run on mobile viewport
    if (!isMobile) return;
    
    await page.goto('/dashboard');
    
    // Check that sidebar/menu is hidden initially on mobile
    // Desktop sidebar has 'hidden lg:flex', mobile sidebar is not rendered until opened
    const desktopSidebar = page.locator('aside').first();
    if (await desktopSidebar.count() > 0) {
      await expect(desktopSidebar).not.toBeVisible();
    }
  });
});
