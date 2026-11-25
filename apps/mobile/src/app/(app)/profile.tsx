import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { GoalType, UserGoal } from '@boshghabyar/core';

import { Button, Card, Field, SectionTitle } from '@/components/ui';
import { useSession } from '@/ctx';
import { colors, font, space } from '@/theme';

const GOAL_TYPES: Array<{ value: GoalType; label: string }> = [
  { value: 'balance', label: 'تعادل' },
  { value: 'weight-loss', label: 'کاهش وزن' },
  { value: 'muscle-gain', label: 'افزایش عضله' },
  { value: 'budget', label: 'صرفهجویی' },
];

export default function ProfileScreen() {
  const { user, signOut, upgrade, updateGoal } = useSession();
  const [form, setForm] = useState<UserGoal | null>(user?.goal ?? null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user || !form) return null;

  const save = async () => {
    setBusy(true);
    setMessage('');
    try {
      await updateGoal(form);
      setMessage('اهداف ذخیره شد.');
    } catch {
      setMessage('خطا در ذخیره اهداف');
    } finally {
      setBusy(false);
    }
  };

  const doUpgrade = async () => {
    setBusy(true);
    try {
      await upgrade();
      setMessage('نسخه حرفهای فعال شد (پرداخت آزمایشی).');
    } catch {
      setMessage('خطا در ارتقا');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>نمایه و اهداف</Text>
      <Text style={styles.subtitle}>{user.name} · {user.email}</Text>
      <View style={styles.planBadge}><Text style={styles.planText}>{user.plan === 'pro' ? 'نسخه حرفهای' : 'نسخه رایگان'}</Text></View>
      {message && <Text style={styles.message}>{message}</Text>}

      <Card>
        <SectionTitle>اهداف تغذیهای</SectionTitle>
        <Text style={styles.fieldLabel}>هدف</Text>
        <View style={styles.types}>
          {GOAL_TYPES.map((type) => (
            <Button
              key={type.value}
              title={type.label}
              variant={form.goalType === type.value ? 'primary' : 'secondary'}
              onPress={() => setForm({ ...form, goalType: type.value })}
            />
          ))}
        </View>
        {([
          ['calorieTarget', 'کالری روزانه'],
          ['proteinTarget', 'پروتئین (گرم)'],
          ['carbsTarget', 'کربوهیدرات (گرم)'],
          ['fatTarget', 'چربی (گرم)'],
          ['fiberTarget', 'فیبر (گرم)'],
          ['dailyBudgetIRR', 'بودجه روزانه (تومان)'],
        ] as Array<[keyof UserGoal, string]>).map(([key, label]) => (
          <Field key={key} label={label} value={String(form[key])} keyboardType="numeric" onChange={(value) => setForm({ ...form, [key]: Number(value) })} />
        ))}
        <Button title="ذخیره اهداف" onPress={save} disabled={busy} />
      </Card>

      <Card>
        <SectionTitle>اشتراک</SectionTitle>
        <Text style={styles.subtitle}>نسخه رایگان شامل ۲۰ غذای ایرانی، ۷ روز تاریخچه و گزارش پایه است.</Text>
        {user.plan !== 'pro' && <Button title="ارتقا به حرفهای" variant="accent" onPress={doUpgrade} disabled={busy} />}
      </Card>

      <Button title="خروج از حساب" variant="secondary" onPress={signOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.md, backgroundColor: colors.background },
  title: { fontSize: font.title, fontWeight: '700', textAlign: 'left' },
  subtitle: { fontSize: font.small, color: colors.textSecondary, textAlign: 'left', marginBottom: space.sm },
  planBadge: { alignSelf: 'flex-start', backgroundColor: colors.primaryLight, borderRadius: 999, paddingHorizontal: space.md, paddingVertical: 4, marginBottom: space.md },
  planText: { color: colors.primary, fontWeight: '700', fontSize: font.small },
  message: { color: colors.success, textAlign: 'left', marginBottom: space.sm },
  fieldLabel: { fontSize: font.small, fontWeight: '600', textAlign: 'left', marginBottom: space.xs },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
});
