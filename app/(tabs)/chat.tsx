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
import { streamChat, type ChatMessage } from "@/services/ai";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getUsageContext } = useMonitoring();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "0",
      role: "assistant",
      content:
        "Hola, soy Guardian. Puedo ayudarte a entender el uso de apps de tu hermano y tomar decisiones. Preguntame lo que necesites.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const flatRef = useRef<FlatList>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 16 : insets.bottom + 16;

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    Haptics.selectionAsync();

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    const asstId = (Date.now() + 1).toString();
    const asstMsg: Message = { id: asstId, role: "assistant", content: "", streaming: true };

    setMessages((prev) => [...prev, userMsg, asstMsg]);
    setLoading(true);

    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);

    const history: ChatMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      await streamChat(
        text,
        history,
        getUsageContext(),
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstId ? { ...m, content: m.content + chunk } : m
            )
          );
          setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 50);
        },
        () => {
          setMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, streaming: false } : m))
          );
          setLoading(false);
        }
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstId
            ? { ...m, content: "Error al conectar. Revisa tu conexion.", streaming: false }
            : m
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
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Feather name="shield" size={14} color="#fff" />
          </View>
        )}
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: isUser ? colors.primary : colors.card,
              borderColor: isUser ? colors.primary : colors.border,
              maxWidth: "78%",
            },
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              { color: isUser ? "#fff" : colors.foreground },
            ]}
          >
            {item.content || (item.streaming ? "..." : "")}
          </Text>
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
        <View style={[styles.avatarLarge, { backgroundColor: colors.primary }]}>
          <Feather name="shield" size={20} color="#fff" />
        </View>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Guardian IA</Text>
          <Text style={[styles.headerSub, { color: colors.success }]}>En linea</Text>
        </View>
      </View>

      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        contentContainerStyle={[styles.list, { paddingBottom: 16 }]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
      />

      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: botPad,
          },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.muted,
              color: colors.foreground,
              borderColor: colors.border,
            },
          ]}
          placeholder="Escribe tu pregunta..."
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
          style={[
            styles.sendBtn,
            {
              backgroundColor:
                input.trim() && !loading ? colors.primary : colors.muted,
            },
          ]}
        >
          <Feather
            name="send"
            size={18}
            color={input.trim() && !loading ? "#fff" : colors.mutedForeground}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  avatarLarge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_500Medium" },
  list: { padding: 16, gap: 12 },
  msgWrap: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  msgLeft: { justifyContent: "flex-start" },
  msgRight: { justifyContent: "flex-end" },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  bubbleText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
});
