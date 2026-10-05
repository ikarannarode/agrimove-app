import { useContext } from 'react';
import { AuthContext } from './context';

export function useAdminAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAdminAuth must be used within AuthProvider');
  return context;
}
