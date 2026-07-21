import { test, expect } from '@playwright/test';

test.describe('Campaign Management', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Supabase getUser to accept our fake local storage token
    await page.route('**/auth/v1/user*', async route => {
      await route.fulfill({
        status: 200,
        json: { id: 'test-user', aud: 'authenticated', role: 'authenticated', email: 'test@collabo.com' }
      });
    });

    // Mock campaigns endpoint to avoid hitting the real API and getting 401
    await page.route('**/campaigns/**', async route => {
      await route.fulfill({
        status: 200,
        json: { data: [], count: 0 }
      });
    });
  });

  test('creates a campaign manually', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    // Check if new campaign button exists and click it. 
    // Wait for empty state button or header button
    const newBtn = page.getByRole('button', { name: /New Campaign|Create First Campaign/i }).first();
    await newBtn.waitFor({ state: 'visible', timeout: 15000 });
    await newBtn.click();
        
    // Ensure Modal appears
    await expect(page.getByRole('heading', { name: /New Campaign/i })).toBeVisible();

    // Skip to manual entry if we are on the upload step
    const manualBtn = page.getByRole('button', { name: /Enter manually/i });
    if (await manualBtn.isVisible()) {
      await manualBtn.click();
    }

    // Fill out basic details
    await page.getByLabel(/Influencer Name/i).fill('Tech Guru');
    await page.getByLabel(/Handle/i).fill('@techguru');
    
    // Select platform (index 1 to skip placeholder)
    await page.getByLabel(/Platform/i).selectOption({ index: 1 });
    
    // Fill future deadline
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const dateStr = futureDate.toISOString().split('T')[0];
    await page.getByLabel(/Deadline/i).fill(dateStr);
    
    await page.getByLabel(/Payment/i).fill('50000');
    await page.getByLabel(/Deliverables/i).fill('1 YouTube Video');

    // Submit form
    const saveBtn = page.getByRole('button', { name: /Save Campaign/i });
    await saveBtn.click();

    // Verify success toast appears
    await expect(page.getByText(/Campaign created successfully/i)).toBeVisible({ timeout: 10000 });
  });

  test('AI Extraction handles errors gracefully', async ({ page }) => {
    // Mock the FastAPI AI extraction endpoint to fail
    await page.route('**/extract/**', async route => {
      await route.fulfill({ status: 500, json: { detail: "AI processing failed" } });
    });

    await page.goto('/dashboard');
    
    const newBtn = page.getByRole('button', { name: /New Campaign|Create First Campaign/i }).first();
    await newBtn.waitFor({ state: 'visible', timeout: 15000 });
    await newBtn.click();
        
    // Wait for the modal upload step
    await expect(page.getByText(/Drop your file or screenshot here/i)).toBeVisible();

    // Upload a dummy file to enable the AI extract button
    await page.setInputFiles('input[type="file"]', {
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('test image content')
    });
    
    const extractBtn = page.getByRole('button', { name: /Extract with AI/i });
    await extractBtn.waitFor({ state: 'visible' });
    await extractBtn.click();

    // Verify error toast or fallback is shown
    await expect(page.getByText(/AI extraction failed/i).or(page.getByText(/processing failed/i))).toBeVisible({ timeout: 10000 });
  });
});
