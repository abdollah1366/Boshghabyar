import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Metric, SectionTitle } from '@/components/ui';
import { useSession } from '@/ctx';
import { api, track } from '@/lib/api';
import { colors, font, space } from '@/theme';

interface WeeklyResponse {
  trend: Array<{ date: string; kcal: number }>;
  summary: { averageKcal: number; activeDays: number; totalMeals: number; budgetUsedIRR: number };
  insight: string;
  advanced: boolean;
}

export default function ReportsScreen() {
  const { user, upgrade } = useSession();
  const [data, setData] = useState<WeeklyResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    track('page.viewed', { page: 'reports' });
    void api<WeeklyResponse>('/api/reports/weekly?days=7').then(setData).catch((err: Error) => setError(err.message));
  }, []);

  const max = Math.max(...(data?.trend.map((p) => p.kcal) ?? [1]), 1);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>گزارشها</Text>
      <Text style={styles.subtitle}>روند هفت روزه کالری و وعدهها</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      {!data && <Text style={styles.subtitle}>در حال بارگذاری…</Text>}

      {data && (
        <>
          <View style={styles.metrics}>
            <Metric label="میانگین کالری" value={Math.round(data.summary.averageKcal).toString()} hint="کیلوکالوری" />
            <Metric label="روزهای فعال" value={`${data.summary.activeDays}/7`} hint="ثبت وعده" />
          </View>
          <Card>
            <SectionTitle>کالری روزانه</SectionTitle>
            <View style={styles.chart}>
              {data.trend.map((point) => (
                <View style={styles.barColumn} key={point.date}>
                  <View style={[styles.bar, { height: `${Math.max((point.kcal / max) * 100, 2)}%` }]} />
                  <Text style={styles.barLabel}>{point.date.slice(5)}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.insight}>{data.insight}</Text>
          </Card>
          {user?.plan === 'free' && <Button title="ارتقا به حرفهای" variant="accent" onPress={() => void upgrade()} />}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.md, backgroundColor: colors.background },
  title: { fontSize: font.title, fontWeight: '700', textAlign: 'left' },
  subtitle: { fontSize: font.small, color: colors.textSecondary, textAlign: 'left', marginBottom: space.md },
  error: { color: colors.error, textAlign: 'left' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap' },
  chart: { height: 170, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around' },
  barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  bar: { width: 18, backgroundColor: colors.primary, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barLabel: { fontSize: 9, color: colors.textSecondary, marginTop: 4 },
  insight: { fontSize: font.small, color: colors.textSecondary, textAlign: 'left', marginTop: space.md },
});
