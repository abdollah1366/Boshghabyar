import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Food, MealEntry, Suggestion } from '@boshghabyar/core';

import { Card, SectionTitle } from '@/components/ui';
import { api, track } from '@/lib/api';
import { colors, font, space } from '@/theme';

interface MealsResponse { meals: MealEntry[]; foods: Food[] }
interface SuggestionsResponse { suggestions: Suggestion[] }

export default function SuggestionsScreen() {
  const [data, setData] = useState<MealsResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    track('page.viewed', { page: 'suggestions' });
    void api<MealsResponse>('/api/meals').then(setData).catch((err: Error) => setError(err.message));
  }, []);

  const load = async (id: string) => {
    setSelected(id);
    setSuggestions(null);
    try {
      const result = await api<SuggestionsResponse>(`/api/recommendations/${id}`);
      setSuggestions(result.suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در دریافت پیشنهادها');
    }
  };

  const nameOf = (id: string) => data?.foods.find((f) => f.id === id)?.nameFa ?? id;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>پیشنهادها</Text>
      <Text style={styles.subtitle}>برای هر وعده ثبت‌شده، جایگزین متعادل و اقتصادی ببینید.</Text>
      {error && <Text style={styles.error}>{error}</Text>}

      <Card>
        <SectionTitle>وعده‌های ثبت‌شده</SectionTitle>
        {data?.meals.length === 0 && <Text style={styles.subtitle}>ابتدا یک وعده ثبت کنید.</Text>}
        {data?.meals.map((meal) => (
          <Pressable key={meal.id} onPress={() => load(meal.id)} style={styles.row}>
            <Text style={styles.rowTitle}>{nameOf(meal.foodId)}</Text>
            <Text style={styles.subtitle}>{meal.date} · {meal.grams} گرم</Text>
          </Pressable>
        ))}
      </Card>

      {suggestions && (
        <Card>
          <SectionTitle>نتیجه</SectionTitle>
          {suggestions.length === 0 && <Text style={styles.subtitle}>جایگزین مناسبی پیدا نشد.</Text>}
          {suggestions.map((s, i) => (
            <View style={styles.row} key={`${s.toFoodId}-${i}`}>
              <Text style={styles.rowTitle}>{s.titleFa}</Text>
              <Text style={styles.subtitle}>{s.reasonFa}</Text>
            </View>
          ))}
          <Text style={styles.footnote}>اعداد توسط موتور محاسبه بشقاب‌یار به‌دست آمدهاند.</Text>
        </Card>
      )}
      {selected && !suggestions && <Text style={styles.subtitle}>در حال محاسبه…</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.md, backgroundColor: colors.background },
  title: { fontSize: font.title, fontWeight: '700', textAlign: 'left' },
  subtitle: { fontSize: font.small, color: colors.textSecondary, textAlign: 'left', marginBottom: space.sm },
  error: { color: colors.error, textAlign: 'left' },
  row: { paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowTitle: { fontWeight: '700', textAlign: 'left' },
  footnote: { fontSize: font.tiny, color: colors.textSecondary, marginTop: space.sm, textAlign: 'left' },
});
