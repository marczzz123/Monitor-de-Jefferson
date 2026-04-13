import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
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
import { streamChat, getTodaySubjects, getDayName, type ChatMessage } from "@/services/ai";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  isHint?: boolean;
}

function getInitialMessage(mode: string): string {
  const subjects = getTodaySubjects();
  const dayName = getDayName();

  if (mode === "study") {
    if (subjects.length > 0) {
      return `Hola Jefferson! Hoy es ${dayName} y tienes: ${subjects.join(", ")}. ¿En cuál necesitas ayuda? No te daré las respuestas directas, pero sí buenas pistas. A las 7 PM tienes tiempo libre para juegos y redes.`;
    }
    return "Hola Jefferson! Estoy aquí para ayudarte con tus tareas. No te daré respuestas directas, sino pistas. ¿En qué materia necesitas ayuda? A las 7 PM es tu tiempo libre.";
  }
  if (mode === "school") {
    return "Estás en horario escolar. Puedo ayudarte con dudas de clase si necesitas. ¿Qué necesitas?";
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
  return null;
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getUsageContext, currentMode, tasksCompleted, setTasksCompleted } = useMonitoring();

  const [messages, setMessages] = useState<Message[]>([
    { id: "0", role: "assistant", content: getInitialMessage(currentMode) },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const flatRef = useRef<FlatList>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 16 : insets.bottom + 16;

  const isStudyMode = currentMode === "study";

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
          <View style={[styles.avatar, { backgroundColor: isStudyMode ? colors.primary : colors.primary }]}>
            <Feather name={isStudyMode ? "edit-3" : "shield"} size={13} color="#fff" />
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

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.avatarLarge, { backgroundColor: colors.primary }]}>
          <Feather name={isStudyMode ? "edit-3" : "shield"} size={20} color="#fff" />
        </View>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {isStudyMode ? "Tutor IA" : "Guardian IA"}
          </Text>
          <View style={styles.headerSub}>
            <View style={[styles.onlineDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.onlineText, { color: colors.success }]}>En linea</Text>
          </View>
        </View>
        <ModeTag mode={currentMode} colors={colors} />
      </View>

      {isStudyMode && (
        <View style={[styles.studyBanner, { backgroundColor: colors.primary + "10", borderBottomColor: colors.primary + "30" }]}>
          <Feather name="info" size={13} color={colors.primary} />
          <Text style={[styles.studyBannerText, { color: colors.primary }]}>
            El tutor te guia con pistas, no da la respuesta directa
          </Text>
          {!tasksCompleted && (
            <TouchableOpacity
              onPress={() => setTasksCompleted(true)}
              style={[styles.doneBtn, { backgroundColor: colors.success }]}
            >
              <Text style={styles.doneBtnText}>Termine mis tareas</Text>
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
          placeholder={isStudyMode ? "Escribe tu pregunta de tarea..." : "Escribe tu pregunta..."}
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
});
