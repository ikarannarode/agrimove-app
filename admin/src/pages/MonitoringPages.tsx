import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable, RecordId, StatusBadge, type Column } from '../components/DataTable';
import { PageHeading } from '../components/AdminShell';
import { usePagedData } from '../components/usePagedData';
import { BOOKING_SELECT, formatDate, formatDateTime, safeSearch, type BookingSummary, type NotificationSummary, type Page } from '../lib/types';
import { requireSupabase } from '../lib/supabase';

const PAGE_SIZE = 15;

export function PaymentsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState('');
  const loadPage = useCallback(async (page: number, pageSize: number): Promise<Page<BookingSummary>> => {
    const supabase = requireSupabase();
    const term = safeSearch(search);
    let query = supabase.from('bookings').select(BOOKING_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false });
    if (status) query = query.eq('payment_status', status);
    if (mode) query = query.eq('payment_mode', mode);
    if (term) {
      if (/^[\da-f-]{36}$/i.test(term)) {
        query = query.eq('id', term);
      } else {
        query = query.ilike('payment_transaction_id', `%${term}%`);
      }
    }
    const { data, error, count } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    return { rows: (data ?? []) as BookingSummary[], count: count ?? 0 };
  }, [search, status, mode]);
  const table = usePagedData(loadPage, PAGE_SIZE);
  const columns: Column<BookingSummary>[] = [
    { title: 'Booking / payment record', render: (row) => <Link className="table-link" to={`/admin/bookings/${row.id}`}><RecordId id={row.id} /></Link> },
    { title: 'Farmer', render: (row) => row.farmer?.full_name ?? '—' },
    { title: 'Vehicle owner', render: (row) => row.vehicle?.owner?.full_name ?? '—' },
    { title: 'Mode', render: (row) => row.payment_mode },
    { title: 'Payment status', render: (row) => <StatusBadge value={row.payment_status} /> },
    { title: 'UTR / transaction', render: (row) => row.payment_transaction_id ?? '—' },
    { title: 'Payment date', render: (row) => formatDate(row.payment_submitted_at) },
    { title: 'Approval date', render: (row) => formatDate(row.payment_approved_at) },
  ];
  return (
    <>
      <PageHeading eyebrow="SETTLEMENT MONITORING" title="Payments" description="Payment data belongs to booking records; verification remains with the vehicle owner." />
      <div className="filter-bar">
        <label className="search-field"><span className="search-icon" aria-hidden="true">⌕</span><input value={search} onChange={(event) => { setSearch(event.target.value); table.setPage(0); }} placeholder="Search booking ID or UTR" aria-label="Search payments" /></label>
        <select className="filter-select" aria-label="Filter payment status" value={status} onChange={(event) => { setStatus(event.target.value); table.setPage(0); }}>
          <option value="">All payment statuses</option><option value="PENDING">Pending</option><option value="VERIFICATION_PENDING">Verification pending</option><option value="COMPLETED">Completed</option><option value="REJECTED">Rejected</option>
        </select>
        <select className="filter-select" aria-label="Filter payment mode" value={mode} onChange={(event) => { setMode(event.target.value); table.setPage(0); }}>
          <option value="">All modes</option><option value="CASH">Cash</option><option value="ONLINE">Online</option>
        </select>
      </div>
      <DataTable {...table} columns={columns} rowKey={(row) => row.id} emptyMessage="No payments found." onPageChange={table.setPage} onRetry={table.refresh} />
    </>
  );
}

type TripRow = {
  id: string;
  booking_id: string;
  vehicle_id: string;
  owner_id: string;
  status: string;
  created_at: string;
  booking: {
    id: string;
    farmer: { full_name: string } | null;
    pickup_location: string | null;
    destination: string | null;
    booking_date: string | null;
    payment_status: string;
  } | null;
  vehicle: { vehicle_number: string; driver_name: string } | null;
  owner: { full_name: string } | null;
};

