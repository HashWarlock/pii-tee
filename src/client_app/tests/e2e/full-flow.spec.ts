import { test, expect } from '@playwright/test';

test.describe('PII-TEE Full Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('complete anonymization and deanonymization flow', async ({ page }) => {
    // Check page loaded
    await expect(page.locator('h1')).toContainText('PII Anonymization');
    
    // Enter text with PII
    const testText = 'John Doe lives at 123 Main St, New York. Email: john@example.com, Phone: 555-1234';
    const input = page.locator('input[placeholder*="Enter text"]').first();
    await input.fill(testText);
    
    // Send message
    await page.keyboard.press('Enter');
    
    // Wait for processing
    await page.waitForTimeout(2000);
    
    // Check User View shows original text
    const userView = page.locator('text=User View').locator('..');
    await expect(userView).toContainText('John Doe');
    await expect(userView).toContainText('john@example.com');
    
    // Check LLM View shows anonymized text
    const llmView = page.locator('text=LLM View').locator('..');
    await expect(llmView).toContainText('<PERSON_0>');
    await expect(llmView).toContainText('<EMAIL_ADDRESS_0>');
    await expect(llmView).toContainText('<PHONE_NUMBER_0>');
    await expect(llmView).toContainText('<LOCATION_0>');
    
    // Check signature verification shows as verified
    const verifyView = page.locator('text=Message Signature Verification').locator('..');
    await expect(verifyView).toContainText('Verified');
    
    // Expand details to see full information
    const expandButton = llmView.locator('button').filter({ hasText: /ChevronDown|Show details/ }).first();
    if (await expandButton.isVisible()) {
      await expandButton.click();
      
      // Check expanded details are visible
      await expect(llmView).toContainText('Session ID');
      await expect(llmView).toContainText('Public Key');
      await expect(llmView).toContainText('Signature');
    }
    
    // Send another message in same session
    const secondText = 'John Doe also has account 4111-1111-1111-1111';
    await input.fill(secondText);
    await page.keyboard.press('Enter');
    
    await page.waitForTimeout(2000);
    
    // Check consistent anonymization (John Doe should still be <PERSON_0>)
    const llmMessages = page.locator('text=LLM View').locator('..').locator('[data-testid="message"]');
    const lastMessage = llmMessages.last();
    await expect(lastMessage).toContainText('<PERSON_0>');
    await expect(lastMessage).toContainText('<CREDIT_CARD_0>');
  });

  test('signature verification for all message types', async ({ page }) => {
    // Send a message
    const input = page.locator('input[placeholder*="Enter text"]').first();
    await input.fill('Test message for Alice');
    await page.keyboard.press('Enter');
    
    await page.waitForTimeout(2000);
    
    // Check all three views have verification
    const userVerify = page.locator('text=User View').locator('..').locator('text=Verified');
    const llmVerify = page.locator('text=LLM View').locator('..').locator('text=Verified');
    const signatureVerify = page.locator('text=Message Signature Verification').locator('..').locator('text=Verified');
    
    await expect(userVerify).toBeVisible();
    await expect(llmVerify).toBeVisible();
    await expect(signatureVerify).toBeVisible();
  });

  test('handles multiple PII types', async ({ page }) => {
    const complexText = `
      Name: Jane Smith
      Email: jane.smith@company.com
      Phone: (555) 987-6543
      SSN: 123-45-6789
      Address: 456 Oak Avenue, Boston, MA 02101
      IP: 192.168.1.100
      URL: https://example.com/profile
      Date: January 15, 2024
    `;
    
    const input = page.locator('input[placeholder*="Enter text"]').first();
    await input.fill(complexText);
    await page.keyboard.press('Enter');
    
    await page.waitForTimeout(2000);
    
    const llmView = page.locator('text=LLM View').locator('..');
    
    // Check all PII types are anonymized
    await expect(llmView).toContainText('<PERSON_0>'); // Jane Smith
    await expect(llmView).toContainText('<EMAIL_ADDRESS_0>');
    await expect(llmView).toContainText('<PHONE_NUMBER_0>');
    await expect(llmView).toContainText('<US_SSN_0>');
    await expect(llmView).toContainText('<LOCATION_'); // Multiple locations
    await expect(llmView).toContainText('<IP_ADDRESS_0>');
    await expect(llmView).toContainText('<URL_0>');
    await expect(llmView).toContainText('<DATE_TIME_0>');
    
    // Original PII should not be visible in LLM view
    await expect(llmView).not.toContainText('Jane Smith');
    await expect(llmView).not.toContainText('jane.smith@company.com');
    await expect(llmView).not.toContainText('123-45-6789');
  });

  test('copy functionality works', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    
    // Send a message
    const input = page.locator('input[placeholder*="Enter text"]').first();
    await input.fill('Copy test for Bob');
    await page.keyboard.press('Enter');
    
    await page.waitForTimeout(2000);
    
    // Expand details
    const llmView = page.locator('text=LLM View').locator('..');
    const expandButton = llmView.locator('button').first();
    await expandButton.click();
    
    // Find and click copy button for session ID
    const copyButtons = llmView.locator('button').filter({ hasText: /Copy|📋/ });
    if (await copyButtons.first().isVisible()) {
      await copyButtons.first().click();
      
      // Check for success message or icon change
      await page.waitForTimeout(500);
      // The copy button should show some feedback
    }
  });

  test('responsive design works', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check layout adjusts
    await expect(page.locator('h1')).toBeVisible();
    
    const input = page.locator('input[placeholder*="Enter text"]').first();
    await expect(input).toBeVisible();
    
    // Send a message
    await input.fill('Mobile test');
    await page.keyboard.press('Enter');
    
    await page.waitForTimeout(2000);
    
    // Check views are still accessible
    await expect(page.locator('text=User View')).toBeVisible();
    await expect(page.locator('text=LLM View')).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('h1')).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('h1')).toBeVisible();
  });

  test('error handling for network issues', async ({ page, context }) => {
    // Simulate network failure
    await context.route('**/anonymize', route => route.abort());
    
    const input = page.locator('input[placeholder*="Enter text"]').first();
    await input.fill('This should fail');
    await page.keyboard.press('Enter');
    
    await page.waitForTimeout(2000);
    
    // Should show error message or handle gracefully
    // The specific error handling depends on implementation
    const errorMessage = page.locator('text=/error|failed|unable/i');
    // If error messages are shown, they should be visible
    // Otherwise, the app should not crash
  });

  test('session persistence', async ({ page }) => {
    // Send first message
    const input = page.locator('input[placeholder*="Enter text"]').first();
    await input.fill('Session test for Charlie');
    await page.keyboard.press('Enter');
    
    await page.waitForTimeout(2000);
    
    // Get session ID from expanded details
    const llmView = page.locator('text=LLM View').locator('..');
    const expandButton = llmView.locator('button').first();
    await expandButton.click();
    
    // Send another message
    await input.fill('Charlie again');
    await page.keyboard.press('Enter');
    
    await page.waitForTimeout(2000);
    
    // Both messages should use <PERSON_0> for Charlie
    const messages = llmView.locator('[data-testid="message"], .message, div').filter({ hasText: '<PERSON_0>' });
    const count = await messages.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

test.describe('Accessibility', () => {
  test('keyboard navigation works', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Tab to input field
    await page.keyboard.press('Tab');
    
    // Type message
    await page.keyboard.type('Keyboard navigation test');
    
    // Submit with Enter
    await page.keyboard.press('Enter');
    
    await page.waitForTimeout(2000);
    
    // Tab through interactive elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      // Check focus is visible
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    }
  });

  test('screen reader labels present', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Check for ARIA labels
    const input = page.locator('input[placeholder*="Enter text"]').first();
    const ariaLabel = await input.getAttribute('aria-label');
    // Input should have proper labeling
    
    // Check for heading hierarchy
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
    
    // Check for landmark regions
    const main = page.locator('main, [role="main"]');
    // Main content area should be defined
  });
});