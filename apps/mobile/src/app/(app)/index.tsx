import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DaySummary, Food, MealEntry } from '@boshghabyar/core';

import { Button, Card, Metric, ProgressBar, SectionTitle } from '@/components/ui';
import { useSession } from '@/ctx';
import { api, track } from '@/lib/api';
import { colors, font, space } from '@/theme';

interface DailyResponse { report: DaySummary; meals: MealEntry[] }
interface MealsResponse { meals: MealEntry[]; foods: Food[] }

const MEAL_LABELS: Record<string, string> = { breakfast: 'صبحانه', lunch: 'ناهار', dinner: 'شام', snack: 'میانوعده' };

export default function HomeScreen() {
  const { user, signOut } = useSession();
  const [daily, setDaily] = useState<DailyResponse | null>(null);
  const [mealsData, setMealsData] = useState<MealsResponse | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    void Promise.all([api<DailyResponse>('/api/reports/daily'), api<MealsResponse>('/api/meals')])
      .then(([d, m]) => { setDaily(d); setMealsData(m); })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    track('page.viewed', { page: 'home' });
    load();
  }, [load]);

  const report = daily?.report;
  const nameOf = (id: string) => mealsData?.foods.find((f) => f.id === id)?.nameFa ?? id;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>سلام {user?.name}</Text>
          <Text style={styles.subtitle}>خلاصه وعدههای امروز</Text>
        </View>
        <Button title="خروج" variant="secondary" onPress={signOut} />
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {!report && <Text style={styles.subtitle}>در حال بارگذاری…</Text>}

      {report && (
        <>
          <View style={styles.metrics}>
            <Metric label="کالری" value={Math.round(report.totals.kcal).toString()} hint={`هدف ${report.goal.calorieTarget}`} />
            <Metric label="پروتئین" value={`${Math.round(report.totals.protein)} گرم`} hint={`هدف ${report.goal.proteinTarget}`} />
          </View>
          <View style={styles.metrics}>
            <Metric label="هزینه" value={`${Math.round(report.ratio.budget * report.goal.dailyBudgetIRR).toLocaleString('fa-IR')}`} hint="تومان" />
            <Metric label="وعدهها" value={report.entryCount.toString()} hint="امروز" />
          </View>

          <Card>
            <SectionTitle>پیشرفت اهداف</SectionTitle>
            <ProgressBar label="کالری" value={report.totals.kcal} target={report.goal.calorieTarget} />
            <ProgressBar label="پروتئین" value={report.totals.protein} target={report.goal.proteinTarget} />
            <ProgressBar label="کربوهیدرات" value={report.totals.carbs} target={report.goal.carbsTarget} />
            <ProgressBar label="چربی" value={report.totals.fat} target={report.goal.fatTarget} />
            <ProgressBar label="بودجه" value={report.ratio.budget * report.goal.dailyBudgetIRR} target={report.goal.dailyBudgetIRR} />
          </Card>

          <Button title="ثبت وعده جدید" onPress={() => router.push('/log')} />
          <Button title="مشاهده پیشنهادها" variant="secondary" onPress={() => router.push('/suggestions')} />

          <Card>
            <SectionTitle>وعدههای اخیر</SectionTitle>
            {daily?.meals.length === 0 && <Text style={styles.subtitle}>هنوز وعدهای ثبت نشده است.</Text>}
            {daily?.meals.slice(0, 5).map((meal) => (
              <View style={styles.mealRow} key={meal.id}>
                <Text style={styles.mealName}>{nameOf(meal.foodId)}</Text>
                <Text style={styles.subtitle}>{MEAL_LABELS[meal.mealType] ?? meal.mealType} · {meal.grams} گرم</Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.md, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },
  hello: { fontSize: font.title, fontWeight: '700', color: colors.text, textAlign: 'left' },
  subtitle: { fontSize: font.small, color: colors.textSecondary, textAlign: 'left' },
  error: { color: colors.error, textAlign: 'left', marginBottom: space.sm },
  metrics: { flexDirection: 'row', flexWrap: 'wrap' },
  mealRow: { paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  mealName: { fontSize: font.body, fontWeight: '600', textAlign: 'left' },
});
