import { View, Text, TouchableOpacity, Image, Pressable } from 'react-native';
import React, { useEffect, useState } from 'react';
import { router, Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { SlideInRight, FadeIn } from 'react-native-reanimated';
import WelcomeCards from '~/src/components/WelcomeCards';
import { Feedback } from '~/src/utils/Feedback';

const SEEN_KEY = 'pingou.seenOnboarding';

// Card metadata array
const onboardingCards = [
  {
    title: 'No wallet, no passwords',
    description:
      'Sign in with Google and we set up a secure account for you — no seed phrases, no gas, nothing to lose.',
    tiltDegrees: 0,
  },
  {
    title: 'Your card, encrypted',
    description:
      "Build your Pingou card once. It stays private and yours — only people you connect with can see it.",
    tiltDegrees: -4,
  },
  {
    title: 'Tap to exchange',
    description: "Scan a QR once and you both get each other's card. Your connections, truly yours.",
    tiltDegrees: 3,
  },
];

const Onboarding = () => {
  const [index, setIndex] = useState(0);
  const [checked, setChecked] = useState(false);
  const [seen, setSeen] = useState(false);
  const isLast = index === onboardingCards.length - 1;

  // Show onboarding only the first time; returning/logged-out users skip to sign-in.
  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY)
      .then((v) => setSeen(v === '1'))
      .finally(() => setChecked(true));
  }, []);

  // Auto-advance through the cards; stop on the last (wait for "Get Started").
  useEffect(() => {
    if (!checked || seen || isLast) return;
    const t = setTimeout(() => setIndex((i) => Math.min(i + 1, onboardingCards.length - 1)), 3600);
    return () => clearTimeout(t);
  }, [index, checked, seen, isLast]);

  const finish = async () => {
    try {
      await AsyncStorage.setItem(SEEN_KEY, '1');
    } catch {}
    router.replace('/(auth)/signin');
  };

  const next = () => {
    Feedback.selection();
    if (isLast) finish();
    else setIndex((i) => i + 1);
  };

  if (!checked) return <View className="flex-1 bg-gray-100 dark:bg-neutral-900" />;
  if (seen) return <Redirect href="/(auth)/signin" />;

  const card = onboardingCards[index];

  return (
    <View className="flex-1 bg-gray-100 dark:bg-neutral-900">
      {/* Top-right penguin (unchanged branding) */}
      <Image
        source={require('../../../assets/PingouLogoWOBG.png')}
        className="absolute top-8 -right-40 w-[500px] h-[500px]"
        style={{ transform: [{ rotate: '-25deg' }], transformOrigin: 'top center' }}
        resizeMode="contain"
      />
      {/* Bottom-left penguin */}
      <Image
        source={require('../../../assets/PingouLogoWOBG.png')}
        className="absolute bottom-20 right-[210px] w-[500px] h-[520px]"
        style={{ transform: [{ rotate: '20deg' }], transformOrigin: 'bottom center' }}
        resizeMode="contain"
      />

      {/* Auto-playing card — tap to advance faster. */}
      <Pressable onPress={next} className="flex-1 justify-center px-6">
        <Animated.View key={index} entering={SlideInRight.duration(420)}>
          <WelcomeCards title={card.title} description={card.description} tiltDegrees={card.tiltDegrees} />
        </Animated.View>
      </Pressable>

      {/* Bottom controls */}
      <View className="pb-12 px-6">
        {/* Progress dots (active = pill, with a subtle animated grow) */}
        <View className="mb-8 flex-row justify-center space-x-2">
          {onboardingCards.map((_, i) => (
            <Animated.View
              key={i}
              entering={FadeIn}
              className={`h-2 rounded-full ${
                i === index ? 'w-8 bg-gray-800 dark:bg-white' : 'w-2 bg-gray-300 dark:bg-neutral-600'
              }`}
            />
          ))}
        </View>

        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            className="rounded-full border border-gray-300 px-7 py-3 dark:border-neutral-600"
            onPress={finish}>
            <Text className="font-medium text-black dark:text-white">Skip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center rounded-full bg-gray-800 px-8 py-3 dark:bg-white"
            onPress={next}>
            <Text className="mr-2 font-medium text-white dark:text-black">
              {isLast ? 'Get Started' : 'Next'}
            </Text>
            <View className="h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-black">
              <Text className="self-center text-black dark:text-white">→</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default Onboarding;
