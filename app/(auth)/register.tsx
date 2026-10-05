import React, { useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Field, Notice, Page } from '@/components/TransportUI';
import { useAuth } from '@/lib/AuthContext';
import { AppRole, isSupabaseConfigured } from '@/lib/supabase';

type SignUpRole = AppRole;

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<SignUpRole>('farmer');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setMessage(null);
    const mobileDigits = phone.replace(/\D/g, '');
    if (!name.trim() || mobileDigits.length < 10 || mobileDigits.length > 15
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || password.length < 8) {
      setError('नाव, वैध मोबाइल, ईमेल आणि किमान ८ अक्षरांचा पासवर्ड भरा.');
      return;
    }
    setBusy(true);
    try {
      const signedIn = await signUp(name, email.trim(), password, role, phone);
      if (!signedIn) setMessage('खाते तयार झाले. ईमेलची पुष्टी करून लॉगिन करा.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'खाते तयार करता आले नाही. पुन्हा प्रयत्न करा.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="नोंदणी" subtitle="शेतकरी किंवा वाहनमालक म्हणून खाते तयार करा">
      {!isSupabaseConfigured ? <Notice>नोंदणीपूर्वी स्थानिक .env फाइलमध्ये Supabase URL आणि anon key जोडा.</Notice> : null}
      {error ? <Notice>{error}</Notice> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}
      <Card>
        <Field label="पूर्ण नाव" value={name} onChangeText={setName} placeholder="तुमचे नाव" autoCapitalize="words" />
        <Field label="मोबाइल" value={phone} onChangeText={setPhone} placeholder="मोबाइल क्रमांक" keyboardType="phone-pad" />
        <Field label="ईमेल" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" />
        <Field label="पासवर्ड (किमान ८ अक्षरे)" value={password} onChangeText={setPassword} placeholder="पासवर्ड तयार करा" secureTextEntry />
        <Text style={styles.roleLabel}>तुमची भूमिका निवडा</Text>
        <View style={styles.roles}>
          {(['farmer', 'vehicle_owner'] as const).map((item) => (
            <Pressable
              key={item}
              onPress={() => setRole(item)}
              accessibilityRole="radio"
              accessibilityState={{ selected: role === item }}
              style={[styles.roleOption, role === item && styles.selectedRole]}
            >
              <Text style={[styles.roleText, role === item && styles.selectedRoleText]}>
                {item === 'farmer' ? 'शेतकरी' : 'वाहनमालक / चालक'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Button title={busy ? 'खाते तयार होत आहे...' : 'नोंदणी करा'} onPress={() => void submit()} disabled={busy || !isSupabaseConfigured} />
        <Link href="/(auth)/login" style={{ color: '#236b43', textAlign: 'center', padding: 10, fontSize: 16 }}>
          खाते आहे? लॉगिन करा
        </Link>
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  roleLabel: { fontWeight: '700', color: '#33493a' },
  roles: { flexDirection: 'row', gap: 10 },
  roleOption: { flex: 1, padding: 14, borderWidth: 1, borderColor: '#d6e0d8', borderRadius: 11, alignItems: 'center' },
  selectedRole: { backgroundColor: '#e8f1eb', borderColor: '#236b43' },
  roleText: { color: '#33493a', fontWeight: '600' },
  selectedRoleText: { color: '#236b43' },
});
