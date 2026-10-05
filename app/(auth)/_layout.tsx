import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/lib/AuthContext';
import { Loading } from '@/components/TransportUI';

export default function AuthLayout() {
  const { session, loading } = useAuth();
  if (loading) return <Loading />;
  if (session) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
