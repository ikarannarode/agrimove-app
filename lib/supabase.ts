import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const webStorage = {
  getItem: async (key: string) => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  },
};

export const supabase = createClient(
  supabaseUrl || 'https://configuration-required.invalid',
  supabaseAnonKey || 'missing-supabase-anon-key',
  {
    auth: {
      storage: Platform.OS === 'web' ? webStorage : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

export type AppRole = 'farmer' | 'vehicle_owner';
export type BookingStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
export type VehicleStatus = 'AVAILABLE' | 'RESERVED' | 'ON_JOURNEY' | 'COMPLETED';
export type TripStatus = 'RESERVED' | 'ON_JOURNEY' | 'COMPLETED';
export type PaymentMode = 'CASH' | 'ONLINE';
export type PaymentStatus = 'PENDING' | 'VERIFICATION_PENDING' | 'COMPLETED' | 'REJECTED';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: AppRole;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  owner_id: string;
  vehicle_number: string;
  vehicle_type: string;
  capacity: number;
  capacity_unit: string;
  driver_name: string;
  driver_mobile: string;
  availability_status: VehicleStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
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
  payment_mode: PaymentMode;
  payment_status: PaymentStatus;
  payment_transaction_id: string | null;
  payment_screenshot_path: string | null;
  payment_submitted_at: string | null;
  payment_approved_at: string | null;
  payment_delete_at: string | null;
  payment_deleted_at: string | null;
  payment_amount: number | null;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
}

export interface OwnerPaymentSettings {
  owner_id: string;
  upi_id: string | null;
  qr_storage_path: string | null;
  updated_at: string;
}

export interface Trip {
  id: string;
  booking_id: string;
  vehicle_id: string;
  owner_id: string;
  status: TripStatus;
  created_at: string;
  updated_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  booking_id: string | null;
  journey_id: string | null;
  is_read: boolean;
  created_at: string;
}
