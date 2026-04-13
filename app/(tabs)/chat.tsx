import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMonitoring } from "@/context/MonitoringContext";
import { useColors } from "@/hooks/useColors";
import {
  streamChat,
  getTodaySubjects,
  getTomorrowSubjects,
  getDayName,
  getTomorrowDayName,
  detectSubject,
  generateNightChallengeQuestion,
  checkNightChallengeAnswer,
  type ChatMessage,
  type NightChallenge,
  ALL_SIMULACRO_SUBJECTS,
} from "@/services/ai";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  isHint?: boolean;
}

function getInitialMessage(mode: string): string {
  const subjects = getTodaySubjects();
  const tomorrowSubjects = getTomorrowSubjects();
  const dayName = getDayName();
  const tomorrowName = getTomorrowDayName();

  if (mode === "study") {
    const tomorrowHint = tomorrowSubjects.length > 0
      ? ` Para desbloquear las redes sociales, necesitas estudiar: ${tomorrowSubjects.join(", ")} (materias de mañana, ${tomorrowName}).`
      : "";
    if (subjects.length > 0) {
      return `Hola Jefferson! Hoy es ${dayName} y tienes: ${subjects.join(", ")}. ¿En cuál necesitas ayuda? No te daré las respuestas directas, pero sí buenas pistas. A las 7 PM tienes tiempo libre para juegos y redes.${tomorrowHint}`;
    }
    return `Hola Jefferson! Estoy aquí para ayudarte con tus tareas. ¿En qué materia necesitas ayuda? A las 7 PM es tu tiempo libre.${tomorrowHint}`;
  }
  if (mode === "school") {
    return "Estás en horario escolar. Puedo ayudarte con dudas de clase si necesitas. ¿Qué necesitas?";
  }
  if (mode === "sleep") {
    return "Es hora de descansar, Jefferson. Si quieres 10 minutos más, resuelve el reto que te muestro. ¡Buenas noches!";
  }
  if (mode === "free" || mode === "lunch") {
    if (subjects.length > 0) {
      return `Hola Jefferson! Hoy es ${dayName}. Tienes estas materias: ${subjects.join(", ")}. Si tienes alguna tarea o duda, cuéntame. También puedes preguntarme sobre el simulacro.`;
    }
    return "Hola Jefferson! Soy tu tutor IA. Si tienes tareas o dudas, cuéntame y te guío. También puedo ayudarte a preparar el simulacro.";
  }
  return "Hola, soy Guardian IA. Puedo ayudarte con tareas, el simulacro o revisar el uso de apps. ¿Qué necesitas?";
}

