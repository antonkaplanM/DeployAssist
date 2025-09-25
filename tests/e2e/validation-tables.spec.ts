import { test, expect } from '@playwright/test';

test('provisioning entitlements modal renders tables', async ({ page }) => {
  const base = process.env.E2E_BASE_URL || 'http://localhost:8080';
  await page.goto(base);

  // Navigate to Provisioning Monitor
  await page.click('#nav-provisioning');
  await expect(page.locator('#page-provisioning')).toBeVisible();

  // Inject a fake row with a product-group button to open modal deterministically
  await page.evaluate(() => {
    const tbody = document.querySelector('#provisioning-table-body');
    if (!tbody) return;
    const fakeEntitlements = [
      { productCode: 'IC-DATABRIDGE', quantity: 2, startDate: '2025-01-01', endDate: '2025-06-01' },
      { productCode: 'APP-X', quantity: 1, startDate: '2025-02-01', endDate: '2025-07-01' },
    ];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td></td><td></td><td></td><td></td>
      <td>
        <button class="product-group-btn" data-request-id="FAKE-1" data-group-type="apps" data-entitlements='${JSON.stringify(fakeEntitlements).replace(/"/g, '&quot;')}'>Open</button>
      </td>
      <td></td><td></td><td></td>
    `;
    tbody.appendChild(tr);
  });

  // Click the injected button (last one to avoid existing rows)
  await page.locator('#provisioning-table-body .product-group-btn').last().click();

  // Expect a table inside modal body
  const modal = page.locator('#product-modal');
  await expect(modal).toBeVisible();
  await expect(modal.locator('table')).toBeVisible();
  await expect(modal.locator('thead th')).toContainText(['Product Code', 'Quantity', 'Start Date', 'End Date']);
});

