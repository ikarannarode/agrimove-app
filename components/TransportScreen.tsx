import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, usePathname } from 'expo-router';
import {
  AppNotification,
  Booking,
  OwnerPaymentSettings,
  PaymentMode,
  Profile,
  Trip,
  Vehicle,
  supabase,
} from '@/lib/supabase';
import MapLocationPicker, { MapCoordinate } from '@/components/MapLocationPicker';
import { useAuth } from '@/lib/AuthContext';
import { IMAGE_URLS } from '@/constants/imageUrls';
import {
  Button,
  Card,
  Empty,
  Field,
  Loading,
  Notice,
  Page,
  StatusLabel,
} from '@/components/TransportUI';

interface VehicleDraft {
  number: string;
  type: string;
  capacity: string;
  driverName: string;
  driverMobile: string;
}

interface BookingDraft {
  cargo: string;
  weight: string;
  pickup: string;
  destination: string;
  date: string;
  time: string;
  note: string;
  pickupCoordinate: MapCoordinate | null;
  destinationCoordinate: MapCoordinate | null;
  paymentMode: PaymentMode;
}

interface PaymentEvidenceDraft {
  asset: ImagePicker.ImagePickerAsset | null;
  transactionId: string;
}

const blankVehicle: VehicleDraft = {
  number: '',
  type: '',
  capacity: '',
  driverName: '',
  driverMobile: '',
};

const blankBooking: BookingDraft = {
  cargo: '',
  weight: '',
  pickup: '',
  destination: '',
  date: '',
  time: '',
  note: '',
  pickupCoordinate: null,
  destinationCoordinate: null,
  paymentMode: 'CASH',
};

const bookingStatusLabel: Record<Booking['status'], string> = {
  PENDING: 'प्रलंबित',
  ACCEPTED: 'स्वीकारले',
  REJECTED: 'नाकारले',
  CANCELLED: 'रद्द',
  COMPLETED: 'पूर्ण',
};

const vehicleStatusLabel: Record<Vehicle['availability_status'], string> = {
  AVAILABLE: 'उपलब्ध',
  RESERVED: 'आरक्षित',
  ON_JOURNEY: 'प्रवासात',
  COMPLETED: 'प्रवास पूर्ण',
};

const tripStatusLabel: Record<Trip['status'], string> = {
  RESERVED: 'आरक्षित',
  ON_JOURNEY: 'प्रवासात',
  COMPLETED: 'प्रवास पूर्ण',
};

const paymentStatusLabel: Record<Booking['payment_status'], string> = {
  PENDING: 'प्रलंबित',
  VERIFICATION_PENDING: 'पडताळणी प्रलंबित',
  COMPLETED: 'पूर्ण',
  REJECTED: 'नाकारले',
};

function coordinateLabel(coordinate: MapCoordinate) {
  return `${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`;
}

function imageExtension(mimeType: string | null | undefined) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return null;
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('mr-IN') : '—';
}

function validIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return parsed.getFullYear() === Number(year)
    && parsed.getMonth() === Number(month) - 1
    && parsed.getDate() === Number(day);
}

function capacityInKg(vehicle: Vehicle) {
  const unit = vehicle.capacity_unit.trim().toLocaleLowerCase();
  const multiplier = ['quintal', 'quintals', 'qtl'].includes(unit)
    ? 100
    : ['ton', 'tons', 'tonne', 'tonnes'].includes(unit)
      ? 1000
      : 1;
  return vehicle.capacity * multiplier;
}

