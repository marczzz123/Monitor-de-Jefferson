import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMonitoring } from "@/context/MonitoringContext";
import { useColors } from "@/hooks/useColors";

function HourPicker({
  value,
  onChange,
  colors,
}: {
  value: number;
  onChange: (h: number) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.hourRow}>
      <TouchableOpacity
        onPress={() => onChange(Math.max(0, value - 1))}
        style={[styles.hourBtn, { backgroundColor: colors.muted }]}
      >
        <Feather name="minus" size={14} color={colors.foreground} />
      </TouchableOpacity>
      <Text style={[styles.hourVal, { color: colors.foreground }]}>
        {String(value).padStart(2, "0")}:00
      </Text>
      <TouchableOpacity
        onPress={() => onChange(Math.min(23, value + 1))}
        style={[styles.hourBtn, { backgroundColor: colors.muted }]}
      >
        <Feather name="plus" size={14} color={colors.foreground} />
      </TouchableOpacity>
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { allApps, restrictedApps, toggleRestrictedApp, schedule, updateSchedule, sensitivity, updateSensitivity } =
    useMonitoring();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const sensitivityLabels = ["Bajo", "Medio", "Alto"];
  const sensitivityDesc = [
    "Solo cierra apps claramente daninas",
    "Balance entre libertad y control",
    "Cierra cualquier distraccion rapidamente",
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 16,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Configuracion</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <View style={styles.sectionHeader}>
            <Feather name="sliders" size={16} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Sensibilidad de la IA</Text>
          </View>
          <View style={styles.sensitivityRow}>
            {sensitivityLabels.map((label, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => updateSensitivity(i)}
                style={[
                  styles.sensitivityBtn,
                  {
                    backgroundColor: sensitivity === i ? colors.primary : colors.muted,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sensitivityText,
                    { color: sensitivity === i ? "#fff" : colors.mutedForeground },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.sensitivityDesc, { color: colors.mutedForeground }]}> 
            {sensitivityDesc[sensitivity]}
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <View style={styles.sectionHeader}>
            <Feather name="clock" size={16} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Horarios</Text>
          </View>
          <View style={styles.scheduleRow}>
            <View style={styles.scheduleItem}>
              <Text style={[styles.scheduleLabel, { color: colors.mutedForeground }]}>Inicio clases</Text>
              <HourPicker
                value={schedule.schoolStart}
                onChange={(h) => updateSchedule({ ...schedule, schoolStart: h })}
                colors={colors}
              />
            </View>
            <View style={styles.scheduleItem}>
              <Text style={[styles.scheduleLabel, { color: colors.mutedForeground }]}>Fin clases</Text>
              <HourPicker
                value={schedule.schoolEnd}
                onChange={(h) => updateSchedule({ ...schedule, schoolEnd: h })}
                colors={colors}
              />
            </View>
            <View style={styles.scheduleItem}>
              <Text style={[styles.scheduleLabel, { color: colors.mutedForeground }]}>Hora dormir</Text>
              <HourPicker
                value={schedule.bedtime}
                onChange={(h) => updateSchedule({ ...schedule, bedtime: h })}
                colors={colors}
              />
            </View>
          </View>
        </View>

        <Text style={[styles.listTitle, { color: colors.foreground }]}>Apps del dispositivo</Text>
        <Text style={[styles.listSub, { color: colors.mutedForeground }]}> 
          Estas apps vienen del Android instalado, no de una lista fija. Activa las que quieres restringir.
        </Text>

        {allApps.length === 0 ? (
          <View style={[styles.emptyApps, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <Feather name="smartphone" size={26} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No se pudieron leer apps todavia</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}> 
              Abre Guardian en Android, activa Acceso al uso de apps y vuelve a iniciar el monitoreo. La app ya no mostrara apps inventadas.
            </Text>
          </View>
        ) : (
          allApps.map((app) => {
            const isRestricted = restrictedApps.includes(app.packageName);
            const categoryColor =
              app.category === "distraction"
                ? colors.destructive
                : app.category === "educational"
                ? colors.success
                : colors.warning;
            const categoryLabel =
              app.category === "distraction"
                ? "Distraccion"
                : app.category === "educational"
                ? "Educativa"
                : "Neutral";
            return (
              <View
                key={app.packageName}
                style={[styles.appRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.appIconBox, { backgroundColor: categoryColor + "18" }]}> 
                  <Feather name={app.icon as any} size={18} color={categoryColor} />
                </View>
                <View style={styles.appInfo}>
                  <Text style={[styles.appName, { color: colors.foreground }]}>{app.name}</Text>
                  <Text style={[styles.packageName, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {app.packageName}
                  </Text>
                  <View style={[styles.categoryBadge, { backgroundColor: categoryColor + "18" }]}> 
                    <Text style={[styles.categoryText, { color: categoryColor }]}>{categoryLabel}</Text>
                  </View>
                </View>
                <Switch
                  value={isRestricted}
                  onValueChange={() => toggleRestrictedApp(app.packageName)}
                  trackColor={{ false: colors.muted, true: colors.destructive + "80" }}
                  thumbColor={isRestricted ? colors.destructive : colors.mutedForeground}
                />
              </View>
            );
          })
        )}

        <View style={[styles.infoBox, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}> 
          <Feather name="info" size={16} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.foreground }]}> 
            Guardian ahora usa lectura nativa de Android para apps instaladas y uso reciente. Si no aparecen datos, falta activar Acceso al uso de apps en Ajustes.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  scroll: { padding: 20, gap: 12 },
  section: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  sensitivityRow: { flexDirection: "row", gap: 8 },
  sensitivityBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  sensitivityText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sensitivityDesc: { fontSize: 12, fontFamily: "Inter_400Regular" },
  scheduleRow: { flexDirection: "row", gap: 8 },
  scheduleItem: { flex: 1, gap: 8, alignItems: "center" },
  scheduleLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "center" },
  hourRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  hourBtn: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  hourVal: { fontSize: 14, fontFamily: "Inter_700Bold", minWidth: 40, textAlign: "center" },
  listTitle: { fontSize: 17, fontFamily: "Inter_700Bold", marginTop: 4 },
  listSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 4, lineHeight: 18 },
  emptyApps: {
    borderRadius: 14,
    padding: 22,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
  },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  appIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  appInfo: { flex: 1, gap: 4 },
  appName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  packageName: { fontSize: 11, fontFamily: "Inter_400Regular" },
  categoryBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  categoryText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  infoBox: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
