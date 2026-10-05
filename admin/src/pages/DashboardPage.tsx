import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RecordId, StatusBadge, type Column } from '../components/DataTable';
import { PageHeading } from '../components/AdminShell';
import { BOOKING_SELECT, formatDate, type BookingSummary } from '../lib/types';
import { requireSupabase } from '../lib/supabase';

type DashboardStats = {
  farmers: number;
  owners: number;
  vehicles: number;
  available: number;
  reserved: number;
  inTrip: number;
  bookings: number;
  pendingBookings: number;
  completedTrips: number;
  pendingPayments: number;
};

const emptyStats: DashboardStats = {
  farmers: 0,
  owners: 0,
  vehicles: 0,
  available: 0,
  reserved: 0,
  inTrip: 0,
  bookings: 0,
  pendingBookings: 0,
  completedTrips: 0,
  pendingPayments: 0,
};

async function countRows(
  table: 'profiles' | 'vehicles' | 'bookings' | 'trips',
  filters: Array<[string, string | string[]]> = [],
) {
  let query = requireSupabase().from(table).select('id', { count: 'exact', head: true });
  for (const [column, value] of filters) {
    query = Array.isArray(value) ? query.in(column, value) : query.eq(column, value);
  }
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export function DashboardPage() {
  const [stats, setStats] = useState(emptyStats);
  const [recent, setRecent] = useState<BookingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = requireSupabase();
    void Promise.all([
      countRows('profiles', [['role', 'farmer']]),
      countRows('profiles', [['role', 'vehicle_owner']]),
      countRows('vehicles'),
      countRows('vehicles', [['availability_status', 'AVAILABLE']]),
      countRows('vehicles', [['availability_status', 'RESERVED']]),
      countRows('vehicles', [['availability_status', 'ON_JOURNEY']]),
      countRows('bookings'),
      countRows('bookings', [['status', 'PENDING']]),
      countRows('trips', [['status', 'COMPLETED']]),
      countRows('bookings', [['payment_status', ['PENDING', 'VERIFICATION_PENDING']]]),
    ]).then((results) => {
      if (!active) return;
      const [farmers, owners, vehicles, available, reserved, inTrip, bookings, pendingBookings, completedTrips, pendingPayments] = results;
      setStats({ farmers, owners, vehicles, available, reserved, inTrip, bookings, pendingBookings, completedTrips, pendingPayments });
      return supabase.from('bookings').select(BOOKING_SELECT).order('created_at', { ascending: false }).limit(8);
    }).then((bookingResponse) => {
      if (!active || !bookingResponse) return;
      if (bookingResponse.error) throw bookingResponse.error;
      setRecent((bookingResponse.data ?? []) as BookingSummary[]);
    }).catch((loadError: unknown) => {
      if (!active) return;
      setError(loadError instanceof Error ? loadError.message : 'Dashboard data could not be loaded.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const metrics = [
    { label: 'Total farmers', value: stats.farmers, mark: 'FA', tone: 'green' },
    { label: 'Vehicle owners', value: stats.owners, mark: 'VO', tone: 'blue' },
    { label: 'Total vehicles', value: stats.vehicles, mark: 'VH', tone: 'gold' },
    { label: 'Available vehicles', value: stats.available, mark: 'AV', tone: 'green' },
    { label: 'Reserved vehicles', value: stats.reserved, mark: 'RS', tone: 'gold' },
    { label: 'Vehicles in trip', value: stats.inTrip, mark: 'IT', tone: 'blue' },
    { label: 'Total bookings', value: stats.bookings, mark: 'BK', tone: 'blue' },
    { label: 'Pending bookings', value: stats.pendingBookings, mark: 'PB', tone: 'gold' },
    { label: 'Completed trips', value: stats.completedTrips, mark: 'CT', tone: 'green' },
    { label: 'Pending payments', value: stats.pendingPayments, mark: 'PY', tone: 'rose' },
  ];

  const columns: Column<BookingSummary>[] = [
    { title: 'Booking ID', render: (row) => <Link className="table-link" to={`/admin/bookings/${row.id}`}><RecordId id={row.id} /></Link> },
    { title: 'Farmer', render: (row) => row.farmer?.full_name ?? '—' },
    { title: 'Vehicle', render: (row) => row.vehicle?.vehicle_number ?? '—' },
    { title: 'Owner', render: (row) => row.vehicle?.owner?.full_name ?? '—' },
    { title: 'Pickup → Destination', render: (row) => <span className="truncate-cell">{row.pickup_location ?? '—'} → {row.destination ?? '—'}</span> },
    { title: 'Date', render: (row) => formatDate(row.booking_date) },
    { title: 'Booking', render: (row) => <StatusBadge value={row.status} /> },
    { title: 'Payment', render: (row) => <StatusBadge value={row.payment_status} /> },
  ];

  return (
    <>
      <PageHeading eyebrow="OVERVIEW" title="Dashboard" description="A concise view of marketplace activity." />
      {error ? (
        <div className="alert alert-error" role="alert">
          <span>{error}</span>
          <button className="button button-secondary" onClick={() => window.location.reload()}>Reload</button>
        </div>
      ) : null}
      <div className="metric-grid">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <span className={`metric-mark metric-${metric.tone}`}>{metric.mark}</span>
            <div className="metric-label">{metric.label}</div>
            <strong className="metric-value">{loading ? '—' : metric.value.toLocaleString()}</strong>
          </article>
        ))}
      </div>
      <div className="section-heading">
        <div><h2>Recent bookings</h2><p>Latest booking requests across the system</p></div>
        <Link className="button button-secondary" to="/admin/bookings">View all bookings</Link>
      </div>
      <section className="table-card">
        {loading ? <div className="state-panel"><span className="spinner" />Loading dashboard…</div>
          : error ? <div className="state-panel state-error">Recent bookings could not be loaded.</div>
            : recent.length === 0 ? <div className="state-panel">No bookings found.</div>
              : <div className="table-scroll"><table><thead><tr>{columns.map((col) => <th key={col.title}>{col.title}</th>)}</tr></thead><tbody>{recent.map((row) => <tr key={row.id}>{columns.map((col) => <td key={col.title}>{col.render(row)}</td>)}</tr>)}</tbody></table></div>}
      </section>
    </>
  );
}
