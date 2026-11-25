import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { colors } from '@/theme';

export const unstable_settings = {
  anchor: 'index',
};

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textSecondary, headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'خانه', tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color as string} /> }}
      />
      <Tabs.Screen
        name="log"
        options={{ title: 'ثبت وعده', tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" size={size} color={color as string} /> }}
      />
      <Tabs.Screen
        name="reports"
        options={{ title: 'گزارش', tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" size={size} color={color as string} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'نمایه', tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color as string} /> }}
      />
    </Tabs>
  );
}
