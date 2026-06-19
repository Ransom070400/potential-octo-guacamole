import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

const PENGUIN = require('../../../assets/PingouLogoWOBG.png');

interface ProfileQRCodeProps {
  /** The value we encode (address / connect link). */
  userId: string;
  /** Optional explicit value override (e.g. a deep link). */
  valueOverride?: string;
  /** QR size in px. */
  size?: number;
}

/**
 * Branded QR card: a clean white panel with the Pingou penguin knocked out of the
 * centre. Error correction is forced to H (~30% recoverable) so the centre logo
 * never hurts scan reliability.
 */
const ProfileQRCode: React.FC<ProfileQRCodeProps> = ({ userId, valueOverride, size = 224 }) => {
  const value = useMemo(() => valueOverride ?? userId, [userId, valueOverride]);

  return (
    <View className="mx-4 rounded-3xl bg-white p-6 shadow-sm dark:bg-neutral-900">
      <Text className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Your QR Code
      </Text>
      <Text className="mt-1 text-base text-neutral-500 dark:text-neutral-400">
        Scan to connect
      </Text>

      <View className="mt-6 items-center">
        {/* White panel — keeps modules on pure white for max scannability */}
        <View
          className="rounded-3xl bg-white p-5"
          style={{
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            elevation: 3,
            borderWidth: 1,
            borderColor: 'rgba(0,0,0,0.05)',
          }}>
          <QRCode
            value={value}
            size={size}
            ecl="H"
            color="#0B0B0F"
            backgroundColor="#FFFFFF"
            quietZone={6}
            logo={PENGUIN}
            logoSize={size * 0.22}
            logoBackgroundColor="#FFFFFF"
            logoMargin={5}
            logoBorderRadius={14}
          />
        </View>
      </View>
    </View>
  );
};

export default ProfileQRCode;