export function TripsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const loadPage = useCallback(async (page: number, pageSize: number): Promise<Page<TripRow>> => {
    const supabase = requireSupabase();
    let query = supabase.from('trips')
      .select('id,booking_id,vehicle_id,owner_id,status,created_at,booking:bookings!trips_booking_id_fkey(id,pickup_location,destination,booking_date,payment_status,farmer:profiles!bookings_farmer_id_fkey(full_name)),vehicle:vehicles!trips_vehicle_id_fkey(vehicle_number,driver_name),owner:profiles!trips_owner_id_fkey(full_name)', { count: 'exact' })
      .order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const term = safeSearch(search);
    if (term) {
      if (!/^[\da-f-]{36}$/i.test(term)) return { rows: [], count: 0 };
      query = query.eq('id', term);
    }
    const { data, error, count } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    return { rows: (data ?? []) as TripRow[], count: count ?? 0 };
  }, [search, status]);
  const table = usePagedData(loadPage, PAGE_SIZE);
  const columns: Column<TripRow>[] = [
    { title: 'Trip ID', render: (row) => <RecordId id={row.id} /> },
    { title: 'Booking', render: (row) => <Link className="table-link" to={`/admin/bookings/${row.booking_id}`}><RecordId id={row.booking_id} /></Link> },
    { title: 'Farmer', render: (row) => row.booking?.farmer?.full_name ?? '—' },
    { title: 'Owner / vehicle', render: (row) => <>{row.owner?.full_name ?? '—'}<small className="cell-subtitle">{row.vehicle?.vehicle_number ?? '—'}</small></> },
    { title: 'Driver', render: (row) => row.vehicle?.driver_name ?? '—' },
    { title: 'Pickup → destination', render: (row) => <span className="truncate-cell">{row.booking?.pickup_location ?? '—'} → {row.booking?.destination ?? '—'}</span> },
    { title: 'Date', render: (row) => formatDate(row.booking?.booking_date) },
    { title: 'Trip status', render: (row) => <StatusBadge value={row.status} /> },
    { title: 'Payment', render: (row) => <StatusBadge value={row.booking?.payment_status} /> },
  ];
  return (
    <>
      <PageHeading eyebrow="OPERATIONS" title="Trips" description="Review reserved, in-progress and completed trips." />
      <div className="filter-bar">
        <label className="search-field"><span className="search-icon" aria-hidden="true">⌕</span><input value={search} onChange={(event) => { setSearch(event.target.value); table.setPage(0); }} placeholder="Enter full trip ID" aria-label="Search trips by ID" /></label>
        <select className="filter-select" value={status} aria-label="Filter trip status" onChange={(event) => { setStatus(event.target.value); table.setPage(0); }}>
          <option value="">All trip statuses</option><option value="RESERVED">Reserved</option><option value="ON_JOURNEY">In trip</option><option value="COMPLETED">Completed</option>
        </select>
      </div>
      <DataTable {...table} columns={columns} rowKey={(row) => row.id} emptyMessage="No trips found." onPageChange={table.setPage} onRetry={table.refresh} />
    </>
  );
}

export function NotificationsPage() {
  const loadPage = useCallback(async (page: number, pageSize: number): Promise<Page<NotificationSummary>> => {
    const { data, error, count } = await requireSupabase().from('notifications')
      .select('id,title,message,booking_id,journey_id,is_read,created_at,user:profiles!notifications_user_id_fkey(id,full_name,phone)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    return { rows: (data ?? []) as NotificationSummary[], count: count ?? 0 };
  }, []);
  const table = usePagedData(loadPage, PAGE_SIZE);
  const columns: Column<NotificationSummary>[] = [
    { title: 'Notification', render: (row) => <><strong>{row.title}</strong><small className="cell-subtitle">{row.message}</small></> },
    { title: 'User', render: (row) => row.user?.full_name ?? '—' },
    { title: 'Booking', render: (row) => row.booking_id ? <Link className="table-link" to={`/admin/bookings/${row.booking_id}`}><RecordId id={row.booking_id} /></Link> : '—' },
    { title: 'Date', render: (row) => formatDateTime(row.created_at) },
    { title: 'Status', render: (row) => <span className={`read-status ${row.is_read ? '' : 'unread'}`}>{row.is_read ? 'Read' : 'Unread'}</span> },
  ];
  return (
    <>
      <PageHeading eyebrow="SYSTEM ACTIVITY" title="Notifications" description="Monitor booking and trip notifications sent to users." />
      <DataTable {...table} columns={columns} rowKey={(row) => row.id} emptyMessage="No notifications found." onPageChange={table.setPage} onRetry={table.refresh} />
    </>
  );
}

export function SettingsPage() {
  const configured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
  return (
    <>
      <PageHeading eyebrow="ADMINISTRATION" title="Settings" description="Environment and operational setup status." />
      <section className="detail-card settings-card">
        <h2>Shared backend</h2>
        <dl className="detail-list">
          <div><dt>Supabase connection</dt><dd><span className={`status-dot-label ${configured ? 'text-green' : 'text-muted'}`}><i />{configured ? 'Client configuration present' : 'Environment variables missing'}</span></dd></div>
          <div><dt>Data access</dt><dd>Authenticated admin policies; no service-role key is used in this web app.</dd></div>
          <div><dt>Payment proof</dt><dd>Private bucket. Admin preview is unavailable unless storage policy explicitly grants it.</dd></div>
          <div><dt>Screenshot cleanup</dt><dd>Backend scheduled job; manage and verify it in Supabase. This dashboard does not expose secrets or modify retention.</dd></div>
        </dl>
        {!configured ? <div className="alert alert-error">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the Admin app environment.</div> : null}
      </section>
    </>
  );
}
