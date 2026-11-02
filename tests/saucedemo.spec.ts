import { test, expect, Page } from '@playwright/test';

/**
 * Residue verification helper:
 * Asserts that the shopping cart is empty and storage has no leftover state.
 */
export async function assertNoLeftoverResidue(page: Page) {
  if (page.url() === 'about:blank') {
    return;
  }
  // Check UI cart badge is completely absent
  const cartBadge = page.locator('.shopping_cart_badge');
  await expect(cartBadge).toHaveCount(0);

  // Check client storage has no cart residue
  const storageState = await page.evaluate(() => {
    try {
      return {
        cartContents: localStorage.getItem('cart-contents'),
      };
    } catch {
      return { cartContents: null };
    }
  });

  if (storageState.cartContents && storageState.cartContents !== '[]') {
    throw new Error(`Leftover test residue detected: cart-contents=${storageState.cartContents}`);
  }
}

/**
 * Cleanup helper:
 * Resets application state and clears cart to ensure zero residues.
 */
async function cleanAppState(page: Page) {
  if (page.url() === 'about:blank') {
    return;
  }
  const menuButton = page.locator('#react-burger-menu-btn');
  if (await menuButton.isVisible()) {
    await menuButton.click();
    const resetButton = page.locator('#reset_sidebar_link');
    await expect(resetButton).toBeVisible();
    await resetButton.click();
    const closeButton = page.locator('#react-burger-cross-btn');
    await closeButton.click();
  }
  // Also clear storage directly as defensive cleanup
  await page.evaluate(() => {
    try {
      localStorage.removeItem('cart-contents');
    } catch {
      // Ignore if localStorage unavailable
    }
  });
}

test.describe('SauceDemo Gating Suite', () => {

  test.afterEach(async ({ page }) => {
    // Teardown: ensure any created state is cleaned up before test completes
    if (!page.isClosed()) {
      await cleanAppState(page);
      await assertNoLeftoverResidue(page);
    }
  });

  // --- STABLE TESTS (Must pass on CI; gate required check) ---

  test('user can log in and view product catalog', { tag: '@stable' }, async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Swag Labs/);

    await page.locator('[data-test="username"]').fill('standard_user');
    await page.locator('[data-test="password"]').fill('secret_sauce');
    await page.locator('[data-test="login-button"]').click();

    // Condition wait: verify navigation and inventory list
    await expect(page).toHaveURL(/.*inventory\.html/);
    await expect(page.locator('.inventory_item')).toHaveCount(6);

    // Verify initial clean state
    await assertNoLeftoverResidue(page);
  });

  test('user can add item to cart and remove it cleanly', { tag: '@stable' }, async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-test="username"]').fill('standard_user');
    await page.locator('[data-test="password"]').fill('secret_sauce');
    await page.locator('[data-test="login-button"]').click();
    await expect(page).toHaveURL(/.*inventory\.html/);

    // Add item to cart
    const addToCartButton = page.locator('[data-test="add-to-cart-sauce-labs-backpack"]');
    await addToCartButton.click();
    await expect(page.locator('.shopping_cart_badge')).toHaveText('1');

    // Clean up state explicitly by removing the item
    const removeButton = page.locator('[data-test="remove-sauce-labs-backpack"]');
    await removeButton.click();

    // Verify zero residues remain
    await assertNoLeftoverResidue(page);
  });

  // --- EXPERIMENTAL TEST (Deliberately flaky; runs in experimental project; cannot block merge) ---

  test('user can sort products by price', { tag: '@experimental' }, async ({ page }) => {
    // Deliberately flaky: fails intermittently or when FLAKY_FAIL=true is set
    // For graduate script / stable runs, STABILIZE_FLAKY=true forces deterministic pass
    const shouldFlake = process.env.FLAKY_FAIL === 'true' ||
      (!process.env.STABILIZE_FLAKY && Math.random() < 0.4);

    if (shouldFlake) {
      expect(false, 'Deliberately flaky failure simulated for @experimental test').toBe(true);
    }

    await page.goto('/');
    await page.locator('[data-test="username"]').fill('standard_user');
    await page.locator('[data-test="password"]').fill('secret_sauce');
    await page.locator('[data-test="login-button"]').click();
    await expect(page).toHaveURL(/.*inventory\.html/);

    const sortSelect = page.locator('[data-test="product-sort-container"]');
    await sortSelect.selectOption('lohi');

    // Condition wait: verify lowest price item appears first
    const firstItemPrice = page.locator('.inventory_item_price').first();
    await expect(firstItemPrice).toHaveText('$7.99');

    // Verify clean state
    await assertNoLeftoverResidue(page);
  });

  // --- QUARANTINE TEST (Always fails; cannot block merge; fix later, do not delete) ---

  test('user cannot access quarantined broken feature', { tag: '@quarantine' }, async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-test="username"]').fill('standard_user');
    await page.locator('[data-test="password"]').fill('secret_sauce');
    await page.locator('[data-test="login-button"]').click();
    await expect(page).toHaveURL(/.*inventory\.html/);

    // Quarantine test: purposefully asserts against an invalid element to always fail
    const brokenElement = page.locator('[data-test="non-existent-quarantined-button"]');
    await expect(brokenElement).toBeVisible({ timeout: 1500 });
  });

});
