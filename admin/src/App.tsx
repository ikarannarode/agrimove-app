import { useState, type FormEvent } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { useAdminAuth } from './auth/useAdminAuth';
import { AdminShell } from './components/AdminShell';
import { isSupabaseConfigured } from './lib/supabase';
import { BookingDetailsPage, BookingsPage } from './pages/BookingsPage';
import { DashboardPage } from './pages/DashboardPage';
import { NotificationsPage, PaymentsPage, SettingsPage, TripsPage } from './pages/MonitoringPages';
import {
  FarmerDetailsPage,
  FarmersPage,
  OwnerDetailsPage,
  OwnersPage,
  VehicleDetailsPage,
  VehiclesPage,
} from './pages/ResourcePages';

function FullPageState({ title, message, error = false }: { title: string; message: string; error?: boolean }) {
  return (
    <main className="login-screen">
      <section className={`login-card ${error ? 'login-card-error' : ''}`}>
        <div className="brand-mark login-brand-mark">A</div>
        <p className="eyebrow">AGRIMOVE ADMIN</p>
        <h1>{title}</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}

function LoginPage() {
  const { status, error, signIn, signOut } = useAdminAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  if (status === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (status === 'loading') return <FullPageState title="Checking access" message="Verifying your secure administrator session…" />;
  if (status === 'denied') {
    return (
      <main className="login-screen">
        <section className="login-card login-card-error">
          <div className="brand-mark login-brand-mark">A</div>
          <p className="eyebrow">ACCESS RESTRICTED</p>
          <h1>Administrator access required</h1>
          <p>This account does not have the admin role. Farmer and vehicle-owner accounts cannot access this dashboard.</p>
          {signOutError ? <div className="alert alert-error" role="alert">{signOutError}</div> : null}
          <button className="button button-primary full-width" onClick={() => {
            setSignOutError(null);
            void signOut().catch((signOutFailure: unknown) => {
              setSignOutError(signOutFailure instanceof Error ? signOutFailure.message : 'Unable to sign out.');
            });
          }}>Sign out</button>
        </section>
      </main>
    );
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await signIn(email.trim(), password);
      navigate('/admin/dashboard', { replace: true });
    } catch (signInError) {
      setFormError(signInError instanceof Error ? signInError.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="brand-mark login-brand-mark">A</div>
        <p className="eyebrow">AGRIMOVE ADMIN</p>
        <h1>Welcome back</h1>
        <p>Sign in with an administrator account to monitor the transport system.</p>
        {!isSupabaseConfigured ? <div className="alert alert-error">Admin backend is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</div> : null}
        {error ? <div className="alert alert-error">{error}</div> : null}
        {formError ? <div className="alert alert-error" role="alert">{formError}</div> : null}
        <form className="login-form" onSubmit={(event) => void submit(event)}>
          <label>Email address<input autoComplete="username" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input autoComplete="current-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button className="button button-primary full-width" type="submit" disabled={submitting || !isSupabaseConfigured}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="login-footnote">Admin accounts are provisioned by a trusted operator. Public admin registration is disabled.</div>
      </section>
      <div className="login-side-note">Shared Supabase backend · Role-protected access</div>
    </main>
  );
}

function AdminGuard() {
  const { status, error } = useAdminAuth();
  if (status === 'loading') return <FullPageState title="Checking access" message="Verifying your secure administrator session…" />;
  if (status === 'misconfigured') return <FullPageState title="Configuration required" message="Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for the Admin app." error />;
  if (status === 'error') return <FullPageState title="Could not verify access" message={error ?? 'The administrator profile could not be verified.'} error />;
  if (status === 'signed-out') return <Navigate to="/login" replace />;
  if (status === 'denied') return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminGuard />}>
          <Route element={<AdminShell />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="farmers" element={<FarmersPage />} />
            <Route path="farmers/:id" element={<FarmerDetailsPage />} />
            <Route path="vehicle-owners" element={<OwnersPage />} />
            <Route path="vehicle-owners/:id" element={<OwnerDetailsPage />} />
            <Route path="vehicles" element={<VehiclesPage />} />
            <Route path="vehicles/:id" element={<VehicleDetailsPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="bookings/:id" element={<BookingDetailsPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="trips" element={<TripsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
