import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { getDatabase } from './store';
import { today } from '../theme';

const tables = ['lines', 'products', 'customers', 'sales', 'dues', 'payments'];
const columns = {
  lines: ['id', 'name'],
  products: ['id', 'name', 'sku', 'cost_paise', 'emi_paise', 'stock_in', 'stock_sold'],
  customers: ['id', 'line_id', 'name', 'phone', 'area', 'notes', 'outstanding_paise'],
  sales: ['id', 'line_id', 'customer_id', 'product_id', 'qty', 'total_paise', 'down_paise', 'financed_paise', 'weekly_paise', 'start_date', 'tenure_weeks', 'status'],
  dues: ['id', 'sale_id', 'line_id', 'due_date', 'due_paise', 'paid_paise', 'status'],
  payments: ['id', 'line_id', 'sale_id', 'amount_paise', 'mode', 'upi_ref', 'collector', 'paid_at_ms'],
};

export async function backupStatus() {
  const db = await getDatabase();
  const row = await db.getFirstAsync("SELECT value FROM metadata WHERE key = 'last_backup_at'");
  const customer = await db.getFirstAsync('SELECT count(*) count FROM customers');
  const payment = await db.getFirstAsync('SELECT count(*) count FROM payments');
  const product = await db.getFirstAsync('SELECT count(*) count FROM products');
  const last = row?.value || '';
  const currentMonth = today().slice(0, 7);
  const savedDate = last ? new Date(last) : null;
  const savedMonth = savedDate ? `${savedDate.getFullYear()}-${String(savedDate.getMonth() + 1).padStart(2, '0')}` : '';
  return { last, due: (customer.count > 0 || payment.count > 0 || product.count > 0) && savedMonth !== currentMonth };
}

export async function exportBackup() {
  const db = await getDatabase();
  const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permissions.granted) return null;
  const data = {};
  await db.withExclusiveTransactionAsync(async tx => {
    const check = await tx.getFirstAsync('PRAGMA integrity_check');
    if (Object.values(check)[0] !== 'ok') throw new Error('Database integrity check failed. Backup was not saved.');
    for (const table of tables) data[table] = await tx.getAllAsync(`SELECT * FROM ${table} ORDER BY id`);
  });
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
  const fileName = `NATIONAL-ENTERPRISES-${stamp}`;
  const uri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, fileName, 'application/json');
  await FileSystem.StorageAccessFramework.writeAsStringAsync(uri, JSON.stringify({ format: 'national-enterprises-backup', schemaVersion: 1, createdAt: now.toISOString(), data }));
  await db.runAsync("INSERT INTO metadata(key, value) VALUES ('last_backup_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", now.toISOString());
  return { fileName: fileName + '.json', uri, createdAt: now.toISOString() };
}

export async function pickBackup() {
  const selection = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (selection.canceled) return null;
  const asset = selection.assets[0];
  if (asset.size && asset.size > 50 * 1024 * 1024) throw new Error('This backup is too large to restore on this phone.');
  const content = await FileSystem.readAsStringAsync(asset.uri);
  if (content.length > 50 * 1024 * 1024) throw new Error('This backup is too large to restore on this phone.');
  let snapshot;
  try { snapshot = JSON.parse(content); } catch { throw new Error('The selected file is not a valid backup.'); }
  validateBackup(snapshot);
  return { snapshot, name: asset.name, counts: Object.fromEntries(tables.map(table => [table, snapshot.data[table].length])) };
}

function validateBackup(snapshot) {
  if (snapshot?.format !== 'national-enterprises-backup' || snapshot.schemaVersion !== 1 || !snapshot.data) throw new Error('This is not a supported NATIONAL ENTERPRISES backup.');
  for (const table of tables) {
    if (!Array.isArray(snapshot.data[table]) || snapshot.data[table].some(row => !row || columns[table].some(column => !Object.prototype.hasOwnProperty.call(row, column)))) throw new Error(`Backup table ${table} is missing or incomplete.`);
  }
  const lines = snapshot.data.lines.map(row => `${row.id}:${row.name}`).sort();
  if (lines.length !== 3 || lines.join('|') !== '1:A-Line|2:B-Line|3:C-Line') throw new Error('Backup line list is invalid.');
}

export async function restoreBackup(snapshot) {
  validateBackup(snapshot);
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async tx => {
    for (const table of [...tables].reverse()) await tx.runAsync(`DELETE FROM ${table}`);
    for (const table of tables) {
      const names = columns[table];
      const placeholders = names.map(() => '?').join(', ');
      for (const row of snapshot.data[table]) await tx.runAsync(`INSERT INTO ${table}(${names.join(', ')}) VALUES (${placeholders})`, names.map(name => row[name]));
    }
    const foreignKeys = await tx.getAllAsync('PRAGMA foreign_key_check');
    if (foreignKeys.length) throw new Error('Backup has broken customer or sale references.');
    const mismatched = await tx.getFirstAsync('SELECT (SELECT count(*) FROM sales s JOIN customers c ON s.customer_id = c.id WHERE s.line_id <> c.line_id) + (SELECT count(*) FROM dues d JOIN sales s ON d.sale_id = s.id WHERE d.line_id <> s.line_id) + (SELECT count(*) FROM payments p JOIN sales s ON p.sale_id = s.id WHERE p.line_id <> s.line_id) bad');
    if (mismatched.bad) throw new Error('Backup mixes records between lines.');
    const balances = await tx.getFirstAsync('SELECT count(*) bad FROM customers c WHERE c.outstanding_paise <> (SELECT coalesce(sum(s.financed_paise - coalesce((SELECT sum(p.amount_paise) FROM payments p WHERE p.sale_id = s.id), 0)), 0) FROM sales s WHERE s.customer_id = c.id)');
    if (balances.bad) throw new Error('Backup customer balances do not match sales and payments.');
    const dues = await tx.getFirstAsync("SELECT count(*) bad FROM sales s WHERE s.financed_paise <> (SELECT coalesce(sum(d.due_paise), 0) FROM dues d WHERE d.sale_id = s.id) OR s.financed_paise - coalesce((SELECT sum(p.amount_paise) FROM payments p WHERE p.sale_id = s.id), 0) <> (SELECT coalesce(sum(d.due_paise - d.paid_paise), 0) FROM dues d WHERE d.sale_id = s.id) OR (s.status = 'CLOSED') <> (NOT EXISTS (SELECT 1 FROM dues d WHERE d.sale_id = s.id AND d.status <> 'PAID'))");
    if (dues.bad) throw new Error('Backup due totals do not match sales and collections.');
    const stock = await tx.getFirstAsync('SELECT count(*) bad FROM products p WHERE p.stock_sold <> (SELECT coalesce(sum(s.qty), 0) FROM sales s WHERE s.product_id = p.id)');
    if (stock.bad) throw new Error('Backup stock totals do not match sales.');
    await tx.runAsync("DELETE FROM metadata WHERE key = 'last_backup_at'");
  });
}
