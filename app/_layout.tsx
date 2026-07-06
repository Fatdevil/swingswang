/**
 * _layout.tsx
 * SwingSwang
 *
 * Root layout with tab navigation.
 */

import React, { useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { AnalysisProvider } from '../src/context/AnalysisContext';
import { COLORS, SPACING, FONT_SIZE } from '../src/constants/theme';
import { useAnalysis } from '../src/hooks/useAnalysis';
import { Pressable, View, StyleSheet, Modal, Text } from 'react-native';

function NavigationLayout() {
  const { selectAndLoadVideo } = useAnalysis();
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <View style={{ flex: 1 }}>
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
                onPress={() => setMenuVisible(true)}
                style={styles.plusButtonContainer}
              >
                <View style={[styles.plusButton, menuVisible && styles.plusActive]}>
                  <Ionicons 
                    name="add" 
                    size={26} 
                    color={menuVisible ? COLORS.textPrimary : COLORS.background} 
                  />
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

      {/* Modal Popup Menu */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuContainer}>
            <Text style={styles.menuTitle}>SWING ACTION</Text>
            
            <Pressable
              onPress={async () => {
                setMenuVisible(false);
                await selectAndLoadVideo();
                router.push('/');
              }}
              style={({ pressed }) => [
                styles.menuItem,
                pressed && styles.menuItemPressed
              ]}
            >
              <Ionicons name="analytics" size={18} color={COLORS.textPrimary} />
              <Text style={styles.menuItemText}>Analyze Swing</Text>
            </Pressable>

            <Pressable
              style={styles.menuItemDisabled}
            >
              <Ionicons name="videocam-outline" size={18} color={COLORS.textTertiary} />
              <Text style={styles.menuItemTextDisabled}>Record Swing (Phase 1)</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
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
  plusActive: {
    backgroundColor: COLORS.cardElevated,
    transform: [{ rotate: '45deg' }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 80, // Positions directly above the tab bar
  },
  menuContainer: {
    width: 240,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  menuTitle: {
    color: COLORS.textTertiary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 12,
    paddingHorizontal: SPACING.sm,
    borderRadius: 8,
  },
  menuItemPressed: {
    backgroundColor: COLORS.cardElevated,
  },
  menuItemText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  menuItemDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 12,
    paddingHorizontal: SPACING.sm,
    opacity: 0.5,
  },
  menuItemTextDisabled: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.sm,
  },
});
