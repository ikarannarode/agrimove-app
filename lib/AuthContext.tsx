import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppRole, Profile, isSupabaseConfigured, supabase } from '@/lib/supabase';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string, role: AppRole, phone: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const loadProfile = useCallback(async (user: User | null) => {
    if (!user) {
      setProfile(null);
      setProfileError(null);
      return;
    }
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (error) {
        setProfile(null);
        setProfileError(error.message);
        return;
      }
      if (data?.role === 'farmer' || data?.role === 'vehicle_owner') {
        setProfile(data as Profile);
        setProfileError(null);
        return;
      }
      setProfile(null);
      setProfileError(data ? 'ही भूमिका मोबाइल अॅपमध्ये उपलब्ध नाही.' : 'तुमचे खाते तयार होत आहे. कृपया पुन्हा प्रयत्न करा.');
    } catch (error) {
      setProfile(null);
      setProfileError(error instanceof Error ? error.message : 'प्रोफाइल लोड करता आले नाही.');
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile(session?.user ?? null);
  }, [loadProfile, session?.user]);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        if (!isSupabaseConfigured) return;
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error) setProfileError(error.message);
        setSession(data.session);
        await loadProfile(data.session?.user ?? null);
      } catch (error) {
        if (!mounted) return;
        setSession(null);
        setProfile(null);
        setProfileError(error instanceof Error ? error.message : 'प्रमाणीकरण माहिती मिळाली नाही.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void initialize();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      void loadProfile(nextSession?.user ?? null).finally(() => setLoading(false));
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (
    name: string,
    email: string,
    password: string,
    role: AppRole,
    phone: string,
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name.trim(), phone: phone.trim(), role } },
    });
    if (error) throw error;
    return Boolean(data.session);
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo(
    () => ({ session, profile, loading, profileError, refreshProfile, signIn, signUp, signOut }),
    [session, profile, loading, profileError, refreshProfile, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
