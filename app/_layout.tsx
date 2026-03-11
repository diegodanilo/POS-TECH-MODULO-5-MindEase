import { AIProvider } from '@/contexts/AIContext';
import { AIIntegrationProvider } from '@/contexts/AIIntegrationContext';
import { CognitiveEngineProvider } from '@/contexts/CognitiveEngineContext';
import { CognitiveProfileProvider } from '@/contexts/CognitiveProfileContext';
import { TaskProvider } from '@/contexts/TaskContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Voltar' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
   return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView>
        <CognitiveProfileProvider>
          <CognitiveEngineProvider>
            <TaskProvider>
              <AIProvider>
                <AIIntegrationProvider>
                  <RootLayoutNav />
                </AIIntegrationProvider>
              </AIProvider>
            </TaskProvider>
          </CognitiveEngineProvider>
        </CognitiveProfileProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}