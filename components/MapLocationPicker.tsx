import React, { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, Map, Marker, type CameraRef, type InitialViewState } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { Button, Notice } from '@/components/TransportUI';

export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

interface MapLocationPickerProps {
  visible: boolean;
  title: string;
  initialCoordinate: MapCoordinate | null;
  otherCoordinate: MapCoordinate | null;
  selectedLabel?: string;
  otherLabel?: string;
  selectable?: boolean;
  onCancel: () => void;
  onSelect: (coordinate: MapCoordinate) => void;
}

const DEFAULT_COORDINATE: MapCoordinate = { latitude: 19.7515, longitude: 75.7139 };
const MAP_STYLE = process.env.EXPO_PUBLIC_MAP_STYLE_URL
  || 'https://tiles.openfreemap.org/styles/liberty';
const MAP_ATTRIBUTION = process.env.EXPO_PUBLIC_MAP_ATTRIBUTION
  || '© OpenStreetMap contributors · OpenFreeMap';

export default function MapLocationPicker({
  visible,
  title,
  initialCoordinate,
  otherCoordinate,
  selectedLabel = 'निवडलेले ठिकाण',
  otherLabel = 'दुसरे ठिकाण',
  selectable = true,
  onCancel,
  onSelect,
}: MapLocationPickerProps) {
  const [coordinate, setCoordinate] = useState(initialCoordinate ?? DEFAULT_COORDINATE);
  const [mapError, setMapError] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const cameraRef = useRef<CameraRef>(null);
  const mapCenter = initialCoordinate ?? DEFAULT_COORDINATE;
  const cameraSettings: InitialViewState = otherCoordinate
    ? {
      bounds: [
        Math.min(mapCenter.longitude, otherCoordinate.longitude),
        Math.min(mapCenter.latitude, otherCoordinate.latitude),
        Math.max(mapCenter.longitude, otherCoordinate.longitude),
        Math.max(mapCenter.latitude, otherCoordinate.latitude),
      ],
      padding: { top: 48, bottom: 48, left: 48, right: 48 },
    }
    : { center: [mapCenter.longitude, mapCenter.latitude], zoom: 10 };

  const locateCurrentPosition = async () => {
    setLocationError(null);
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationError('स्थान परवानगी दिली नाही. नकाशावर हाताने ठिकाण निवडू शकता.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      setCoordinate(next);
      cameraRef.current?.flyTo({ center: [next.longitude, next.latitude], duration: 500 });
    } catch (locationFailure) {
      setLocationError(locationFailure instanceof Error
        ? `सध्याचे स्थान मिळाले नाही: ${locationFailure.message}`
        : 'सध्याचे स्थान मिळाले नाही. नकाशावर हाताने ठिकाण निवडा.');
    } finally {
      setLocating(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onCancel}
      onShow={() => {
        setCoordinate(initialCoordinate ?? DEFAULT_COORDINATE);
        setMapError(false);
      }}
    >
      <View style={styles.screen}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.help}>नकाशावर योग्य ठिकाणी टॅप करून स्थान निवडा.</Text>
        {selectable ? (
          <Pressable
            onPress={() => void locateCurrentPosition()}
            disabled={locating}
            style={styles.locationButton}
            accessibilityRole="button"
          >
            <Text style={styles.locationButtonText}>{locating ? 'स्थान मिळवत आहे...' : 'माझे सध्याचे स्थान वापरा'}</Text>
          </Pressable>
        ) : null}
        {locationError ? <Notice tone="info">{locationError}</Notice> : null}
        {mapError ? <Notice>नकाशा लोड झाला नाही. इंटरनेट किंवा नकाशा शैलीचा URL तपासा.</Notice> : null}
        <Map
          style={styles.map}
          mapStyle={MAP_STYLE}
          attribution
          attributionPosition={{ bottom: 12, right: 12 }}
          onPress={selectable ? (event) => {
            const [longitude, latitude] = event.nativeEvent.lngLat;
            if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
              setCoordinate({ latitude, longitude });
            }
          } : undefined}
          onDidFailLoadingMap={() => setMapError(true)}
          onDidFinishLoadingMap={() => setMapError(false)}
        >
          <Camera
            ref={cameraRef}
            key={`${mapCenter.latitude}:${mapCenter.longitude}:${otherCoordinate?.latitude ?? ''}:${otherCoordinate?.longitude ?? ''}`}
            initialViewState={cameraSettings}
          />
          {otherCoordinate ? (
            <Marker
              id="other-location"
              lngLat={[otherCoordinate.longitude, otherCoordinate.latitude]}
            >
              <View style={[styles.marker, otherLabel === 'पोहोच' ? styles.destinationMarker : styles.pickupMarker]} />
            </Marker>
          ) : null}
          <Marker
            id="selected-location"
            lngLat={[coordinate.longitude, coordinate.latitude]}
          >
            <View style={[styles.marker, selectedLabel === 'पोहोच' ? styles.destinationMarker : styles.pickupMarker]} />
          </Marker>
        </Map>
        <Text style={styles.coordinates}>
          {coordinate.latitude.toFixed(6)}, {coordinate.longitude.toFixed(6)}
        </Text>
        <Text style={styles.attribution}>{MAP_ATTRIBUTION}</Text>
        <View style={styles.actions}>
          <Button
            title={selectable ? 'हे ठिकाण निवडा' : 'बंद करा'}
            onPress={() => onSelect(coordinate)}
          />
          {selectable ? <Button title="रद्द करा" variant="secondary" onPress={onCancel} /> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f7f4', padding: 16, paddingTop: 48, gap: 10 },
  title: { color: '#183b2a', fontSize: 22, fontWeight: '800' },
  help: { color: '#64756a', fontSize: 15 },
  locationButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 9, backgroundColor: '#e8f1eb' },
  locationButtonText: { color: '#236b43', fontWeight: '700' },
  map: { flex: 1, minHeight: 300, borderRadius: 16, overflow: 'hidden' },
  marker: { height: 22, width: 22, borderRadius: 11, borderWidth: 3, borderColor: '#fff' },
  pickupMarker: { backgroundColor: '#236b43' },
  destinationMarker: { backgroundColor: '#c04b38' },
  coordinates: { textAlign: 'center', color: '#33493a', fontWeight: '700' },
  attribution: { textAlign: 'center', color: '#64756a', fontSize: 11 },
  actions: { gap: 8, paddingBottom: 12 },
});
