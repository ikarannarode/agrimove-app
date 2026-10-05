import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DataTable, RecordId, StatusBadge, type Column } from '../components/DataTable';
import { PageHeading } from '../components/AdminShell';
import { usePagedData } from '../components/usePagedData';
import { BOOKING_SELECT, formatDate, safeSearch, type BookingSummary, type Page, type Profile, type TripSummary, type VehicleSummary } from '../lib/types';
import { requireSupabase } from '../lib/supabase';

const PAGE_SIZE = 15;

function SearchBar({ value, onChange, placeholder, selectValue, selectOptions, onSelectChange }: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  selectValue?: string;
  selectOptions?: Array<{ value: string; label: string }>;
  onSelectChange?: (value: string) => void;
}) {
  return (
    <div className="filter-bar">
      <label className="search-field">
        <span className="search-icon" aria-hidden="true">⌕</span>
        <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
      </label>
      {selectOptions && selectValue !== undefined && onSelectChange ? (
        <select className="filter-select" value={selectValue} onChange={(event) => onSelectChange(event.target.value)} aria-label="Filter records">
          {selectOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
        </select>
      ) : null}
    </div>
  );
}

function ProfileList({ role }: { role: 'farmer' | 'vehicle_owner' }) {
  const [search, setSearch] = useState('');
  const loadPage = useCallback(async (page: number, pageSize: number): Promise<Page<Profile>> => {
    const query = requireSupabase().from('profiles')
      .select('id,full_name,phone,role,created_at', { count: 'exact' })
      .eq('role', role)
      .order('created_at', { ascending: false });
    const term = safeSearch(search);
    if (term) query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`);
    const from = page * pageSize;
    const { data, error, count } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    return { rows: (data ?? []) as Profile[], count: count ?? 0 };
  }, [role, search]);
  const table = usePagedData(loadPage, PAGE_SIZE);
  const detailPath = role === 'farmer' ? '/admin/farmers' : '/admin/vehicle-owners';
  const columns: Column<Profile>[] = [
    { title: 'Name', render: (row) => <Link className="table-link" to={`${detailPath}/${row.id}`}>{row.full_name}</Link> },
    { title: 'Mobile', render: (row) => row.phone ?? '—' },
    { title: 'Registered', render: (row) => formatDate(row.created_at) },
    { title: 'Account', render: () => <span className="muted">Status not tracked</span> },
    { title: 'Details', render: (row) => <Link className="text-link" to={`${detailPath}/${row.id}`}>View details <span aria-hidden="true">→</span></Link> },
  ];
  const title = role === 'farmer' ? 'Farmers' : 'Vehicle owners';
  const placeholder = role === 'farmer' ? 'Search name or mobile' : 'Search owner name or mobile';
  const empty = role === 'farmer' ? 'No farmers found.' : 'No vehicle owners found.';

  return (
    <>
      <PageHeading eyebrow="PEOPLE" title={title} description={`Search and review registered ${role === 'farmer' ? 'farmers' : 'vehicle owners'}.`} />
      <SearchBar value={search} onChange={(value) => { setSearch(value); table.setPage(0); }} placeholder={placeholder} />
      <DataTable {...table} columns={columns} rowKey={(row) => row.id} emptyMessage={empty} onPageChange={table.setPage} onRetry={table.refresh} />
    </>
  );
}

export function FarmersPage() {
  return <ProfileList role="farmer" />;
}

export function OwnersPage() {
  return <ProfileList role="vehicle_owner" />;
}

export function VehiclesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const loadPage = useCallback(async (page: number, pageSize: number): Promise<Page<VehicleSummary>> => {
    const query = requireSupabase().from('vehicles')
      .select('id,vehicle_number,vehicle_type,capacity,capacity_unit,driver_name,driver_mobile,availability_status,is_active,created_at,owner:profiles!vehicles_owner_id_fkey(id,full_name,phone)', { count: 'exact' })
      .order('created_at', { ascending: false });
    const term = safeSearch(search);
    if (term) query.or(`vehicle_number.ilike.%${term}%,vehicle_type.ilike.%${term}%`);
    if (status) query.eq('availability_status', status);
    const { data, error, count } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    return { rows: (data ?? []) as VehicleSummary[], count: count ?? 0 };
  }, [search, status]);
  const table = usePagedData(loadPage, PAGE_SIZE);
  const columns: Column<VehicleSummary>[] = [
    { title: 'Vehicle', render: (row) => <Link className="table-link" to={`/admin/vehicles/${row.id}`}>{row.vehicle_number}</Link> },
    { title: 'Type / capacity', render: (row) => `${row.vehicle_type} · ${Number(row.capacity).toLocaleString()} ${row.capacity_unit}` },
    { title: 'Owner', render: (row) => row.owner?.full_name ?? '—' },
    { title: 'Driver', render: (row) => <>{row.driver_name || '—'}<small className="cell-subtitle">{row.driver_mobile}</small></> },
    { title: 'Availability', render: (row) => <StatusBadge value={row.availability_status} /> },
    { title: 'Active', render: (row) => <span className={`status-dot-label ${row.is_active ? 'text-green' : 'text-muted'}`}><i />{row.is_active ? 'Yes' : 'No'}</span> },
    { title: 'Details', render: (row) => <Link className="text-link" to={`/admin/vehicles/${row.id}`}>View details →</Link> },
  ];
  return (
    <>
      <PageHeading eyebrow="FLEET" title="Vehicles" description="Monitor registered vehicles, ownership and availability." />
      <SearchBar
        value={search}
        onChange={(value) => { setSearch(value); table.setPage(0); }}
        placeholder="Search vehicle number or type"
        selectValue={status}
        onSelectChange={(value) => { setStatus(value); table.setPage(0); }}
        selectOptions={[
          { value: '', label: 'All statuses' },
          { value: 'AVAILABLE', label: 'Available' },
          { value: 'RESERVED', label: 'Reserved' },
          { value: 'ON_JOURNEY', label: 'In trip' },
          { value: 'COMPLETED', label: 'Completed' },
        ]}
      />
      <DataTable {...table} columns={columns} rowKey={(row) => row.id} emptyMessage="No vehicles found." onPageChange={table.setPage} onRetry={table.refresh} />
    </>
  );
}

function DetailPanel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="detail-card"><h2>{title}</h2>{children}</section>;
}

function ProfileDetails({ role }: { role: 'farmer' | 'vehicle_owner' }) {
  const { id = '' } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = requireSupabase();
        const { data: profileData, error: profileError } = await supabase.from('profiles')
          .select('id,full_name,phone,role,created_at').eq('id', id).eq('role', role).maybeSingle();
        if (profileError) throw profileError;
        if (!profileData) throw new Error(role === 'farmer' ? 'Farmer was not found.' : 'Vehicle owner was not found.');
        const current = profileData as Profile;
        let vehicleRows: VehicleSummary[] = [];
        let bookingResult;
        if (role === 'vehicle_owner') {
          const vehicleResult = await supabase.from('vehicles')
            .select('id,vehicle_number,vehicle_type,capacity,capacity_unit,driver_name,driver_mobile,availability_status,is_active,created_at,owner:profiles!vehicles_owner_id_fkey(id,full_name,phone)')
            .eq('owner_id', id);
          if (vehicleResult.error) throw vehicleResult.error;
          vehicleRows = (vehicleResult.data ?? []) as VehicleSummary[];
          const vehicleIds = vehicleRows.map((vehicle) => vehicle.id);
          bookingResult = vehicleIds.length
            ? await supabase.from('bookings').select(BOOKING_SELECT).in('vehicle_id', vehicleIds).order('created_at', { ascending: false }).limit(50)
            : { data: [], error: null };
        } else {
          bookingResult = await supabase.from('bookings')
            .select(BOOKING_SELECT).eq('farmer_id', id).order('created_at', { ascending: false }).limit(50);
        }
        if (bookingResult.error) throw bookingResult.error;
        const bookingRows = (bookingResult.data ?? []) as BookingSummary[];
        const tripBookingIds = bookingRows.map((booking) => booking.id);
        const tripResult = tripBookingIds.length
          ? await supabase.from('trips').select('id,booking_id,vehicle_id,owner_id,status,created_at').in('booking_id', tripBookingIds).order('created_at', { ascending: false }).limit(50)
          : { data: [], error: null };
        if (tripResult.error) throw tripResult.error;
        if (active) {
          setProfile(current);
          setVehicles(vehicleRows);
          setBookings(bookingRows);
          setTrips((tripResult.data ?? []) as TripSummary[]);
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Details could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [id, role]);

  const heading = role === 'farmer' ? 'Farmer details' : 'Vehicle owner details';
  if (loading) return <><PageHeading title={heading} /><div className="state-panel"><span className="spinner" />Loading details…</div></>;
  if (error || !profile) return <><PageHeading title={heading} /><div className="alert alert-error">{error ?? 'Record is unavailable.'}</div><Link className="text-link" to={role === 'farmer' ? '/admin/farmers' : '/admin/vehicle-owners'}>← Back to {role === 'farmer' ? 'farmers' : 'vehicle owners'}</Link></>;

  return (
    <>
      <PageHeading eyebrow={role === 'farmer' ? 'FARMER' : 'VEHICLE OWNER'} title={profile.full_name} description={profile.phone ?? 'Mobile number not provided'} />
      <div className="back-link"><Link className="text-link" to={role === 'farmer' ? '/admin/farmers' : '/admin/vehicle-owners'}>← Back to {role === 'farmer' ? 'farmers' : 'vehicle owners'}</Link></div>
      <div className="detail-grid">
        <DetailPanel title="Account">
          <dl className="detail-list">
            <div><dt>Name</dt><dd>{profile.full_name}</dd></div>
            <div><dt>Mobile</dt><dd>{profile.phone ?? '—'}</dd></div>
            <div><dt>Email</dt><dd>Not stored in the public profile</dd></div>
            <div><dt>Registered</dt><dd>{formatDate(profile.created_at)}</dd></div>
            <div><dt>Account status</dt><dd>Not tracked in the current profile schema</dd></div>
          </dl>
        </DetailPanel>
        {role === 'vehicle_owner' ? (
          <DetailPanel title={`Vehicles (${vehicles.length})`}>
            {vehicles.length ? <ul className="compact-list">{vehicles.map((vehicle) => <li key={vehicle.id}><Link className="table-link" to={`/admin/vehicles/${vehicle.id}`}>{vehicle.vehicle_number}</Link><span>{vehicle.vehicle_type} · <StatusBadge value={vehicle.availability_status} /></span></li>)}</ul> : <p className="muted">No vehicles found.</p>}
          </DetailPanel>
        ) : null}
      </div>
      <DetailPanel title={`Bookings (${bookings.length})`}>
        {bookings.length ? <ul className="compact-list">{bookings.map((booking) => <li key={booking.id}><Link className="table-link" to={`/admin/bookings/${booking.id}`}>Booking <RecordId id={booking.id} /></Link><span>{booking.pickup_location ?? '—'} → {booking.destination ?? '—'} · <StatusBadge value={booking.status} /></span></li>)}</ul> : <p className="muted">No bookings found.</p>}
      </DetailPanel>
      {role === 'vehicle_owner' ? (
        <DetailPanel title="Payment information">
          {bookings.length ? (
            <ul className="compact-list">
              {bookings.map((booking) => (
                <li key={booking.id}>
                  <Link className="table-link" to={`/admin/bookings/${booking.id}`}>Booking <RecordId id={booking.id} /></Link>
                  <span>{booking.payment_mode} · <StatusBadge value={booking.payment_status} />{booking.payment_transaction_id ? ` · UTR ${booking.payment_transaction_id}` : ''}</span>
                </li>
              ))}
            </ul>
          ) : <p className="muted">No payment records are linked to this owner yet.</p>}
        </DetailPanel>
      ) : null}
      <DetailPanel title={`Trips (${trips.length})`}>
        {trips.length ? <ul className="compact-list">{trips.map((trip) => <li key={trip.id}><span>Trip <RecordId id={trip.id} /></span><span><Link className="text-link" to={`/admin/bookings/${trip.booking_id}`}>Booking details</Link> · <StatusBadge value={trip.status} /></span></li>)}</ul> : <p className="muted">No trips found.</p>}
      </DetailPanel>
    </>
  );
}

export function FarmerDetailsPage() {
  return <ProfileDetails role="farmer" />;
}

export function OwnerDetailsPage() {
  return <ProfileDetails role="vehicle_owner" />;
}

export function VehicleDetailsPage() {
  const { id = '' } = useParams();
  const [vehicle, setVehicle] = useState<VehicleSummary | null>(null);
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const supabase = requireSupabase();
        const { data, error: vehicleError } = await supabase.from('vehicles')
          .select('id,vehicle_number,vehicle_type,capacity,capacity_unit,driver_name,driver_mobile,availability_status,is_active,created_at,owner:profiles!vehicles_owner_id_fkey(id,full_name,phone)')
          .eq('id', id).maybeSingle();
        if (vehicleError) throw vehicleError;
        if (!data) throw new Error('Vehicle was not found.');
        const { data: bookingData, error: bookingError } = await supabase.from('bookings')
          .select(BOOKING_SELECT).eq('vehicle_id', id).order('created_at', { ascending: false }).limit(50);
        if (bookingError) throw bookingError;
        if (active) {
          setVehicle(data as VehicleSummary);
          setBookings((bookingData ?? []) as BookingSummary[]);
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Vehicle details could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [id]);

  if (loading) return <><PageHeading title="Vehicle details" /><div className="state-panel"><span className="spinner" />Loading vehicle…</div></>;
  if (error || !vehicle) return <><PageHeading title="Vehicle details" /><div className="alert alert-error">{error ?? 'Vehicle is unavailable.'}</div><Link className="text-link" to="/admin/vehicles">← Back to vehicles</Link></>;
  return (
    <>
      <PageHeading eyebrow="FLEET" title={vehicle.vehicle_number} description={`${vehicle.vehicle_type} · ${Number(vehicle.capacity).toLocaleString()} ${vehicle.capacity_unit}`} />
      <div className="back-link"><Link className="text-link" to="/admin/vehicles">← Back to vehicles</Link></div>
      <DetailPanel title="Vehicle and operator">
        <dl className="detail-list">
          <div><dt>Vehicle number</dt><dd>{vehicle.vehicle_number}</dd></div>
          <div><dt>Vehicle type</dt><dd>{vehicle.vehicle_type}</dd></div>
          <div><dt>Capacity</dt><dd>{Number(vehicle.capacity).toLocaleString()} {vehicle.capacity_unit}</dd></div>
          <div><dt>Owner</dt><dd>{vehicle.owner?.full_name ?? '—'}{vehicle.owner?.phone ? ` · ${vehicle.owner.phone}` : ''}</dd></div>
          <div><dt>Driver</dt><dd>{vehicle.driver_name || '—'}{vehicle.driver_mobile ? ` · ${vehicle.driver_mobile}` : ''}</dd></div>
          <div><dt>Status</dt><dd><StatusBadge value={vehicle.availability_status} />{vehicle.is_active ? ' Active listing' : ' Inactive listing'}</dd></div>
          <div><dt>Registered</dt><dd>{formatDate(vehicle.created_at)}</dd></div>
        </dl>
      </DetailPanel>
      <DetailPanel title={`Bookings (${bookings.length})`}>
        {bookings.length ? <ul className="compact-list">{bookings.map((booking) => <li key={booking.id}><Link className="table-link" to={`/admin/bookings/${booking.id}`}>Booking <RecordId id={booking.id} /></Link><span>{booking.farmer?.full_name ?? '—'} · <StatusBadge value={booking.status} /></span></li>)}</ul> : <p className="muted">No bookings found.</p>}
      </DetailPanel>
    </>
  );
}