function appError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function TransportScreen() {
  const pathname = usePathname();
  const page = pathname.split('/').pop() ?? 'home';
  const { profile, session, refreshProfile, signOut } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [farmers, setFarmers] = useState<Record<string, Profile>>({});
  const [owners, setOwners] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vehicleModal, setVehicleModal] = useState(false);
  const [bookingDetailsModal, setBookingDetailsModal] = useState(false);
  const [bookingFormModal, setBookingFormModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<string | null>(null);
  const [vehicleDraft, setVehicleDraft] = useState<VehicleDraft>(blankVehicle);
  const [bookingDraft, setBookingDraft] = useState<BookingDraft>(blankBooking);
  const [filterType, setFilterType] = useState('');
  const [filterCapacity, setFilterCapacity] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [paymentSettings, setPaymentSettings] = useState<OwnerPaymentSettings | null>(null);
  const [paymentSettingsByOwner, setPaymentSettingsByOwner] = useState<Record<string, OwnerPaymentSettings>>({});
  const [paymentUpi, setPaymentUpi] = useState('');
  const [pendingQrAsset, setPendingQrAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [ownerQrUrl, setOwnerQrUrl] = useState<string | null>(null);
  const [qrImageUrls, setQrImageUrls] = useState<Record<string, string>>({});
  const [paymentProofUrls, setPaymentProofUrls] = useState<Record<string, string>>({});
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, PaymentEvidenceDraft>>({});
  const [reviewScreenshot, setReviewScreenshot] = useState<string | null>(null);
  const [paymentBooking, setPaymentBooking] = useState<Booking | null>(null);
  const [mapTarget, setMapTarget] = useState<'pickup' | 'destination' | null>(null);
  const [viewMapBooking, setViewMapBooking] = useState<Booking | null>(null);
  const [onlineQrAvailable, setOnlineQrAvailable] = useState<boolean | null>(null);
  const [paymentModeNotice, setPaymentModeNotice] = useState<string | null>(null);

  const loadBookingContext = useCallback(async (rows: Booking[]) => {
    setBookings(rows);
    const vehicleIds = [...new Set(rows.map((booking) => booking.vehicle_id).filter(Boolean))];
    const farmerIds = [...new Set(rows.map((booking) => booking.farmer_id))];
    const [vehicleResult, farmerResult] = await Promise.all([
      vehicleIds.length
        ? supabase.from('vehicles').select('*').in('id', vehicleIds)
        : Promise.resolve({ data: [], error: null }),
      farmerIds.length
        ? supabase.from('profiles').select('*').in('id', farmerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (vehicleResult.error) throw vehicleResult.error;
    if (farmerResult.error) throw farmerResult.error;
    const vehicleRows = (vehicleResult.data ?? []) as Vehicle[];
    setVehicles(vehicleRows);
    setFarmers(Object.fromEntries(((farmerResult.data ?? []) as Profile[]).map((farmer) => [farmer.id, farmer])));
    const ownerIds = [...new Set(vehicleRows.map((vehicle) => vehicle.owner_id))];
    const ownerProfilesResult = ownerIds.length
      ? await supabase.from('profiles').select('*').in('id', ownerIds)
      : { data: [], error: null };
    if (ownerProfilesResult.error) throw ownerProfilesResult.error;
    setOwners(Object.fromEntries(
      ((ownerProfilesResult.data ?? []) as Profile[]).map((owner) => [owner.id, owner]),
    ));
    const onlineOwners = new Set(rows
      .filter((booking) => booking.status === 'ACCEPTED' && booking.payment_mode === 'ONLINE')
      .map((booking) => vehicleRows.find((vehicle) => vehicle.id === booking.vehicle_id)?.owner_id)
      .filter((ownerId): ownerId is string => Boolean(ownerId)));
    const settingsResult = ownerIds.length
      ? await supabase.from('owner_payment_settings')
        .select('owner_id, upi_id, qr_storage_path, updated_at')
        .in('owner_id', ownerIds)
      : { data: [], error: null };
    if (settingsResult.error) throw settingsResult.error;
    const settingsRows = (settingsResult.data ?? []) as OwnerPaymentSettings[];
    setPaymentSettingsByOwner(Object.fromEntries(settingsRows.map((settings) => [settings.owner_id, settings])));
    const qrUrls: Record<string, string> = {};
    for (const settings of settingsRows) {
      if (!settings.qr_storage_path || !onlineOwners.has(settings.owner_id)) continue;
      const { data, error: signedUrlError } = await supabase.storage
        .from('owner-payment-qr')
        .createSignedUrl(settings.qr_storage_path, 900);
      if (signedUrlError) throw signedUrlError;
      qrUrls[settings.owner_id] = data.signedUrl;
    }
    setQrImageUrls(qrUrls);

    const proofUrls: Record<string, string> = {};
    for (const booking of rows) {
      if (!booking.payment_screenshot_path) continue;
      const { data, error: signedUrlError } = await supabase.storage
        .from('payment-screenshots')
        .createSignedUrl(booking.payment_screenshot_path, 900);
      if (signedUrlError) throw signedUrlError;
      proofUrls[booking.id] = data.signedUrl;
    }
    setPaymentProofUrls(proofUrls);
    const bookingIds = rows.map((booking) => booking.id);
    if (!bookingIds.length) {
      setTrips([]);
      return;
    }
    const { data: tripRows, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .in('booking_id', bookingIds);
    if (tripError) throw tripError;
    setTrips((tripRows ?? []) as Trip[]);
  }, []);

  const runQuery = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      if (page === 'search') {
        const { data, error: queryError } = await supabase
          .from('vehicles')
          .select('*')
          .eq('is_active', true)
          .eq('availability_status', 'AVAILABLE')
          .neq('driver_name', '')
          .neq('driver_mobile', '')
          .order('created_at', { ascending: false });
        if (queryError) throw queryError;
        setVehicles((data ?? []) as Vehicle[]);
      } else if (page === 'vehicles') {
        const { data, error: queryError } = await supabase
          .from('vehicles')
          .select('*')
          .eq('owner_id', profile.id)
          .order('created_at', { ascending: false });
        if (queryError) throw queryError;
        setVehicles((data ?? []) as Vehicle[]);
      } else if (page === 'bookings') {
        const { data, error: queryError } = await supabase
          .from('bookings')
          .select('*')
          .eq('farmer_id', profile.id)
          .not('vehicle_id', 'is', null)
          .order('created_at', { ascending: false });
        if (queryError) throw queryError;
        await loadBookingContext((data ?? []) as Booking[]);
      } else if (page === 'requests') {
        const { data: ownedVehicles, error: vehicleError } = await supabase
          .from('vehicles')
          .select('*')
          .eq('owner_id', profile.id);
        if (vehicleError) throw vehicleError;
        const ownerVehicleRows = (ownedVehicles ?? []) as Vehicle[];
        setVehicles(ownerVehicleRows);
        const vehicleIds = ownerVehicleRows.map((vehicle) => vehicle.id);
        if (!vehicleIds.length) {
          await loadBookingContext([]);
        } else {
          const { data, error: queryError } = await supabase
            .from('bookings')
            .select('*')
            .in('vehicle_id', vehicleIds)
            .order('created_at', { ascending: false });
          if (queryError) throw queryError;
          await loadBookingContext((data ?? []) as Booking[]);
        }
      } else if (page === 'journeys') {
        let tripQuery = supabase.from('trips').select('*').order('created_at', { ascending: false });
        if (profile.role === 'vehicle_owner') {
          tripQuery = tripQuery.eq('owner_id', profile.id);
        } else {
          const { data: farmerBookings, error: farmerBookingError } = await supabase
            .from('bookings').select('id').eq('farmer_id', profile.id).eq('status', 'ACCEPTED');
          if (farmerBookingError) throw farmerBookingError;
          const bookingIds = (farmerBookings ?? []).map((booking) => booking.id);
          if (!bookingIds.length) {
            setTrips([]);
            await loadBookingContext([]);
            return;
          }
          tripQuery = tripQuery.in('booking_id', bookingIds);
        }
        const { data, error: queryError } = await tripQuery;
        if (queryError) throw queryError;
        const tripRows = (data ?? []) as Trip[];
        setTrips(tripRows);
        if (tripRows.length) {
          const { data: tripBookings, error: tripBookingError } = await supabase
            .from('bookings').select('*').in('id', tripRows.map((trip) => trip.booking_id));
          if (tripBookingError) throw tripBookingError;
          await loadBookingContext((tripBookings ?? []) as Booking[]);
        } else {
          await loadBookingContext([]);
        }
      } else if (page === 'notifications') {
        const { data, error: queryError } = await supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false });
        if (queryError) throw queryError;
        setNotifications((data ?? []) as AppNotification[]);
      } else if (page === 'profile' && profile.role === 'vehicle_owner') {
        const { data, error: settingsError } = await supabase
          .from('owner_payment_settings')
          .select('owner_id, upi_id, qr_storage_path, updated_at')
          .eq('owner_id', profile.id)
          .maybeSingle();
        if (settingsError) throw settingsError;
        const settings = data as OwnerPaymentSettings | null;
        setPaymentSettings(settings);
        setPaymentSettingsByOwner(settings ? { [settings.owner_id]: settings } : {});
        setPaymentUpi(settings?.upi_id ?? '');
        if (settings?.qr_storage_path) {
          const { data: signed, error: signedError } = await supabase.storage
            .from('owner-payment-qr')
            .createSignedUrl(settings.qr_storage_path, 900);
          if (signedError) throw signedError;
          setOwnerQrUrl(signed.signedUrl);
        } else {
          setOwnerQrUrl(null);
        }
      } else if (page === 'profile') {
        setPaymentSettings(null);
        setPaymentSettingsByOwner({});
        setOwnerQrUrl(null);
        setProfileName(profile.full_name);
        setProfilePhone(profile.phone ?? '');
      } else if (page === 'home') {
        const [bookingResult, notificationResult] = await Promise.all([
          supabase.from('bookings').select('*').order('created_at', { ascending: false }),
          supabase.from('notifications').select('*').eq('is_read', false),
        ]);
        if (bookingResult.error) throw bookingResult.error;
        if (notificationResult.error) throw notificationResult.error;
        const bookingRows = (bookingResult.data ?? []) as Booking[];
        const ownBookings = bookingRows.filter((booking) => (
          booking.vehicle_id !== null
          && (profile.role !== 'farmer' || booking.farmer_id === profile.id)
        ));
        await loadBookingContext(ownBookings);
        setNotifications((notificationResult.data ?? []) as AppNotification[]);
        if (profile.role === 'vehicle_owner') {
          const [vehicleResult, tripResult] = await Promise.all([
            supabase.from('vehicles').select('*').eq('owner_id', profile.id),
            supabase.from('trips').select('*').eq('owner_id', profile.id),
          ]);
          if (vehicleResult.error) throw vehicleResult.error;
          if (tripResult.error) throw tripResult.error;
          setVehicles((vehicleResult.data ?? []) as Vehicle[]);
          setTrips((tripResult.data ?? []) as Trip[]);
        }
      }
    } catch (loadError) {
      setError(appError(loadError, 'माहिती लोड करता आली नाही. पुन्हा प्रयत्न करा.'));
    } finally {
      setLoading(false);
    }
  }, [loadBookingContext, page, profile]);

  useFocusEffect(useCallback(() => {
    void runQuery();
  }, [runQuery]));

  const visibleVehicles = useMemo(() => {
    const capacity = filterCapacity.trim() ? Number(filterCapacity) : null;
    return vehicles.filter((vehicle) => (
      vehicle.is_active
      && vehicle.availability_status === 'AVAILABLE'
      && (!filterType.trim() || vehicle.vehicle_type.toLocaleLowerCase().includes(filterType.trim().toLocaleLowerCase()))
      && (capacity === null || (Number.isFinite(capacity) && capacityInKg(vehicle) >= capacity))
    ));
  }, [filterCapacity, filterType, vehicles]);

  const chooseImage = async (kind: 'qr' | 'proof', bookingId?: string) => {
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        allowsEditing: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const extension = imageExtension(asset.mimeType);
      const maxBytes = kind === 'qr' ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
      if (!extension || (asset.fileSize !== undefined && asset.fileSize > maxBytes)) {
        throw new Error(kind === 'qr'
          ? 'QR साठी JPG, PNG किंवा WEBP प्रतिमा (कमाल ५ MB) निवडा.'
          : 'पेमेंट पुराव्यासाठी JPG, PNG किंवा WEBP प्रतिमा (कमाल १० MB) निवडा.');
      }
      if (kind === 'qr') {
        setPendingQrAsset(asset);
      } else if (bookingId) {
        setPaymentDrafts((current) => ({
          ...current,
          [bookingId]: { asset, transactionId: current[bookingId]?.transactionId ?? '' },
        }));
      }
    } catch (pickerError) {
      setError(appError(pickerError, 'प्रतिमा निवडता आली नाही.'));
    }
  };

  const uploadImage = async (
    bucket: 'owner-payment-qr' | 'payment-screenshots',
    path: string,
    asset: ImagePicker.ImagePickerAsset,
    upsert = false,
  ) => {
    const extension = imageExtension(asset.mimeType);
    if (!extension) throw new Error('प्रतिमेचा प्रकार समर्थित नाही.');
    const response = await fetch(asset.uri);
    if (!response.ok) throw new Error('निवडलेली प्रतिमा वाचता आली नाही.');
    const imageBlob = await response.blob();
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, imageBlob, {
      contentType: asset.mimeType ?? 'image/jpeg',
      upsert,
    });
    if (uploadError) throw uploadError;
  };

  const savePaymentSettings = async () => {
    if (!profile || profile.role !== 'vehicle_owner') return;
    const upi = paymentUpi.trim();
    if (upi && !/^[A-Za-z0-9._-]{2,256}@[A-Za-z0-9.-]{2,64}$/.test(upi)) {
      setError('वैध UPI ID भरा किंवा रिकामे ठेवा.');
      return;
    }
    setBusy(true);
    setError(null);
    let newPath: string | null = null;
    let settingsSaved = false;
    try {
      if (pendingQrAsset) {
        const extension = imageExtension(pendingQrAsset.mimeType);
        if (!extension) throw new Error('QR प्रतिमेचा प्रकार समर्थित नाही.');
        newPath = `${profile.id}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}.${extension}`;
        await uploadImage('owner-payment-qr', newPath, pendingQrAsset);
      }
      const nextPath = newPath ?? paymentSettings?.qr_storage_path ?? null;
      const { data, error: saveError } = await supabase
        .from('owner_payment_settings')
        .upsert({ owner_id: profile.id, upi_id: upi || null, qr_storage_path: nextPath })
        .select('owner_id, upi_id, qr_storage_path, updated_at')
        .single();
      if (saveError) throw saveError;
      settingsSaved = true;
      const previousPath = paymentSettings?.qr_storage_path;
      const { data: signed, error: signedError } = nextPath
        ? await supabase.storage.from('owner-payment-qr').createSignedUrl(nextPath, 900)
        : { data: null, error: null };
      if (signedError) throw signedError;
      setPaymentSettings(data as OwnerPaymentSettings);
      setPaymentSettingsByOwner((current) => ({ ...current, [profile.id]: data as OwnerPaymentSettings }));
      setOwnerQrUrl(signed?.signedUrl ?? null);
      setPendingQrAsset(null);
      if (newPath && previousPath && previousPath !== newPath) {
        const { error: removeError } = await supabase.storage.from('owner-payment-qr').remove([previousPath]);
        if (removeError) throw new Error(`सेटिंग जतन झाली; जुनी QR फाइल हटवता आली नाही: ${removeError.message}`);
      }
    } catch (settingsError) {
      if (newPath && !settingsSaved) {
        const { error: cleanupError } = await supabase.storage.from('owner-payment-qr').remove([newPath]);
        if (cleanupError) {
          setError(`${appError(settingsError, 'पेमेंट सेटिंग जतन करता आली नाही.')} नवीन QR फाइलची साफसफाईही अयशस्वी झाली: ${cleanupError.message}`);
        } else {
          setError(appError(settingsError, 'पेमेंट सेटिंग जतन करता आली नाही.'));
        }
      } else {
        setError(appError(settingsError, 'पेमेंट सेटिंग जतन करता आली नाही.'));
      }
    } finally {
      setBusy(false);
    }
  };

  const deleteOwnerQr = async () => {
    if (!paymentSettings?.qr_storage_path) return;
    setBusy(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('owner_payment_settings')
        .update({ qr_storage_path: null })
        .eq('owner_id', paymentSettings.owner_id);
      if (updateError) throw updateError;
      setPaymentSettings({ ...paymentSettings, qr_storage_path: null });
      setPaymentSettingsByOwner((current) => ({
        ...current,
        [paymentSettings.owner_id]: { ...paymentSettings, qr_storage_path: null },
      }));
      setOwnerQrUrl(null);
      setPendingQrAsset(null);
      const { error: removeError } = await supabase.storage
        .from('owner-payment-qr')
        .remove([paymentSettings.qr_storage_path]);
      if (removeError) throw removeError;
    } catch (deleteError) {
      setError(appError(deleteError, 'QR कोड हटवता आला नाही.'));
    } finally {
      setBusy(false);
    }
  };

  const askDeleteQr = () => Alert.alert(
    'QR कोड हटवायचा?',
    'हा QR कोड वाहनमालकाच्या पेमेंट सेटिंगमधून काढला जाईल.',
    [
      { text: 'रद्द करा', style: 'cancel' },
      { text: 'हटवा', style: 'destructive', onPress: () => void deleteOwnerQr() },
    ],
  );

  const choosePaymentMode = async (mode: PaymentMode) => {
    setPaymentModeNotice(null);
    if (mode === 'CASH') {
      setOnlineQrAvailable(null);
      setBookingDraft((current) => ({ ...current, paymentMode: mode }));
      return;
    }
    if (!selectedVehicle) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: availabilityError } = await supabase.rpc('phase2_has_owner_qr', {
        target_owner: selectedVehicle.owner_id,
      });
      if (availabilityError) throw availabilityError;
      setOnlineQrAvailable(Boolean(data));
      if (!data) {
        setBookingDraft((current) => ({ ...current, paymentMode: 'CASH' }));
        setPaymentModeNotice('या वाहन मालकाने ऑनलाइन पेमेंटसाठी QR कोड जोडलेला नाही. रोख रक्कम निवडा.');
        return;
      }
      setBookingDraft((current) => ({ ...current, paymentMode: 'ONLINE' }));
    } catch (availabilityError) {
      setError(appError(availabilityError, 'ऑनलाइन पेमेंट उपलब्धता तपासता आली नाही.'));
    } finally {
      setBusy(false);
    }
  };

  const submitPaymentEvidence = async (booking: Booking) => {
    const draft = paymentDrafts[booking.id];
    if (!profile || !draft?.asset || !imageExtension(draft.asset.mimeType)) {
      setError('पेमेंटचा स्क्रीनशॉट निवडा.');
      return;
    }
    if (draft.asset.fileSize !== undefined && draft.asset.fileSize > 10 * 1024 * 1024) {
      setError('स्क्रीनशॉटचा आकार १० MB पेक्षा कमी असावा.');
      return;
    }
    setBusy(true);
    setError(null);
    const path = `${profile.id}/${booking.id}/payment-proof`;
    let committed = false;
    try {
      await uploadImage('payment-screenshots', path, draft.asset, true);
      const { data, error: submitError } = await supabase
        .from('bookings')
        .update({
          payment_screenshot_path: path,
          payment_transaction_id: draft.transactionId.trim() || null,
          payment_status: 'VERIFICATION_PENDING',
        })
        .eq('id', booking.id)
        .eq('farmer_id', profile.id)
        .select('id')
        .maybeSingle();
      if (submitError) throw submitError;
      if (!data) throw new Error('बुकिंग अद्ययावत झाली नाही. स्थिती तपासून पुन्हा प्रयत्न करा.');
      committed = true;
      if (booking.payment_screenshot_path && booking.payment_screenshot_path !== path) {
        const { error: removeOldError } = await supabase.storage
          .from('payment-screenshots')
          .remove([booking.payment_screenshot_path]);
        if (removeOldError) throw removeOldError;
      }
      setPaymentDrafts((current) => {
        const next = { ...current };
        delete next[booking.id];
        return next;
      });
      setPaymentBooking(null);
      await runQuery();
    } catch (submitError) {
      const message = appError(submitError, 'पेमेंट पुरावा पाठवता आला नाही.');
      if (committed) {
        await runQuery();
        setError(`${message} पेमेंट नोंदले आहे; कृपया बुकिंग स्थिती पुन्हा तपासा.`);
      } else {
        if (booking.payment_screenshot_path === path) {
          setError(message);
        } else {
          const { error: cleanupError } = await supabase.storage.from('payment-screenshots').remove([path]);
          setError(cleanupError ? `${message} अपलोड केलेली फाइल हटवता आली नाही: ${cleanupError.message}` : message);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const reviewPayment = async (booking: Booking, approved: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const { data, error: reviewError } = await supabase
        .from('bookings')
        .update({ payment_status: approved ? 'COMPLETED' : 'REJECTED' })
        .eq('id', booking.id)
        .eq('payment_status', 'VERIFICATION_PENDING')
        .select('id')
        .maybeSingle();
      if (reviewError) throw reviewError;
      if (!data) throw new Error('पेमेंट स्थिती बदलली नाही. पृष्ठ पुन्हा लोड करा.');
      setReviewScreenshot(null);
      await runQuery();
    } catch (reviewError) {
      setError(appError(reviewError, 'पेमेंट तपासणी जतन करता आली नाही.'));
    } finally {
      setBusy(false);
    }
  };

  const confirmCashPayment = async (booking: Booking) => {
    setBusy(true);
    setError(null);
    try {
      const { data, error: paymentError } = await supabase
        .from('bookings')
        .update({ payment_status: 'COMPLETED' })
        .eq('id', booking.id)
        .eq('payment_mode', 'CASH')
        .eq('payment_status', 'PENDING')
        .select('id')
        .maybeSingle();
      if (paymentError) throw paymentError;
      if (!data) throw new Error('रोख पेमेंटची स्थिती बदलली नाही. प्रवास पूर्ण आहे का तपासा.');
      await runQuery();
    } catch (paymentError) {
      setError(appError(paymentError, 'रोख पेमेंट पूर्ण नोंदवता आले नाही.'));
    } finally {
      setBusy(false);
    }
  };

  const saveVehicle = async () => {
    const capacity = Number(vehicleDraft.capacity);
    const digits = vehicleDraft.driverMobile.replace(/\D/g, '');
    if (!vehicleDraft.number.trim() || !vehicleDraft.type.trim()
      || !Number.isFinite(capacity) || capacity <= 0 || !vehicleDraft.driverName.trim()
      || digits.length < 10 || digits.length > 15) {
      setError('वाहन क्रमांक, प्रकार, योग्य क्षमता, चालकाचे नाव आणि वैध मोबाइल क्रमांक भरा.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const values = {
        vehicle_number: vehicleDraft.number.trim().toUpperCase(),
        vehicle_type: vehicleDraft.type.trim(),
        capacity,
        capacity_unit: editingVehicle
          ? vehicles.find((vehicle) => vehicle.id === editingVehicle)?.capacity_unit ?? 'kg'
          : 'kg',
        driver_name: vehicleDraft.driverName.trim(),
        driver_mobile: vehicleDraft.driverMobile.trim(),
        is_active: editingVehicle
          ? vehicles.find((vehicle) => vehicle.id === editingVehicle)?.is_active ?? true
          : true,
        ...(!editingVehicle ? { availability_status: 'AVAILABLE' as const } : {}),
      };
      const result = editingVehicle
        ? await supabase.from('vehicles').update(values).eq('id', editingVehicle)
        : await supabase.from('vehicles').insert({ ...values, owner_id: profile?.id });
      if (result.error) throw result.error;
      setVehicleModal(false);
      setEditingVehicle(null);
      setVehicleDraft(blankVehicle);
      await runQuery();
    } catch (saveError) {
      setError(appError(saveError, 'वाहन जतन करता आले नाही.'));
    } finally {
      setBusy(false);
    }
  };

  const changeVehicleAvailability = async (vehicle: Vehicle) => {
    setBusy(true);
    setError(null);
    try {
      const makeAvailable = vehicle.availability_status === 'COMPLETED';
      const { error: updateError } = await supabase
        .from('vehicles')
        .update({
          is_active: makeAvailable ? true : !vehicle.is_active,
          ...(makeAvailable ? { availability_status: 'AVAILABLE' } : {}),
        })
        .eq('id', vehicle.id);
      if (updateError) throw updateError;
      await runQuery();
    } catch (updateError) {
      setError(appError(updateError, 'उपलब्धता बदलता आली नाही.'));
    } finally {
      setBusy(false);
    }
  };

  const createBooking = async () => {
    const weight = Number(bookingDraft.weight);
    const isDate = validIsoDate(bookingDraft.date);
    const isTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(bookingDraft.time);
    if (!selectedVehicle || !bookingDraft.cargo.trim() || !Number.isFinite(weight) || weight <= 0
      || weight > selectedVehicle.capacity || !bookingDraft.pickup.trim() || !bookingDraft.destination.trim()
      || !bookingDraft.pickupCoordinate || !bookingDraft.destinationCoordinate
      || bookingDraft.pickup.trim().toLocaleLowerCase() === bookingDraft.destination.trim().toLocaleLowerCase()
      || (bookingDraft.paymentMode === 'ONLINE' && onlineQrAvailable !== true)
      || !isDate || bookingDraft.date < new Date().toISOString().slice(0, 10) || !isTime) {
      setError('माल, योग्य वजन, वेगवेगळी उचल व पोहोच ठिकाणे, भविष्यातील तारीख आणि वेळ भरा.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from('bookings').insert({
        vehicle_id: selectedVehicle.id,
        farmer_id: profile?.id,
        cargo_description: bookingDraft.cargo.trim(),
        quantity: weight,
        pickup_location: bookingDraft.pickup.trim(),
        destination: bookingDraft.destination.trim(),
        pickup_latitude: bookingDraft.pickupCoordinate.latitude,
        pickup_longitude: bookingDraft.pickupCoordinate.longitude,
        destination_latitude: bookingDraft.destinationCoordinate.latitude,
        destination_longitude: bookingDraft.destinationCoordinate.longitude,
        booking_date: bookingDraft.date,
        booking_time: bookingDraft.time,
        additional_note: bookingDraft.note.trim() || null,
        payment_mode: bookingDraft.paymentMode,
      });
      if (insertError) throw insertError;
      setBookingFormModal(false);
      setBookingDetailsModal(false);
      setSelectedVehicle(null);
      setBookingDraft(blankBooking);
      await runQuery();
    } catch (insertError) {
      setError(appError(insertError, 'आरक्षण विनंती पाठवता आली नाही.'));
    } finally {
      setBusy(false);
    }
  };

  const changeBooking = async (booking: Booking, accepted: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: accepted ? 'ACCEPTED' : 'REJECTED' })
        .eq('id', booking.id)
        .eq('status', 'PENDING');
      if (updateError) throw updateError;
      await runQuery();
    } catch (updateError) {
      setError(appError(updateError, 'आरक्षणाची स्थिती बदलता आली नाही.'));
    } finally {
      setBusy(false);
    }
  };

  const changeTrip = async (trip: Trip, status: Trip['status']) => {
    setBusy(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('trips')
        .update({ status })
        .eq('id', trip.id);
      if (updateError) throw updateError;
      await runQuery();
    } catch (updateError) {
      setError(appError(updateError, 'प्रवासाची स्थिती बदलता आली नाही.'));
    } finally {
      setBusy(false);
    }
  };

  const markRead = async (notification: AppNotification) => {
    setBusy(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notification.id);
      if (updateError) throw updateError;
      await runQuery();
    } catch (updateError) {
      setError(appError(updateError, 'सूचना वाचलेली म्हणून नोंदवता आली नाही.'));
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async () => {
    const mobileDigits = profilePhone.replace(/\D/g, '');
    if (!profileName.trim() || mobileDigits.length < 10 || mobileDigits.length > 15) {
      setError('नाव आणि वैध मोबाइल क्रमांक आवश्यक आहे.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ full_name: profileName.trim(), phone: profilePhone.trim() })
        .eq('id', profile?.id);
      if (updateError) throw updateError;
      await refreshProfile();
    } catch (updateError) {
      setError(appError(updateError, 'प्रोफाइल जतन करता आले नाही.'));
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    setError(null);
    try {
      await signOut();
    } catch (signOutError) {
      setError(appError(signOutError, 'लॉगआउट करता आले नाही.'));
    } finally {
      setBusy(false);
    }
  };

  const updateTripFromBooking = (bookingId: string) => trips.find((trip) => trip.booking_id === bookingId);
  const vehicleForBooking = (booking: Booking) => vehicles.find((vehicle) => vehicle.id === booking.vehicle_id);
  const pageTitle: Record<string, string> = {
    home: profile?.role === 'farmer' ? 'शेतकरी डॅशबोर्ड' : 'वाहनमालक डॅशबोर्ड',
    search: 'वाहन शोधा',
    vehicles: 'माझी वाहने',
    bookings: 'माझी आरक्षणे',
    requests: 'आरक्षण विनंत्या',
    journeys: 'माझे प्रवास',
    notifications: 'सूचना',
    profile: 'माझे प्रोफाइल',
  };
  const paymentVehicle = paymentBooking ? vehicleForBooking(paymentBooking) : undefined;
  const paymentOwner = paymentVehicle ? owners[paymentVehicle.owner_id] : undefined;
  const paymentOwnerSettings = paymentVehicle
    ? paymentSettingsByOwner[paymentVehicle.owner_id]
    : undefined;
  const paymentDraft = paymentBooking ? paymentDrafts[paymentBooking.id] : undefined;

  return (
    <>
      <Page title={pageTitle[page] ?? 'स्मार्ट कृषी मालवाहतूक'} subtitle={profile ? `नमस्कार, ${profile.full_name}` : undefined}>
        {error ? <Notice>{error}</Notice> : null}
        {loading ? <Loading /> : null}

        {!loading && page === 'home' && profile?.role === 'farmer' ? (
          <>
            <ImageBackground source={{ uri: IMAGE_URLS.welcome }} imageStyle={styles.heroImage} style={styles.hero}>
              <View style={styles.heroShade}>
                <Text style={styles.heroTitle}>शेतमालाच्या वाहतुकीसाठी योग्य वाहन शोधा</Text>
                <Text style={styles.heroSubtitle}>विश्वासार्ह वाहनमालकांशी थेट संपर्क साधा.</Text>
                <Button title="वाहन शोधा" onPress={() => router.push('/(tabs)/search')} />
              </View>
            </ImageBackground>
            <Card>
              <Text style={styles.cardHeading}>तुमचे आरक्षण</Text>
              <Text style={styles.body}>{bookings.length} आरक्षणे · {notifications.length} नवीन सूचना</Text>
              <Button title="माझी आरक्षणे पहा" variant="secondary" onPress={() => router.push('/(tabs)/bookings')} />
              <Button title="माझे प्रवास पहा" variant="secondary" onPress={() => router.push('/(tabs)/journeys')} />
              <Button title="सूचना पहा" variant="secondary" onPress={() => router.push('/(tabs)/notifications')} />
            </Card>
          </>
        ) : null}

        {!loading && page === 'home' && profile?.role === 'vehicle_owner' ? (
          <>
            <ImageBackground source={{ uri: IMAGE_URLS.vehicleOwner }} imageStyle={styles.heroImage} style={styles.hero}>
              <View style={styles.heroShade}>
                <Text style={styles.heroTitle}>तुमची वाहने, तुमचा व्यवसाय</Text>
                <Text style={styles.heroSubtitle}>वाहन नोंदवा आणि शेतकऱ्यांच्या विनंत्यांना प्रतिसाद द्या.</Text>
                <Button title="वाहन नोंदणी" onPress={() => {
                  setEditingVehicle(null);
                  setVehicleDraft(blankVehicle);
                  setVehicleModal(true);
                }} />
              </View>
            </ImageBackground>
            <Card>
              <Text style={styles.cardHeading}>आजचा आढावा</Text>
              <Text style={styles.body}>{vehicles.length} वाहने · {bookings.filter((item) => item.status === 'PENDING').length} प्रलंबित विनंत्या · {trips.length} प्रवास</Text>
              <Button title="आरक्षण विनंत्या पहा" variant="secondary" onPress={() => router.push('/(tabs)/requests')} />
              <Button title="माझे प्रवास पहा" variant="secondary" onPress={() => router.push('/(tabs)/journeys')} />
            </Card>
          </>
        ) : null}

        {!loading && page === 'search' ? (
          <>
            <Card>
              <Field label="वाहनाचा प्रकार" value={filterType} onChangeText={setFilterType} placeholder="ट्रक, ट्रॅक्टर, टेम्पो..." />
              <Field label="किमान क्षमता (किलो)" value={filterCapacity} onChangeText={setFilterCapacity} placeholder="उदा. 1000" keyboardType="decimal-pad" />
            </Card>
            {!filterCapacity.trim() || (Number.isFinite(Number(filterCapacity)) && Number(filterCapacity) > 0)
              ? visibleVehicles.length === 0
                ? <Empty>या निकषांनुसार उपलब्ध वाहने नाहीत.</Empty>
                : visibleVehicles.map((vehicle) => (
                  <Pressable key={vehicle.id} onPress={() => {
                    setSelectedVehicle(vehicle);
                    setBookingDetailsModal(true);
                  }}>
                    <Card>
                      <View style={styles.cardTopRow}>
                        <Text style={styles.cardHeading}>{vehicle.vehicle_number}</Text>
                        <StatusLabel status="उपलब्ध" />
                      </View>
                      <Text style={styles.body}>{vehicle.vehicle_type} · {vehicle.capacity} {vehicle.capacity_unit}</Text>
                      <Text style={styles.body}>चालक: {vehicle.driver_name}</Text>
                      <Text style={styles.tapHint}>तपशील पाहण्यासाठी निवडा</Text>
                    </Card>
                  </Pressable>
                ))
              : <Notice>क्षमता शून्यापेक्षा जास्त असावी.</Notice>}
          </>
        ) : null}

        {!loading && page === 'vehicles' ? (
          <>
            <Button title="＋ वाहन नोंदणी" onPress={() => {
              setEditingVehicle(null);
              setVehicleDraft(blankVehicle);
              setVehicleModal(true);
            }} />
            {vehicles.length === 0 ? <Empty>अद्याप वाहन नोंदवलेले नाही. पहिले वाहन जोडा.</Empty> : null}
            {vehicles.map((vehicle) => (
              <Card key={vehicle.id}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.cardHeading}>{vehicle.vehicle_number}</Text>
                  <StatusLabel status={vehicle.is_active ? vehicleStatusLabel[vehicle.availability_status] : 'अनुपलब्ध'} />
                </View>
                <Text style={styles.body}>{vehicle.vehicle_type} · {vehicle.capacity} {vehicle.capacity_unit}</Text>
                <Text style={styles.body}>चालक: {vehicle.driver_name}</Text>
                <Text style={styles.body}>मोबाइल: {vehicle.driver_mobile}</Text>
                <Button title="वाहन संपादित करा" variant="secondary" onPress={() => {
                  setEditingVehicle(vehicle.id);
                  setVehicleDraft({
                    number: vehicle.vehicle_number,
                    type: vehicle.vehicle_type,
                    capacity: String(vehicle.capacity),
                    driverName: vehicle.driver_name || profile?.full_name || '',
                    driverMobile: vehicle.driver_mobile || profile?.phone || '',
                  });
                  setVehicleModal(true);
                }} disabled={busy || vehicle.availability_status === 'RESERVED' || vehicle.availability_status === 'ON_JOURNEY'} />
                {vehicle.availability_status === 'AVAILABLE' || vehicle.availability_status === 'COMPLETED' ? (
                  <Button
                    title={vehicle.availability_status === 'COMPLETED'
                      ? 'पुन्हा उपलब्ध करा'
                      : vehicle.is_active
                        ? 'तात्पुरते अनुपलब्ध करा'
                        : 'उपलब्ध करा'}
                    variant="secondary"
                    onPress={() => void changeVehicleAvailability(vehicle)}
                    disabled={busy}
                  />
                ) : null}
              </Card>
            ))}
          </>
        ) : null}

        {!loading && (page === 'bookings' || page === 'requests') ? (
          <>
            {bookings.length === 0 ? (
              <Empty>{page === 'bookings' ? 'तुमची आरक्षणे येथे दिसतील.' : 'नवीन आरक्षण विनंती नाही.'}</Empty>
            ) : null}
            {bookings.map((booking) => {
              const vehicle = vehicleForBooking(booking);
              const farmer = farmers[booking.farmer_id];
              const trip = updateTripFromBooking(booking.id);
              return (
                <Card key={booking.id}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.cardHeading}>{vehicle?.vehicle_number ?? `आरक्षण ${booking.id.slice(0, 8)}`}</Text>
                    <StatusLabel status={bookingStatusLabel[booking.status]} />
                  </View>
                  {page === 'requests' ? (
                    <>
                      <Text style={styles.body}>शेतकरी: {farmer?.full_name ?? 'माहिती उपलब्ध नाही'}</Text>
                      <Text style={styles.body}>मोबाइल: {farmer?.phone ?? 'माहिती उपलब्ध नाही'}</Text>
                    </>
                  ) : null}
                  <Text style={styles.body}>आरक्षण क्रमांक: {booking.id}</Text>
                  <Text style={styles.body}>वाहन: {vehicle?.vehicle_type ?? '—'} · चालक: {vehicle?.driver_name ?? '—'}</Text>
                  <Text style={styles.body}>माल: {booking.cargo_description} · वजन: {booking.quantity} {vehicle?.capacity_unit ?? 'kg'}</Text>
                  <Text style={styles.body}>उचल: {booking.pickup_location ?? '—'} · पोहोच: {booking.destination ?? '—'}</Text>
                  {booking.pickup_latitude !== null && booking.pickup_longitude !== null
                    && booking.destination_latitude !== null && booking.destination_longitude !== null ? (
                    <Button
                      title="उचल व पोहोच ठिकाण नकाशावर पहा"
                      variant="secondary"
                      onPress={() => setViewMapBooking(booking)}
                    />
                  ) : null}
                  <Text style={styles.body}>तारीख: {formatDate(booking.booking_date)} · वेळ: {booking.booking_time ?? '—'}</Text>
                  <Text style={styles.body}>
                    पेमेंट पद्धत: {booking.payment_mode === 'ONLINE' ? 'ऑनलाइन पेमेंट' : 'रोख रक्कम'}
                  </Text>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.body}>पेमेंट स्थिती</Text>
                    <StatusLabel status={paymentStatusLabel[booking.payment_status]} />
                  </View>
                  {booking.payment_amount !== null ? (
                    <Text style={styles.body}>पेमेंट रक्कम: ₹{booking.payment_amount}</Text>
                  ) : null}
                  {booking.payment_deleted_at ? (
                    <Text style={styles.date}>स्क्रीनशॉट हटवला: {new Date(booking.payment_deleted_at).toLocaleString('mr-IN')}</Text>
                  ) : booking.payment_delete_at && booking.payment_screenshot_path ? (
                    <Text style={styles.date}>स्क्रीनशॉट हटवण्याची नियोजित वेळ: {new Date(booking.payment_delete_at).toLocaleString('mr-IN')}</Text>
                  ) : null}
                  {booking.additional_note ? <Text style={styles.body}>टीप: {booking.additional_note}</Text> : null}
                  {page === 'requests' && booking.payment_mode === 'ONLINE'
                    && booking.payment_status === 'VERIFICATION_PENDING' ? (
                    <>
                      <Text style={styles.body}>UTR / व्यवहार क्रमांक: {booking.payment_transaction_id ?? 'दिला नाही'}</Text>
                      {booking.payment_submitted_at ? (
                        <Text style={styles.date}>पेमेंट दिनांक: {new Date(booking.payment_submitted_at).toLocaleString('mr-IN')}</Text>
                      ) : null}
                      {paymentProofUrls[booking.id] ? (
                        <Pressable onPress={() => setReviewScreenshot(paymentProofUrls[booking.id])}>
                          <Image source={{ uri: paymentProofUrls[booking.id] }} style={styles.paymentProof} resizeMode="contain" />
                          <Text style={styles.tapHint}>मोठा स्क्रीनशॉट पाहण्यासाठी निवडा</Text>
                        </Pressable>
                      ) : <Notice>पेमेंट स्क्रीनशॉट उपलब्ध नाही. शेतकऱ्याला पुन्हा अपलोड करण्यास सांगा.</Notice>}
                      <View style={styles.actionRow}>
                        <View style={styles.actionCell}>
                          <Button title="पेमेंट स्वीकारा" onPress={() => void reviewPayment(booking, true)} disabled={busy} />
                        </View>
                        <View style={styles.actionCell}>
                          <Button title="पेमेंट नकारा" variant="danger" onPress={() => void reviewPayment(booking, false)} disabled={busy} />
                        </View>
                      </View>
                    </>
                  ) : null}
                  {page === 'requests' && booking.status === 'PENDING' ? (
                    <View style={styles.actionRow}>
                      <View style={styles.actionCell}>
                        <Button title="स्वीकारा" onPress={() => void changeBooking(booking, true)} disabled={busy} />
                      </View>
                      <View style={styles.actionCell}>
                        <Button title="नकार द्या" variant="danger" onPress={() => void changeBooking(booking, false)} disabled={busy} />
                      </View>
                    </View>
                  ) : null}
                  {page === 'bookings' && trip ? <StatusLabel status={tripStatusLabel[trip.status]} /> : null}
                  {page === 'bookings' && booking.status === 'ACCEPTED'
                    && booking.payment_mode === 'ONLINE' ? (
                    <>
                      <Button
                        title="पेमेंट तपशील उघडा"
                        onPress={() => setPaymentBooking(booking)}
                        disabled={busy}
                      />
                    </>
                  ) : null}
                  {page === 'requests' && profile?.role === 'vehicle_owner'
                    && booking.status === 'ACCEPTED' && booking.payment_mode === 'CASH'
                    && booking.payment_status === 'PENDING'
                    && (trip?.status === 'ON_JOURNEY' || trip?.status === 'COMPLETED') ? (
                    <Button
                      title="रोख पेमेंट पूर्ण नोंदवा"
                      onPress={() => void confirmCashPayment(booking)}
                      disabled={busy}
                    />
                  ) : null}
                </Card>
              );
            })}
          </>
        ) : null}

        {!loading && page === 'journeys' ? (
          <>
            {trips.length === 0 ? (
              <Empty>{profile?.role === 'vehicle_owner' ? 'स्वीकारलेल्या आरक्षणांमधून तुमचे प्रवास येथे तयार होतील.' : 'स्वीकारलेल्या आरक्षणांचे प्रवास येथे दिसतील.'}</Empty>
            ) : null}
            {trips.map((trip) => {
              const booking = bookings.find((item) => item.id === trip.booking_id);
              const vehicle = vehicles.find((item) => item.id === trip.vehicle_id);
              return (
                <Card key={trip.id}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.cardHeading}>{vehicle?.vehicle_number ?? 'प्रवास'}</Text>
                    <StatusLabel status={tripStatusLabel[trip.status]} />
                  </View>
                  <Text style={styles.body}>{booking?.pickup_location ?? '—'} → {booking?.destination ?? '—'}</Text>
                  <Text style={styles.body}>{formatDate(booking?.booking_date ?? '')} · {booking?.booking_time ?? '—'}</Text>
                  <Text style={styles.body}>माल: {booking?.cargo_description ?? '—'} · {booking?.quantity ?? '—'} {vehicle?.capacity_unit ?? 'kg'}</Text>
                  {profile?.role === 'vehicle_owner' && trip.status === 'RESERVED' ? (
                    <Button title="प्रवास सुरू करा" onPress={() => void changeTrip(trip, 'ON_JOURNEY')} disabled={busy} />
                  ) : null}
                  {profile?.role === 'vehicle_owner' && trip.status === 'ON_JOURNEY' ? (
                    <Button title="प्रवास पूर्ण करा" onPress={() => void changeTrip(trip, 'COMPLETED')} disabled={busy} />
                  ) : null}
                </Card>
              );
            })}
          </>
        ) : null}

        {!loading && page === 'notifications' ? (
          <>
            {notifications.length === 0 ? <Empty>नवीन सूचना नाहीत.</Empty> : null}
            {notifications.map((notification) => (
              <Card key={notification.id}>
                <Text style={styles.cardHeading}>{notification.title}</Text>
                <Text style={styles.body}>{notification.message}</Text>
                <Text style={styles.date}>{new Date(notification.created_at).toLocaleString('mr-IN')}</Text>
                {!notification.is_read ? (
                  <Button title="वाचलेली म्हणून नोंदवा" variant="secondary" onPress={() => void markRead(notification)} disabled={busy} />
                ) : <StatusLabel status="वाचले" />}
              </Card>
            ))}
          </>
        ) : null}

        {!loading && page === 'profile' ? (
          <>
            <Card>
              <Field label="नाव" value={profileName} onChangeText={setProfileName} placeholder="तुमचे नाव" autoCapitalize="words" />
              <Field label="मोबाइल" value={profilePhone} onChangeText={setProfilePhone} placeholder="मोबाइल क्रमांक" keyboardType="phone-pad" />
              <Text style={styles.body}>ईमेल: {session?.user.email ?? '—'}</Text>
              <Text style={styles.body}>भूमिका: {profile?.role === 'farmer' ? 'शेतकरी' : 'वाहनमालक / चालक'}</Text>
              <Button title={busy ? 'जतन होत आहे...' : 'प्रोफाइल जतन करा'} onPress={() => void saveProfile()} disabled={busy} />
            </Card>
            {profile?.role === 'vehicle_owner' ? (
              <Card>
                <Text style={styles.cardHeading}>पेमेंट सेटिंग्ज</Text>
                <Text style={styles.body}>ऑनलाइन पेमेंटसाठी QR कोड आणि UPI ID द्या. रोख पेमेंटसाठी हे ऐच्छिक आहे.</Text>
                <Field
                  label="UPI ID (ऐच्छिक)"
                  value={paymentUpi}
                  onChangeText={setPaymentUpi}
                  placeholder="name@bank"
                  autoCapitalize="none"
                />
                {pendingQrAsset ? (
                  <Image source={{ uri: pendingQrAsset.uri }} style={styles.qrImage} resizeMode="contain" />
                ) : ownerQrUrl ? (
                  <Image source={{ uri: ownerQrUrl }} style={styles.qrImage} resizeMode="contain" />
                ) : (
                  <Empty>QR कोड जोडलेला नाही.</Empty>
                )}
                <Button
                  title={pendingQrAsset ? 'दुसरा QR निवडा' : paymentSettings?.qr_storage_path ? 'QR बदला' : 'QR अपलोड करा'}
                  variant="secondary"
                  onPress={() => void chooseImage('qr')}
                  disabled={busy}
                />
                {paymentSettings?.qr_storage_path ? (
                  <Button title="QR हटवा" variant="danger" onPress={askDeleteQr} disabled={busy} />
                ) : null}
                <Button
                  title={busy ? 'जतन होत आहे...' : 'पेमेंट सेटिंग्ज जतन करा'}
                  onPress={() => void savePaymentSettings()}
                  disabled={busy}
                />
              </Card>
            ) : null}
            <Button title="लॉगआउट" variant="secondary" onPress={() => void handleSignOut()} disabled={busy} />
          </>
        ) : null}
      </Page>

      <Modal visible={vehicleModal} animationType="slide" transparent onRequestClose={() => setVehicleModal(false)}>
        <View style={styles.modalShade}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalCard} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
            <Text style={styles.cardHeading}>{editingVehicle ? 'वाहन संपादित करा' : 'नवीन वाहन नोंदवा'}</Text>
            {error ? <Notice>{error}</Notice> : null}
            <Field label="वाहन क्रमांक" value={vehicleDraft.number} onChangeText={(number) => setVehicleDraft((current) => ({ ...current, number }))} placeholder="उदा. MH 12 AB 1234" autoCapitalize="characters" />
            <Field label="वाहनाचा प्रकार" value={vehicleDraft.type} onChangeText={(type) => setVehicleDraft((current) => ({ ...current, type }))} placeholder="ट्रक, ट्रॅक्टर, टेम्पो..." />
            <Field label="क्षमता (किलो)" value={vehicleDraft.capacity} onChangeText={(capacity) => setVehicleDraft((current) => ({ ...current, capacity }))} placeholder="उदा. 2000" keyboardType="decimal-pad" />
            <Field label="चालकाचे नाव" value={vehicleDraft.driverName} onChangeText={(driverName) => setVehicleDraft((current) => ({ ...current, driverName }))} placeholder="चालकाचे पूर्ण नाव" />
            <Field label="चालकाचा मोबाइल" value={vehicleDraft.driverMobile} onChangeText={(driverMobile) => setVehicleDraft((current) => ({ ...current, driverMobile }))} placeholder="मोबाइल क्रमांक" keyboardType="phone-pad" />
            {!editingVehicle ? <StatusLabel status="उपलब्ध" /> : null}
            <Button title={busy ? 'जतन होत आहे...' : 'वाहन जतन करा'} onPress={() => void saveVehicle()} disabled={busy} />
            <Button title="बंद करा" variant="secondary" onPress={() => setVehicleModal(false)} disabled={busy} />
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={bookingDetailsModal} animationType="slide" transparent onRequestClose={() => setBookingDetailsModal(false)}>
        <View style={styles.modalShade}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalCard} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
            <Text style={styles.cardHeading}>वाहन तपशील</Text>
            {error ? <Notice>{error}</Notice> : null}
            {selectedVehicle ? (
              <>
                <Text style={styles.body}>क्रमांक: {selectedVehicle.vehicle_number}</Text>
                <Text style={styles.body}>प्रकार: {selectedVehicle.vehicle_type}</Text>
                <Text style={styles.body}>क्षमता: {selectedVehicle.capacity} {selectedVehicle.capacity_unit}</Text>
                <Text style={styles.body}>चालक: {selectedVehicle.driver_name}</Text>
                <Text style={styles.body}>मोबाइल: {selectedVehicle.driver_mobile}</Text>
                <StatusLabel status="उपलब्ध" />
              </>
            ) : null}
            <Button title="आरक्षण करा" onPress={() => {
              setBookingDraft(blankBooking);
              setBookingDetailsModal(false);
              setBookingFormModal(true);
            }} />
            <Button title="बंद करा" variant="secondary" onPress={() => setBookingDetailsModal(false)} />
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={bookingFormModal} animationType="slide" transparent onRequestClose={() => setBookingFormModal(false)}>
        <View style={styles.modalShade}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalCard} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
            <Text style={styles.cardHeading}>आरक्षण विनंती</Text>
            {error ? <Notice>{error}</Notice> : null}
            {paymentModeNotice ? <Notice tone="info">{paymentModeNotice}</Notice> : null}
            <Field label="मालाचा प्रकार" value={bookingDraft.cargo} onChangeText={(cargo) => setBookingDraft((current) => ({ ...current, cargo }))} placeholder="उदा. कांदा, गहू" />
            <Field label={`अंदाजे वजन (${selectedVehicle?.capacity_unit ?? 'kg'})`} value={bookingDraft.weight} onChangeText={(weight) => setBookingDraft((current) => ({ ...current, weight }))} placeholder="उदा. 500" keyboardType="decimal-pad" />
            <Field label="माल उचलण्याचे ठिकाण" value={bookingDraft.pickup} onChangeText={(pickup) => setBookingDraft((current) => ({ ...current, pickup }))} placeholder="गाव / परिसर" />
            <Button
              title={bookingDraft.pickupCoordinate ? 'उचल ठिकाण नकाशावर बदला' : 'उचल ठिकाण नकाशावर निवडा'}
              variant="secondary"
              onPress={() => setMapTarget('pickup')}
            />
            {bookingDraft.pickupCoordinate ? <Text style={styles.coordinateText}>उचल: {coordinateLabel(bookingDraft.pickupCoordinate)}</Text> : null}
            <Field label="पोहोचण्याचे ठिकाण" value={bookingDraft.destination} onChangeText={(destination) => setBookingDraft((current) => ({ ...current, destination }))} placeholder="गाव / बाजारपेठ" />
            <Button
              title={bookingDraft.destinationCoordinate ? 'पोहोच ठिकाण नकाशावर बदला' : 'पोहोच ठिकाण नकाशावर निवडा'}
              variant="secondary"
              onPress={() => setMapTarget('destination')}
            />
            {bookingDraft.destinationCoordinate ? <Text style={styles.coordinateText}>पोहोच: {coordinateLabel(bookingDraft.destinationCoordinate)}</Text> : null}
            <Text style={styles.cardHeading}>पेमेंट पद्धत</Text>
            {(['ONLINE', 'CASH'] as const).map((mode) => (
              <Pressable
                key={mode}
                onPress={() => void choosePaymentMode(mode)}
                accessibilityRole="radio"
                accessibilityState={{ selected: bookingDraft.paymentMode === mode }}
                style={[styles.paymentOption, bookingDraft.paymentMode === mode && styles.paymentOptionSelected]}
                disabled={busy}
              >
                <Text style={styles.paymentOptionText}>
                  {bookingDraft.paymentMode === mode ? '◉' : '○'} {mode === 'ONLINE' ? 'ऑनलाइन पेमेंट' : 'रोख रक्कम'}
                </Text>
              </Pressable>
            ))}
            {bookingDraft.paymentMode === 'ONLINE' ? (
              <Notice tone="info">ऑनलाइन पेमेंट वाहनमालक QR द्वारे बाहेरून करा. पुरावा वाहनमालक तपासेल.</Notice>
            ) : null}
            <Field label="तारीख (YYYY-MM-DD)" value={bookingDraft.date} onChangeText={(date) => setBookingDraft((current) => ({ ...current, date }))} placeholder="2026-10-05" />
            <Field label="वेळ (HH:MM)" value={bookingDraft.time} onChangeText={(time) => setBookingDraft((current) => ({ ...current, time }))} placeholder="09:30" />
            <Field label="अतिरिक्त टीप (ऐच्छिक)" value={bookingDraft.note} onChangeText={(note) => setBookingDraft((current) => ({ ...current, note }))} placeholder="काही विशेष सूचना" multiline />
            <Button title={busy ? 'विनंती पाठवत आहे...' : 'आरक्षण विनंती पाठवा'} onPress={() => void createBooking()} disabled={busy} />
            <Button title="परत जा" variant="secondary" onPress={() => {
              setBookingFormModal(false);
              setBookingDetailsModal(true);
            }} disabled={busy} />
          </ScrollView>
        </View>
      </Modal>
      <Modal
        visible={paymentBooking !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setPaymentBooking(null)}
      >
        <View style={styles.modalShade}>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalCard}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            <Text style={styles.cardHeading}>ऑनलाइन पेमेंट</Text>
            {paymentBooking ? (
              <>
                <Text style={styles.body}>बुकिंग: {paymentBooking.id.slice(0, 8)}</Text>
                <Text style={styles.body}>वाहनमालक: {paymentOwner?.full_name ?? 'माहिती उपलब्ध नाही'}</Text>
                <Text style={styles.body}>वाहन: {paymentVehicle?.vehicle_number ?? '—'}</Text>
                <Text style={styles.body}>
                  उचल: {paymentBooking.pickup_location ?? '—'} → पोहोच: {paymentBooking.destination ?? '—'}
                </Text>
                {paymentBooking.payment_amount !== null ? (
                  <Text style={styles.body}>रक्कम: ₹{paymentBooking.payment_amount}</Text>
                ) : (
                  <Text style={styles.body}>रक्कम अॅपमध्ये उपलब्ध नाही; वाहनमालकाशी रक्कम निश्चित करा.</Text>
                )}
                <View style={styles.cardTopRow}>
                  <Text style={styles.body}>पेमेंट स्थिती</Text>
                  <StatusLabel status={paymentStatusLabel[paymentBooking.payment_status]} />
                </View>
                {paymentOwnerSettings?.upi_id ? (
                  <Text style={styles.body}>UPI ID: {paymentOwnerSettings.upi_id}</Text>
                ) : null}
                {qrImageUrls[paymentVehicle?.owner_id ?? ''] ? (
                  <Image
                    source={{ uri: qrImageUrls[paymentVehicle?.owner_id ?? ''] }}
                    style={styles.qrImage}
                    resizeMode="contain"
                  />
                ) : (
                  <Notice>या वाहन मालकाने ऑनलाइन पेमेंटसाठी QR कोड जोडलेला नाही.</Notice>
                )}
                {paymentBooking.payment_status === 'PENDING' || paymentBooking.payment_status === 'REJECTED' ? (
                  <>
                    <Text style={styles.body}>
                      QR वापरून UPI अॅपमध्ये बाहेरून पेमेंट करा. पडताळणी वाहनमालक हाताने करेल.
                    </Text>
                    <Button
                      title={paymentDraft?.asset ? 'दुसरा स्क्रीनशॉट निवडा' : 'पेमेंट प्रूफ अपलोड करा'}
                      variant="secondary"
                      onPress={() => void chooseImage('proof', paymentBooking.id)}
                      disabled={busy}
                    />
                    {paymentDraft?.asset ? (
                      <Image source={{ uri: paymentDraft.asset.uri }} style={styles.paymentProof} resizeMode="contain" />
                    ) : paymentBooking.payment_screenshot_path && paymentProofUrls[paymentBooking.id] ? (
                      <Image source={{ uri: paymentProofUrls[paymentBooking.id] }} style={styles.paymentProof} resizeMode="contain" />
                    ) : paymentBooking.payment_screenshot_path && paymentProofUrls[paymentBooking.id] ? (
                      <Image source={{ uri: paymentProofUrls[paymentBooking.id] }} style={styles.paymentProof} resizeMode="contain" />
                    ) : null}
                    <Field
                      label="Transaction ID / UTR (ऐच्छिक)"
                      value={paymentDraft?.transactionId ?? paymentBooking.payment_transaction_id ?? ''}
                      onChangeText={(transactionId) => setPaymentDrafts((current) => ({
                        ...current,
                        [paymentBooking.id]: {
                          asset: current[paymentBooking.id]?.asset ?? null,
                          transactionId,
                        },
                      }))}
                      placeholder="व्यवहार क्रमांक"
                      autoCapitalize="characters"
                    />
                    <Button
                      title="पेमेंट प्रूफ सबमिट करा"
                      onPress={() => void submitPaymentEvidence(paymentBooking)}
                      disabled={busy || !paymentDraft?.asset}
                    />
                  </>
                ) : null}
                {paymentBooking.payment_status === 'VERIFICATION_PENDING' ? (
                  <>
                    <Text style={styles.body}>पेमेंट प्रूफ वाहनमालकाच्या हाताने पडताळणीसाठी पाठवला आहे.</Text>
                    <Text style={styles.body}>UTR: {paymentBooking.payment_transaction_id ?? 'दिला नाही'}</Text>
                    {paymentProofUrls[paymentBooking.id] ? (
                      <Image source={{ uri: paymentProofUrls[paymentBooking.id] }} style={styles.paymentProof} resizeMode="contain" />
                    ) : <Notice>पेमेंट प्रूफ लोड करता आला नाही. बुकिंग पुन्हा उघडून प्रयत्न करा.</Notice>}
                    {paymentBooking.payment_submitted_at ? (
                      <Text style={styles.date}>
                        पेमेंट दिनांक: {new Date(paymentBooking.payment_submitted_at).toLocaleString('mr-IN')}
                      </Text>
                    ) : null}
                  </>
                ) : null}
                {paymentBooking.payment_approved_at ? (
                  <Text style={styles.date}>
                    {paymentBooking.payment_status === 'COMPLETED' ? 'मंजुरी दिनांक' : 'तपासणी दिनांक'}: {' '}
                    {new Date(paymentBooking.payment_approved_at).toLocaleString('mr-IN')}
                  </Text>
                ) : null}
                {paymentBooking.payment_delete_at && paymentBooking.payment_screenshot_path ? (
                  <Text style={styles.date}>
                    स्क्रीनशॉट हटवण्याची नियोजित वेळ: {new Date(paymentBooking.payment_delete_at).toLocaleString('mr-IN')}
                  </Text>
                ) : null}
                {paymentBooking.payment_deleted_at ? (
                  <Text style={styles.date}>
                    स्क्रीनशॉट हटवला: {new Date(paymentBooking.payment_deleted_at).toLocaleString('mr-IN')}
                  </Text>
                ) : null}
              </>
            ) : null}
            <Button title="बंद करा" variant="secondary" onPress={() => setPaymentBooking(null)} disabled={busy} />
          </ScrollView>
        </View>
      </Modal>
      <MapLocationPicker
        visible={mapTarget !== null || viewMapBooking !== null}
        title={viewMapBooking
          ? 'आरक्षणातील उचल व पोहोच ठिकाणे'
          : mapTarget === 'pickup'
            ? 'उचल ठिकाण निवडा'
            : 'पोहोच ठिकाण निवडा'}
        initialCoordinate={viewMapBooking
          ? viewMapBooking.pickup_latitude !== null && viewMapBooking.pickup_longitude !== null
            ? { latitude: viewMapBooking.pickup_latitude, longitude: viewMapBooking.pickup_longitude }
            : null
          : mapTarget === 'pickup'
            ? bookingDraft.pickupCoordinate
            : bookingDraft.destinationCoordinate}
        otherCoordinate={viewMapBooking
          ? viewMapBooking.destination_latitude !== null && viewMapBooking.destination_longitude !== null
            ? { latitude: viewMapBooking.destination_latitude, longitude: viewMapBooking.destination_longitude }
            : null
          : mapTarget === 'pickup'
            ? bookingDraft.destinationCoordinate
            : bookingDraft.pickupCoordinate}
        selectedLabel={viewMapBooking || mapTarget === 'pickup' ? 'उचल' : 'पोहोच'}
        otherLabel={viewMapBooking || mapTarget === 'pickup' ? 'पोहोच' : 'उचल'}
        selectable={mapTarget !== null}
        onCancel={() => {
          setMapTarget(null);
          setViewMapBooking(null);
        }}
        onSelect={(coordinate) => {
          if (mapTarget === 'pickup') {
            setBookingDraft((current) => ({
              ...current,
              pickupCoordinate: coordinate,
              pickup: current.pickup.trim() ? current.pickup : coordinateLabel(coordinate),
            }));
          } else if (mapTarget === 'destination') {
            setBookingDraft((current) => ({
              ...current,
              destinationCoordinate: coordinate,
              destination: current.destination.trim() ? current.destination : coordinateLabel(coordinate),
            }));
          }
          setMapTarget(null);
          setViewMapBooking(null);
        }}
      />
      <Modal
        visible={reviewScreenshot !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setReviewScreenshot(null)}
      >
        <View style={styles.reviewShade}>
          <View style={styles.reviewCard}>
            {reviewScreenshot ? (
              <Image source={{ uri: reviewScreenshot }} style={styles.reviewImage} resizeMode="contain" />
            ) : null}
            <Button title="बंद करा" onPress={() => setReviewScreenshot(null)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 230, justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 20, backgroundColor: '#236b43' },
  heroImage: { borderRadius: 20 },
  heroShade: { padding: 20, gap: 12, backgroundColor: 'rgba(16, 45, 28, 0.70)' },
  heroTitle: { color: '#fff', fontSize: 23, lineHeight: 30, fontWeight: '800' },
  heroSubtitle: { color: '#f0f6f1', fontSize: 15, lineHeight: 22 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  cardHeading: { color: '#183b2a', fontSize: 18, fontWeight: '800', flexShrink: 1 },
  body: { color: '#56685d', fontSize: 15, lineHeight: 22 },
  tapHint: { color: '#236b43', fontSize: 14, fontWeight: '700', paddingTop: 2 },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionCell: { flex: 1 },
  date: { color: '#748278', fontSize: 13 },
  modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(12, 30, 18, 0.55)' },
  modalScroll: {
    maxHeight: '92%',
    backgroundColor: '#f7faf7',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  modalCard: {
    padding: 20,
    gap: 11,
  },
  coordinateText: { color: '#56685d', fontSize: 13, lineHeight: 19 },
  paymentOption: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#d6e0d8',
    borderRadius: 11,
    backgroundColor: '#fff',
  },
  paymentOptionSelected: { borderColor: '#236b43', backgroundColor: '#e8f1eb' },
  paymentOptionText: { color: '#33493a', fontSize: 15, fontWeight: '700' },
  qrImage: { width: '100%', height: 220, backgroundColor: '#f4f7f4', borderRadius: 12 },
  paymentProof: { width: '100%', height: 220, backgroundColor: '#f4f7f4', borderRadius: 12 },
  reviewShade: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: 'rgba(12, 30, 18, 0.78)' },
  reviewCard: { backgroundColor: '#fff', padding: 14, borderRadius: 16, gap: 12 },
  reviewImage: { width: '100%', height: '75%' },
});
