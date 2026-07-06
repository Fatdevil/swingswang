/**
 * _layout.tsx
 * SwingSwang
 *
 * Root layout with tab navigation.
 */

import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { AnalysisProvider } from '../src/context/AnalysisContext';
import { COLORS } from '../src/constants/theme';
import { useAnalysis } from '../src/hooks/useAnalysis';
import { Pressable, View, StyleSheet } from 'react-native';

function NavigationLayout() {
  const { selectAndLoadVideo } = useAnalysis();
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 6,
        },
        tabBarActiveTintColor: COLORS.textPrimary,
        tabBarInactiveTintColor: COLORS.textTertiary,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="player"
        options={{
          title: 'Player',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="play-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="plus"
        options={{
          title: '',
          tabBarButton: () => (
            <Pressable
              onPress={async () => {
                await selectAndLoadVideo();
                router.push('/');
              }}
              style={styles.plusButtonContainer}
            >
              <View style={styles.plusButton}>
                <Ionicons name="add" size={26} color={COLORS.background} />
              </View>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: 'Results',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="debug"
        options={{
          title: 'Debug',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bug-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Hide screens that shouldn't appear in tabs */}
      <Tabs.Screen name="analyze" options={{ href: null }} />
    </Tabs>
  );
}

export default function RootLayout() {
  return (
    <AnalysisProvider>
      <StatusBar style="light" />
      <NavigationLayout />
    </AnalysisProvider>
  );
}

const styles = StyleSheet.create({
  plusButtonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
