import { Tabs } from "expo-router";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { View, type ColorValue } from "react-native";
import { AddSeriesButton, CartButton } from "@/components/HeaderButtons";
import { useThemeColors } from "@/theme/colors";

function tabIcon(name: SymbolViewProps["name"]) {
  function TabIcon({ color }: { color: ColorValue }) {
    return <SymbolView name={name} tintColor={color as string} size={26} />;
  }
  return TabIcon;
}

/** web 版モバイルの下部 5 タブ（Layout.jsx）と同じ構成 */
export default function TabsLayout() {
  const colors = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.brand },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontWeight: "700" },
        tabBarActiveTintColor: colors.brandText,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: { backgroundColor: colors.card },
        sceneStyle: { backgroundColor: colors.surface },
        headerRight: () => (
          <View className="mr-3 flex-row items-center gap-4">
            <CartButton />
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "ホーム",
          tabBarIcon: tabIcon("house.fill"),
          headerRight: () => (
            <View className="mr-3 flex-row items-center gap-4">
              <AddSeriesButton />
              <CartButton />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{ title: "読みたい", tabBarIcon: tabIcon("bookmark.fill") }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: "履歴", tabBarIcon: tabIcon("clock.fill") }}
      />
      <Tabs.Screen
        name="completed"
        options={{ title: "読破", tabBarIcon: tabIcon("trophy.fill") }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "設定", tabBarIcon: tabIcon("gearshape.fill") }}
      />
    </Tabs>
  );
}
