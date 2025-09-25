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
      { productCode: 'IC-DATABRIDGE', quantity: 3, startDate: '2025-01-01', endDate: '2025-06-01' },
      { productCode: 'APP-X', quantity: 1, startDate: '2025-02-01', endDate: '2025-07-01' },
      { productCode: 'APP-Y', quantity: 2, startDate: '2025-03-01', endDate: '2025-08-01' },
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

  // Verify sorting toggles by Quantity
  const getQuantities = async () => {
    const count = await modal.locator('tbody tr').count();
    const vals: number[] = [];
    for (let i = 1; i <= count; i++) {
      const txt = await modal.locator(`tbody tr:nth-child(${i}) td:nth-child(2)`).innerText();
      const num = Number(String(txt).trim());
      if (!Number.isNaN(num)) vals.push(num);
    }
    return vals;
  };

  // Ascending
  await modal.locator('thead th[data-sort-key="quantity"]').click();
  const asc = await getQuantities();
  const ascSorted = [...asc].sort((a,b)=>a-b);
  expect(asc).toEqual(ascSorted);

  // Descending
  await modal.locator('thead th[data-sort-key="quantity"]').click();
  const desc = await getQuantities();
  const descSorted = [...desc].sort((a,b)=>b-a);
  expect(desc).toEqual(descSorted);
});

