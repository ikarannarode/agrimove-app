import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
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
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [coordinateError, setCoordinateError] = useState<string | null>(null);
  const coordinate = initialCoordinate ?? DEFAULT_COORDINATE;

  const selectCoordinate = () => {
    const next = { latitude: Number(latitude), longitude: Number(longitude) };
    if (
      !Number.isFinite(next.latitude)
      || !Number.isFinite(next.longitude)
      || next.latitude < -90
      || next.latitude > 90
      || next.longitude < -180
      || next.longitude > 180
    ) {
      setCoordinateError('अक्षांश -90 ते 90 आणि रेखांश -180 ते 180 दरम्यान असावा.');
      return;
    }
    onSelect(next);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onCancel}
      onShow={() => {
        setLatitude(String(coordinate.latitude));
        setLongitude(String(coordinate.longitude));
        setCoordinateError(null);
      }}
    >
      <View style={styles.screen}>
        <Text style={styles.title}>{title}</Text>
        <Notice tone="info">
          वेब आवृत्तीत नकाशा उपलब्ध नाही. स्थान निवडण्यासाठी अक्षांश आणि रेखांश भरा; मोबाईल अॅपमध्ये नकाशावर ठिकाण निवडता येईल.
        </Notice>
        {selectable ? (
          <View style={styles.fields}>
            <View style={styles.field}>
              <Text style={styles.label}>अक्षांश</Text>
              <TextInput
                accessibilityLabel="अक्षांश"
                keyboardType="decimal-pad"
                value={latitude}
                onChangeText={setLatitude}
                placeholder="उदा. 19.7515"
                style={styles.input}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>रेखांश</Text>
              <TextInput
                accessibilityLabel="रेखांश"
                keyboardType="decimal-pad"
                value={longitude}
                onChangeText={setLongitude}
                placeholder="उदा. 75.7139"
                style={styles.input}
              />
            </View>
          </View>
        ) : (
          <View style={styles.details}>
            <Text style={styles.label}>{selectedLabel}</Text>
            <Text style={styles.coordinates}>
              {coordinate.latitude.toFixed(6)}, {coordinate.longitude.toFixed(6)}
            </Text>
            {otherCoordinate ? (
              <>
                <Text style={styles.label}>{otherLabel}</Text>
                <Text style={styles.coordinates}>
                  {otherCoordinate.latitude.toFixed(6)}, {otherCoordinate.longitude.toFixed(6)}
                </Text>
              </>
            ) : null}
          </View>
        )}
        {coordinateError ? <Notice>{coordinateError}</Notice> : null}
        <View style={styles.actions}>
          {selectable ? (
            <Button title="हे ठिकाण निवडा" onPress={selectCoordinate} />
          ) : (
            <Button title="बंद करा" onPress={onCancel} />
          )}
          {selectable ? <Button title="रद्द करा" variant="secondary" onPress={onCancel} /> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f7f4', padding: 16, paddingTop: 48, gap: 16 },
  title: { color: '#183b2a', fontSize: 22, fontWeight: '800' },
  fields: { gap: 14 },
  field: { gap: 6 },
  label: { color: '#33493a', fontSize: 14, fontWeight: '700' },
  input: { backgroundColor: '#fff', borderColor: '#cbd8ce', borderRadius: 10, borderWidth: 1, color: '#183b2a', padding: 12 },
  details: { gap: 8 },
  coordinates: { color: '#33493a', fontWeight: '700' },
  actions: { gap: 8, marginTop: 'auto', paddingBottom: 12 },
});
