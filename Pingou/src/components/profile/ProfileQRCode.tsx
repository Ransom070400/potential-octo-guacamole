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
 * Branded QR card: a clean code with the Pingou penguin knocked out of the centre.
 * Error correction is forced to H (~30% recoverable) so the centre logo never hurts
 * scan reliability.
 */
const ProfileQRCode: React.FC<ProfileQRCodeProps> = ({ userId, valueOverride, size = 224 }) => {
  const value = useMemo(() => valueOverride ?? userId, [userId, valueOverride]);
  const qrSize = size;

  return (
    <View
      className="mx-4 rounded-[28px] bg-white px-5 pb-6 pt-5 dark:bg-neutral-900"
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 10 },
        elevation: 5,
      }}>
      <Text className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Your QR Code
      </Text>
      <Text className="mt-1 text-base text-neutral-500 dark:text-neutral-400">
        Scan to connect
      </Text>

      <View className="mt-5 items-center">
        {/* White panel — keeps modules on pure white for maximum scannability */}
        <View
          className="rounded-3xl bg-white"
          style={{
            padding: 18,
            borderWidth: 1,
            borderColor: 'rgba(0,0,0,0.06)',
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 2,
          }}>
          <QRCode
            value={value}
            size={qrSize}
            ecl="H"
            color="#0B0B0F"
            backgroundColor="#FFFFFF"
            quietZone={6}
            logo={PENGUIN}
            logoSize={qrSize * 0.2}
            logoBackgroundColor="#FFFFFF"
            logoMargin={6}
            logoBorderRadius={16}
          />
        </View>
      </View>
    </View>
  );
};

export default ProfileQRCode;
