import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, useColorScheme, Alert, RefreshControl, Share, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogOut, Share2, Trash2 } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { supabase } from '~/src/lib/supabase';
import { useAuth } from '~/src/context/AuthProvider';
import { useSuiAuth } from '~/src/context/SuiAuthProvider';
import { SUI_ENABLED } from '~/src/lib/sui/config';
import { buildConnectQR } from '~/src/lib/sui/share';

import ProfileHeader from '~/src/components/profile/ProfileHeader';
import { StatsCard } from '~/src/components/profile/StatsRow';
import ContactInfo from '~/src/components/profile/ContactInfo';
import SocialLinks from '~/src/components/profile/SocialLinks';
import ProfileQRCode from '~/src/components/profile/ProfileQRCode';

import { buildSocialLinks } from '~/src/utils/buildSocialLinks';
import { ProfileSkeleton } from '~/src/components/Skeleton';
import { Feedback } from '~/src/utils/Feedback';

// Every connection a user makes is worth this many Ping Tokens.
const TOKENS_PER_CONNECTION = 10;

const SupabaseHome: React.FC = () => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const iconColor = colorScheme === 'dark' ? '#ffffff' : '#111827';
  const { profile, setProfile, session } = useAuth();
  const [connectionCount, setConnectionCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const socialList = useMemo(() => (profile ? buildSocialLinks(profile) : []), [profile]);

  const fetchStats = useCallback(async () => {
    if (!session?.user?.id) return;
    const { count } = await supabase
      .from('connections')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', session.user.id);
    setConnectionCount(count ?? 0);
  }, [session?.user?.id]);

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .single();
    if (data) setProfile(data);
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [fetchStats])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshProfile(), fetchStats()]);
    setRefreshing(false);
  }, [refreshProfile, fetchStats]);

  const handleShare = async () => {
    if (!profile) return;
    Feedback.light();
    try {
      await Share.share({
        message: `Connect with ${profile.fullname} on Pingou!\n\nUser ID: ${profile.user_id}`,
      });
    } catch (_) {}
  };

  const handleLogout = () => {
    Feedback.medium();
    Alert.alert('Confirm Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.auth.signOut();
          if (error) Alert.alert('Logout Error', error.message);
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Feedback.heavy();
    Alert.alert(
      'Delete Account',
      'This will permanently delete your profile, connections, and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Are you sure?', 'Type is final. All your data will be gone forever.', [
              { text: 'Go Back', style: 'cancel' },
              {
                text: 'Yes, Delete',
                style: 'destructive',
                onPress: async () => {
                  if (!session?.user?.id) return;
                  // Delete connections, folders, profile in order
                  await supabase.from('connections').delete().eq('owner_id', session.user.id);
                  await supabase.from('connections').delete().eq('connected_to', session.user.id);
                  await supabase.from('folders').delete().eq('owner_id', session.user.id);
                  await supabase.from('profiles').delete().eq('user_id', session.user.id);
                  // Delete storage
                  await supabase.storage.from('pfp').remove([`${session.user.id}.jpg`]);
                  // Sign out
                  await supabase.auth.signOut();
                },
              },
            ]);
          },
        },
      ]
    );
  };

  if (!profile) {
    return <ProfileSkeleton />;
  }

  return (
    <View className="flex-1 bg-neutral-100 dark:bg-neutral-900">
      {/* Top-right action buttons */}
      <View style={{ position: 'absolute', top: insets.top + 8, right: 16, zIndex: 10, flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity
          onPress={handleShare}
          activeOpacity={0.6}
          className="h-9 w-9 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-800">
          <Share2 size={16} color={iconColor} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleLogout}
          activeOpacity={0.6}
          className="h-9 w-9 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-800">
          <LogOut size={16} color={iconColor} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <ProfileHeader
          fullName={profile.fullname}
          tagline={profile.bio || profile.nickname}
          avatarUrl={profile.profile_url}
        />

        <StatsCard pingTokens={connectionCount * TOKENS_PER_CONNECTION} connections={connectionCount} />

        <View className="mt-8">
          <ProfileQRCode userId={profile.user_id} />
        </View>

        <View className="mt-6">
          <ContactInfo email={profile.email} phone={profile.phone} />
        </View>

        <View className="mb-8 mt-6">
          <SocialLinks links={socialList} />
        </View>

        {/* Delete account — bottom of profile */}
        <TouchableOpacity
          onPress={handleDeleteAccount}
          className="mx-4 mb-4 flex-row items-center justify-center rounded-xl py-3">
          <Trash2 size={16} color="#EF4444" />
          <Text className="ml-2 text-sm text-red-500">Delete Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

// ── Sui-mode home: profile from zkLogin + on-chain Profile (Walrus+Seal). ──
const SuiHome: React.FC = () => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const iconColor = colorScheme === 'dark' ? '#ffffff' : '#111827';
  const { address, profile, profileRef, busy, loading, logout, refresh } = useSuiAuth();

  // QR encodes address + profile id + share-code so one scan exchanges both cards.
  const qrValue = useMemo(
    () =>
      address && profileRef && profile?.shareCode
        ? buildConnectQR({ address, profileId: profileRef.profileObjectId, code: profile.shareCode })
        : (address ?? ''),
    [address, profileRef, profile?.shareCode]
  );

  const socialList = useMemo(
    () => (profile ? buildSocialLinks(profile as any) : []),
    [profile]
  );

  const handleLogout = () => {
    Feedback.medium();
    Alert.alert('Confirm Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  if (loading) return <ProfileSkeleton />;

  // Signed in but no profile yet — prompt setup.
  if (!profile) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-100 px-8 dark:bg-neutral-900">
        <Text className="mb-2 text-xl font-bold text-neutral-900 dark:text-white">
          Set up your profile
        </Text>
        <Text className="mb-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
          Your profile is encrypted with Seal and stored on Walrus — only people you
          connect with can read it.
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/editProfile')}
          className="h-12 items-center justify-center rounded-full bg-black px-8 dark:bg-white">
          <Text className="font-semibold text-white dark:text-black">Create profile</Text>
        </TouchableOpacity>
        <Text className="mt-10 text-xs text-neutral-400" onPress={handleLogout}>
          Log out
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-neutral-100 dark:bg-neutral-900">
      <View
        style={{ position: 'absolute', top: insets.top + 8, right: 16, zIndex: 10, flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity
          onPress={() => router.push('/editProfile')}
          activeOpacity={0.6}
          className="h-9 items-center justify-center rounded-full bg-neutral-200 px-4 dark:bg-neutral-800">
          <Text className="text-xs font-semibold" style={{ color: iconColor }}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleLogout}
          activeOpacity={0.6}
          className="h-9 w-9 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-800">
          <LogOut size={16} color={iconColor} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={refresh} />}>
        <ProfileHeader
          fullName={profile.fullname}
          tagline={profile.bio || profile.nickname || ''}
          avatarUrl={profile.avatar}
        />

        {/* QR carries address + profile id + share-code → one scan = two-way exchange. */}
        <View className="mt-8">
          <ProfileQRCode userId={qrValue} />
        </View>

        <View className="mt-6">
          <ContactInfo email={profile.email} phone={profile.phone} />
        </View>

        <View className="mb-8 mt-6">
          <SocialLinks links={socialList} />
        </View>
      </ScrollView>
    </View>
  );
};

export default function Index() {
  return SUI_ENABLED ? <SuiHome /> : <SupabaseHome />;
}
