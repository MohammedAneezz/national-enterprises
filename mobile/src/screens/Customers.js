import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Plus, ChevronRight, UserRound, Search } from 'lucide-react-native';
import { useSession } from '../context';
import { errorText } from '../api';
import { useLoad } from '../useLoad';
import { C, styles as s, money } from '../theme';
import { Page, Title, Field, Button, Chip, Notice, Empty, Loading, Badge } from '../components';

export function Customers({ navigation }) {
  const { api, line } = useSession();
  const [filterArea, setFilterArea] = useState('');
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [phone, setPhone] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const load = useLoad(useCallback(async () => {
    const [customers, areas] = await Promise.all([api.get('/customers', { params: { line_id: line.id, area: filterArea || undefined, q: query || undefined } }), api.get('/areas', { params: { line_id: line.id } })]);
    return { customers: customers.data, areas: areas.data };
  }, [api, line.id, filterArea, query]));
  const add = async () => {
    if (busy) return;
    setError(''); setSaved('');
    if (!name.trim()) return setError('Enter the customer name.');
    setBusy(true);
    try {
      await api.post('/customers', { line_id: line.id, name: name.trim(), area: area.trim(), phone: phone.trim(), notes: '' });
      setName(''); setPhone(''); setArea(''); setFilterArea(''); setQuery(''); setAdding(false);
      setSaved('Customer added. Open their record to start an EMI sale.');
      await load.reload();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  return <Page onRefresh={load.reload} refreshing={load.loading}>
    <Title eyebrow={line.name + ' / CUSTOMER BOOK'} title="Customers" subtitle="A clear record of every customer." />
    <Button title={adding ? 'Close customer form' : '+ Add Customer'} icon={Plus} onPress={() => { setAdding(!adding); setError(''); }} />
    {adding && <View style={s.card}><Text style={s.heading}>New customer</Text><Field label="Customer name" value={name} onChangeText={setName} placeholder="e.g. Ravi Kumar" /><Field label="Area" value={area} onChangeText={setArea} placeholder="e.g. Kovilpatti" /><Field label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" /><Button title="Save customer" onPress={add} busy={busy} /></View>}
    <Notice text={error || load.error} /><Notice text={saved} success />
    <Field label="Find a customer" value={query} onChangeText={setQuery} placeholder="Search by name or phone" />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}><Chip title="All areas" selected={!filterArea} onPress={() => setFilterArea('')} />{load.data?.areas.map(a => <Chip key={a} title={a} selected={a === filterArea} onPress={() => setFilterArea(a)} />)}</ScrollView>
    <View style={s.between}><Text style={s.eyebrow}>CUSTOMER LIST</Text><Text style={s.muted}>{load.data?.customers.length ?? '—'} records</Text></View>
    {load.loading && !load.data && <Loading />}
    {load.error && <Button title="Retry" secondary onPress={load.reload} />}
    {load.data?.customers.length === 0 && <Empty title="No customers here yet" detail={filterArea || query ? 'Try another area or search.' : 'Add your first customer to start an EMI sale.'} />}
    {load.data?.customers.map(customer => <Pressable accessibilityRole="button" accessibilityLabel={'Open customer ' + customer.name} key={customer.id} style={s.card} onPress={() => navigation.navigate('Customer', { customerId: customer.id })}>
      <View style={s.between}><View style={{ flex: 1, gap: 4 }}><Text style={s.heading}>{customer.name}</Text><Text style={s.muted}>{customer.area || 'Area not set'} · {customer.phone || 'No phone'}</Text></View><ChevronRight size={19} color={C.muted} /></View>
      <View style={s.divider} /><View style={s.between}><Text style={s.muted}>Balance outstanding</Text><Text style={[s.heading, { color: Number(customer.outstanding) > 0 ? C.secondary : C.success }]}>{money(customer.outstanding)}</Text></View>
    </Pressable>)}
  </Page>;
}

export function Customer({ route, navigation }) {
  const { api, line } = useSession();
  const { customerId } = route.params;
  const load = useLoad(useCallback(async () => (await api.get('/customers/' + customerId, { params: { line_id: line.id } })).data, [api, line.id, customerId]));
  const [schedules, setSchedules] = useState({});
  useFocusEffect(useCallback(() => { setSchedules({}); }, []));
  const [error, setError] = useState('');
  const viewSchedule = async saleId => {
    if (schedules[saleId]) return setSchedules(x => ({ ...x, [saleId]: null }));
    try { const { data } = await api.get('/sales/' + saleId + '/schedule', { params: { line_id: line.id } }); setSchedules(x => ({ ...x, [saleId]: data })); }
    catch (e) { setError(errorText(e)); }
  };
  const data = load.data;
  return <Page refreshing={load.loading} onRefresh={() => { setSchedules({}); load.reload(); }}>
    <Notice text={error || load.error} /><Notice text={route.params.message} success />
    {load.loading && !data && <Loading />}
    {load.error && <Button title="Retry" secondary onPress={load.reload} />}
    {data && <>
      <Title eyebrow={line.name + ' / CUSTOMER #' + customerId} title={data.customer.name} subtitle={[data.customer.area, data.customer.phone].filter(Boolean).join(' · ')} />
      <View style={[s.card, { backgroundColor: C.primary, borderColor: C.primary }]}><Text style={[s.eyebrow, { color: '#CBD5E1' }]}>TOTAL OUTSTANDING</Text><Text style={[s.metric, { color: 'white', fontSize: 36 }]}>{money(data.customer.outstanding)}</Text></View>
      {!!data.customer.notes && <Text style={s.body}>{data.customer.notes}</Text>}
      <Button title="New EMI sale" icon={Plus} onPress={() => navigation.navigate('NewSale', { customerId, customerName: data.customer.name })} />
      <Text style={s.heading}>EMI sales</Text>
      {!data.sales.length && <Empty title="No sales yet" detail="Create a sale to generate the weekly schedule." />}
      {data.sales.map(sale => <View key={sale.id} style={s.card}><View style={s.between}><Text style={s.heading}>Sale #{sale.id}</Text><Badge text={sale.status} /></View><Text style={s.body}>{money(sale.financed)} financed · {money(sale.weekly_amt)} / week</Text><Text style={s.muted}>{sale.start_date} · {sale.tenure_weeks} weeks</Text>
        <View style={s.row}><Chip title={schedules[sale.id] ? 'Hide schedule' : 'View schedule'} onPress={() => viewSchedule(sale.id)} />{sale.status !== 'CLOSED' && <Chip title="Collect" onPress={() => navigation.navigate('Workspace', { screen: 'Collect', params: { saleId: sale.id } })} />}</View>
        {schedules[sale.id]?.map(due => <View key={due.id} style={{ borderTopWidth: 1, borderColor: C.border, paddingTop: 10, gap: 5 }}><View style={s.between}><Text style={s.body}>{due.due_date}</Text><Badge text={due.status} danger={due.status !== 'PAID'} /></View><Text style={s.muted}>Due {money(due.due_amt)} · Paid {money(due.paid_amt)}</Text></View>)}
      </View>)}
      <Text style={s.heading}>Payment history</Text>
      {!data.payments.length && <Text style={s.muted}>Collections will appear here after you save them.</Text>}
      {data.payments.map(payment => <View key={payment.id} style={s.card}><View style={s.between}><Text style={s.heading}>{money(payment.amount)}</Text><Badge text={payment.mode} /></View><Text style={s.muted}>Sale #{payment.sale_id} · Receipt #{payment.id} · {payment.collector}</Text><Text style={s.muted}>{new Date(payment.paid_at + (payment.paid_at.endsWith('Z') ? '' : 'Z')).toLocaleString('en-IN')}</Text>{!!payment.upi_ref && <Text style={s.muted}>Ref: {payment.upi_ref}</Text>}</View>)}
    </>}
  </Page>;
}