function ModeTag({ mode, colors }: { mode: string; colors: ReturnType<typeof useColors> }) {
  if (mode === "study") {
    return (
      <View style={[styles.modeTag, { backgroundColor: colors.primary + "18" }]}>
        <Feather name="edit-3" size={11} color={colors.primary} />
        <Text style={[styles.modeTagText, { color: colors.primary }]}>Tutor de estudio</Text>
      </View>
    );
  }
  if (mode === "school") {
    return (
      <View style={[styles.modeTag, { backgroundColor: colors.destructive + "18" }]}>
        <Feather name="book-open" size={11} color={colors.destructive} />
        <Text style={[styles.modeTagText, { color: colors.destructive }]}>Modo colegio</Text>
      </View>
    );
  }
  if (mode === "sleep") {
    return (
      <View style={[styles.modeTag, { backgroundColor: "#6366F118" }]}>
        <Feather name="moon" size={11} color="#6366F1" />
        <Text style={[styles.modeTagText, { color: "#6366F1" }]}>Modo dormir</Text>
      </View>
    );
  }
  return null;
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getUsageContext, currentMode, tasksCompleted, setTasksCompleted, markSubjectDone, grantNightExtraTime, sleepOverrideUntil } = useMonitoring();

  const [messages, setMessages] = useState<Message[]>([
    { id: "0", role: "assistant", content: getInitialMessage(currentMode) },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const flatRef = useRef<FlatList>(null);

  // Night challenge state
  const [nightChallenge, setNightChallenge] = useState<NightChallenge | null>(null);
  const [nightChallengeInput, setNightChallengeInput] = useState("");
  const [nightChallengeResult, setNightChallengeResult] = useState<"none" | "correct" | "wrong">("none");
  const [nightChallengeUsed, setNightChallengeUsed] = useState(false);
  const [nightModalVisible, setNightModalVisible] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 16 : insets.bottom + 16;

  const isStudyMode = currentMode === "study";
  const isSleepMode = currentMode === "sleep";
  const tomorrowSubjects = getTomorrowSubjects();
  const todaySubjects = getTodaySubjects();

  function openNightChallenge() {
    const subjects = tomorrowSubjects.length > 0 ? tomorrowSubjects : todaySubjects;
    const challenge = generateNightChallengeQuestion(subjects.length > 0 ? subjects : ALL_SIMULACRO_SUBJECTS);
    setNightChallenge(challenge);
    setNightChallengeInput("");
    setNightChallengeResult("none");
    setNightModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function submitNightChallengeAnswer() {
    if (!nightChallenge || !nightChallengeInput.trim()) return;
    const correct = checkNightChallengeAnswer(nightChallenge.correctAnswer, nightChallengeInput.trim());
    setNightChallengeResult(correct ? "correct" : "wrong");
    if (correct) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        setNightModalVisible(false);
        setNightChallengeUsed(true);
        grantNightExtraTime();
      }, 1500);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    Haptics.selectionAsync();

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    const asstId = (Date.now() + 1).toString();
    const asstMsg: Message = { id: asstId, role: "assistant", content: "", streaming: true, isHint: isStudyMode };

    setMessages((prev) => [...prev, userMsg, asstMsg]);
    setLoading(true);

    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);

    // Auto-detect subject and mark as done
    const allRelevant = [...new Set([...tomorrowSubjects, ...todaySubjects, ...ALL_SIMULACRO_SUBJECTS])];
    const detected = detectSubject(text, allRelevant);
    if (detected && tomorrowSubjects.includes(detected)) {
      markSubjectDone(detected);
    }

    const history: ChatMessage[] = messages.map((m) => ({ role: m.role, content: m.content }));
    const ctx = getUsageContext();

    try {
      await streamChat(
        text,
        history,
        ctx,
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) => m.id === asstId ? { ...m, content: m.content + chunk } : m)
          );
          setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 50);
        },
        () => {
          setMessages((prev) =>
            prev.map((m) => m.id === asstId ? { ...m, streaming: false } : m)
          );
          setLoading(false);
        }
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstId ? { ...m, content: "Error al conectar. Revisa tu conexion.", streaming: false } : m
        )
      );
      setLoading(false);
    }
  }

  function renderMessage({ item }: { item: Message }) {
    const isUser = item.role === "user";
    return (
      <View style={[styles.msgWrap, isUser ? styles.msgRight : styles.msgLeft]}>
        {!isUser && (
          <View style={[styles.avatar, { backgroundColor: isSleepMode ? "#6366F1" : colors.primary }]}>
            <Feather name={isSleepMode ? "moon" : isStudyMode ? "edit-3" : "shield"} size={13} color="#fff" />
          </View>
        )}
        <View>
          {!isUser && item.isHint && (
            <View style={[styles.hintLabel, { backgroundColor: colors.primary + "18" }]}>
              <Feather name="lightbulb" size={10} color={colors.primary} />
              <Text style={[styles.hintLabelText, { color: colors.primary }]}>Pista del tutor</Text>
            </View>
          )}
          <View style={[styles.bubble, { backgroundColor: isUser ? colors.primary : colors.card, borderColor: isUser ? colors.primary : colors.border, maxWidth: 260 }]}>
            <Text style={[styles.bubbleText, { color: isUser ? "#fff" : colors.foreground }]}>
              {item.content || (item.streaming ? "..." : "")}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const canRequestNightTime = isSleepMode && !nightChallengeUsed && !sleepOverrideUntil;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.avatarLarge, { backgroundColor: isSleepMode ? "#6366F1" : colors.primary }]}>
          <Feather name={isSleepMode ? "moon" : isStudyMode ? "edit-3" : "shield"} size={20} color="#fff" />
        </View>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {isSleepMode ? "Guardian Nocturno" : isStudyMode ? "Tutor IA" : "Guardian IA"}
          </Text>
          <View style={styles.headerSub}>
            <View style={[styles.onlineDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.onlineText, { color: colors.success }]}>En linea</Text>
          </View>
        </View>
        <ModeTag mode={currentMode} colors={colors} />
      </View>

      {/* BANNER MODO DORMIR */}
      {isSleepMode && (
        <View style={[styles.sleepBanner, { backgroundColor: "#6366F110", borderBottomColor: "#6366F130" }]}>
          <Feather name="moon" size={13} color="#6366F1" />
          <Text style={[styles.sleepBannerText, { color: "#6366F1" }]}>
            {sleepOverrideUntil
              ? "Tienes 10 minutos extra. ¡Disfrútalos!"
              : "Es hora de dormir. El dispositivo está bloqueado."}
          </Text>
          {canRequestNightTime && (
            <TouchableOpacity
              onPress={openNightChallenge}
              style={[styles.nightBtn, { backgroundColor: "#6366F1" }]}
            >
              <Text style={styles.nightBtnText}>Pedir 10 min más</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* BANNER MODO ESTUDIO */}
      {isStudyMode && (
        <View style={[styles.studyBanner, { backgroundColor: colors.primary + "10", borderBottomColor: colors.primary + "30" }]}>
          <Feather name="info" size={13} color={colors.primary} />
          <Text style={[styles.studyBannerText, { color: colors.primary }]}>
            {tasksCompleted
              ? "¡Tareas listas! El entretenimiento está desbloqueado."
              : "Estudia cada materia de mañana aquí para desbloquear juegos y redes."}
          </Text>
          {!tasksCompleted && (
            <TouchableOpacity
              onPress={() => setTasksCompleted(true)}
              style={[styles.doneBtn, { backgroundColor: colors.success }]}
            >
              <Text style={styles.doneBtnText}>Listo</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        contentContainerStyle={[styles.list, { paddingBottom: 16 }]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: botPad }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          placeholder={isStudyMode ? "Escribe tu pregunta de tarea..." : isSleepMode ? "Escríbeme si necesitas algo..." : "Escribe tu pregunta..."}
          placeholderTextColor={colors.mutedForeground}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          onSubmitEditing={send}
        />
        <TouchableOpacity
          onPress={send}
          disabled={!input.trim() || loading}
          style={[styles.sendBtn, { backgroundColor: input.trim() && !loading ? colors.primary : colors.muted }]}
        >
          <Feather name="send" size={18} color={input.trim() && !loading ? "#fff" : colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* MODAL RETO NOCTURNO */}
      <Modal
        visible={nightModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNightModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: "#6366F118" }]}>
                <Feather name="moon" size={22} color="#6366F1" />
              </View>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Reto Nocturno</Text>
              <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
                Responde correctamente y ganas 10 minutos libres.
              </Text>
            </View>

            {nightChallenge && (
              <>
                <View style={[styles.questionBox, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.questionSubject, { color: colors.primary }]}>{nightChallenge.subject}</Text>
                  <Text style={[styles.questionText, { color: colors.foreground }]}>{nightChallenge.question}</Text>
                  <View style={[styles.hintBox, { backgroundColor: "#6366F110" }]}>
                    <Feather name="lightbulb" size={12} color="#6366F1" />
                    <Text style={[styles.hintText, { color: "#6366F1" }]}>Pista: {nightChallenge.hint}</Text>
                  </View>
                </View>

                <TextInput
                  style={[styles.challengeInput, {
                    backgroundColor: colors.muted,
                    color: colors.foreground,
                    borderColor: nightChallengeResult === "correct" ? colors.success
                      : nightChallengeResult === "wrong" ? colors.destructive
                      : colors.border,
                  }]}
                  placeholder="Tu respuesta..."
                  placeholderTextColor={colors.mutedForeground}
                  value={nightChallengeInput}
                  onChangeText={(t) => {
                    setNightChallengeInput(t);
                    setNightChallengeResult("none");
                  }}
                  autoFocus
                />

                {nightChallengeResult === "correct" && (
                  <View style={[styles.resultBanner, { backgroundColor: colors.success + "18" }]}>
                    <Feather name="check-circle" size={16} color={colors.success} />
                    <Text style={[styles.resultText, { color: colors.success }]}>¡Correcto! Tienes 10 minutos libres.</Text>
                  </View>
                )}
                {nightChallengeResult === "wrong" && (
                  <View style={[styles.resultBanner, { backgroundColor: colors.destructive + "18" }]}>
                    <Feather name="x-circle" size={16} color={colors.destructive} />
                    <Text style={[styles.resultText, { color: colors.destructive }]}>Intenta de nuevo. Revisa la pista.</Text>
                  </View>
                )}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    onPress={() => setNightModalVisible(false)}
                    style={[styles.cancelBtn, { backgroundColor: colors.muted }]}
                  >
                    <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={submitNightChallengeAnswer}
                    disabled={!nightChallengeInput.trim()}
                    style={[styles.submitBtn, { backgroundColor: nightChallengeInput.trim() ? "#6366F1" : colors.muted }]}
                  >
                    <Text style={[styles.submitBtnText, { color: nightChallengeInput.trim() ? "#fff" : colors.mutedForeground }]}>
                      Responder
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  headerInfo: { flex: 1, gap: 2 },
  avatarLarge: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  headerSub: { flexDirection: "row", alignItems: "center", gap: 4 },
  onlineDot: { width: 6, height: 6, borderRadius: 3 },
  onlineText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  modeTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  modeTagText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  sleepBanner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, flexWrap: "wrap" },
  sleepBannerText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  nightBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  nightBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  studyBanner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, flexWrap: "wrap" },
  studyBannerText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  doneBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  doneBtnText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  list: { padding: 16, gap: 12 },
  msgWrap: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  msgLeft: { justifyContent: "flex-start" },
  msgRight: { justifyContent: "flex-end" },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  hintLabel: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginBottom: 4, alignSelf: "flex-start" },
  hintLabelText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  bubble: { padding: 12, borderRadius: 16, borderWidth: 1 },
  bubbleText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", padding: 12, paddingTop: 12, gap: 10, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, fontFamily: "Inter_400Regular", borderWidth: 1, maxHeight: 100 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  // Night challenge modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: { borderRadius: 20, padding: 24, width: "100%", maxWidth: 380, gap: 16 },
  modalHeader: { alignItems: "center", gap: 8 },
  modalIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  modalSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  questionBox: { borderRadius: 14, padding: 16, gap: 8 },
  questionSubject: { fontSize: 12, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.8 },
  questionText: { fontSize: 16, fontFamily: "Inter_600SemiBold", lineHeight: 22 },
  hintBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, padding: 8, borderRadius: 8 },
  hintText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
  challengeInput: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontFamily: "Inter_400Regular", borderWidth: 2 },
  resultBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10 },
  resultText: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  modalActions: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  cancelBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  submitBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  submitBtnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
});
