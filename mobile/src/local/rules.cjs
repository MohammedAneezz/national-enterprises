const moneyToPaise = (value, label = 'Amount') => {
  const text = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error(`${label} must be a valid amount with up to two decimal places.`);
  const [rupees, fraction = ''] = text.split('.');
  const result = Number(rupees) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(result)) throw new Error(`${label} is too large.`);
  return result;
};

const rupees = paise => paise / 100;

const positiveInteger = (value, label, maximum = 1000000) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0 || number > maximum) throw new Error(`${label} must be a positive whole number.`);
  return number;
};

const validDay = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw new Error('Use a purchase date in YYYY-MM-DD format.');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Enter a valid purchase date.');
  return value;
};

const addDays = (value, days) => {
  const date = new Date(`${validDay(value)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const schedule = (startDate, financed, weekly, tenure) => {
  validDay(startDate);
  if (financed < 0 || !Number.isSafeInteger(financed)) throw new Error('Down payment cannot exceed total EMI.');
  if (weekly <= 0 || !Number.isSafeInteger(weekly)) throw new Error('Weekly amount must be greater than zero.');
  positiveInteger(tenure, 'Tenure', 520);
  if (financed > 0 && !(weekly * (tenure - 1) < financed && financed <= weekly * tenure)) {
    throw new Error('Tenure must equal financed / weekly amount, rounded up; the final installment may be smaller.');
  }
  let remaining = financed;
  return Array.from({ length: tenure }, (_, index) => {
    const amount = Math.min(weekly, remaining);
    remaining -= amount;
    return { due_date: addDays(startDate, index * 7), due_paise: amount, status: amount ? 'PENDING' : 'PAID' };
  });
};

const applyPayment = (dues, amount) => {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Collection amount must be greater than zero.');
  const balance = dues.reduce((sum, due) => sum + due.due_paise - due.paid_paise, 0);
  if (amount > balance) throw new Error(`Collection exceeds the sale balance of ${rupees(balance).toFixed(2)}.`);
  let remaining = amount;
  const updated = dues.map(due => {
    const applied = Math.min(remaining, due.due_paise - due.paid_paise);
    remaining -= applied;
    const paid_paise = due.paid_paise + applied;
    return { ...due, paid_paise, status: paid_paise === due.due_paise ? 'PAID' : paid_paise ? 'PARTIAL' : 'PENDING' };
  });
  return { dues: updated, closed: updated.every(due => due.status === 'PAID') };
};

module.exports = { moneyToPaise, rupees, positiveInteger, validDay, addDays, schedule, applyPayment };
