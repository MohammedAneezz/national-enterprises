import * as SQLite from 'expo-sqlite';
import { today } from '../theme';

const { moneyToPaise, rupees, positiveInteger, validDay, schedule, applyPayment } = require('./rules.cjs');
let opening;

export function getDatabase() {
  if (!opening) opening = open().catch(error => { opening = null; throw error; });
  return opening;
}

async function open() {
  const db = await SQLite.openDatabaseAsync('national-enterprises.db');
  await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  const version = await db.getFirstAsync('PRAGMA user_version');
  if (version.user_version > 1) throw new Error('This database was created by a newer version of the app. Update the app to open it.');
  if (version.user_version === 0) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS lines (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
      CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY, line_id INTEGER NOT NULL REFERENCES lines(id), name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', area TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', outstanding_paise INTEGER NOT NULL DEFAULT 0 CHECK(outstanding_paise >= 0));
      CREATE INDEX IF NOT EXISTS customers_line_area ON customers(line_id, area);
      CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, sku TEXT NOT NULL DEFAULT '', cost_paise INTEGER NOT NULL DEFAULT 0, emi_paise INTEGER NOT NULL DEFAULT 0, stock_in INTEGER NOT NULL DEFAULT 0, stock_sold INTEGER NOT NULL DEFAULT 0, CHECK(stock_in >= stock_sold AND stock_sold >= 0));
      CREATE UNIQUE INDEX IF NOT EXISTS products_sku ON products(sku) WHERE sku <> '';
      CREATE TABLE IF NOT EXISTS sales (id INTEGER PRIMARY KEY, line_id INTEGER NOT NULL REFERENCES lines(id), customer_id INTEGER NOT NULL REFERENCES customers(id), product_id INTEGER NOT NULL REFERENCES products(id), qty INTEGER NOT NULL, total_paise INTEGER NOT NULL, down_paise INTEGER NOT NULL, financed_paise INTEGER NOT NULL, weekly_paise INTEGER NOT NULL, start_date TEXT NOT NULL, tenure_weeks INTEGER NOT NULL, status TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS sales_line_customer ON sales(line_id, customer_id);
      CREATE TABLE IF NOT EXISTS dues (id INTEGER PRIMARY KEY, sale_id INTEGER NOT NULL REFERENCES sales(id), line_id INTEGER NOT NULL REFERENCES lines(id), due_date TEXT NOT NULL, due_paise INTEGER NOT NULL, paid_paise INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, CHECK(paid_paise >= 0 AND paid_paise <= due_paise));
      CREATE INDEX IF NOT EXISTS dues_line_day ON dues(line_id, due_date);
      CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY, line_id INTEGER NOT NULL REFERENCES lines(id), sale_id INTEGER NOT NULL REFERENCES sales(id), amount_paise INTEGER NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('CASH', 'UPI')), upi_ref TEXT NOT NULL DEFAULT '', collector TEXT NOT NULL, paid_at_ms INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS payments_line_time ON payments(line_id, paid_at_ms);
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT OR IGNORE INTO lines(id, name) VALUES (1, 'A-Line'), (2, 'B-Line'), (3, 'C-Line');
      PRAGMA user_version = 1;
    `);
  }
  return db;
}

const customerRecord = row => ({ id: row.id, line_id: row.line_id, name: row.name, phone: row.phone, area: row.area, notes: row.notes, outstanding: rupees(row.outstanding_paise) });
const productRecord = row => ({ id: row.id, name: row.name, sku: row.sku, cost_price: rupees(row.cost_paise), emi_price: rupees(row.emi_paise), stock_in: row.stock_in, stock_sold: row.stock_sold, came: row.stock_in, sold: row.stock_sold, available: row.stock_in - row.stock_sold });
const saleRecord = row => ({ id: row.id, line_id: row.line_id, customer_id: row.customer_id, product_id: row.product_id, qty: row.qty, total_emi: rupees(row.total_paise), down_payment: rupees(row.down_paise), financed: rupees(row.financed_paise), weekly_amt: rupees(row.weekly_paise), start_date: row.start_date, tenure_weeks: row.tenure_weeks, status: row.status });
const dueRecord = row => ({ id: row.id, sale_id: row.sale_id, line_id: row.line_id, due_date: row.due_date, due_amt: rupees(row.due_paise), paid_amt: rupees(row.paid_paise), status: row.status });
const paymentRecord = row => ({ id: row.id, line_id: row.line_id, sale_id: row.sale_id, amount: rupees(row.amount_paise), mode: row.mode, upi_ref: row.upi_ref, collector: row.collector, paid_at: new Date(row.paid_at_ms).toISOString() });

async function requireLine(db, id) {
  const line = await db.getFirstAsync('SELECT * FROM lines WHERE id = ?', positiveInteger(id, 'Line ID', 3));
  if (!line) throw new Error('Line not found.');
  return line;
}

function requiredText(value, label, max = 150) {
  const text = String(value ?? '').trim();
  if (!text || text.length > max) throw new Error(`${label} is required and must have at most ${max} characters.`);
  return text;
}

function optionalText(value, label, max = 150) {
  const text = String(value ?? '').trim();
  if (text.length > max) throw new Error(`${label} must have at most ${max} characters.`);
  return text;
}

async function get(path, params = {}) {
  const db = await getDatabase();
  if (path === '/lines') return db.getAllAsync('SELECT * FROM lines ORDER BY id');
  if (path === '/products') return (await db.getAllAsync('SELECT * FROM products ORDER BY name, id')).map(productRecord);
  if (path === '/areas') {
    await requireLine(db, params.line_id);
    return (await db.getAllAsync("SELECT DISTINCT area FROM customers WHERE line_id = ? AND area <> '' ORDER BY area", params.line_id)).map(row => row.area);
  }
  if (path === '/customers') {
    await requireLine(db, params.line_id);
    const rows = await db.getAllAsync('SELECT * FROM customers WHERE line_id = ? AND (? = \'\' OR area = ?) AND (? = \'\' OR instr(lower(name), lower(?)) > 0 OR instr(lower(phone), lower(?)) > 0) ORDER BY name, id', params.line_id, params.area || '', params.area || '', params.q || '', params.q || '', params.q || '');
    return rows.map(customerRecord);
  }
  const customerMatch = path.match(/^\/customers\/(\d+)$/);
  if (customerMatch) {
    const customer = await db.getFirstAsync('SELECT * FROM customers WHERE id = ? AND line_id = ?', Number(customerMatch[1]), params.line_id);
    if (!customer) throw new Error('Customer not found in this line.');
    const sales = await db.getAllAsync('SELECT * FROM sales WHERE customer_id = ? AND line_id = ? ORDER BY id DESC', customer.id, customer.line_id);
    const payments = await db.getAllAsync('SELECT p.* FROM payments p JOIN sales s ON p.sale_id = s.id WHERE s.customer_id = ? AND p.line_id = ? ORDER BY p.paid_at_ms DESC, p.id DESC', customer.id, customer.line_id);
    return { customer: customerRecord(customer), sales: sales.map(saleRecord), payments: payments.map(paymentRecord) };
  }
  const saleMatch = path.match(/^\/sales\/(\d+)\/schedule$/);
  if (saleMatch) {
    const sale = await db.getFirstAsync('SELECT id FROM sales WHERE id = ? AND line_id = ?', Number(saleMatch[1]), params.line_id);
    if (!sale) throw new Error('Sale not found in this line.');
    return (await db.getAllAsync('SELECT * FROM dues WHERE sale_id = ? ORDER BY due_date, id', sale.id)).map(dueRecord);
  }
  if (path === '/reports/daily') return daily(db, params);
  throw new Error('Unknown local request: ' + path);
}

async function post(path, body) {
  const db = await getDatabase();
  if (path === '/customers') {
    await requireLine(db, body.line_id);
    const name = requiredText(body.name, 'Customer name');
    const phone = optionalText(body.phone, 'Phone', 30);
    const area = optionalText(body.area, 'Area');
    const notes = optionalText(body.notes, 'Notes', 2000);
    const result = await db.runAsync('INSERT INTO customers(line_id, name, phone, area, notes) VALUES (?, ?, ?, ?, ?)', body.line_id, name, phone, area, notes);
    return customerRecord(await db.getFirstAsync('SELECT * FROM customers WHERE id = ?', result.lastInsertRowId));
  }
  if (path === '/products') {
    const name = requiredText(body.name, 'Product name');
    const sku = optionalText(body.sku, 'SKU', 80);
    if (sku && await db.getFirstAsync('SELECT id FROM products WHERE sku = ?', sku)) throw new Error('This SKU already exists; use Stock In on the existing product.');
    const stock = Number(body.stock_in ?? 0);
    if (!Number.isSafeInteger(stock) || stock < 0) throw new Error('Stock must be a whole number of zero or more.');
    const result = await db.runAsync('INSERT INTO products(name, sku, cost_paise, emi_paise, stock_in) VALUES (?, ?, ?, ?, ?)', name, sku, moneyToPaise(body.cost_price ?? 0, 'Cost price'), moneyToPaise(body.emi_price ?? 0, 'EMI price'), stock);
    return productRecord(await db.getFirstAsync('SELECT * FROM products WHERE id = ?', result.lastInsertRowId));
  }
  const stockMatch = path.match(/^\/products\/(\d+)\/stock-in$/);
  if (stockMatch) {
    const qty = positiveInteger(body.qty, 'Quantity');
    const result = await db.runAsync('UPDATE products SET stock_in = stock_in + ? WHERE id = ?', qty, Number(stockMatch[1]));
    if (!result.changes) throw new Error('Product not found.');
    return productRecord(await db.getFirstAsync('SELECT * FROM products WHERE id = ?', Number(stockMatch[1])));
  }
  if (path === '/sales') return createSale(db, body);
  if (path === '/payments') return createPayment(db, body);
  throw new Error('Unknown local request: ' + path);
}

async function createSale(db, body) {
  const lineId = positiveInteger(body.line_id, 'Line ID', 3);
  const customerId = positiveInteger(body.customer_id, 'Customer ID');
  const productId = positiveInteger(body.product_id, 'Product ID');
  const qty = positiveInteger(body.qty, 'Quantity');
  const total = moneyToPaise(body.total_emi, 'Total EMI');
  const down = moneyToPaise(body.down_payment ?? 0, 'Down payment');
  const weekly = moneyToPaise(body.weekly_amt, 'Weekly amount');
  const tenure = positiveInteger(body.tenure_weeks, 'Tenure', 520);
  if (!total) throw new Error('Total EMI must be greater than zero.');
  const dues = schedule(validDay(body.start_date), total - down, weekly, tenure);
  let response;
  await db.withExclusiveTransactionAsync(async tx => {
    await requireLine(tx, lineId);
    const customer = await tx.getFirstAsync('SELECT * FROM customers WHERE id = ? AND line_id = ?', customerId, lineId);
    if (!customer) throw new Error('Customer not found in this line.');
    const stock = await tx.runAsync('UPDATE products SET stock_sold = stock_sold + ? WHERE id = ? AND stock_in - stock_sold >= ?', qty, productId, qty);
    if (!stock.changes) {
      const product = await tx.getFirstAsync('SELECT stock_in, stock_sold FROM products WHERE id = ?', productId);
      if (!product) throw new Error('Product not found.');
      throw new Error(`Only ${product.stock_in - product.stock_sold} units are available.`);
    }
    const status = total === down ? 'CLOSED' : 'OPEN';
    const result = await tx.runAsync('INSERT INTO sales(line_id, customer_id, product_id, qty, total_paise, down_paise, financed_paise, weekly_paise, start_date, tenure_weeks, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', lineId, customerId, productId, qty, total, down, total - down, weekly, body.start_date, tenure, status);
    for (const due of dues) await tx.runAsync('INSERT INTO dues(sale_id, line_id, due_date, due_paise, status) VALUES (?, ?, ?, ?, ?)', result.lastInsertRowId, lineId, due.due_date, due.due_paise, due.status);
    await tx.runAsync('UPDATE customers SET outstanding_paise = outstanding_paise + ? WHERE id = ?', total - down, customerId);
    response = { sale_id: result.lastInsertRowId, financed: rupees(total - down), dues: tenure };
  });
  return response;
}

async function createPayment(db, body) {
  const lineId = positiveInteger(body.line_id, 'Line ID', 3);
  const saleId = positiveInteger(body.sale_id, 'Sale ID');
  const amount = moneyToPaise(body.amount, 'Collection amount');
  const mode = String(body.mode || '').toUpperCase();
  const upiRef = optionalText(body.upi_ref, 'UPI reference');
  if (!amount) throw new Error('Collection amount must be greater than zero.');
  if (!['CASH', 'UPI'].includes(mode)) throw new Error('Payment mode must be CASH or UPI.');
  if (mode === 'UPI' && !upiRef) throw new Error('UPI reference is required.');
  let response;
  await db.withExclusiveTransactionAsync(async tx => {
    const sale = await tx.getFirstAsync('SELECT * FROM sales WHERE id = ? AND line_id = ?', saleId, lineId);
    if (!sale) throw new Error('Sale not found in this line.');
    if (sale.status === 'CLOSED') throw new Error('This sale is already closed.');
    const dues = await tx.getAllAsync('SELECT * FROM dues WHERE sale_id = ? AND line_id = ? ORDER BY due_date, id', saleId, lineId);
    const allocation = applyPayment(dues, amount);
    for (const due of allocation.dues) await tx.runAsync('UPDATE dues SET paid_paise = ?, status = ? WHERE id = ?', due.paid_paise, due.status, due.id);
    const receipt = await tx.runAsync('INSERT INTO payments(line_id, sale_id, amount_paise, mode, upi_ref, collector, paid_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?)', lineId, saleId, amount, mode, mode === 'UPI' ? upiRef : '', 'admin', Date.now());
    if (allocation.closed) await tx.runAsync("UPDATE sales SET status = 'CLOSED' WHERE id = ?", saleId);
    await tx.runAsync('UPDATE customers SET outstanding_paise = max(0, outstanding_paise - ?) WHERE id = ? AND line_id = ?', amount, sale.customer_id, lineId);
    const customer = await tx.getFirstAsync('SELECT outstanding_paise FROM customers WHERE id = ?', sale.customer_id);
    response = { payment_id: receipt.lastInsertRowId, applied: rupees(amount), amount: rupees(amount), mode, sale_id: saleId, sale_status: allocation.closed ? 'CLOSED' : 'OPEN', outstanding: rupees(customer.outstanding_paise) };
  });
  return response;
}

async function daily(db, params) {
  const lineId = positiveInteger(params.line_id, 'Line ID', 3);
  await requireLine(db, lineId);
  const day = validDay(params.day || today());
  const [year, month, date] = day.split('-').map(Number);
  const start = new Date(year, month - 1, date).getTime();
  const end = new Date(year, month - 1, date + 1).getTime();
  const sales = await db.getFirstAsync('SELECT count(*) count, coalesce(sum(total_paise), 0) total FROM sales WHERE line_id = ? AND start_date = ?', lineId, day);
  const paid = await db.getFirstAsync("SELECT count(*) count, coalesce(sum(amount_paise), 0) total, coalesce(sum(CASE WHEN mode = 'CASH' THEN amount_paise ELSE 0 END), 0) cash, coalesce(sum(CASE WHEN mode = 'UPI' THEN amount_paise ELSE 0 END), 0) upi FROM payments WHERE line_id = ? AND paid_at_ms >= ? AND paid_at_ms < ?", lineId, start, end);
  const rows = await db.getAllAsync('SELECT d.*, c.id customer_id, c.name customer_name, c.area, c.phone FROM dues d JOIN sales s ON d.sale_id = s.id JOIN customers c ON s.customer_id = c.id WHERE d.line_id = ? AND s.line_id = ? AND c.line_id = ? AND d.due_date <= ? ORDER BY d.due_date, d.id', lineId, lineId, lineId, day);
  const detail = row => ({ ...dueRecord(row), due_id: row.id, balance: rupees(row.due_paise - row.paid_paise), customer_id: row.customer_id, customer_name: row.customer_name, area: row.area, phone: row.phone });
  const left_outs = rows.filter(row => row.due_date === day && row.status !== 'PAID').map(detail);
  const overdue = rows.filter(row => row.due_date < day && row.status !== 'PAID').map(detail);
  return { day, line_id: lineId, sales_count: sales.count, sales_amount: rupees(sales.total), collected_count: paid.count, collected_amount: rupees(paid.total), cash: rupees(paid.cash), upi: rupees(paid.upi), due_today_count: rows.filter(row => row.due_date === day).length, left_out_count: left_outs.length, left_outs, overdue_count: overdue.length, overdue };
}

export const localApi = {
  get: async (path, options = {}) => ({ data: await get(path, options.params || {}) }),
  post: async (path, body) => ({ data: await post(path, body) }),
};
