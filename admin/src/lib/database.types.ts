type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<Row, Links extends Relationship[] = Relationship[]> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: Links;
};

type ProfileRow = {
  id: string;
  full_name: string;
  phone: string | null;
  role: 'farmer' | 'vehicle_owner' | 'admin';
  created_at: string;
  updated_at: string;
};

type VehicleRow = {
  id: string;
  owner_id: string;
  vehicle_number: string;
  vehicle_type: string;
  capacity: number;
  capacity_unit: string;
  driver_name: string;
  driver_mobile: string;
  availability_status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type BookingRow = {
  id: string;
  journey_id: string | null;
  vehicle_id: string | null;
  farmer_id: string;
  cargo_description: string;
  quantity: number;
  pickup_location: string | null;
  destination: string | null;
  booking_date: string | null;
  booking_time: string | null;
  additional_note: string | null;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  destination_latitude: number | null;
  destination_longitude: number | null;
  payment_mode: string;
  payment_status: string;
  payment_amount: number | null;
  payment_transaction_id: string | null;
  payment_screenshot_path: string | null;
  payment_submitted_at: string | null;
  payment_approved_at: string | null;
  payment_delete_at: string | null;
  payment_deleted_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type TripRow = {
  id: string;
  booking_id: string;
  vehicle_id: string;
  owner_id: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  booking_id: string | null;
  journey_id: string | null;
  is_read: boolean;
  created_at: string;
};

export type AppDatabase = {
  public: {
    Tables: {
      profiles: Table<ProfileRow>;
      vehicles: Table<VehicleRow, [{
        foreignKeyName: 'vehicles_owner_id_fkey';
        columns: ['owner_id'];
        isOneToOne: false;
        referencedRelation: 'profiles';
        referencedColumns: ['id'];
      }]>;
      bookings: Table<BookingRow, [
        {
          foreignKeyName: 'bookings_farmer_id_fkey';
          columns: ['farmer_id'];
          isOneToOne: false;
          referencedRelation: 'profiles';
          referencedColumns: ['id'];
        },
        {
          foreignKeyName: 'bookings_vehicle_id_fkey';
          columns: ['vehicle_id'];
          isOneToOne: false;
          referencedRelation: 'vehicles';
          referencedColumns: ['id'];
        },
        {
          foreignKeyName: 'bookings_journey_id_fkey';
          columns: ['journey_id'];
          isOneToOne: false;
          referencedRelation: 'journeys';
          referencedColumns: ['id'];
        }
      ]>;
      trips: Table<TripRow, [
        {
          foreignKeyName: 'trips_booking_id_fkey';
          columns: ['booking_id'];
          isOneToOne: true;
          referencedRelation: 'bookings';
          referencedColumns: ['id'];
        },
        {
          foreignKeyName: 'trips_vehicle_id_fkey';
          columns: ['vehicle_id'];
          isOneToOne: false;
          referencedRelation: 'vehicles';
          referencedColumns: ['id'];
        },
        {
          foreignKeyName: 'trips_owner_id_fkey';
          columns: ['owner_id'];
          isOneToOne: false;
          referencedRelation: 'profiles';
          referencedColumns: ['id'];
        }
      ]>;
      notifications: Table<NotificationRow, [
        {
          foreignKeyName: 'notifications_user_id_fkey';
          columns: ['user_id'];
          isOneToOne: false;
          referencedRelation: 'profiles';
          referencedColumns: ['id'];
        },
        {
          foreignKeyName: 'notifications_booking_id_fkey';
          columns: ['booking_id'];
          isOneToOne: false;
          referencedRelation: 'bookings';
          referencedColumns: ['id'];
        }
      ]>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
