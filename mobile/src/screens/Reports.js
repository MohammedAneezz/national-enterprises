import React, { useCallback, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ArrowUpRight, Users, Banknote, Package, BarChart3, ArrowRight } from 'lucide-react-native';
import { useSession } from '../context';
import { useLoad } from '../useLoad';
import { C, F, money, today, styles as s } from '../theme';
import { Page, Title, Field, Button, Notice, Loading, Empty, Chip, Badge } from '../components';

function Summary({ report }) {
  return <>
    <View style={[s.card, { backgroundColor: C.primary, borderColor: C.primary, padding: 22, gap: 18 }]}>
      <View style={s.between}><Text style={[s.eyebrow, { color: '#CBD5E1' }]}>TOTAL COLLECTED</Text><ArrowUpRight size={22} color="#FCD34D" /></View>
      <Text style={[s.metric, { color: 'white', fontSize: 38 }]}>{money(report.collected_amount)}</Text>
      <Text style={[s.muted, { color: '#CBD5E1' }]}>{report.collected_count} collections recorded</Text>
      <View style={{ height: 1, backgroundColor: '#334155' }} />
      <View style={s.row}>{[['CASH', report.cash], ['UPI', report.upi]].map(([label, amount]) => <View key={label} style={{ flex: 1, gap: 5 }}><Text style={[s.eyebrow, { color: '#94A3B8' }]}>{label}</Text><Text style={[s.heading, { color: 'white', fontSize: 20 }]}>{money(amount)}</Text></View>)}</View>
    </View>
    <View style={s.row}>
      <View style={[s.card, { flex: 1 }]}><Text style={s.eyebrow}>SALES</Text><Text style={[s.metric, { fontSize: 23 }]}>{money(report.sales_amount)}</Text><Text style={s.muted}>{report.sales_count} sales</Text></View>
      <View style={[s.card, { flex: 1 }]}><Text style={s.eyebrow}>DUES TODAY</Text><Text style={[s.metric, { fontSize: 23 }]}>{report.due_today_count}</Text><Text style={s.muted}>Weekly installments</Text></View>
    </View>
    <View style={s.row}>
      {[['Left-outs', report.left_out_count, 'Unpaid for this day'], ['Overdue', report.overdue_count, 'From earlier days']].map(([label, count, detail]) => <View key={label} style={[s.card, { flex: 1, borderColor: '#FECACA' }]}><Text style={s.label}>{label}</Text><Text style={[s.metric, { color: C.danger }]}>{count}</Text><Text style={s.muted}>{detail}</Text></View>)}
    </View>
  </>;
}

export function Reports({ navigation }) {
  const { api, line } = useSession();
  const [day, setDay] = useState(today);
  const [draftDay, setDraftDay] = useState(day);
  const [filter, setFilter] = useState('left_outs');
  const [error, setError] = useState('');
  const load = useLoad(useCallback(async () => (await api.get('/reports/daily', { params: { line_id: line.id, day } })).data, [api, line.id, day]));
  const showDay = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draftDay) || Number.isNaN(Date.parse(draftDay)) || new Date(draftDay).toISOString().slice(0, 10) !== draftDay) return setError('Use a valid date in YYYY-MM-DD format.');
    setError(''); setDay(draftDay); if (draftDay === day) load.reload();
  };
  const report = load.data;
  return <Page refreshing={load.loading} onRefresh={load.reload}>
    <Title eyebrow={line.name + ' / DAILY REPORT'} title="The day, in numbers" subtitle="Sales, collections, and customers to follow up." />
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}><Field style={{ flex: 1 }} label="Report date" value={draftDay} onChangeText={setDraftDay} placeholder="YYYY-MM-DD" /><Button title="Show" onPress={showDay} secondary /></View>
    <Notice text={error || load.error} />
    {load.loading && !report && <Loading />}{load.error && <Button title="Retry" secondary onPress={load.reload} />}
    {report && <>
      <Text style={s.eyebrow}>{report.day}</Text><Summary report={report} />
      <View style={s.row}><Chip title={'Left-outs (' + report.left_out_count + ')'} selected={filter === 'left_outs'} onPress={() => setFilter('left_outs')} /><Chip title={'Overdue (' + report.overdue_count + ')'} selected={filter === 'overdue'} onPress={() => setFilter('overdue')} /></View>
      {!report[filter].length && <Empty title={filter === 'left_outs' ? 'No left-outs for this day' : 'No overdue installments'} detail="All clear in this list." />}
      {report[filter].map(due => <View key={due.due_id} style={s.card}>
        <View style={s.between}><Text style={[s.heading, { flex: 1 }]}>{due.customer_name}</Text><Badge text={filter === 'overdue' ? 'OVERDUE' : due.status} danger /></View>
        <Text style={s.muted}>{due.area || 'Area not set'} · Sale #{due.sale_id}</Text><Text style={s.muted}>Due {due.due_date} · Paid {money(due.paid_amt)}</Text>
        <View style={s.between}><Text style={[s.heading, { color: C.danger }]}>{money(due.balance)} left</Text><Chip title="Collect" onPress={() => navigation.navigate('Collect', { saleId: due.sale_id })} /></View>
      </View>)}
    </>}
  </Page>;
}

export function Dashboard({ navigation }) {
  const { api, line } = useSession();
  const load = useLoad(useCallback(async () => (await api.get('/reports/daily', { params: { line_id: line.id } })).data, [api, line.id]));
  return <Page refreshing={load.loading} onRefresh={load.reload}>
    <Title eyebrow={line.name + ' / OVERVIEW'} title="Ready for the day" subtitle={load.data?.day || 'Your daily workspace'} />
    <Notice text={load.error} />{load.loading && !load.data && <Loading />}
    {load.error && <Button title="Retry" onPress={load.reload} secondary />}
    {load.data && <Summary report={load.data} />}
    <Text style={s.heading}>Your workspace</Text>
    {[['Customers', 'Manage customers & EMI sales', Users], ['Collect', 'Record Cash or UPI payments', Banknote], ['Stock', 'Receive stock & check availability', Package], ['Reports', 'Review left-outs & overdue dues', BarChart3]].map(([screen, detail, Icon]) => <Pressable accessibilityRole="button" accessibilityLabel={'Go to ' + screen} key={screen} style={[s.card, s.row]} onPress={() => navigation.navigate('Workspace', { screen })}><View style={{ padding: 10, borderRadius: 8, backgroundColor: C.blueTint }}><Icon size={21} color={C.secondary} /></View><View style={{ flex: 1 }}><Text style={s.heading}>{screen}</Text><Text style={s.muted}>{detail}</Text></View><ArrowRight size={20} color={C.cta} /></Pressable>)}
  </Page>;
}
