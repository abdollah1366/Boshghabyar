import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Food, MealType, Suggestion } from '@boshghabyar/core';

import { Button, Card, Field, SectionTitle } from '@/components/ui';
import { api, track } from '@/lib/api';
import { colors, font, radius, space } from '@/theme';

interface FoodsResponse { foods: Food[] }
interface SuggestionsResponse { suggestions: Suggestion[] }

const MEAL_TYPES: Array<{ value: MealType; label: string }> = [
  { value: 'breakfast', label: 'صبحانه' },
  { value: 'lunch', label: 'ناهار' },
  { value: 'dinner', label: 'شام' },
  { value: 'snack', label: 'میانوعده' },
];

export default function LogMealScreen() {
  const [foods, setFoods] = useState<Food[]>([]);
  const [foodId, setFoodId] = useState('');
  const [grams, setGrams] = useState('150');
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);

  useEffect(() => {
    track('page.viewed', { page: 'log_meal' });
    void api<FoodsResponse>('/api/foods').then((res) => {
      setFoods(res.foods);
      setFoodId(res.foods[0]?.id ?? '');
    }).catch((err: Error) => setError(err.message));
  }, []);

  const selected = foods.find((f) => f.id === foodId);
  const kcal = selected ? Math.round((selected.per100g.kcal * Number(grams)) / 100) : 0;

  const submit = async () => {
    setBusy(true);
    setError('');
    setSuggestions(null);
    try {
      const created = await api<{ id: string }>('/api/meals', {
        method: 'POST',
        body: JSON.stringify({ foodId, grams: Number(grams), mealType, date: new Date().toISOString().slice(0, 10) }),
      });
      setMessage(`ثبت شد · ${kcal} کیلوکالوری`);
      const result = await api<SuggestionsResponse>(`/api/recommendations/${created.id}`);
      setSuggestions(result.suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ثبت وعده');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>ثبت وعده</Text>
      <Text style={styles.subtitle}>غذا، اندازه سهم و نوع وعده را انتخاب کنید.</Text>

      <Card>
        <SectionTitle>انتخاب غذا</SectionTitle>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {foods.map((food) => (
            <Pressable
              key={food.id}
              onPress={() => setFoodId(food.id)}
              style={[styles.chip, foodId === food.id && styles.chipActive]}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, foodId === food.id && styles.chipTextActive]}>{food.nameFa}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {selected && <Text style={styles.hint}>سهم معمولی: {selected.serving.grams} گرم · {selected.per100g.kcal} کیلوکالوری در ۱۰۰ گرم</Text>}
      </Card>

      <Card>
        <SectionTitle>جزئیات</SectionTitle>
        <Field label="وزن (گرم)" value={grams} onChange={setGrams} keyboardType="numeric" />
        <View style={styles.chipRowWrap}>
          {MEAL_TYPES.map((type) => (
            <Pressable
              key={type.value}
              onPress={() => setMealType(type.value)}
              style={[styles.chip, mealType === type.value && styles.chipActive]}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, mealType === type.value && styles.chipTextActive]}>{type.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>تخمین کالری: {kcal}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}
        <Button title="ثبت وعده" onPress={submit} disabled={busy || !foodId} loading={busy} />
      </Card>

      {suggestions && (
        <Card>
          <SectionTitle>پیشنهادهای جایگزین</SectionTitle>
          {suggestions.length === 0 && <Text style={styles.subtitle}>جایگزین مناسبی یافت نشد.</Text>}
          {suggestions.map((s, i) => (
            <View style={styles.suggestion} key={`${s.toFoodId}-${i}`}>
              <Text style={styles.suggestionTitle}>{s.titleFa}</Text>
              <Text style={styles.subtitle}>{s.reasonFa}</Text>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.md, backgroundColor: colors.background },
  title: { fontSize: font.title, fontWeight: '700', textAlign: 'left' },
  subtitle: { fontSize: font.small, color: colors.textSecondary, textAlign: 'left', marginBottom: space.md },
  hint: { fontSize: font.small, color: colors.primary, textAlign: 'left', marginTop: space.sm },
  error: { color: colors.error, textAlign: 'left', marginBottom: space.sm },
  success: { color: colors.success, textAlign: 'left', marginBottom: space.sm },
  chipRow: { flexDirection: 'row' },
  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: space.sm, marginEnd: space.sm },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: font.small },
  chipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  suggestion: { paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  suggestionTitle: { fontWeight: '700', textAlign: 'left' },
});
