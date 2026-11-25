import { useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Field } from '@/components/ui';
import { useSession } from '@/ctx';
import { ApiError, track } from '@/lib/api';
import { colors, font, radius, space } from '@/theme';

export default function LoginScreen() {
  const { signIn, signUp, demoSignIn } = useSession();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') await signIn(email.trim(), password);
      else await signUp(name.trim(), email.trim(), password);
      track(mode === 'login' ? 'ui.login_completed' : 'ui.register_completed');
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در ارتباط با سرور');
    } finally {
      setBusy(false);
    }
  };

  const demo = async () => {
    setBusy(true);
    setError('');
    try {
      await demoSignIn();
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ورود آزمایشی ناموفق بود');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.badge}><Text style={styles.badgeText}>بشقاب‌یار</Text></View>
      <Text style={styles.title}>همراه هوشمند وعدههای ایرانی</Text>
      <Text style={styles.subtitle}>وعده را ثبت کنید، کالری و هزینه آن را ببینید و جایگزین متعادلتر بیابید.</Text>

      <Card>
        <Text style={styles.formTitle}>{mode === 'login' ? 'ورود به حساب' : 'ثبتنام'}</Text>
        {mode === 'register' && <Field label="نام" value={name} onChange={setName} placeholder="نام شما" />}
        <Field label="ایمیل" value={email} onChange={setEmail} placeholder="you@example.com" keyboardType="email-address" />
        <Field label="رمز عبور" value={password} onChange={setPassword} placeholder="حداقل ۸ کاراکتر" secure />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title={mode === 'login' ? 'ورود' : 'ساخت حساب'} onPress={submit} disabled={busy} loading={busy} />
        <Button
          title={mode === 'login' ? 'حساب ندارید؟ ثبتنام' : 'حساب دارید؟ ورود'}
          onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
          variant="secondary"
        />
        <Button title="ورود آزمایشی" onPress={demo} variant="secondary" disabled={busy} />
      </Card>

      <Text style={styles.footer}>برگزیده استارتاپ ویکند غذا و تغذیه تبریز — ۱۴۰۵</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: space.lg, justifyContent: 'center', backgroundColor: colors.background },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: space.sm, marginBottom: space.md },
  badgeText: { color: '#FFFFFF', fontWeight: '700' },
  title: { fontSize: font.hero, fontWeight: '700', color: colors.text, textAlign: 'left', marginBottom: space.sm },
  subtitle: { fontSize: font.body, color: colors.textSecondary, textAlign: 'left', marginBottom: space.lg },
  formTitle: { fontSize: font.title, fontWeight: '700', textAlign: 'left', marginBottom: space.md },
  error: { color: colors.error, textAlign: 'left', marginBottom: space.sm },
  footer: { fontSize: font.tiny, color: colors.textSecondary, textAlign: 'center', marginTop: space.md },
});
