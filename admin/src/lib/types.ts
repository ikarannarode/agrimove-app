export type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  role: 'farmer' | 'vehicle_owner' | 'admin';
  created_at: string;
};

export type OwnerSummary = Pick<Profile, 'id' | 'full_name' | 'phone'>;

export type VehicleSummary = {
  id: string;
  vehicle_number: string;
  vehicle_type: string;
  capacity: number;
  capacity_unit: string;
  driver_name: string;
  driver_mobile: string;
  availability_status: string;
  is_active: boolean;
  created_at: string;
  owner: OwnerSummary | null;
};

export type BookingSummary = {
  id: string;
  farmer_id: string;
  vehicle_id: string | null;
  cargo_description: string;
  quantity: number;
  pickup_location: string | null;
  destination: string | null;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  destination_latitude: number | null;
  destination_longitude: number | null;
  booking_date: string | null;
  booking_time: string | null;
  status: string;
  payment_mode: string;
  payment_status: string;
  payment_amount: number | null;
  payment_transaction_id: string | null;
  payment_screenshot_path: string | null;
  payment_submitted_at: string | null;
  payment_approved_at: string | null;
  payment_delete_at: string | null;
  payment_deleted_at: string | null;
  created_at: string;
  farmer: OwnerSummary | null;
  vehicle: Pick<VehicleSummary, 'id' | 'vehicle_number' | 'vehicle_type' | 'driver_name' | 'owner'> | null;
};

export type TripSummary = {
  id: string;
  booking_id: string;
  vehicle_id: string;
  owner_id: string;
  status: string;
  created_at: string;
  booking: BookingSummary | null;
  vehicle: Pick<VehicleSummary, 'id' | 'vehicle_number' | 'driver_name'> | null;
  owner: OwnerSummary | null;
};

export type NotificationSummary = {
  id: string;
  title: string;
  message: string;
  booking_id: string | null;
  journey_id: string | null;
  is_read: boolean;
  created_at: string;
  user: OwnerSummary | null;
};

export type Page<T> = {
  rows: T[];
  count: number;
};

export type PageLoader<T> = (page: number, pageSize: number) => Promise<Page<T>>;

export const BOOKING_SELECT = 'id,farmer_id,vehicle_id,cargo_description,quantity,pickup_location,destination,pickup_latitude,pickup_longitude,destination_latitude,destination_longitude,booking_date,booking_time,status,payment_mode,payment_status,payment_amount,payment_transaction_id,payment_screenshot_path,payment_submitted_at,payment_approved_at,payment_delete_at,payment_deleted_at,created_at,farmer:profiles!bookings_farmer_id_fkey(id,full_name,phone),vehicle:vehicles!bookings_vehicle_id_fkey(id,vehicle_number,vehicle_type,driver_name,owner:profiles!vehicles_owner_id_fkey(id,full_name,phone))' as const;

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

export function labelForStatus(value: string | null | undefined) {
  if (!value) return 'Unknown';
  const labels: Record<string, string> = {
    AVAILABLE: 'Available',
    RESERVED: 'Reserved',
    ON_JOURNEY: 'In trip',
    COMPLETED: 'Completed',
    PENDING: 'Pending',
    ACCEPTED: 'Accepted',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
    VERIFICATION_PENDING: 'Verification pending',
  };
  return labels[value] ?? value.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

export function statusTone(value: string | null | undefined) {
  switch (value) {
    case 'AVAILABLE':
    case 'COMPLETED':
    case 'ACCEPTED':
      return 'success';
    case 'RESERVED':
    case 'VERIFICATION_PENDING':
      return 'warning';
    case 'ON_JOURNEY':
      return 'info';
    case 'REJECTED':
    case 'CANCELLED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function safeSearch(value: string) {
  return value.replace(/[^\p{L}\p{N}\s+-]/gu, '').trim();
}
