import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface MathKeyboardProps {
  onInsert: (text: string) => void;
  onBackspace: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  submitDisabled?: boolean;
}

type Tab = "basic" | "advanced";

interface Key {
  label: string;
  insert: string;
  flex?: number;
  variant?: "primary" | "ghost";
}

const BASIC_ROWS: Key[][] = [
  [
    { label: "7", insert: "7" },
    { label: "8", insert: "8" },
    { label: "9", insert: "9" },
    { label: "÷", insert: "÷" },
    { label: "(", insert: "(" },
    { label: ")", insert: ")" },
  ],
  [
    { label: "4", insert: "4" },
    { label: "5", insert: "5" },
    { label: "6", insert: "6" },
    { label: "×", insert: "×" },
    { label: "x", insert: "x" },
    { label: "y", insert: "y" },
  ],
  [
    { label: "1", insert: "1" },
    { label: "2", insert: "2" },
    { label: "3", insert: "3" },
    { label: "-", insert: "-" },
    { label: "x²", insert: "²" },
    { label: "√", insert: "√(" },
  ],
  [
    { label: "0", insert: "0" },
    { label: ".", insert: "." },
    { label: ",", insert: "," },
    { label: "+", insert: "+" },
    { label: "=", insert: "=" },
    { label: "π", insert: "π" },
  ],
];

const ADVANCED_ROWS: Key[][] = [
  [
    { label: "x^n", insert: "^" },
    { label: "x²", insert: "²" },
    { label: "x³", insert: "³" },
    { label: "√", insert: "√(" },
    { label: "∛", insert: "∛(" },
    { label: "a/b", insert: "/" },
  ],
  [
    { label: "sin", insert: "sin(" },
    { label: "cos", insert: "cos(" },
    { label: "tan", insert: "tan(" },
    { label: "log", insert: "log(" },
    { label: "ln", insert: "ln(" },
    { label: "e", insert: "e" },
  ],
  [
    { label: "π", insert: "π" },
    { label: "∞", insert: "∞" },
    { label: "≤", insert: "≤" },
    { label: "≥", insert: "≥" },
    { label: "≠", insert: "≠" },
    { label: "±", insert: "±" },
  ],
  [
    { label: "α", insert: "α" },
    { label: "β", insert: "β" },
    { label: "θ", insert: "θ" },
    { label: "Δ", insert: "Δ" },
    { label: "∫", insert: "∫" },
    { label: "∑", insert: "∑" },
  ],
];

export default function MathKeyboard({
  onInsert,
  onBackspace,
  onSubmit,
  submitLabel = "Enviar",
  submitDisabled = false,
}: MathKeyboardProps) {
  const colors = useColors();
  const [tab, setTab] = useState<Tab>("basic");

  const rows = tab === "basic" ? BASIC_ROWS : ADVANCED_ROWS;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
      {/* Pestañas */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => setTab("basic")}
          style={[
            styles.tab,
            tab === "basic" && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
          ]}
        >
          <Text
            style={[
              styles.tabText,
              { color: tab === "basic" ? colors.primary : colors.mutedForeground },
            ]}
          >
            Básico
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTab("advanced")}
          style={[
            styles.tab,
            tab === "advanced" && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
          ]}
        >
          <Text
            style={[
              styles.tabText,
              { color: tab === "advanced" ? colors.primary : colors.mutedForeground },
            ]}
          >
            Avanzado
          </Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={onBackspace}
          style={[styles.actionBtn, { backgroundColor: colors.muted }]}
        >
          <Feather name="delete" size={16} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Teclas */}
      <View style={styles.keysWrap}>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.row}>
            {row.map((k, ki) => (
              <TouchableOpacity
                key={ki}
                onPress={() => onInsert(k.insert)}
                style={[
                  styles.key,
                  { backgroundColor: colors.muted, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.keyText, { color: colors.foreground }]}>{k.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>

      {onSubmit && (
        <TouchableOpacity
          onPress={onSubmit}
          disabled={submitDisabled}
          style={[
            styles.submit,
            { backgroundColor: submitDisabled ? colors.muted : colors.primary },
          ]}
        >
          <Text
            style={[
              styles.submitText,
              { color: submitDisabled ? colors.mutedForeground : "#fff" },
            ]}
          >
            {submitLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderTopWidth: 1, paddingHorizontal: 6, paddingTop: 6, paddingBottom: 8 },
  tabs: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  tab: { paddingHorizontal: 12, paddingVertical: 6 },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  actionBtn: { padding: 8, borderRadius: 8, marginLeft: 6, marginBottom: 4 },
  keysWrap: { gap: 4 },
  row: { flexDirection: "row", gap: 4 },
  key: {
    flex: 1,
    aspectRatio: 1.6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
  },
  keyText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  submit: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  submitText: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
