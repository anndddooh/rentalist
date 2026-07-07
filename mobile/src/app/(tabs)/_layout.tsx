import { Tabs } from "expo-router";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { View, type ColorValue } from "react-native";
import { useThemeColors } from "@/theme/colors";

// アクティブ時は brand-soft のピルをアイコン背後に敷く（モックアップのタブバー）
function tabIcon(name: SymbolViewProps["name"]) {
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return (
      <View
        className={`rounded-full px-4 py-1 ${focused ? "bg-brand-soft" : ""}`}
      >
        <SymbolView name={name} tintColor={color as string} size={24} />
      </View>
    );
  }
  return TabIcon;
}

/** web 版モバイルの下部 5 タブ（Layout.jsx）と同じ構成 */
export default function TabsLayout() {
  const colors = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandText,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.line,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
        sceneStyle: { backgroundColor: colors.surface },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "ホーム", tabBarIcon: tabIcon("house.fill") }}
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
