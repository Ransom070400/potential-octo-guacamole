import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Platform,
  StyleSheet,
  Alert,
  useColorScheme,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { Mail, Lock } from 'lucide-react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import {
  handleLoginUtil,
  handleLoginWithAppleAuthUtil,
  handleLoginWithGoogleUtil,
} from '~/src/utils/signInUtils';
import { handleUserSignUp } from '~/src/utils/signUpUtils';
import SocialAuthButton from '~/src/components/SocialAuthButton';
import { Feedback } from '~/src/utils/Feedback';
import { SUI_ENABLED } from '~/src/lib/sui/config';
import { useSuiAuth } from '~/src/context/SuiAuthProvider';

type Tab = 'signin' | 'signup';

/** zkLogin sign-in (Sui mode): one tap -> Google -> Sui address. */
function SuiSignInScreen() {
  const { login, busy } = useSuiAuth();

  const onPress = async () => {
    try {
      Feedback.medium();
      await login(); // _layout's address guard switches to (tabs) on success
    } catch (e: any) {
      if (e?.message && e.message !== 'Google sign-in was cancelled') {
        Alert.alert('Sign-in failed', e.message);
      }
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-neutral-100 dark:bg-neutral-900 px-8">
      <Image source={require('../../../assets/PingouLogoWOBG.png')} className="w-[90px] h-[120px] mb-6" />
      <Text className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">Welcome to Pingou</Text>
      <Text className="text-sm text-neutral-500 dark:text-neutral-400 mb-10 text-center">
        Sign in with Google to create your seedless Sui account. No wallet, no gas, no passwords.
      </Text>
      {/* flex-row so SocialAuthButton's `flex-1` fills width (it collapses in a column). */}
      <View className="w-full flex-row">
        <SocialAuthButton
          label={busy ? 'Signing in…' : 'Continue with Google'}
          onPress={onPress}
          disabled={busy}
        />
      </View>
    </View>
  );
}

export default function AuthScreen() {
  if (SUI_ENABLED) return <SuiSignInScreen />;
  const isIOS = Platform.OS === 'ios';
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const iconColor = isDark ? '#9CA3AF' : 'gray';

  const [tab, setTab] = useState<Tab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const { success, error } = await handleLoginUtil(email, password);
    setLoading(false);
    if (success) {
      router.replace('/(tabs)');
    } else {
      Alert.alert('Login Error', error.message);
    }
  };

  const handleSignUp = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Easy there!', 'Passwords do not match');
      return;
    }
    setLoading(true);
    const { success, error } = await handleUserSignUp(email, password);
    setLoading(false);
    if (error && !success) {
      Alert.alert('Sign up error', error.message);
      return;
    }
    if (success) router.replace('/(auth)/onboarding');
  };

  const handleApple = async () => {
    try {
      const { success, error } = await handleLoginWithAppleAuthUtil();
      if (success) {
        router.replace(tab === 'signup' ? '/(auth)/onboarding' : '/(tabs)');
      } else {
        Alert.alert('Apple Sign-In Error', error?.message ?? 'Something went wrong');
      }
    } catch (error) {
      if (error instanceof Error) Alert.alert(error.message);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { success, error } = await handleLoginWithGoogleUtil();
    setGoogleLoading(false);
    if (success) {
      router.replace(tab === 'signup' ? '/(auth)/onboarding' : '/(tabs)');
    } else if (error?.message && error.message !== 'Google sign-in was cancelled') {
      Alert.alert('Google Sign-In Error', error.message);
    }
  };

  const isSignIn = tab === 'signin';

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        className="flex-1 bg-neutral-100 dark:bg-neutral-900"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 36, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* Logo */}
        <View className="items-center mb-4">
          <Image source={require('../../../assets/PingouLogoWOBG.png')} className="w-[80px] h-[110px]" />
        </View>

        {/* Heading */}
        <View className="items-center mb-5">
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">
            {isSignIn ? 'Welcome back' : 'Welcome to Pingou!'}
          </Text>
          <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Your Networking companion
          </Text>
        </View>

        {/* Card */}
        <View className="bg-white dark:bg-neutral-800 rounded-2xl px-5 pt-5 pb-6 shadow-sm">

          {/* Segmented control pill */}
          <View className="flex-row bg-neutral-100 dark:bg-neutral-700 rounded-full p-1 mb-5">
            <TouchableOpacity
              onPress={() => { setTab('signin'); Feedback.selection(); }}
              className={`flex-1 h-10 items-center justify-center rounded-full ${
                isSignIn ? 'bg-black dark:bg-white' : ''
              }`}
              activeOpacity={0.8}>
              <Text
                className={`text-sm font-semibold ${
                  isSignIn
                    ? 'text-white dark:text-black'
                    : 'text-neutral-500 dark:text-neutral-400'
                }`}>
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setTab('signup'); Feedback.selection(); }}
              className={`flex-1 h-10 items-center justify-center rounded-full ${
                !isSignIn ? 'bg-black dark:bg-white' : ''
              }`}
              activeOpacity={0.8}>
              <Text
                className={`text-sm font-semibold ${
                  !isSignIn
                    ? 'text-white dark:text-black'
                    : 'text-neutral-500 dark:text-neutral-400'
                }`}>
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>

          {/* Apple Sign In */}
          {isIOS && (
            <View className="flex-row items-center justify-center mb-5">
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={
                  isSignIn
                    ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                    : AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
                }
                buttonStyle={
                  isDark
                    ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                    : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={20}
                style={styles.appleButton}
                onPress={handleApple}
              />
            </View>
          )}

          {/* Google Sign In */}
          <View className="flex-row mb-5">
            <SocialAuthButton
              label={googleLoading ? 'Connecting…' : 'Continue with Google'}
              onPress={handleGoogle}
              disabled={googleLoading}
            />
          </View>

          {/* OR separator */}
          <View className="flex-row items-center mb-5">
            <View className="flex-1 h-px bg-neutral-300 dark:bg-neutral-600" />
            <Text className="mx-3 text-xs font-medium text-neutral-500 dark:text-neutral-400">OR</Text>
            <View className="flex-1 h-px bg-neutral-300 dark:bg-neutral-600" />
          </View>

          {/* Email input */}
          <View className="flex-row items-center h-12 rounded-full border border-neutral-300 dark:border-neutral-600 px-4 mb-3 bg-white dark:bg-neutral-700">
            <Mail color={iconColor} size={20} style={{ marginRight: 8 }} />
            <TextInput
              className="flex-1 text-sm text-neutral-900 dark:text-white"
              placeholder="Enter your Email"
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              autoCorrect={false}
            />
          </View>

          {/* Password input */}
          <View className={`flex-row items-center h-12 rounded-full border border-neutral-300 dark:border-neutral-600 px-4 ${!isSignIn ? 'mb-3' : 'mb-4'} bg-white dark:bg-neutral-700`}>
            <Lock color={iconColor} size={20} style={{ marginRight: 8 }} />
            <TextInput
              className="flex-1 text-sm text-neutral-900 dark:text-white"
              placeholder="Password"
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Confirm password — sign up only, animated */}
          {!isSignIn && (
            <Animated.View
              entering={FadeIn.duration(250)}
              exiting={FadeOut.duration(150)}
              className="flex-row items-center h-12 rounded-full border border-neutral-300 dark:border-neutral-600 px-4 mb-4 bg-white dark:bg-neutral-700">
              <Lock color={iconColor} size={20} style={{ marginRight: 8 }} />
              <TextInput
                className="flex-1 text-sm text-neutral-900 dark:text-white"
                placeholder="Confirm password"
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Animated.View>
          )}

          {/* Action button */}
          <TouchableOpacity
            className="h-12 rounded-full bg-black dark:bg-white items-center justify-center flex-row active:opacity-90"
            onPress={() => { Feedback.medium(); (isSignIn ? handleLogin : handleSignUp)(); }}
            disabled={loading}>
            <Text className="text-white dark:text-black font-semibold mr-3 text-sm">
              {loading
                ? isSignIn ? 'Logging in...' : 'Creating account...'
                : isSignIn ? 'Login' : 'Sign up'}
            </Text>
            <View className="bg-white dark:bg-black rounded-full w-8 h-8 justify-center items-center">
              <Text className="text-black dark:text-white self-center">→</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Forgot password — sign in only */}
        {isSignIn && (
          <View className="items-center mt-4">
            <Text
              onPress={() => router.push('/(auth)/forgotPassword')}
              className="text-xs text-amber-600 dark:text-amber-400">
              Forgot password?
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  appleButton: {
    width: 240,
    height: 44,
  },
});
