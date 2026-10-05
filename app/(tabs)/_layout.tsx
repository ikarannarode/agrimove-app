import { Redirect, Tabs, usePathname } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useAuth } from '@/lib/AuthContext';
import { Loading } from '@/components/TransportUI';

export default function TabsLayout() {
  const pathname = usePathname();
  const { session, profile, loading } = useAuth();
  if (loading) return <Loading />;
  if (!session || !profile) return <Redirect href="/(auth)/login" />;

  const farmer = profile.role === 'farmer';
  const ownerOnlyScreens = ['vehicles', 'requests'];
  const farmerOnlyScreens = ['search', 'bookings'];
  const currentScreen = pathname.split('/').pop() ?? 'home';
  if (farmer && ownerOnlyScreens.includes(currentScreen)) return <Redirect href="/(tabs)/home" />;
  if (!farmer && farmerOnlyScreens.includes(currentScreen)) return <Redirect href="/(tabs)/home" />;
  const tabIcon = (name: ComponentProps<typeof MaterialCommunityIcons>['name']) => ({
    tabBarIcon: ({ color, size }: { color: ColorValue; size: number }) => (
      <MaterialCommunityIcons name={name} color={color} size={size} />
    ),
  });

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#236b43',
        tabBarInactiveTintColor: '#77847a',
        tabBarStyle: { height: 62, paddingTop: 5, paddingBottom: 7, backgroundColor: '#fff' },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="home" options={{ ...tabIcon('home-variant'), title: farmer ? 'मुख्यपृष्ठ' : 'डॅशबोर्ड', tabBarLabel: farmer ? 'मुख्य' : 'डॅशबोर्ड' }} />
      <Tabs.Screen name="search" options={{ ...tabIcon('magnify'), title: 'वाहन शोधा', tabBarLabel: 'शोध', href: farmer ? undefined : null }} />
      <Tabs.Screen name="vehicles" options={{ ...tabIcon('truck'), title: 'माझी वाहने', tabBarLabel: 'वाहने', href: farmer ? null : undefined }} />
      <Tabs.Screen name="bookings" options={{ ...tabIcon('clipboard-list'), title: 'माझी आरक्षणे', tabBarLabel: 'आरक्षणे', href: farmer ? undefined : null }} />
      <Tabs.Screen name="requests" options={{ ...tabIcon('inbox-arrow-down'), title: 'आरक्षण विनंत्या', tabBarLabel: 'विनंत्या', href: farmer ? null : undefined }} />
      <Tabs.Screen name="journeys" options={{ ...tabIcon('truck-fast'), title: 'माझे प्रवास', tabBarLabel: 'प्रवास' }} />
      <Tabs.Screen name="notifications" options={{ ...tabIcon('bell-outline'), title: 'सूचना', tabBarLabel: 'सूचना' }} />
      <Tabs.Screen name="profile" options={{ ...tabIcon('account-circle-outline'), title: 'प्रोफाइल', tabBarLabel: 'प्रोफाइल' }} />
    </Tabs>
  );
}
