import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DataTable, RecordId, StatusBadge, type Column } from '../components/DataTable';
import { PageHeading } from '../components/AdminShell';
import { usePagedData } from '../components/usePagedData';
import { BOOKING_SELECT, formatDate, formatDateTime, safeSearch, type BookingSummary, type NotificationSummary, type Page, type TripSummary } from '../lib/types';
import { requireSupabase } from '../lib/supabase';

const PAGE_SIZE = 15;
const bookingStatuses = [
  { value: '', label: 'All booking statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function BookingsPage() {
  const [search, setSearch] = useState('');
  const [searchBy, setSearchBy] = useState('id');
  const [status, setStatus] = useState('');
  const loadPage = useCallback(async (page: number, pageSize: number): Promise<Page<BookingSummary>> => {
    const supabase = requireSupabase();
    const term = safeSearch(search);
    let query = supabase.from('bookings').select(BOOKING_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    if (term && searchBy === 'id') {
      if (!/^[\da-f-]{36}$/i.test(term)) return { rows: [], count: 0 };
      query = query.eq('id', term);
    } else if (term && searchBy === 'farmer') {
      const { data: profiles, error } = await supabase.from('profiles').select('id')
        .eq('role', 'farmer').or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`).limit(100);
      if (error) throw error;
      const farmerIds = (profiles ?? []).map((profile) => profile.id);
      if (!farmerIds.length) return { rows: [], count: 0 };
      query = query.in('farmer_id', farmerIds);
    } else if (term && searchBy === 'vehicle') {
      const { data: vehicles, error } = await supabase.from('vehicles').select('id')
        .ilike('vehicle_number', `%${term}%`).limit(100);
      if (error) throw error;
      const vehicleIds = (vehicles ?? []).map((vehicle) => vehicle.id);
      if (!vehicleIds.length) return { rows: [], count: 0 };
      query = query.in('vehicle_id', vehicleIds);
    }
    const { data, error, count } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    return { rows: (data ?? []) as BookingSummary[], count: count ?? 0 };
  }, [search, searchBy, status]);
  const table = usePagedData(loadPage, PAGE_SIZE);
  const columns: Column<BookingSummary>[] = [
    { title: 'Booking ID', render: (row) => <Link className="table-link" to={`/admin/bookings/${row.id}`}><RecordId id={row.id} /></Link> },
    { title: 'Farmer', render: (row) => row.farmer?.full_name ?? '—' },
    { title: 'Vehicle / owner', render: (row) => <>{row.vehicle?.vehicle_number ?? '—'}<small className="cell-subtitle">{row.vehicle?.owner?.full_name ?? '—'}</small></> },
    { title: 'Cargo / weight', render: (row) => `${row.cargo_description} · ${Number(row.quantity).toLocaleString()} kg` },
    { title: 'Pickup → destination', render: (row) => <span className="truncate-cell">{row.pickup_location ?? '—'} → {row.destination ?? '—'}</span> },
    { title: 'Date', render: (row) => formatDate(row.booking_date) },
    { title: 'Booking', render: (row) => <StatusBadge value={row.status} /> },
    { title: 'Payment', render: (row) => <>{row.payment_mode}<small className="cell-subtitle"><StatusBadge value={row.payment_status} /></small></> },
  ];

  return (
    <>
      <PageHeading eyebrow="OPERATIONS" title="Bookings" description="Monitor booking requests and their payment state." />
      <div className="filter-bar">
        <label className="search-field"><span className="search-icon" aria-hidden="true">⌕</span><input value={search} onChange={(event) => { setSearch(event.target.value); table.setPage(0); }} placeholder={searchBy === 'id' ? 'Enter full booking ID' : searchBy === 'farmer' ? 'Search farmer name or mobile' : 'Search vehicle number'} aria-label="Search bookings" /></label>
        <select className="filter-select" aria-label="Search bookings by" value={searchBy} onChange={(event) => { setSearchBy(event.target.value); table.setPage(0); }}><option value="id">Booking ID</option><option value="farmer">Farmer</option><option value="vehicle">Vehicle</option></select>
        <select className="filter-select" aria-label="Filter booking status" value={status} onChange={(event) => { setStatus(event.target.value); table.setPage(0); }}>{bookingStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
      </div>
      <DataTable {...table} columns={columns} rowKey={(row) => row.id} emptyMessage="No bookings found." onPageChange={table.setPage} onRetry={table.refresh} />
    </>
  );
}

function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="detail-card"><h2>{title}</h2>{children}</section>;
}

export function BookingDetailsPage() {
  const { id = '' } = useParams();
  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [trip, setTrip] = useState<TripSummary | null>(null);
  const [notifications, setNotifications] = useState<NotificationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = requireSupabase();
        const { data, error: bookingError } = await supabase.from('bookings')
          .select(BOOKING_SELECT).eq('id', id).maybeSingle();
        if (bookingError) throw bookingError;
        if (!data) throw new Error('Booking was not found.');
        const [tripResult, notificationResult] = await Promise.all([
          supabase.from('trips').select('id,booking_id,vehicle_id,owner_id,status,created_at').eq('booking_id', id).maybeSingle(),
          supabase.from('notifications').select('id,title,message,booking_id,journey_id,is_read,created_at,user:profiles!notifications_user_id_fkey(id,full_name,phone)').eq('booking_id', id).order('created_at', { ascending: false }).limit(20),
        ]);
        if (tripResult.error) throw tripResult.error;
        if (notificationResult.error) throw notificationResult.error;
        if (active) {
          setBooking(data as BookingSummary);
          setTrip(tripResult.data as TripSummary | null);
          setNotifications((notificationResult.data ?? []) as NotificationSummary[]);
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Booking details could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [id]);

  if (loading) return <><PageHeading title="Booking details" /><div className="state-panel"><span className="spinner" />Loading booking…</div></>;
  if (error || !booking) return <><PageHeading title="Booking details" /><div className="alert alert-error">{error ?? 'Booking is unavailable.'}</div><Link className="text-link" to="/admin/bookings">← Back to bookings</Link></>;

  const screenshotDeleted = Boolean(booking.payment_deleted_at)
    || Boolean(booking.payment_approved_at && !booking.payment_screenshot_path);
  return (
    <>
      <PageHeading eyebrow="BOOKING" title={`Booking ${booking.id.slice(0, 8).toUpperCase()}`} description={`Created ${formatDateTime(booking.created_at)}`} />
      <div className="back-link"><Link className="text-link" to="/admin/bookings">← Back to bookings</Link></div>
      <div className="detail-grid">
        <DetailCard title="Booking">
          <dl className="detail-list">
            <div><dt>Booking status</dt><dd><StatusBadge value={booking.status} /></dd></div>
            <div><dt>Cargo</dt><dd>{booking.cargo_description}</dd></div>
            <div><dt>Estimated weight</dt><dd>{Number(booking.quantity).toLocaleString()} kg</dd></div>
            <div><dt>Scheduled date</dt><dd>{booking.booking_date ?? '—'} {booking.booking_time?.slice(0, 5) ?? ''}</dd></div>
            <div><dt>Farmer</dt><dd>{booking.farmer?.full_name ?? '—'}{booking.farmer?.phone ? ` · ${booking.farmer.phone}` : ''}</dd></div>
            <div><dt>Vehicle</dt><dd>{booking.vehicle?.vehicle_number ?? '—'} · {booking.vehicle?.vehicle_type ?? '—'}</dd></div>
            <div><dt>Vehicle owner</dt><dd>{booking.vehicle?.owner?.full_name ?? '—'}{booking.vehicle?.owner?.phone ? ` · ${booking.vehicle.owner.phone}` : ''}</dd></div>
            <div><dt>Driver</dt><dd>{booking.vehicle?.driver_name ?? '—'}</dd></div>
          </dl>
        </DetailCard>
        <DetailCard title="Payment">
          <dl className="detail-list">
            <div><dt>Mode</dt><dd>{booking.payment_mode}</dd></div>
            <div><dt>Payment status</dt><dd><StatusBadge value={booking.payment_status} /></dd></div>
            <div><dt>Amount</dt><dd>{booking.payment_amount == null ? 'Not recorded' : Number(booking.payment_amount).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</dd></div>
            <div><dt>UTR / transaction ID</dt><dd>{booking.payment_transaction_id ?? '—'}</dd></div>
            <div><dt>Submitted</dt><dd>{formatDateTime(booking.payment_submitted_at)}</dd></div>
            <div><dt>Approved</dt><dd>{formatDateTime(booking.payment_approved_at)}</dd></div>
            <div><dt>Screenshot</dt><dd>{screenshotDeleted ? 'Screenshot deleted for privacy.' : booking.payment_screenshot_path ? 'Stored privately; admin preview is not permitted by current storage policy.' : 'No screenshot available.'}</dd></div>
            <div><dt>Scheduled removal</dt><dd>{formatDateTime(booking.payment_delete_at)}</dd></div>
            <div><dt>Removed</dt><dd>{formatDateTime(booking.payment_deleted_at)}</dd></div>
          </dl>
        </DetailCard>
      </div>
      <DetailCard title="Locations">
        <div className="location-grid">
          <div><strong>Pickup</strong><p>{booking.pickup_location ?? '—'}</p><small>Latitude {booking.pickup_latitude ?? '—'} · Longitude {booking.pickup_longitude ?? '—'}</small></div>
          <div><strong>Destination</strong><p>{booking.destination ?? '—'}</p><small>Latitude {booking.destination_latitude ?? '—'} · Longitude {booking.destination_longitude ?? '—'}</small></div>
        </div>
      </DetailCard>
      <DetailCard title="Trip">
        {trip ? <dl className="detail-list"><div><dt>Trip ID</dt><dd><RecordId id={trip.id} /></dd></div><div><dt>Status</dt><dd><StatusBadge value={trip.status} /></dd></div><div><dt>Trip created</dt><dd>{formatDateTime(trip.created_at)}</dd></div></dl> : <p className="muted">No trip has been created for this booking.</p>}
      </DetailCard>
      <DetailCard title="Related notifications">
        {notifications.length ? <ul className="compact-list">{notifications.map((notification) => <li key={notification.id}><span><strong>{notification.title}</strong><small className="cell-subtitle">{notification.message}</small></span><span>{notification.user?.full_name ?? '—'} · {formatDateTime(notification.created_at)} · {notification.is_read ? 'Read' : 'Unread'}</span></li>)}</ul> : <p className="muted">No related notifications found.</p>}
      </DetailCard>
    </>
  );
}
