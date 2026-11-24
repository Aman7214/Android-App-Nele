import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { avatarLabel, avatarSource } from '@/data/avatars';
import { colors } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = {
  avatarId?: string | null;
  /** Used for the initials fallback and the accessibility label. */
  name?: string | null;
  size?: number;
  /** Darker ring used when the avatar sits on a white card. */
  bordered?: boolean;
};

/** The chosen illustration, or the person's initial when none is chosen yet. */
export function ProfileAvatar({ avatarId, name, size = 48, bordered = false }: Props) {
  const source = avatarSource(avatarId);
  const style = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: bordered ? 1 : 0,
    borderColor: colors.hairlineSoft,
  };
  if (source) {
    return <Image source={source} style={style} contentFit="cover" accessibilityLabel={avatarLabel(avatarId)} />;
  }
  const initial = (name?.trim().charAt(0) || 'N').toUpperCase();
  return (
    <View style={[styles.fallback, style]}>
      <AppText
        style={[styles.initial, { fontSize: Math.round(size * 0.4), lineHeight: Math.round(size * 0.5) }]}>
        {initial}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: colors.onPrimary,
    fontWeight: '600',
  },
});
