import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, requireSupabase } from '../lib/supabase';
import type { Profile } from '../lib/types';
import { AuthContext, type AuthStatus } from './context';

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<AuthStatus>(isSupabaseConfigured ? 'loading' : 'misconfigured');
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    setProfile(null);
    setError(null);
    if (!nextSession) {
      setStatus('signed-out');
      return;
    }
    setStatus('loading');
    try {
      const { data, error: profileError } = await requireSupabase()
        .from('profiles')
        .select('id,full_name,phone,role,created_at')
        .eq('id', nextSession.user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!data) {
        setStatus('denied');
        return;
      }
      const nextProfile = data as Profile;
      setProfile(nextProfile);
      setStatus(nextProfile.role === 'admin' ? 'admin' : 'denied');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to verify administrator access.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let active = true;
    const supabase = requireSupabase();
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        setError(sessionError.message);
        setStatus('error');
        return;
      }
      void loadSession(data.session);
    }).catch((loadError: unknown) => {
      if (!active) return;
      setError(loadError instanceof Error ? loadError.message : 'Unable to restore the login session.');
      setStatus('error');
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      queueMicrotask(() => {
        if (active) void loadSession(nextSession);
      });
    });
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [loadSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error: signInError } = await requireSupabase().auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
  }, []);

  const signOut = useCallback(async () => {
    const { error: signOutError } = await requireSupabase().auth.signOut();
    if (signOutError) throw signOutError;
  }, []);

  const value = useMemo(
    () => ({ session, profile, status, error, signIn, signOut }),
    [session, profile, status, error, signIn, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
