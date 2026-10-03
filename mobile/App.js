import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, StatusBar, ActivityIndicator } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Users, Banknote, Package, BarChart3, LayoutDashboard, ChevronDown, ArrowLeft } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import { localApi, getDatabase } from './src/local/store';
import { SessionContext, useSession } from './src/context';
import { C, F, styles as s } from './src/theme';
import { Login, Lines } from './src/screens/Auth';
import { Customers, Customer } from './src/screens/Customers';
import { Collect } from './src/screens/Collect';
import { Stock } from './src/screens/Stock';
import { NewSale } from './src/screens/NewSale';
import { Reports, Dashboard } from './src/screens/Reports';
import { Backup } from './src/screens/Backup';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const icons = { Customers: Users, Collect: Banknote, Stock: Package, Reports: BarChart3 };
const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: C.primary, background: C.bg, card: C.card, text: C.text, border: C.border } };

function Header({ navigation, route, back }) {
  const { line, selectLine } = useSession();
  const switchLine = () => { navigation.reset({ index: 0, routes: [{ name: 'Lines' }] }); selectLine(null); };
  return <SafeAreaView edges={['top']} style={{ backgroundColor: C.card, borderBottomWidth: 1, borderColor: C.border }}>
    <View style={[s.between, { paddingHorizontal: 16, paddingVertical: 9, maxWidth: 720, width: '100%', alignSelf: 'center' }]}>
      <View style={[s.row, { gap: 8 }]}>
        {route.name !== 'Workspace' && <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={() => navigation.goBack()} style={s.iconButton}><ArrowLeft size={21} color={C.primary} /></Pressable>}
        <View><Text style={{ fontFamily: F.head, fontSize: 12, letterSpacing: 0.7, color: C.primary }}>NATIONAL</Text><Text style={[s.eyebrow, { fontSize: 8, letterSpacing: 1.5 }]}>ENTERPRISES</Text></View>
      </View>
      {line && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Switch line" onPress={switchLine} style={[s.row, { paddingHorizontal: 10, minHeight: 44, backgroundColor: C.bg, borderRadius: 8, gap: 6 }]}><Text style={{ fontFamily: F.bold, fontSize: 14, color: C.primary }}>{line?.name}</Text><ChevronDown size={14} color={C.primary} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Dashboard" onPress={() => navigation.navigate('Dashboard')} style={s.iconButton}><LayoutDashboard size={20} color={route.name === 'Dashboard' ? C.cta : C.primary} /></Pressable>
      </View>}
    </View>
  </SafeAreaView>;
}

function Workspace() {
  const { line } = useSession();
  const insets = useSafeAreaInsets();
  if (!line) return null;
  return <Tab.Navigator key={line.id} screenOptions={({ route }) => ({
    headerShown: false,
    tabBarActiveTintColor: C.cta,
    tabBarInactiveTintColor: C.muted,
    tabBarLabelStyle: { fontFamily: F.bold, fontSize: 12, marginTop: 2 },
    tabBarStyle: { backgroundColor: C.card, borderTopColor: C.border, height: 68 + insets.bottom, paddingTop: 8, paddingBottom: Math.max(8, insets.bottom) },
    tabBarIcon: ({ color }) => { const Icon = icons[route.name]; return <Icon size={22} strokeWidth={1.8} color={color} />; },
  })}>
    <Tab.Screen name="Customers" component={Customers} />
    <Tab.Screen name="Collect" component={Collect} />
    <Tab.Screen name="Stock" component={Stock} />
    <Tab.Screen name="Reports" component={Reports} />
  </Tab.Navigator>;
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Lexend_600SemiBold: require('@expo-google-fonts/lexend/600SemiBold/Lexend_600SemiBold.ttf'),
    SourceSans3_400Regular: require('@expo-google-fonts/source-sans-3/400Regular/SourceSans3_400Regular.ttf'),
    SourceSans3_600SemiBold: require('@expo-google-fonts/source-sans-3/600SemiBold/SourceSans3_600SemiBold.ttf'),
  });
  const [session, setSession] = useState(false);
  const [line, selectLine] = useState(null);
  const [startup, setStartup] = useState({ loading: true, hasPin: false, error: '' });
  useEffect(() => { let live = true; Promise.all([getDatabase(), SecureStore.getItemAsync('national-enterprises-local-pin-v1')]).then(([, pin]) => { if (live) setStartup({ loading: false, hasPin: !!pin, error: '' }); }).catch(error => { if (live) setStartup({ loading: false, hasPin: false, error: error.message }); }); return () => { live = false; }; }, []);
  const signOut = useCallback(() => { setSession(false); selectLine(null); }, []);
  const signIn = useCallback(() => setSession(true), []);
  const context = useMemo(() => ({ api: localApi, line, selectLine, signIn, signOut, username: 'admin' }), [line, signIn, signOut]);
  return <SafeAreaProvider><StatusBar barStyle="dark-content" backgroundColor={C.card} />
    {(!fontsLoaded && !fontError) || startup.loading ? <View style={[s.screen, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={C.primary} /></View> : startup.error ? <View style={[s.screen, { padding: 24, justifyContent: 'center' }]}><Text style={s.heading}>Could not open this phone's database</Text><Text style={s.body}>{startup.error}</Text></View> :
      <SessionContext.Provider value={context}><NavigationContainer theme={theme}>
        <Stack.Navigator screenOptions={{ header: props => <Header {...props} /> }}>
          {!session ? <Stack.Screen name="Login" options={{ headerShown: false }}>{props => <SafeAreaView style={s.screen} edges={['top', 'bottom']}><Login {...props} hasPin={startup.hasPin} onPinCreated={() => setStartup(x => ({ ...x, hasPin: true }))} /></SafeAreaView>}</Stack.Screen> : <>
            <Stack.Screen name="Lines" options={{ headerShown: false }}>{props => <SafeAreaView style={s.screen} edges={['top', 'bottom']}><Lines {...props} /></SafeAreaView>}</Stack.Screen>
            <Stack.Screen name="Workspace" component={Workspace} />
            <Stack.Screen name="Dashboard" component={Dashboard} />
            <Stack.Screen name="Customer" component={Customer} />
            <Stack.Screen name="NewSale" component={NewSale} />
            <Stack.Screen name="Backup" component={Backup} />
          </>}
        </Stack.Navigator>
      </NavigationContainer></SessionContext.Provider>}
  </SafeAreaProvider>;
}
