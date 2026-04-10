import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface AppCardProps {
  name: string;
  packageName: string;
  minutes: number;
  isRestricted: boolean;
  decision?: "allow" | "warn" | "close";
  onToggle?: () => void;
}

export function AppCard({ name, packageName, minutes, isRestricted, decision, onToggle }: AppCardProps) {
  const colors = useColors();

  const decisionColor =
    decision === "close"
      ? colors.destructive
      : decision === "warn"
      ? colors.warning
      : colors.success;

  const decisionIcon =
    decision === "close" ? "x-circle" : decision === "warn" ? "alert-triangle" : "check-circle";

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const timeLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.iconBox, { backgroundColor: isRestricted ? colors.destructive + "20" : colors.primary + "15" }]}>
        <Feather
          name="smartphone"
          size={20}
          color={isRestricted ? colors.destructive : colors.primary}
        />
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.pkg, { color: colors.mutedForeground }]} numberOfLines={1}>
          {timeLabel} hoy
        </Text>
      </View>
      <View style={styles.right}>
        {decision && (
          <Feather name={decisionIcon as any} size={16} color={decisionColor} style={styles.decisionIcon} />
        )}
        {onToggle && (
          <TouchableOpacity
            onPress={onToggle}
            style={[
              styles.badge,
              {
                backgroundColor: isRestricted ? colors.destructive + "20" : colors.success + "20",
              },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: isRestricted ? colors.destructive : colors.success },
              ]}
            >
              {isRestricted ? "Bloqueada" : "Permitida"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  pkg: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  right: {
    alignItems: "flex-end",
    gap: 6,
  },
  decisionIcon: {
    marginBottom: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});
