import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo } from "react";
import {
  BackHandler,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getModeDescription,
  getModeLabel,
  useMonitoring,
  type AppMode,
} from "@/context/MonitoringContext";
import { useColors } from "@/hooks/useColors";

const MODE_ICONS: Record<AppMode, keyof typeof Feather.glyphMap> = {
  school: "book-open",
  lunch: "coffee",
  study: "edit-3",
  sleep: "moon",
  free: "play-circle",
};

export default function BlockedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentMode } = useMonitoring();
  const params = useLocalSearchParams<{ pkg?: string; mode?: string }>();

  const mode: AppMode = useMemo(() => {
    const m = (params.mode ?? currentMode) as AppMode;
    if (m === "school" || m === "lunch" || m === "study" || m === "sleep" || m === "free") return m;
    return currentMode;
  }, [params.mode, currentMode]);

  const modeColors: Record<AppMode, string> = {
    school: colors.destructive,
    lunch: colors.warning,
    study: colors.primary,
    sleep: "#6366F1",
    free: colors.success,
  };
  const accent = modeColors[mode];

  // Block hardware back so Jefferson doesn't dismiss it
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: accent + "18", borderColor: accent + "40" }]}>
          <Feather name="lock" size={56} color={accent} />
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>Aplicacion bloqueada</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Guardian esta limitando esta app durante el modo activo. Espera al siguiente horario para volver a usarla.
        </Text>

        <View style={[styles.modeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.modeIcon, { backgroundColor: accent + "18" }]}>
            <Feather name={MODE_ICONS[mode]} size={22} color={accent} />
          </View>
          <View style={styles.modeInfo}>
            <Text style={[styles.modeLabel, { color: colors.mutedForeground }]}>Modo activo</Text>
            <Text style={[styles.modeName, { color: accent }]}>{getModeLabel(mode)}</Text>
            <Text style={[styles.modeDesc, { color: colors.mutedForeground }]}>{getModeDescription(mode)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  iconWrap: {
    width: 120, height: 120, borderRadius: 60,
    alignItems: "center", justifyContent: "center", borderWidth: 2,
    marginBottom: 8,
  },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", textAlign: "center", letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, paddingHorizontal: 16 },
  modeCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    padding: 16, borderRadius: 16, borderWidth: 1, width: "100%", marginTop: 8,
  },
  modeIcon: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  modeInfo: { flex: 1, gap: 2 },
  modeLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.6 },
  modeName: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modeDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
});
