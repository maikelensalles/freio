// components/Card.tsx
import { Text, View } from 'react-native';

export function DashboardCard() {
  return (
    // Note que usamos `className` porque você vai usar o NativeWind (Tailwind)
    <View className="bg-[#1E2028] p-6 rounded-[32px] mx-4 my-6 border border-[#2D2F38]">
      <Text className="text-gray-400 text-sm">Available balance</Text>
      <Text className="text-white text-4xl font-bold mt-2">$3,578</Text>
      <Text className="text-indigo-400 mt-4 underline">See details</Text>
    </View>
  );
}