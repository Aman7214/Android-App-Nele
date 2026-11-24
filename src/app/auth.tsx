import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { z } from 'zod';

import { AppText } from '@/components/nele/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/nele/Buttons';
import { Screen } from '@/components/nele/Screen';
import { sendVerificationCode, VerificationRequiredError, verifyEmail } from '@/services/auth';
import { useAuthStore } from '@/stores/auth';
import { useLayout } from '@/theme/layout';
import { colors, radius, spacing, touchTarget, typography } from '@/theme/tokens';

/** Screens a signed-in user may be returned to, plus the first-run location step. */
const STATIC_RETURN_PATHS = new Set([
  '/location', '/list', '/saved', '/my-properties', '/profile',
  '/agent', '/help', '/messages', '/home', '/explore',
]);

export default function AuthScreen() {
  const { gutter } = useLayout();
  const params = useLocalSearchParams<{ returnTo?: string; mode?: string }>();
  // Only internal destinations, so a crafted link cannot bounce elsewhere.
  const requested = params.returnTo;
  const returnTo: Href = requested
    && (STATIC_RETURN_PATHS.has(requested) || /^\/property\/[A-Za-z0-9_-]{1,80}$/.test(requested))
    ? requested as Href
    : '/profile';
  const wantsSignUp = params.mode === 'signup';
  const user = useAuthStore((state) => state.user);
  const submit = useAuthStore((state) => state.submit);
  const pending = useAuthStore((state) => state.pending);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);
  // Derived from the route (`mode=signup` after onboarding) until the user toggles it.
  const [signUpOverride, setSignUpOverride] = useState<boolean | null>(null);
  const signUp = signUpOverride ?? wantsSignUp;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verification, setVerification] = useState(false);
  const [otp, setOtp] = useState('');
  const [working, setWorking] = useState(false);
  const inFlight = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const busy = pending || working;
  const valid = z.email().safeParse(email.trim()).success && password.length >= 8 && password.length <= 128
    && (!signUp || name.trim().length >= 2) && (!verification || /^\d{6}$/.test(otp));

  useEffect(() => { if (user) router.replace(returnTo); }, [user, returnTo]);
  useEffect(() => { clearError(); }, [clearError]);

  const handleSubmit = async () => {
    if (!valid || busy || inFlight.current || useAuthStore.getState().pending) return;
    inFlight.current = true;
    setWorking(true);
    setMessage(null);
    try {
      if (verification) {
        await verifyEmail(email.trim(), otp);
      }
      await submit({ email: email.trim(), password, name: name.trim() }, signUp && !verification);
    } catch (failure) {
      if (failure instanceof VerificationRequiredError) {
        setVerification(true);
        try {
          await sendVerificationCode(email.trim());
          setMessage('Check your email for a six-digit verification code.');
        } catch (sendError) { setMessage(sendError instanceof Error ? sendError.message : 'The code could not be sent.'); }
      } else if (verification) setMessage(failure instanceof Error ? failure.message : 'The code could not be checked.');
    } finally { inFlight.current = false; setWorking(false); }
  };

  const resendCode = async () => {
    if (busy || inFlight.current || useAuthStore.getState().pending) return;
    inFlight.current = true;
    setWorking(true);
    try { await sendVerificationCode(email.trim()); setMessage('A new code was sent.'); }
    catch (failure) { setMessage(failure instanceof Error ? failure.message : 'The code could not be sent.'); }
    finally { inFlight.current = false; setWorking(false); }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}>
          <View style={styles.header}>
            <AppText variant="displayLG">{verification ? 'Verify your email' : signUp ? 'Create an account' : 'Welcome back'}</AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close sign in"
              onPress={() => (router.canGoBack() ? router.back() : router.replace(returnTo))}
              hitSlop={8}
              style={styles.close}>
              <Ionicons name="close" size={24} color={colors.ink} />
            </Pressable>
          </View>
          <AppText variant="bodyMD" tone="muted">
            {params.mode
              ? 'Create an account to post a property, message owners and keep your saves. Then pick your town.'
              : 'Sign in to post properties and keep your saves across devices.'}
          </AppText>
          {signUp && !verification ? <View style={styles.field}>
            <AppText variant="titleSM">Your name</AppText>
            <TextInput accessibilityLabel="Your name" value={name} onChangeText={setName} maxLength={80} autoComplete="name" textContentType="name" style={styles.input} editable={!busy} />
          </View> : null}
          <View style={styles.field}>
            <AppText variant="titleSM">Email</AppText>
            <TextInput accessibilityLabel="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" maxLength={254} style={styles.input} editable={!busy && !verification} />
          </View>
          <View style={styles.field}>
            <AppText variant="titleSM">Password</AppText>
            <TextInput accessibilityLabel="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete={signUp ? 'new-password' : 'current-password'} textContentType={signUp ? 'newPassword' : 'password'} maxLength={128} style={styles.input} editable={!busy} onSubmitEditing={() => { void handleSubmit(); }} />
            <AppText variant="captionSM" tone="muted">Use at least 8 characters.</AppText>
          </View>
          {verification ? <View style={styles.field}>
            <AppText variant="titleSM">Verification code</AppText>
            <TextInput accessibilityLabel="Verification code" value={otp} onChangeText={setOtp} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} style={styles.input} editable={!busy} />
          </View> : null}
          {error || message ? <AppText variant="bodySM" style={styles.feedback} accessibilityLiveRegion="polite">{message ?? error}</AppText> : null}
          <PrimaryButton label={busy ? 'Please wait…' : verification ? 'Verify and sign in' : signUp ? 'Create account' : 'Sign in'} disabled={!valid || busy} onPress={() => { void handleSubmit(); }} />
          {verification ? <SecondaryButton label="Send a new code" disabled={busy} onPress={() => { void resendCode(); }} /> : <SecondaryButton label={signUp ? 'Already have an account? Sign in' : 'New to Nele? Create an account'} disabled={busy} onPress={() => { clearError(); setMessage(null); setSignUpOverride(!signUp); }} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  close: { minWidth: touchTarget, minHeight: touchTarget, alignItems: 'center', justifyContent: 'center' },
  field: { gap: spacing.sm },
  input: { ...typography.bodyMD, minHeight: touchTarget, borderWidth: 1, borderColor: colors.hairline, borderRadius: radius.sm, paddingHorizontal: spacing.base, color: colors.ink, backgroundColor: colors.canvas },
  feedback: { color: colors.error },
});
