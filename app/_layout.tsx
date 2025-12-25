import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/contexts/AuthContext';
import { CorporateProvider } from '@/contexts/CorporateContext';

export default function RootLayout() {
  useFrameworkReady();

  return (
    <AuthProvider>
      <CorporateProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </CorporateProvider>
    </AuthProvider>
  );
}
