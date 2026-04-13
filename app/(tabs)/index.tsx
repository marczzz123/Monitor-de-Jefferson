import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PermissionSetupPrompt } from "@/components/PermissionSetupPrompt";
import {
  getModeDescription,
  getModeLabel,
  isModeBlocked,
  type AppMode,
  useMonitoring,
} from "@/context/MonitoringContext";
import { useColors } from "@/hooks/useColors";
import { analyzeApp } from "@/services/ai";

function PulsingDot({ active, colors }: { active: boolean; colors: ReturnType<typeof useColors> }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (active) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.6, duration: 900, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else { pulse.setValue(1); }
  }, [active, pulse]);

  return (
    <View style={styles.dotWrap}>
      <Animated.View style={[styles.dotRing, { backgroundColor: (active ? colors.success : colors.mutedForeground) + "30", transform: [{ scale: pulse }] }]} />
      <View style={[styles.dot, { backgroundColor: active ? colors.success : colors.mutedForeground }]} />
    </View>
  );
}

function ModeBadge({ mode, colors }: { mode: AppMode; colors: ReturnType<typeof useColors> }) {
  const modeColors: Record<AppMode, string> = {
    school: "#EF4444",
    lunch: "#F59E0B",
    study: "#3B82F6",
    sleep: "#6366F1",
    free: "#22C55E",
  };
  const modeIcons: Record<AppMode, string> = {
    school: "book-open",
    lunch: "coffee",
    study: "edit-3",
    sleep: "moon",
    free: "sun",
  };
  const color = modeColors[mode];
  return (
    <View style={[styles.modeBadge, { backgroundColor: color + "18", borderColor: color + "40" }]}>
      <Feather name={modeIcons[mode] as any} size={13} color={color} />
      <Text style={[styles.modeBadgeText, { color }]}>{getModeLabel(mode)}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    isMonitoring,
    currentApp,
    currentMode,
    todayUsage,
    recentActions,
    blockAttempts,
    restrictedApps,
    schedule,
    tasksCompleted,
    addAction,
    addBlockAttempt,
    allApps,
  } = useMonitoring();

  const [analyzing, setAnalyzing] = useState(false);
  const [lastDecision, setLastDecision] = useState<{ decision: string; reason: string } | null>(null);

  const totalMinutes = todayUsage.reduce((s, u) => s + u.minutes, 0);
  const blockedToday = recentActions.filter((a) => a.action === "close").length;
  const warnedToday = recentActions.filter((a) => a.action === "warn").length;
  const blockedApps = allApps.filter(a => isModeBlocked(currentMode, a.packageName, a.name, restrictedApps));
  const allowedApps = allApps.filter(a => !isModeBlocked(currentMode, a.packageName, a.name, restrictedApps));

  const analyzeCurrentApp = useCallback(async () => {
    if (!currentApp || analyzing) return;
    setAnalyzing(true);
    try {
      const now = new Date();
      const hour = now.getHours();
      const usage = todayUsage.find((u) => u.packageName === currentApp.packageName);
      const schoolStart = schedule.schoolStart * 60 + (schedule.schoolStartMin ?? 0);
      const schoolEnd = schedule.schoolEnd * 60 + (schedule.schoolEndMin ?? 30);
      const bedtime = schedule.bedtime * 60 + (schedule.bedtimeMin ?? 0);
      const totalMin = hour * 60 + now.getMinutes();

      const result = await analyzeApp({
        appName: currentApp.name,
        packageName: currentApp.packageName,
        usageMinutes: usage?.minutes ?? 0,
        timeOfDay: `${hour}:${String(now.getMinutes()).padStart(2, "0")}`,
        isSchoolHours: totalMin >= schoolStart && totalMin < schoolEnd,
        isNightTime: totalMin >= bedtime,
        currentMode,
        restrictedApps,
        tasksCompleted,
      });

      setLastDecision({ decision: result.decision, reason: result.reason });

      if (result.decision === "close" || result.decision === "warn") {
        Haptics.notificationAsync(
          result.decision === "close"
            ? Haptics.NotificationFeedbackType.Error
            : Haptics.NotificationFeedbackType.Warning
        );
        addAction({
          id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
          appName: currentApp.name,
          action: result.decision,
          reason: result.reason,
          message: result.message,
          timestamp: Date.now(),
          mode: currentMode,
        });
        if (result.decision === "close") {
          addBlockAttempt({
            appName: currentApp.name,
            packageName: currentApp.packageName,
            timestamp: Date.now(),
            mode: currentMode,
            reason: result.reason,
          });
        }
      }
    } catch {}
    setAnalyzing(false);
  }, [currentApp, analyzing, todayUsage, schedule, restrictedApps, currentMode, tasksCompleted, addAction, addBlockAttempt]);

  useEffect(() => {
    if (currentApp && isMonitoring) { analyzeCurrentApp(); }
  }, [currentApp]);

  const decisionColor =
    lastDecision?.decision === "close" ? colors.destructive
    : lastDecision?.decision === "warn" ? colors.warning
    : colors.success;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const modeDescColor: Record<AppMode, string> = {
    school: colors.destructive,
    lunch: colors.warning,
    study: colors.primary,
    sleep: "#6366F1",
    free: colors.success,
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <PermissionSetupPrompt />
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Guardian</Text>
          <View style={styles.statusRow}>
            <PulsingDot active={isMonitoring} colors={colors} />
            <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
              {isMonitoring ? "Protección activa" : "Iniciando..."}
            </Text>
          </View>
        </View>
        <View style={[styles.activeChip, { backgroundColor: colors.success + "18" }]}>
          <Feather name="shield" size={14} color={colors.success} />
          <Text style={[styles.activeChipText, { color: colors.success }]}>IA activa</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 100 }]} showsVerticalScrollIndicator={false}>
        
        {/* MODO ACTUAL */}
        <View style={[styles.modeCard, { backgroundColor: modeDescColor[currentMode] + "12", borderColor: modeDescColor[currentMode] + "30" }]}>
          <View style={styles.modeCardTop}>
            <ModeBadge mode={currentMode} colors={colors} />
            <Text style={[styles.modeDesc, { color: modeDescColor[currentMode] }]}>
              {getModeDescription(currentMode)}
            </Text>
          </View>
          <Text style={[styles.modeHint, { color: colors.mutedForeground }]}>
            La IA actualiza el modo automaticamente segun la hora
          </Text>
        </View>

        {/* APP ACTUAL */}
        <View style={[styles.currentAppCard, { backgroundColor: colors.primary }]}>
          <Text style={styles.currentLabel}>App actual</Text>
          {isMonitoring && currentApp ? (
            <>
              <Text style={styles.currentAppName}>{currentApp.name}</Text>
              {analyzing ? (
                <View style={styles.analyzingRow}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.analyzingText}>IA analizando...</Text>
                </View>
              ) : lastDecision ? (
                <View style={[styles.decisionBadge, { backgroundColor: decisionColor }]}>
                  <Feather
                    name={lastDecision.decision === "close" ? "x-circle" : lastDecision.decision === "warn" ? "alert-triangle" : "check-circle"}
                    size={13} color="#fff"
                  />
                  <Text style={styles.decisionText}>
                    {lastDecision.decision === "close" ? "Cerrada" : lastDecision.decision === "warn" ? "Advertencia" : "Permitida"}
                  </Text>
                </View>
              ) : null}
              {lastDecision && <Text style={styles.currentReason} numberOfLines={2}>{lastDecision.reason}</Text>}
            </>
          ) : (
            <Text style={styles.noAppText}>{isMonitoring ? "Esperando actividad..." : "Inicia el monitoreo"}</Text>
          )}
        </View>

        {/* ESTADISTICAS */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="clock" size={18} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.foreground }]}>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Uso total hoy</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="x-circle" size={18} color={colors.destructive} />
            <Text style={[styles.statValue, { color: colors.foreground }]}>{blockedToday}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Bloqueadas hoy</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="alert-triangle" size={18} color={colors.warning} />
            <Text style={[styles.statValue, { color: colors.foreground }]}>{warnedToday}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Advertencias</Text>
          </View>
        </View>

        {/* PANEL ADMIN: APPS */}
        <View style={[styles.adminCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.adminCardHeader}>
            <Feather name="shield" size={15} color={colors.primary} />
            <Text style={[styles.adminCardTitle, { color: colors.foreground }]}>Estado del dispositivo</Text>
          </View>
          <View style={styles.adminRow}>
            <View style={styles.adminItem}>
              <Feather name="check-circle" size={14} color={colors.success} />
              <Text style={[styles.adminItemText, { color: colors.mutedForeground }]}>{allowedApps.length} permitidas</Text>
            </View>
            <View style={styles.adminItem}>
              <Feather name="x-circle" size={14} color={colors.destructive} />
              <Text style={[styles.adminItemText, { color: colors.mutedForeground }]}>{blockedApps.length} restringidas</Text>
            </View>
            <View style={styles.adminItem}>
              <Feather name="smartphone" size={14} color={colors.warning} />
              <Text style={[styles.adminItemText, { color: colors.mutedForeground }]}>{allApps.length} instaladas</Text>
            </View>
          </View>
          <View style={[styles.adminDivider, { backgroundColor: colors.border }]} />
          <View style={styles.adminRow}>
            <View style={styles.adminItem}>
              <Feather name="eye" size={14} color={colors.primary} />
              <Text style={[styles.adminItemText, { color: colors.mutedForeground }]}>{blockAttempts.length} intentos bloqueados</Text>
            </View>
            <View style={styles.adminItem}>
              <Feather name="book" size={14} color={tasksCompleted ? colors.success : colors.warning} />
              <Text style={[styles.adminItemText, { color: colors.mutedForeground }]}>
                {tasksCompleted ? "Tareas completadas" : "Tareas pendientes"}
              </Text>
            </View>
          </View>
        </View>

        {/* INTENTOS DE BLOQUEO RECIENTES */}
        {blockAttempts.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Intentos de apertura bloqueados</Text>
            {blockAttempts.slice(0, 5).map((attempt) => (
              <View key={attempt.id} style={[styles.actionRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.actionIcon, { backgroundColor: colors.destructive + "18" }]}>
                  <Feather name="lock" size={15} color={colors.destructive} />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={[styles.actionApp, { color: colors.foreground }]}>{attempt.appName}</Text>
                  <Text style={[styles.actionReason, { color: colors.mutedForeground }]} numberOfLines={1}>{attempt.reason}</Text>
                </View>
                <Text style={[styles.actionTime, { color: colors.mutedForeground }]}>
                  {new Date(attempt.timestamp).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* ACCIONES RECIENTES */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Acciones recientes de la IA</Text>
        {recentActions.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="shield" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Sin acciones aun. Inicia el monitoreo.</Text>
          </View>
        ) : (
          recentActions.slice(0, 6).map((action) => {
            const color = action.action === "close" ? colors.destructive : action.action === "warn" ? colors.warning : colors.success;
            const icon = action.action === "close" ? "x-circle" : action.action === "warn" ? "alert-triangle" : "check-circle";
            return (
              <View key={action.id} style={[styles.actionRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.actionIcon, { backgroundColor: color + "20" }]}>
                  <Feather name={icon as any} size={16} color={color} />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={[styles.actionApp, { color: colors.foreground }]}>{action.appName}</Text>
                  <Text style={[styles.actionReason, { color: colors.mutedForeground }]} numberOfLines={1}>{action.reason}</Text>
                </View>
                <Text style={[styles.actionTime, { color: colors.mutedForeground }]}>
                  {new Date(action.timestamp).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                </Text>
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
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  headerLeft: { gap: 4 },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  dotWrap: { width: 14, height: 14, alignItems: "center", justifyContent: "center" },
  dotRing: { position: "absolute", width: 14, height: 14, borderRadius: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  activeChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  activeChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  scroll: { padding: 20, gap: 12 },
  modeCard: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 8 },
  modeCardTop: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  modeBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  modeBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  modeDesc: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  modeHint: { fontSize: 11, fontFamily: "Inter_400Regular" },
  currentAppCard: { borderRadius: 18, padding: 22, gap: 8, marginBottom: 4 },
  currentLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.8 },
  currentAppName: { color: "#fff", fontSize: 26, fontFamily: "Inter_700Bold" },
  noAppText: { color: "rgba(255,255,255,0.8)", fontSize: 16, fontFamily: "Inter_400Regular" },
  analyzingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  analyzingText: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontFamily: "Inter_400Regular" },
  decisionBadge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  decisionText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  currentReason: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontFamily: "Inter_400Regular" },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  statCard: { flex: 1, borderRadius: 14, padding: 14, alignItems: "center", gap: 6, borderWidth: 1 },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  adminCard: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 12 },
  adminCardHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  adminCardTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  adminRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  adminItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  adminItemText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  adminDivider: { height: 1 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 4 },
  emptyCard: { borderRadius: 14, padding: 28, alignItems: "center", gap: 10, borderWidth: 1 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  actionRow: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, gap: 12 },
  actionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  actionInfo: { flex: 1, gap: 2 },
  actionApp: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  actionReason: { fontSize: 12, fontFamily: "Inter_400Regular" },
  actionTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
