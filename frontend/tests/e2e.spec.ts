import { test, expect } from '@playwright/test';

test.describe('BudgetIQ E2E workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Setup generic route mocks so we don't need a running backend for E2E frontend state tests
    await page.route('**/api/config', async route => {
      await route.fulfill({ json: { auth_mode: 'dev', environment: 'development' } });
    });
    await page.route('**/api/auth/session', async route => {
      await route.fulfill({ json: { 
        user: { id: 'test', email: 'test@example.com' },
        organization: { id: 'org_123', name: 'Test Org' },
        role: 'admin'
      } });
    });
    // Set a fake auth token
    await page.addInitScript(() => {
      window.sessionStorage.setItem('budgetiq_access_token', 'fake-jwt-token');
    });
  });

  test('Dashboard loads and displays filters and empty states', async ({ page }) => {
    await page.route('**/api/budget-lines**', async route => {
      await route.fulfill({ json: { data: [], total: 0, page: 1 } });
    });
    
    await page.goto('/dashboard');
    await expect(page.locator('text=Dashboard').first()).toBeVisible();
    await expect(page.locator('text=No budget lines found')).toBeVisible();
  });

  test('Billing page renders customer portal buttons', async ({ page }) => {
    await page.route('**/api/billing', async route => {
      await route.fulfill({ json: { status: 'active', plan: 'pro', customer_id: 'cus_123' } });
    });
    await page.route('**/api/billing/invoices', async route => {
      await route.fulfill({ json: { data: [] } });
    });
    
    await page.goto('/billing');
    await expect(page.locator('text=Billing').first()).toBeVisible();
    await expect(page.locator('text=Open Stripe billing portal')).toBeVisible();
  });

  test('Governance page renders correctly', async ({ page }) => {
    await page.goto('/governance');
    await expect(page.locator('text=Governance Controls')).toBeVisible();
    await expect(page.locator('text=Approval tiers and escalation policies')).toBeVisible();
  });

  test('Scenario page handles empty state', async ({ page }) => {
    await page.route('**/api/scenarios', async route => {
      await route.fulfill({ json: [] });
    });
    
    await page.goto('/scenarios');
    await expect(page.locator('text=Saved Scenarios')).toBeVisible();
    await expect(page.locator('text=No scenarios saved yet.')).toBeVisible();
  });

  test('Auth boundary redirects to login', async ({ page }) => {
    // Clear the token for this test
    await page.addInitScript(() => {
      window.sessionStorage.removeItem('budgetiq_access_token');
    });
    await page.route('**/api/auth/session', async route => {
      await route.fulfill({ status: 401, json: { detail: 'Unauthorized' } });
    });

    await page.goto('/dashboard');
    // Assuming unauthenticated users are redirected to login
    // wait for url to be '/'
    await page.waitForURL('/');
    await expect(page.locator('button:has-text("Sign in")')).toBeVisible();
  });
});
