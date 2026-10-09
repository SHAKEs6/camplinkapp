import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { signInWithGoogle, supabase } from './src/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { MobileApp } from './src/screens/MobileApp';
import camplinkLogo from './assets/camplink-logo.png';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [paymentReturn, setPaymentReturn] = useState<{ orderId: string; cancel: boolean } | null>(null);
  const handledLinks = useRef(new Set<string>());

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) Alert.alert('Session check failed', error.message);
      setSession(data.session);
      setLoading(false);
    }).catch((error: unknown) => {
      Alert.alert('Session check failed', error instanceof Error ? error.message : 'Could not restore your session.');
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    const handleUrl = async (url: string | null) => {
      if (!url || handledLinks.current.has(url)) return;
      handledLinks.current.add(url);
      try {
        const parsed = Linking.parse(url);
        const params = parsed.queryParams ?? {};
        const code = typeof params.code === 'string' ? params.code : null;
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          const accessToken = typeof params.access_token === 'string' ? params.access_token : null;
          const refreshToken = typeof params.refresh_token === 'string' ? params.refresh_token : null;
          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            if (error) throw error;
          }
        }
        if (typeof params.order === 'string') setPaymentReturn({ orderId: params.order, cancel: params.cancel === '1' });
      } catch (error) {
        Alert.alert('Could not complete sign-in', error instanceof Error ? error.message : 'Please try signing in again.');
      }
    };
    Linking.getInitialURL().then(handleUrl);
    const urlSubscription = Linking.addEventListener('url', event => handleUrl(event.url));

    return () => { listener.subscription.unsubscribe(); urlSubscription.remove(); };
  }, []);

  const submit = async () => {
    setMessage('');
    if (!email.trim() || !password) {
      setMessage('Enter your email address and password to continue.');
      return;
    }
    setBusy(true);
    try {
      const result = mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password });
      if (result.error) setMessage(result.error.message);
      else if (mode === 'signup' && !result.data.session) setMessage('Account created. Check your email to confirm your address.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const continueWithGoogle = async () => {
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await signInWithGoogle();
      if (error) throw error;
      if (Platform.OS === 'web' && data.url) window.location.assign(data.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start Google sign-in.');
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (!paymentReturn || !session) return;
    const finalize = async () => {
      if (paymentReturn.cancel) {
        Alert.alert('Payment cancelled', 'No payment was taken.');
        setPaymentReturn(null);
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke('paypal-capture-order', { body: { order_id: paymentReturn.orderId } });
        if (error || data?.error) throw new Error(data?.error || error?.message || 'The PayPal payment could not be confirmed.');
        Alert.alert(data?.status === 'paid' ? 'Payment received' : 'Payment update', data?.status === 'paid' ? `KSh ${Number(data.amount || 0).toLocaleString()} added to your wallet.` : `Payment status: ${data?.status || 'pending'}.`);
      } catch (error) {
        Alert.alert('Payment confirmation pending', error instanceof Error ? error.message : 'Refresh your wallet in a moment.');
      } finally { setPaymentReturn(null); }
    };
    finalize();
  }, [paymentReturn, session]);

  if (loading) return <View style={styles.center}><ActivityIndicator color="#13795b" size="large" /><Text style={styles.muted}>Loading Camplink…</Text></View>;
  if (session) return <MobileApp session={session} />;

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Image source={camplinkLogo} style={styles.brandLogo} resizeMode="cover" />
        <Text style={styles.eyebrow}>CAMPLINK CONNECT</Text>
        <Text style={styles.title}>{mode === 'signin' ? 'Your campus,\nconnected.' : 'Find your place\non campus.'}</Text>
        <Text style={styles.subtitle}>Sign in with your Camplink account to find good things close to home.</Text>
        <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
        <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@example.com" placeholderTextColor="#8a9990" value={email} onChangeText={setEmail} style={styles.input} returnKeyType="next" />
        <Text style={styles.fieldLabel}>PASSWORD</Text>
        <TextInput secureTextEntry autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder="At least 6 characters" placeholderTextColor="#8a9990" value={password} onChangeText={setPassword} style={styles.input} onSubmitEditing={submit} />
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <Pressable style={[styles.button, busy && styles.buttonDisabled]} disabled={busy} onPress={submit}>
          {busy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>{mode === 'signin' ? 'Sign in' : 'Create account'}  →</Text>}
        </Pressable>
        <View style={styles.orRow}><View style={styles.orLine} /><Text style={styles.orText}>OR CONTINUE WITH</Text><View style={styles.orLine} /></View>
        <Pressable style={[styles.googleButton, busy && styles.buttonDisabled]} disabled={busy} onPress={continueWithGoogle}>
          <Text style={styles.googleIcon}>G</Text><Text style={styles.googleButtonText}>Continue with Google</Text>
        </Pressable>
        <Pressable onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(''); }}><Text style={styles.switchText}>{mode === 'signin' ? 'New to Camplink?  Create an account' : 'Already have an account?  Sign in'}</Text></Pressable>
        <Text style={styles.legal}>By continuing, you agree to keep your campus community kind and safe.</Text>
      </KeyboardAvoidingView>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0b0a16' },
  center: { flex: 1, gap: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b0a16' },
  content: { flex: 1, paddingHorizontal: 28, justifyContent: 'center' },
  brandLogo: { width: 92, height: 92, borderRadius: 24, marginBottom: 22, borderWidth: 1, borderColor: '#6c56ec' },
  eyebrow: { color: '#b3a4ff', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
  title: { color: '#f7f4ff', fontSize: 39, fontWeight: '800', lineHeight: 43, letterSpacing: -1.1, marginBottom: 12 },
  subtitle: { color: '#aaa5c4', fontSize: 14, lineHeight: 21, marginBottom: 27, maxWidth: 320 },
  muted: { color: '#aaa5c4', fontSize: 13 },
  fieldLabel: { color: '#cbc5e1', fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginBottom: 7 },
  input: { backgroundColor: '#141122', borderColor: '#302a49', borderRadius: 14, borderWidth: 1, color: '#f7f4ff', fontSize: 14, marginBottom: 16, paddingHorizontal: 15, paddingVertical: 15 },
  button: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#6c56e8', borderRadius: 14, padding: 16, marginTop: 3, minHeight: 52 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  orLine: { flex: 1, height: 1, backgroundColor: '#302a49' },
  orText: { color: '#827d9c', fontSize: 8, fontWeight: '800', letterSpacing: 1.1 },
  googleButton: { height: 50, borderRadius: 14, borderWidth: 1, borderColor: '#3b3555', backgroundColor: '#141122', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  googleIcon: { color: '#f7f4ff', fontWeight: '900', fontSize: 17 },
  googleButtonText: { color: '#f7f4ff', fontSize: 13, fontWeight: '700' },
  switchText: { color: '#b3a4ff', fontSize: 12, fontWeight: '700', marginTop: 19, textAlign: 'center' },
  message: { color: '#ff777e', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  legal: { color: '#827d9c', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 26, paddingHorizontal: 15 },
});
