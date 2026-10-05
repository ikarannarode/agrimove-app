import React, { useState } from 'react';
import { Link } from 'expo-router';
import { Button, Card, Field, Notice, Page } from '@/components/TransportUI';
import { useAuth } from '@/lib/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('ईमेल आणि पासवर्ड भरा.');
      return;
    }
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'लॉगिन करता आले नाही. पुन्हा प्रयत्न करा.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="स्मार्ट कृषी मालवाहतूक व्यवस्थापन प्रणाली" subtitle="शेतकरी आणि वाहनमालकांसाठी विश्वासार्ह सेवा">
      {!isSupabaseConfigured ? <Notice>लॉगिनसाठी Supabase जोडा. स्थानिक .env फाइलमध्ये URL आणि anon key भरा आणि Expo पुन्हा सुरू करा.</Notice> : null}
      {error ? <Notice>{error}</Notice> : null}
      <Card>
        <Field label="ईमेल" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" />
        <Field label="पासवर्ड" value={password} onChangeText={setPassword} placeholder="तुमचा पासवर्ड" secureTextEntry />
        <Button title={busy ? 'लॉगिन होत आहे...' : 'लॉगिन'} onPress={() => void submit()} disabled={busy || !isSupabaseConfigured} />
        <Link href="/(auth)/register" style={{ color: '#236b43', textAlign: 'center', padding: 10, fontSize: 16 }}>
          नवीन खाते तयार करा
        </Link>
      </Card>
    </Page>
  );
}
