// app/_layout.tsx
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';
import { AppProvider, useApp } from '../hooks/AppContext';

// Componente interno que acessa o contexto (precisa estar dentro do Provider)
function RootNavigator() {
  const { loading } = useApp();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F1015' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  // O redirect é feito pelo AppContext via useRouter — aqui só declaramos as rotas
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      {/* AppProvider engloba tudo — session e renda ficam disponíveis em qualquer tela */}
      <AppProvider>
        <RootNavigator />
      </AppProvider>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}