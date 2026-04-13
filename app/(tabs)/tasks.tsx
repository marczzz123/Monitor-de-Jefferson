import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMonitoring } from "@/context/MonitoringContext";
import { useColors } from "@/hooks/useColors";
import { getTomorrowSubjects, getTomorrowDayName, getTodaySubjects, getDayName } from "@/services/ai";

export default function TasksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    subjectsDone,
    markSubjectDone,
    resetSubjectsDone,
    schedule,
    tasksCompleted,
    currentMode,
  } = useMonitoring();

  const tomorrowSubjects = getTomorrowSubjects();
  const todaySubjects = getTodaySubjects();
  const tomorrowName = getTomorrowDayName();
  const todayName = getDayName();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const gamesStartLabel = `${schedule.gamesStart ?? 19}:${String(schedule.gamesStartMin ?? 0).padStart(2, "0")} PM`;
  const doneCount = tomorrowSubjects.filter(s => subjectsDone[s]).length;
  const totalCount = tomorrowSubjects.length;

  const progressPct = totalCount === 0 ? 100 : Math.round((doneCount / totalCount) * 100);

  const isWeekend = [0, 6].includes(new Date().getDay());

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Tareas</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Para mañana ({tomorrowName})
          </Text>
        </View>
        {doneCount > 0 && (
          <TouchableOpacity onPress={resetSubjectsDone} style={[styles.resetBtn, { backgroundColor: colors.muted }]}>
            <Feather name="rotate-ccw" size={13} color={colors.mutedForeground} />
            <Text style={[styles.resetBtnText, { color: colors.mutedForeground }]}>Resetear</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 100 }]} showsVerticalScrollIndicator={false}>

        {/* ESTADO DE DESBLOQUEO */}
        <View style={[styles.unlockCard, {
          backgroundColor: tasksCompleted ? colors.success + "12" : colors.warning + "12",
          borderColor: tasksCompleted ? colors.success + "40" : colors.warning + "40",
        }]}>
          <View style={styles.unlockRow}>
            <Feather
              name={tasksCompleted ? "unlock" : "lock"}
              size={20}
              color={tasksCompleted ? colors.success : colors.warning}
            />
            <View style={styles.unlockInfo}>
              <Text style={[styles.unlockTitle, { color: tasksCompleted ? colors.success : colors.warning }]}>
                {tasksCompleted ? "¡Entretenimiento desbloqueado!" : "Juegos y redes bloqueados"}
              </Text>
              <Text style={[styles.unlockDesc, { color: colors.mutedForeground }]}>
                {tasksCompleted
                  ? "Completaste todas las materias de mañana. Los juegos y las redes sociales están disponibles."
                  : "Estudia cada materia de mañana con el tutor IA para desbloquear los juegos y las redes sociales."
                }
              </Text>
            </View>
          </View>

          {/* UNA SOLA CONDICIÓN */}
          <View style={styles.conditionsRow}>
            <View style={[styles.conditionChip, {
              backgroundColor: tasksCompleted ? colors.success + "20" : colors.muted,
            }]}>
              <Feather name={tasksCompleted ? "check-circle" : "book"} size={12} color={tasksCompleted ? colors.success : colors.mutedForeground} />
              <Text style={[styles.conditionText, { color: tasksCompleted ? colors.success : colors.mutedForeground }]}>
                {tasksCompleted ? "Todas las materias completadas" : `${doneCount}/${totalCount} materias completadas`}
              </Text>
            </View>
          </View>
        </View>

        {/* BARRA DE PROGRESO */}
        {tomorrowSubjects.length > 0 && (
          <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressTitle, { color: colors.foreground }]}>Progreso</Text>
              <Text style={[styles.progressCount, { color: colors.primary }]}>{doneCount}/{totalCount}</Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: colors.muted }]}>
              <View style={[styles.progressFill, {
                width: `${progressPct}%` as any,
                backgroundColor: progressPct === 100 ? colors.success : colors.primary,
              }]} />
            </View>
            <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
              {progressPct === 100 ? "¡Todas las materias completadas!" : `${progressPct}% completado`}
            </Text>
          </View>
        )}

        {/* MATERIAS DE MAÑANA */}
        {tomorrowSubjects.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Materias del {tomorrowName}
            </Text>
            <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
              Habla con el tutor IA sobre cada materia para marcarla como estudiada.
            </Text>
            {tomorrowSubjects.map((subject) => {
              const done = !!subjectsDone[subject];
              return (
                <View key={subject} style={[styles.subjectRow, {
                  backgroundColor: colors.card,
                  borderColor: done ? colors.success + "40" : colors.border,
                }]}>
                  <View style={[styles.subjectIconBox, {
                    backgroundColor: done ? colors.success + "18" : colors.primary + "15",
                  }]}>
                    <Feather
                      name={done ? "check-circle" : "book"}
                      size={18}
                      color={done ? colors.success : colors.primary}
                    />
                  </View>
                  <View style={styles.subjectInfo}>
                    <Text style={[styles.subjectName, { color: colors.foreground }]}>{subject}</Text>
                    <Text style={[styles.subjectStatus, { color: done ? colors.success : colors.mutedForeground }]}>
                      {done ? "Estudiado con el tutor" : "Pendiente"}
                    </Text>
                  </View>
                  {done ? (
                    <View style={[styles.doneBadge, { backgroundColor: colors.success + "18" }]}>
                      <Feather name="check" size={14} color={colors.success} />
                      <Text style={[styles.doneBadgeText, { color: colors.success }]}>Listo</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => router.push("/(tabs)/chat")}
                      style={[styles.studyBtn, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}
                    >
                      <Feather name="message-circle" size={13} color={colors.primary} />
                      <Text style={[styles.studyBtnText, { color: colors.primary }]}>Estudiar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </>
        ) : isWeekend ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="sun" size={32} color={colors.success} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>¡Es fin de semana!</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No hay materias mañana. Disfruta tu tiempo libre.
            </Text>
          </View>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="calendar" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sin materias mañana</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No hay materias programadas para mañana.
            </Text>
          </View>
        )}

        {/* MATERIAS DE HOY (referencia) */}
        {todaySubjects.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 8 }]}>
              Materias de hoy ({todayName})
            </Text>
            <View style={[styles.todayCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {todaySubjects.map((s, i) => (
                <View key={s} style={[styles.todayRow, i < todaySubjects.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <Feather name="book-open" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.todaySubject, { color: colors.foreground }]}>{s}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* NOTA */}
        <View style={[styles.noteCard, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "20" }]}>
          <Feather name="info" size={13} color={colors.primary} />
          <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
            Las materias se marcan automáticamente cuando hablas del tema con el Tutor IA. Cuando termines todas las materias de mañana, los juegos y las redes se desbloquean solos.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  resetBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  resetBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  scroll: { padding: 20, gap: 12 },
  unlockCard: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 12 },
  unlockRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  unlockInfo: { flex: 1, gap: 4 },
  unlockTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  unlockDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  conditionsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  conditionChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  conditionText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  progressCard: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 10 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  progressCount: { fontSize: 14, fontFamily: "Inter_700Bold" },
  progressBar: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  progressLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 4 },
  sectionHint: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, marginTop: -4 },
  subjectRow: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, gap: 12 },
  subjectIconBox: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  subjectInfo: { flex: 1, gap: 3 },
  subjectName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  subjectStatus: { fontSize: 12, fontFamily: "Inter_400Regular" },
  doneBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  doneBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  studyBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  studyBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  emptyCard: { borderRadius: 14, padding: 28, alignItems: "center", gap: 10, borderWidth: 1 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  todayCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  todayRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  todaySubject: { fontSize: 14, fontFamily: "Inter_500Medium" },
  noteCard: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  noteText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
});
