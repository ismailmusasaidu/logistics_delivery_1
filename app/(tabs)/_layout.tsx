import { Tabs } from 'expo-router';
import { Package, User, LayoutDashboard, Bike, Users, DollarSign } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();

  if (!profile) {
    return null;
  }

  if (profile.role === 'customer') {
    return (
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#10b981',
          tabBarInactiveTintColor: '#6b7280',
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopWidth: 1,
            borderTopColor: '#e5e7eb',
            height: 60 + insets.bottom,
            paddingBottom: Math.max(insets.bottom, 8),
            paddingTop: 8,
          },
        }}>
        <Tabs.Screen
          name="customer-home"
          options={{
            title: 'Orders',
            tabBarIcon: ({ size, color }) => (
              <Package size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="customer-profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ size, color }) => (
              <User size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen name="rider-home" options={{ href: null }} />
        <Tabs.Screen name="rider-profile" options={{ href: null }} />
        <Tabs.Screen name="admin-dashboard" options={{ href: null }} />
        <Tabs.Screen name="admin-orders" options={{ href: null }} />
        <Tabs.Screen name="admin-riders" options={{ href: null }} />
        <Tabs.Screen name="admin-users" options={{ href: null }} />
        <Tabs.Screen name="admin-pricing" options={{ href: null }} />
      </Tabs>
    );
  }

  if (profile.role === 'rider') {
    return (
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#3b82f6',
          tabBarInactiveTintColor: '#6b7280',
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopWidth: 1,
            borderTopColor: '#e5e7eb',
            height: 60 + insets.bottom,
            paddingBottom: Math.max(insets.bottom, 8),
            paddingTop: 8,
          },
        }}>
        <Tabs.Screen
          name="rider-home"
          options={{
            title: 'Deliveries',
            tabBarIcon: ({ size, color }) => (
              <Bike size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="rider-profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ size, color }) => (
              <User size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen name="customer-home" options={{ href: null }} />
        <Tabs.Screen name="customer-profile" options={{ href: null }} />
        <Tabs.Screen name="admin-dashboard" options={{ href: null }} />
        <Tabs.Screen name="admin-orders" options={{ href: null }} />
        <Tabs.Screen name="admin-riders" options={{ href: null }} />
        <Tabs.Screen name="admin-users" options={{ href: null }} />
        <Tabs.Screen name="admin-pricing" options={{ href: null }} />
      </Tabs>
    );
  }

  if (profile.role === 'admin') {
    return (
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#8b5cf6',
          tabBarInactiveTintColor: '#6b7280',
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopWidth: 1,
            borderTopColor: '#e5e7eb',
            height: 60 + insets.bottom,
            paddingBottom: Math.max(insets.bottom, 8),
            paddingTop: 8,
          },
        }}>
        <Tabs.Screen
          name="admin-dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ size, color }) => (
              <LayoutDashboard size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="admin-orders"
          options={{
            title: 'Orders',
            tabBarIcon: ({ size, color }) => (
              <Package size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="admin-riders"
          options={{
            title: 'Riders',
            tabBarIcon: ({ size, color }) => (
              <Bike size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="admin-users"
          options={{
            title: 'Users',
            tabBarIcon: ({ size, color }) => (
              <Users size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="admin-pricing"
          options={{
            title: 'Pricing',
            tabBarIcon: ({ size, color }) => (
              <DollarSign size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="customer-profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ size, color }) => (
              <User size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen name="customer-home" options={{ href: null }} />
        <Tabs.Screen name="rider-home" options={{ href: null }} />
        <Tabs.Screen name="rider-profile" options={{ href: null }} />
      </Tabs>
    );
  }

  return null;
}
