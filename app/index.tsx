import { useState } from 'react';
import { Redirect } from 'expo-router';
import { Button, Loading, Notice, Page } from '@/components/TransportUI';
import { useAuth } from '@/lib/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function Index() {
  const { session, profile, loading, profileError, signOut } = useAuth();
  const [error, setError] = useState<string | null>(null);

  if (loading) return <Loading />;
  if (!isSupabaseConfigured) return <Redirect href="/(auth)/login" />;
  if (!session) return <Redirect href="/(auth)/login" />;
  if (profile) return <Redirect href="/(tabs)/home" />;
  return (
    <Page title="खातेची माहिती उपलब्ध नाही" subtitle="या भूमिकेसाठी मोबाइल अॅपमध्ये प्रवेश नाही.">
      <Notice>{error ?? profileError ?? 'प्रोफाइल माहिती मिळाली नाही. पुन्हा लॉगिन करा.'}</Notice>
      <Button title="लॉगआउट" onPress={() => {
        void signOut().catch((signOutError: unknown) => {
          setError(signOutError instanceof Error ? signOutError.message : 'लॉगआउट करता आले नाही.');
        });
      }} />
    </Page>
  );
}
