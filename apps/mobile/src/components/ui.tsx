import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ReactNode } from 'react';

import { colors, font, radius, space } from '@/theme';

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'accent';
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'accent' && styles.buttonAccent,
        pressed && styles.buttonPressed,
        (disabled || loading) && styles.buttonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.primary : '#FFFFFF'} />
      ) : (
        <Text style={[styles.buttonText, variant === 'secondary' && styles.buttonTextSecondary]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {hint && <Text style={styles.tinyMuted}>{hint}</Text>}
    </View>
  );
}

export function ProgressBar({ label, value, target }: { label: string; value: number; target: number }) {
  const ratio = target ? Math.min(1, value / target) : 0;
  const over = target > 0 && value > target;
  return (
    <View style={styles.progressBlock}>
      <View style={styles.progressLabelRow}>
        <Text style={styles.small}>{label}</Text>
        <Text style={over ? styles.errorText : styles.muted}>{Math.round(value)} / {Math.round(target)}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${ratio * 100}%` }, over && styles.progressOver]} />
      </View>
    </View>
  );
}

export function Field({
  label, value, onChange, placeholder, secure, keyboardType,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
  },
  sectionTitle: { fontSize: font.title, fontWeight: '700', marginBottom: space.sm, color: colors.text },
  button: {
    minHeight: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  buttonSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary },
  buttonAccent: { backgroundColor: colors.accent },
  buttonPressed: { opacity: 0.8 },
  buttonDisabled: { backgroundColor: colors.border },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: font.body },
  buttonTextSecondary: { color: colors.primary },
  metric: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: space.sm, margin: space.xs / 2 },
  metricLabel: { fontSize: font.tiny, color: colors.textSecondary },
  metricValue: { fontSize: font.stat, color: colors.primary, fontWeight: '700', textAlign: 'left' },
  tinyMuted: { fontSize: font.tiny, color: colors.textSecondary, textAlign: 'left' },
  progressBlock: { marginBottom: space.md },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.xs },
  progressTrack: { height: 10, backgroundColor: colors.primaryLight, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 999 },
  progressOver: { backgroundColor: colors.error },
  small: { fontSize: font.small, color: colors.text },
  muted: { color: colors.textSecondary, fontSize: font.small },
  errorText: { color: colors.error, fontSize: font.small },
  field: { marginBottom: space.md },
  fieldLabel: { fontSize: font.small, fontWeight: '600', marginBottom: space.xs, textAlign: 'left' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: space.sm,
    fontSize: font.body,
    textAlign: 'left',
  },
});
