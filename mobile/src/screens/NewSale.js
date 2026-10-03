import React, { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { CalendarDays, Plus } from 'lucide-react-native';
import { useSession } from '../context';
import { useLoad } from '../useLoad';
import { errorText } from '../api';
import { C, money, today, styles as s } from '../theme';
import { Page, Title, Field, Button, Chip, Notice, Loading, Empty } from '../components';

export function NewSale({ route, navigation }) {
  const { api, line } = useSession();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState('1');
  const [total, setTotal] = useState('');
  const [down, setDown] = useState('0');
  const [weekly, setWeekly] = useState('');
  const [tenure, setTenure] = useState('4');
  const [start, setStart] = useState(today);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const load = useLoad(useCallback(async () => (await api.get('/products')).data, [api]));
  const financed = Math.round((Number(total || 0) - Number(down || 0)) * 100) / 100;
  const suggested = Number(tenure) > 0 ? Math.ceil(Math.max(0, financed) * 100 / Number(tenure)) / 100 : 0;
  const weeklyValue = weekly || String(suggested || '');
  const save = async () => {
    if (saving.current) return;
    setError('');
    if (!product) return setError('Select a product.');
    if (!/^[1-9]\d*$/.test(qty) || !/^[1-9]\d*$/.test(tenure)) return setError('Quantity and tenure must be positive whole numbers.');
    if (![total, down || '0', weeklyValue].every(v => /^\d+(\.\d{1,2})?$/.test(v)) || Number(total) <= 0) return setError('Enter valid total, down payment, and weekly amounts.');
    if (financed < 0) return setError('Down payment cannot exceed total EMI.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || Number.isNaN(Date.parse(start))) return setError('Enter a purchase date as YYYY-MM-DD.');
    saving.current = true; setBusy(true);
    try {
      const { data } = await api.post('/sales', { line_id: line.id, customer_id: route.params.customerId, product_id: product.id,
        qty: Number(qty), total_emi: total, down_payment: down || '0', weekly_amt: financed === 0 ? '1' : weeklyValue, tenure_weeks: Number(tenure), start_date: start });
      navigation.navigate('Customer', { customerId: route.params.customerId, message: 'Sale #' + data.sale_id + ' created. ' + data.dues + ' weekly dues are ready.' });
    } catch (e) { setError(errorText(e)); } finally { saving.current = false; setBusy(false); }
  };
  return <Page>
    <Title eyebrow={line.name + ' / NEW SALE'} title="Start an EMI plan" subtitle={route.params.customerName} />
    <Notice text={load.error} />
    {load.loading && !load.data && <Loading />}
    {load.error && <Button title="Retry products" onPress={load.reload} secondary />}
    <Text style={s.label}>Choose a product</Text>
    <View style={{ gap: 8 }}>{load.data?.filter(p => p.available > 0).map(p => <Chip key={p.id} title={p.name + ' · ' + money(p.emi_price) + ' · ' + p.available + ' left'} selected={product?.id === p.id} onPress={() => { setProduct(p); setTotal(String(Math.round(p.emi_price * Number(qty || 1) * 100) / 100)); setWeekly(''); }} />)}</View>
    {load.data && !load.data.some(p => p.available > 0) && <Empty title="Add stock first" detail="Products with available stock will appear here." />}
    <View style={s.card}>
      <Field label="Quantity" value={qty} onChangeText={v => { setQty(v); if (product) setTotal(String(Math.round(product.emi_price * Number(v || 0) * 100) / 100)); }} keyboardType="number-pad" />
      <Field label="Total EMI price (₹)" value={total} onChangeText={setTotal} keyboardType="decimal-pad" />
      <Field label="Down payment (₹)" value={down} onChangeText={setDown} keyboardType="decimal-pad" />
      <View style={s.row}><Field style={{ flex: 1 }} label="Tenure (weeks)" value={tenure} onChangeText={setTenure} keyboardType="number-pad" /><Field style={{ flex: 1 }} label="Weekly amount (₹)" value={weeklyValue} onChangeText={setWeekly} keyboardType="decimal-pad" /></View>
      <Field label="Purchase date" value={start} onChangeText={setStart} placeholder="YYYY-MM-DD" autoCapitalize="none" />
    </View>
    <View style={[s.card, { backgroundColor: C.goldTint }]}><Text style={s.eyebrow}>PLAN SUMMARY</Text><View style={s.between}><Text style={s.body}>Amount financed</Text><Text style={s.heading}>{money(financed)}</Text></View><Text style={s.muted}>First due: {start}. Following dues fall every 7 days. The last installment covers the exact remaining balance.</Text><Text style={s.muted}>Down payment reduces the balance. Daily collection totals include payments saved in Collect.</Text></View>
    <Notice text={error} /><Button title="Create EMI sale" icon={Plus} busy={busy} disabled={!product} onPress={save} />
  </Page>;
}
