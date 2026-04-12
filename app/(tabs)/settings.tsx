import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
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

import { getModeLabel, useMonitoring, type AppMode, type Schedule } from "@/context/MonitoringContext";
import { useColors } from "@/hooks/useColors";

function HourMinPicker({
  hour, minute, onChangeHour, onChangeMin, colors,
}: {
  hour: number; minute: number;
  onChangeHour: (h: number) => void;
  onChangeMin: (m: number) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.hmRow}>
      <View style={styles.hmUnit}>
        <TouchableOpacity onPress={() => onChangeHour(Math.max(0, hour - 1))} style={[styles.hmBtn, { backgroundColor: colors.muted }]}>
          <Feather name="minus" size={12} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.hmVal, { color: colors.foreground }]}>{String(hour).padStart(2, "0")}</Text>
        <TouchableOpacity onPress={() => onChangeHour(Math.min(23, hour + 1))} style={[styles.hmBtn, { backgroundColor: colors.muted }]}>
          <Feather name="plus" size={12} color={colors.foreground} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.hmSep, { color: colors.mutedForeground }]}>:</Text>
      <View style={styles.hmUnit}>
        <TouchableOpacity onPress={() => onChangeMin(minute <= 0 ? 59 : minute - 1)} style={[styles.hmBtn, { backgroundColor: colors.muted }]}>
          <Feather name="minus" size={12} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.hmVal, { color: colors.foreground }]}>{String(minute).padStart(2, "0")}</Text>
        <TouchableOpacity onPress={() => onChangeMin(minute >= 59 ? 0 : minute + 1)} style={[styles.hmBtn, { backgroundColor: colors.muted }]}>
          <Feather name="plus" size={12} color={colors.foreground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SectionCard({ icon, title, children, colors }: { icon: string; title: string; children: React.ReactNode; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.sectionHeader}>
        <Feather name={icon as any} size={15} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    allApps, restrictedApps, toggleRestrictedApp,
    schedule, updateSchedule, sensitivity, updateSensitivity,
    currentMode, recentActions, blockAttempts,
    tasksCompleted, setTasksCompleted,
  } = useMonitoring();

  const [filterCategory, setFilterCategory] = useState<string>("all");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const sensitivityLabels = ["Bajo", "Medio", "Alto"];
  const sensitivityDesc = [
    "Solo cierra apps claramente daninas",
    "Balance entre libertad y control",
    "Cierra cualquier distraccion rapidamente",
  ];

  function updateSched(partial: Partial<Schedule>) {
    updateSchedule({ ...schedule, ...partial });
  }

  const categories = ["all", "social", "game", "educational", "distraction", "neutral", "system"];
  const categoryLabels: Record<string, string> = {
    all: "Todas", social: "Social", game: "Juegos", educational: "Educativa",
    distraction: "Distraccion", neutral: "Neutral", system: "Sistema",
  };

  const filteredApps = filterCategory === "all"
    ? allApps
    : allApps.filter(a => a.category === filterCategory);

  const modeColors: Record<AppMode, string> = {
    school: colors.destructive, lunch: colors.warning,
    study: colors.primary, sleep: "#6366F1", free: colors.success,
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Admin</Text>
        <View style={[styles.modeChip, { backgroundColor: modeColors[currentMode] + "18" }]}>
          <Text style={[styles.modeChipText, { color: modeColors[currentMode] }]}>{getModeLabel(currentMode)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 100 }]} showsVerticalScrollIndicator={false}>

        {/* RESUMEN ADMIN */}
        <SectionCard icon="activity" title="Resumen del dia" colors={colors}>
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryItem, { backgroundColor: colors.destructive + "10" }]}>
              <Text style={[styles.summaryNum, { color: colors.destructive }]}>
                {recentActions.filter(a => a.action === "close").length}
              </Text>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Bloqueadas</Text>
            </View>
            <View style={[styles.summaryItem, { backgroundColor: colors.warning + "10" }]}>
              <Text style={[styles.summaryNum, { color: colors.warning }]}>
                {recentActions.filter(a => a.action === "warn").length}
              </Text>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Advertencias</Text>
            </View>
            <View style={[styles.summaryItem, { backgroundColor: colors.primary + "10" }]}>
              <Text style={[styles.summaryNum, { color: colors.primary }]}>
                {blockAttempts.length}
              </Text>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Intentos</Text>
            </View>
          </View>
          <View style={[styles.tasksRow, { backgroundColor: tasksCompleted ? colors.success + "12" : colors.warning + "12" }]}>
            <Feather name={tasksCompleted ? "check-circle" : "circle"} size={14} color={tasksCompleted ? colors.success : colors.warning} />
            <Text style={[styles.tasksText, { color: tasksCompleted ? colors.success : colors.warning }]}>
              {tasksCompleted ? "Jefferson completo las tareas de estudio" : "Tareas de estudio pendientes"}
            </Text>
            <TouchableOpacity onPress={() => setTasksCompleted(!tasksCompleted)}>
              <Text style={[styles.tasksToggle, { color: colors.primary }]}>{tasksCompleted ? "Resetear" : "Marcar listo"}</Text>
            </TouchableOpacity>
          </View>
        </SectionCard>

        {/* HORARIOS */}
        <SectionCard icon="clock" title="Horarios del dia" colors={colors}>
          <View style={styles.scheduleBlock}>
            <View style={styles.scheduleRow}>
              <View style={[styles.scheduleIcon, { backgroundColor: colors.destructive + "15" }]}>
                <Feather name="book-open" size={14} color={colors.destructive} />
              </View>
              <View style={styles.scheduleInfo}>
                <Text style={[styles.scheduleLabel, { color: colors.foreground }]}>Inicio colegio</Text>
                <HourMinPicker
                  hour={schedule.schoolStart} minute={schedule.schoolStartMin ?? 20}
                  onChangeHour={(h) => updateSched({ schoolStart: h })}
                  onChangeMin={(m) => updateSched({ schoolStartMin: m })}
                  colors={colors}
                />
              </View>
            </View>
            <View style={[styles.scheduleDivider, { backgroundColor: colors.border }]} />
            <View style={styles.scheduleRow}>
              <View style={[styles.scheduleIcon, { backgroundColor: colors.warning + "15" }]}>
                <Feather name="coffee" size={14} color={colors.warning} />
              </View>
              <View style={styles.scheduleInfo}>
                <Text style={[styles.scheduleLabel, { color: colors.foreground }]}>Fin colegio / Inicio almuerzo</Text>
                <HourMinPicker
                  hour={schedule.schoolEnd} minute={schedule.schoolEndMin ?? 30}
                  onChangeHour={(h) => updateSched({ schoolEnd: h })}
                  onChangeMin={(m) => updateSched({ schoolEndMin: m })}
                  colors={colors}
                />
              </View>
            </View>
            <View style={[styles.scheduleDivider, { backgroundColor: colors.border }]} />
            <View style={styles.scheduleRow}>
              <View style={[styles.scheduleIcon, { backgroundColor: colors.primary + "15" }]}>
                <Feather name="edit-3" size={14} color={colors.primary} />
              </View>
              <View style={styles.scheduleInfo}>
                <Text style={[styles.scheduleLabel, { color: colors.foreground }]}>Fin almuerzo / Inicio estudio</Text>
                <HourMinPicker
                  hour={schedule.lunchEnd ?? 15} minute={schedule.lunchEndMin ?? 30}
                  onChangeHour={(h) => updateSched({ lunchEnd: h })}
                  onChangeMin={(m) => updateSched({ lunchEndMin: m })}
                  colors={colors}
                />
              </View>
            </View>
            <View style={[styles.scheduleDivider, { backgroundColor: colors.border }]} />
            <View style={styles.scheduleRow}>
              <View style={[styles.scheduleIcon, { backgroundColor: "#6366F115" }]}>
                <Feather name="moon" size={14} color="#6366F1" />
              </View>
              <View style={styles.scheduleInfo}>
                <Text style={[styles.scheduleLabel, { color: colors.foreground }]}>Hora de dormir</Text>
                <HourMinPicker
                  hour={schedule.bedtime} minute={schedule.bedtimeMin ?? 0}
                  onChangeHour={(h) => updateSched({ bedtime: h })}
                  onChangeMin={(m) => updateSched({ bedtimeMin: m })}
                  colors={colors}
                />
              </View>
            </View>
          </View>
          <View style={[styles.scheduleNote, { backgroundColor: colors.primary + "10" }]}>
            <Feather name="info" size={12} color={colors.primary} />
            <Text style={[styles.scheduleNoteText, { color: colors.mutedForeground }]}>
              L-V: Colegio → Almuerzo (solo social) → Estudio → Libre. Fines de semana: solo libre y dormir.
            </Text>
          </View>
        </SectionCard>

        {/* SENSIBILIDAD IA */}
        <SectionCard icon="sliders" title="Sensibilidad de la IA" colors={colors}>
          <View style={styles.sensitivityRow}>
            {sensitivityLabels.map((label, i) => (
              <TouchableOpacity
                key={i} onPress={() => updateSensitivity(i)}
                style={[styles.sensitivityBtn, { backgroundColor: sensitivity === i ? colors.primary : colors.muted }]}
              >
                <Text style={[styles.sensitivityText, { color: sensitivity === i ? "#fff" : colors.mutedForeground }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.sensitivityDesc, { color: colors.mutedForeground }]}>{sensitivityDesc[sensitivity]}</Text>
        </SectionCard>

        {/* REGLAS BASE */}
        <SectionCard icon="shield" title="Reglas base por modo" colors={colors}>
          {(["school", "lunch", "study", "sleep", "free"] as AppMode[]).map((mode) => {
            const ruleTexts: Record<AppMode, string> = {
              school: "Bloquea todo excepto apps del sistema",
              lunch: "Solo apps sociales (TikTok, Instagram). Sin juegos.",
              study: "Sin juegos ni sociales. Solo educativas y neutrales. Se desbloquea al completar tareas.",
              sleep: "Bloqueo total automatico",
              free: "Solo las apps marcadas como restringidas se bloquean",
            };
            return (
              <View key={mode} style={[styles.ruleRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.ruleDot, { backgroundColor: modeColors[mode] }]} />
                <View style={styles.ruleInfo}>
                  <Text style={[styles.ruleMode, { color: colors.foreground }]}>{getModeLabel(mode)}</Text>
                  <Text style={[styles.ruleDesc, { color: colors.mutedForeground }]}>{ruleTexts[mode]}</Text>
                </View>
              </View>
            );
          })}
        </SectionCard>

        {/* APPS */}
        <Text style={[styles.listTitle, { color: colors.foreground }]}>Apps del dispositivo</Text>
        <Text style={[styles.listSub, { color: colors.mutedForeground }]}>
          Activa para restringir en modo libre. En modos colegio, estudio y dormir la IA bloquea automaticamente.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catRow}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat} onPress={() => setFilterCategory(cat)}
              style={[styles.catChip, { backgroundColor: filterCategory === cat ? colors.primary : colors.muted }]}
            >
              <Text style={[styles.catChipText, { color: filterCategory === cat ? "#fff" : colors.mutedForeground }]}>
                {categoryLabels[cat]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {filteredApps.length === 0 ? (
          <View style={[styles.emptyApps, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="smartphone" size={26} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {allApps.length === 0 ? "No se detectaron apps aun" : "No hay apps en esta categoria"}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {allApps.length === 0
                ? "Activa Acceso al uso de apps en Android y reinicia el monitoreo"
                : "Prueba con otra categoria de filtro"}
            </Text>
          </View>
        ) : (
          filteredApps.map((app) => {
            const isRestricted = restrictedApps.includes(app.packageName);
            const catColorMap: Record<string, string> = {
              social: "#F59E0B", game: colors.destructive, educational: colors.success,
              distraction: colors.destructive, neutral: colors.mutedForeground, system: colors.primary,
            };
            const catColor = catColorMap[app.category] ?? colors.mutedForeground;
            const catLabel: Record<string, string> = {
              social: "Social", game: "Juego", educational: "Educativa",
              distraction: "Distraccion", neutral: "Neutral", system: "Sistema",
            };
            return (
              <View key={app.packageName} style={[styles.appRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.appIconBox, { backgroundColor: catColor + "18" }]}>
                  <Feather name="smartphone" size={18} color={catColor} />
                </View>
                <View style={styles.appInfo}>
                  <Text style={[styles.appName, { color: colors.foreground }]}>{app.name}</Text>
                  <Text style={[styles.packageName, { color: colors.mutedForeground }]} numberOfLines={1}>{app.packageName}</Text>
                  <View style={[styles.categoryBadge, { backgroundColor: catColor + "18" }]}>
                    <Text style={[styles.categoryText, { color: catColor }]}>{catLabel[app.category] ?? "Neutral"}</Text>
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  modeChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  modeChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  scroll: { padding: 20, gap: 12 },
  section: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  summaryGrid: { flexDirection: "row", gap: 10 },
  summaryItem: { flex: 1, borderRadius: 10, padding: 12, alignItems: "center", gap: 4 },
  summaryNum: { fontSize: 22, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  tasksRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, flexWrap: "wrap" },
  tasksText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  tasksToggle: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  scheduleBlock: { gap: 0 },
  scheduleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  scheduleIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  scheduleInfo: { flex: 1, gap: 8 },
  scheduleLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  scheduleDivider: { height: 1, marginLeft: 46 },
  scheduleNote: { flexDirection: "row", alignItems: "flex-start", gap: 6, padding: 10, borderRadius: 10 },
  scheduleNoteText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  hmRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  hmUnit: { flexDirection: "row", alignItems: "center", gap: 6 },
  hmBtn: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  hmVal: { fontSize: 15, fontFamily: "Inter_700Bold", minWidth: 28, textAlign: "center" },
  hmSep: { fontSize: 16, fontFamily: "Inter_700Bold" },
  sensitivityRow: { flexDirection: "row", gap: 8 },
  sensitivityBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  sensitivityText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sensitivityDesc: { fontSize: 12, fontFamily: "Inter_400Regular" },
  ruleRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  ruleDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  ruleInfo: { flex: 1, gap: 2 },
  ruleMode: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  ruleDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  listTitle: { fontSize: 17, fontFamily: "Inter_700Bold", marginTop: 4 },
  listSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  catScroll: { marginBottom: 4 },
  catRow: { gap: 8, paddingVertical: 4 },
  catChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  catChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  emptyApps: { borderRadius: 14, padding: 22, alignItems: "center", gap: 8, borderWidth: 1 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  appRow: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, gap: 12, marginBottom: 8 },
  appIconBox: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  appInfo: { flex: 1, gap: 4 },
  appName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  packageName: { fontSize: 11, fontFamily: "Inter_400Regular" },
  categoryBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  categoryText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});
