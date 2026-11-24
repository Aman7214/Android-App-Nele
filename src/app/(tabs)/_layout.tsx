import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, shadow } from '@/theme/tokens';

/**
 * Raised centre action — pushes the list form instead of activating a tab,
 * so the surrounding tabs keep their selection.
 */
function ListTabButton() {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.actionWrap, animatedStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="List your property"
        onPress={() => router.push('/list')}
        onPressIn={() => {
          scale.set(withSpring(0.92, { damping: 18, stiffness: 400 }));
        }}
        onPressOut={() => {
          scale.set(withSpring(1, { damping: 18, stiffness: 400 }));
        }}
        style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
        <Ionicons name="add" size={28} color={colors.onPrimary} />
      </Pressable>
    </Animated.View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.canvas },
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.mutedSoft,
        tabBarLabelStyle: styles.label,
        tabBarStyle: [
          styles.bar,
          {
            // Respect the Android gesture bar / nav buttons, and give the
            // icon + label stack enough room to render fully.
            height: 68 + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 0,
          },
        ],
        tabBarItemStyle: styles.item,
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={22} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="list"
        options={{
          title: 'List',
          tabBarButton: () => <ListTabButton />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'heart' : 'heart-outline'} size={22} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color as string} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  item: {
    paddingVertical: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
  },
  actionWrap: {
    flex: 1,
    alignItems: 'center',
  },
  action: {
    width: 52,
    height: 52,
    borderRadius: 9999,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -14,
    borderWidth: 4,
    borderColor: colors.canvas,
    ...shadow,
  },
  actionPressed: {
    backgroundColor: colors.primaryActive,
  },
});
