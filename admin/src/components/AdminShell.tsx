import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../auth/useAdminAuth';

const navigation = [
  { to: '/admin/dashboard', label: 'Dashboard', mark: 'OV' },
  { to: '/admin/farmers', label: 'Farmers', mark: 'FA' },
  { to: '/admin/vehicle-owners', label: 'Vehicle owners', mark: 'VO' },
  { to: '/admin/vehicles', label: 'Vehicles', mark: 'VH' },
  { to: '/admin/bookings', label: 'Bookings', mark: 'BK' },
  { to: '/admin/payments', label: 'Payments', mark: 'PY' },
  { to: '/admin/trips', label: 'Trips', mark: 'TR' },
  { to: '/admin/notifications', label: 'Notifications', mark: 'NO' },
  { to: '/admin/settings', label: 'Settings', mark: 'ST' },
];

function routeTitle(pathname: string) {
  if (pathname.includes('/farmers/')) return 'Farmer details';
  if (pathname.includes('/vehicle-owners/')) return 'Vehicle owner details';
  if (pathname.includes('/vehicles/')) return 'Vehicle details';
  if (pathname.includes('/bookings/')) return 'Booking details';
  return navigation.find((item) => pathname === item.to)?.label ?? 'Dashboard';
}

export function AdminShell() {
  const { profile, signOut } = useAdminAuth();
  const { pathname } = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const logout = async () => {
    setLogoutError(null);
    try {
      await signOut();
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'Could not sign out.');
    }
  };

  return (
    <div className="admin-frame">
      {mobileMenuOpen ? <button className="sidebar-backdrop" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} /> : null}
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">A</span>
          <span><strong>AgriMove</strong><small>Administration</small></span>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="side-nav" aria-label="Admin navigation">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
            >
              <span className="nav-mark">{item.mark}</span>{item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="account-mini">
            <span className="avatar">{profile?.full_name?.slice(0, 1).toUpperCase() ?? 'A'}</span>
            <span className="account-copy"><strong>{profile?.full_name ?? 'Administrator'}</strong><small>Admin account</small></span>
          </div>
          <button className="logout-button" onClick={() => void logout()}><span>↪</span> Sign out</button>
          {logoutError ? <p className="inline-error">{logoutError}</p> : null}
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <button className="menu-button" aria-label="Open navigation" onClick={() => setMobileMenuOpen(true)}>☰</button>
          <div className="breadcrumb"><span>AgriMove</span><i>/</i><strong>{routeTitle(pathname)}</strong></div>
          <div className="topbar-end"><span className="secure-label"><span /> Secure admin</span></div>
        </header>
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function PageHeading({ eyebrow, title, description, action }: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="heading-action">{action}</div> : null}
    </div>
  );
}
