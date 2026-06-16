import React, { useMemo } from 'react'
// import RN primitives
import { View, Text } from 'react-native'
// render the QR image
import QRCode from 'react-native-qrcode-svg'

interface ProfileQRCodeProps {
  // The unique user id we encode
  userId: string
  // Optional explicit value override (lets you pass a deep link later)
  valueOverride?: string
  // Optional size so parent can control dimensions (defaults sensible)
  size?: number
}

const ProfileQRCode: React.FC<ProfileQRCodeProps> = ({
  userId,
  valueOverride,
  size = 200
}) => {
  // Build the value ONCE per userId/valueOverride change.
  // const qrValue = useMemo(
  //   () => valueOverride ?? `pingou:user:${userId}`,
  //   [userId, valueOverride]
  // )

  return (
    // Card container: rounded, padded, and theme-aware background
    <View className="bg-white dark:bg-neutral-900 rounded-2xl p-6 mx-4 shadow-sm">
      {/* Title */}
      <Text className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 text-left">
        Your QR Code
      </Text>

      {/* Subtitle */}
      <Text className="mt-1 text-lg text-black dark:text-neutral-400 text-left">
        Scan to connect
      </Text>

      {/* Center the QR block */}
      <View className="mt-6 items-center">
        {/* Grey rounded background wrapper (like your screenshot) */}
        <View className="bg-neutral-100 dark:bg-neutral-800 rounded-3xl p-10 shadow-sm">
          {/* Exact-fit white square so its corners align 1:1 with the QR */}
          <View
            // Width/height must match the QR size exactly (no +1, no padding)
            style={{ width: size, height: size }}
            // White surface improves scan reliability; clip to remove any bleed
            className="bg-white overflow-hidden rounded-none"
          >
            <QRCode
              // The encoded value
              value={userId}
              // Fill the white square exactly
              size={size}
              // Transparent so the white square shows through
              backgroundColor="transparent"
              // Black modules on white are most scannable in both light/dark modes
              color="#000000"
            />
          </View>
        </View>
      </View>
    </View>
  )
}

export default ProfileQRCode