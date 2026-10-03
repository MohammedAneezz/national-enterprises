const test = require('node:test');
const assert = require('node:assert/strict');
const { moneyToPaise, schedule, applyPayment } = require('../src/local/rules.cjs');

test('sale schedule stays on purchase weekday and keeps the exact final amount', () => {
  const dues = schedule('2026-09-22', moneyToPaise('750'), moneyToPaise('200'), 4);
  assert.deepEqual(dues.map(due => due.due_date), ['2026-09-22', '2026-09-29', '2026-10-06', '2026-10-13']);
  assert.deepEqual(dues.map(due => due.due_paise), [20000, 20000, 20000, 15000]);
});

test('FIFO collection pays oldest due first and closes exactly at balance', () => {
  const dues = schedule('2026-09-22', 75000, 20000, 4).map((due, id) => ({ ...due, id, paid_paise: 0 }));
  const first = applyPayment(dues, 25000);
  assert.deepEqual(first.dues.map(due => due.paid_paise), [20000, 5000, 0, 0]);
  assert.deepEqual(first.dues.map(due => due.status), ['PAID', 'PARTIAL', 'PENDING', 'PENDING']);
  assert.equal(first.closed, false);
  assert.equal(applyPayment(first.dues, 50000).closed, true);
  assert.throws(() => applyPayment(first.dues, 50001), /exceeds/);
});

test('money accepts paise exactly and rejects malformed input', () => {
  assert.equal(moneyToPaise('750.05'), 75005);
  assert.throws(() => moneyToPaise('750.005'), /valid amount/);
  assert.throws(() => schedule('2026-09-31', 10000, 10000, 1), /valid purchase date/);
});
