const { test, expect } = require('@playwright/test');

test('375px: create stock, customer, EMI sale, collect 750, validate UPI, and switch lines', async ({ page, request }) => {
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  await page.goto('/');
  await page.getByLabel('Server URL', { exact: true }).fill('http://127.0.0.1:8001/api/v1');
  await page.getByLabel('Password', { exact: true }).fill('admin123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Open A-Line', exact: true }).click();

  await page.getByText('Stock', { exact: true }).last().click();
  await page.getByLabel('Product name', { exact: true }).fill('Test mixer');
  await page.getByLabel('Qty came', { exact: true }).fill('3');
  await page.getByLabel('EMI price (₹)', { exact: true }).fill('4000');
  await page.getByRole('button', { name: '+ Stock In', exact: true }).click();
  await expect(page.getByText('3 units added to Test mixer.')).toBeVisible();

  await page.getByText('Customers', { exact: true }).last().click();
  await page.getByRole('button', { name: '+ Add Customer', exact: true }).click();
  await page.getByLabel('Customer name', { exact: true }).fill('Ravi Test');
  await page.getByLabel('Area', { exact: true }).fill('Sattur');
  await page.getByRole('button', { name: 'Save customer', exact: true }).click();
  await page.getByRole('button', { name: 'Open customer Ravi Test', exact: true }).click();
  await page.getByRole('button', { name: 'New EMI sale', exact: true }).click();
  await page.getByRole('button', { name: /Test mixer ·/ }).click();
  await page.getByLabel('Down payment (₹)', { exact: true }).fill('400');
  await page.getByRole('button', { name: 'Create EMI sale', exact: true }).click();
  await expect(page.getByText('Sale #1 created. 4 weekly dues are ready.')).toBeVisible();
  await page.getByRole('button', { name: 'Collect', exact: true }).click();
  await expect(page.getByLabel('Sale ID', { exact: true })).toHaveValue('1');
  for (const value of [100, 200, 500]) await page.getByRole('button', { name: '+' + value, exact: true }).click();
  await expect(page.getByLabel('Collection amount', { exact: true })).toHaveValue('800');
  await page.getByLabel('Collection amount', { exact: true }).fill('750');
  await page.getByRole('button', { name: 'Save Collection', exact: true }).click();
  await expect(page.getByText('Collected ₹750 by CASH')).toBeVisible();
  await page.screenshot({ path: 'test-results/collection-375.png', fullPage: true });

  await page.getByRole('button', { name: 'UPI', exact: true }).click();
  await page.getByLabel('Collection amount', { exact: true }).fill('150');
  await page.getByRole('button', { name: 'Save Collection', exact: true }).click();
  await expect(page.getByText('UPI reference is required before saving.')).toBeVisible();
  await page.getByLabel('UPI reference', { exact: true }).fill('TEST-UPI-001');
  await page.getByRole('button', { name: 'Save Collection', exact: true }).click();
  await expect(page.getByText('Collected ₹150 by UPI')).toBeVisible();

  await page.getByText('Reports', { exact: true }).last().click();
  await expect(page.getByText('₹900', { exact: true })).toBeVisible();
  await expect(page.getByText('No left-outs for this day')).toBeVisible();
  await page.screenshot({ path: 'test-results/reports-375.png', fullPage: true });
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByText('Ready for the day')).toBeVisible();
  await page.getByRole('button', { name: 'Switch line', exact: true }).click();
  await page.getByRole('button', { name: 'Open B-Line', exact: true }).click();
  await expect(page.getByText('No customers here yet')).toBeVisible();
  await page.getByText('Reports', { exact: true }).last().click();
  await expect(page.getByText('0 collections recorded')).toBeVisible();
  await page.getByRole('button', { name: 'Switch line', exact: true }).click();
  await page.getByRole('button', { name: 'Open C-Line', exact: true }).click();
  await expect(page.getByText('No customers here yet')).toBeVisible();
  await page.getByRole('button', { name: 'Switch line', exact: true }).click();
  await page.getByRole('button', { name: 'Open A-Line', exact: true }).click();
  await page.getByRole('button', { name: 'Open customer Ravi Test', exact: true }).click();
  await expect(page.getByText('₹2,700', { exact: true }).last()).toBeVisible();

  const login = await request.post('http://127.0.0.1:8001/api/v1/auth/login', { data: { username: 'admin', password: 'admin123' } });
  const headers = { Authorization: 'Bearer ' + (await login.json()).access_token };
  const ledger = await request.get('http://127.0.0.1:8001/api/v1/customers/1?line_id=1', { headers });
  const data = await ledger.json();
  expect(data.payments.map(p => p.amount).sort((a, b) => a - b)).toEqual([150, 750]);
  expect(data.customer.outstanding).toBe(2700);
  expect(runtimeErrors).toEqual([]);
});
