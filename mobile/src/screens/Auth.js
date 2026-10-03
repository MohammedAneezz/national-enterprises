import React, { useCallback, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ArrowRight, Building2, LogOut, ShieldCheck } from 'lucide-react-native';
import { C, F, styles as s } from '../theme';
import { Page, Title, Field, Button, Notice, Loading } from '../components';
import { useSession } from '../context';
import { defaultServer, normalizeServer, createApi, errorText } from '../api';
import { useLoad } from '../useLoad';

export function Login() {
  const { signIn } = useSession();
  const [server, setServer] = useState(defaultServer);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const login = async () => {
    if (busy) return;
    setError('');
    if (!username.trim() || !password) return setError('Enter your username and password.');
    setBusy(true);
    try {
      const url = normalizeServer(server);
      const { data } = await createApi(url).post('/auth/login', { username: username.trim(), password });
      signIn(url, data.access_token, data.username || username.trim());
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  return <Page contentStyle={{ paddingTop: 44, gap: 30 }}>
    <View style={s.row}><View style={{ padding: 12, backgroundColor: C.primary, borderRadius: 10 }}><Building2 size={25} color="white" /></View><View><Text style={{ fontFamily: F.head, fontSize: 16, letterSpacing: 1, color: C.primary }}>NATIONAL</Text><Text style={[s.eyebrow, { letterSpacing: 2.4 }]}>ENTERPRISES</Text></View></View>
    <View style={{ height: 3, width: 42, backgroundColor: C.cta }} />
    <Title eyebrow="WEEKLY EMI COLLECTIONS" title={'Every collection.\nAccounted for.'} subtitle="Your customers, collections, and stock. One workspace for each line." />
    <View style={s.card}>
      <Text style={s.heading}>Welcome back</Text>
      <Field label="Server URL" value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="http://192.168.1.5:8000/api/v1" />
      <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} autoComplete="username" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" onSubmitEditing={login} />
      <Notice text={error} />
      <Button title="Sign in" icon={ArrowRight} busy={busy} onPress={login} />
    </View>
    <View style={s.row}><ShieldCheck size={17} color={C.muted} /><Text style={[s.muted, { flex: 1 }]}>Admin access · First sign-in: admin / admin123</Text></View>
  </Page>;
}

export function Lines({ navigation }) {
  const { api, username, selectLine, signOut } = useSession();
  const load = useLoad(useCallback(async () => (await api.get('/lines')).data, [api]));
  return <Page onRefresh={load.reload} refreshing={load.loading}>
    <View style={s.between}><View><Text style={[s.eyebrow, { color: C.primary }]}>NATIONAL ENTERPRISES</Text><Text style={s.muted}>Signed in as {username}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Sign out" style={s.iconButton} onPress={signOut}><LogOut size={21} color={C.primary} /></Pressable></View>
    <View style={{ paddingTop: 25, gap: 10 }}><Title eyebrow="YOUR WORKSPACES" title="Choose a line" subtitle="Open a workspace to manage the day's work." /></View>
    <Notice text={load.error} />
    {load.error && <Button title="Retry" secondary onPress={load.reload} />}
    {load.loading && !load.data && <Loading />}
    {load.data?.map((line, i) => <Pressable accessibilityRole="button" accessibilityLabel={'Open ' + line.name} key={line.id} onPress={() => { selectLine(line); navigation.navigate('Workspace'); }} style={({ pressed }) => [s.card, { padding: 22, gap: 24, opacity: pressed ? 0.7 : 1 }]}>
      <View style={s.between}><View style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: F.head, color: 'white', fontSize: 24 }}>{line.name[0]}</Text></View><Text style={s.eyebrow}>0{i+1} / WORKSPACE</Text></View>
      <View style={s.between}><View style={{ flex: 1 }}><Text style={[s.heading, { fontSize: 23 }]}>{line.name}</Text><Text style={[s.muted, { marginTop: 5 }]}>Customers, collections & reports</Text></View><ArrowRight size={23} color={C.cta} /></View>
    </Pressable>)}
    <Text style={[s.muted, { textAlign: 'center' }]}>Collections are kept separate for each line.\nThe product catalog and stock are shared.</Text>
  </Page>;
}
