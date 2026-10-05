import { createContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '../lib/types';

export type AuthStatus = 'loading' | 'signed-out' | 'admin' | 'denied' | 'error' | 'misconfigured';

export type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  status: AuthStatus;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
