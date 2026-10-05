import React, { PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const green = '#236b43';

export function Page({ title, subtitle, children }: PropsWithChildren<{ title: string; subtitle?: string }>) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <View style={styles.heading}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function Field({ label, style, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        style={[styles.input, props.multiline && styles.multiline, style]}
        placeholderTextColor="#78867e"
        accessibilityLabel={label}
      />
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.secondaryButton,
        variant === 'danger' && styles.dangerButton,
        (disabled || pressed) && styles.buttonDim,
      ]}
    >
      <Text style={[styles.buttonText, variant === 'secondary' && styles.secondaryButtonText]}>{title}</Text>
    </Pressable>
  );
}

export function Notice({ children, tone = 'error' }: PropsWithChildren<{ tone?: 'error' | 'info' | 'success' }>) {
  return <Text style={[styles.notice, tone === 'info' && styles.infoNotice, tone === 'success' && styles.successNotice]}>{children}</Text>;
}

export function Empty({ children }: PropsWithChildren) {
  return <Text style={styles.empty}>{children}</Text>;
}

export function Loading() {
  return <ActivityIndicator size="large" color={green} style={styles.loading} />;
}

export function StatusLabel({ status }: { status: string }) {
  const tone = status === 'प्रलंबित' || status === 'पडताळणी प्रलंबित'
    ? styles.pendingStatus
    : status === 'नाकारले' || status === 'अनुपलब्ध'
      ? styles.rejectedStatus
      : status === 'प्रवासात'
        ? styles.activeStatus
        : styles.status;
  return <Text style={[styles.status, tone]}>{status.replaceAll('_', ' ')}</Text>;
}

export const uiColors = { green };

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7f4' },
  page: { padding: 18, paddingBottom: 36, gap: 14 },
  heading: { paddingTop: 8, paddingBottom: 6 },
  title: { color: '#183b2a', fontSize: 27, fontWeight: '800' },
  subtitle: { color: '#64756a', fontSize: 15, marginTop: 5, lineHeight: 21 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e1e9e3',
    padding: 16,
    gap: 10,
  },
  fieldGroup: { gap: 6 },
  label: { fontSize: 14, fontWeight: '700', color: '#33493a' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#d6e0d8',
    paddingHorizontal: 13,
    paddingVertical: 12,
    minHeight: 48,
    color: '#1e2c22',
    fontSize: 16,
  },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
  button: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: green,
  },
  secondaryButton: { backgroundColor: '#e8f1eb', borderWidth: 1, borderColor: '#cdddcf' },
  dangerButton: { backgroundColor: '#a63e33' },
  buttonDim: { opacity: 0.65 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryButtonText: { color: green },
  notice: { color: '#8e2f25', backgroundColor: '#ffefed', borderRadius: 10, padding: 12, lineHeight: 20 },
  infoNotice: { color: '#315e77', backgroundColor: '#eaf5fb' },
  successNotice: { color: '#236b43', backgroundColor: '#eaf5ed' },
  empty: { textAlign: 'center', color: '#64756a', padding: 22, lineHeight: 22 },
  loading: { padding: 30 },
  status: {
    color: '#236b43',
    backgroundColor: '#e8f1eb',
    overflow: 'hidden',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    fontWeight: '700',
  },
  pendingStatus: { color: '#805500', backgroundColor: '#fff2d3' },
  rejectedStatus: { color: '#922f28', backgroundColor: '#ffefed' },
  activeStatus: { color: '#24577a', backgroundColor: '#eaf5fb' },
});
