import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as IntentLauncher from "expo-intent-launcher";
import React, { useEffect, useState } from "react";
import {
  Linking,
  Modal,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

const ACK_KEY = "@guardian_permissions_acknowledged";
const ANDROID_PACKAGE = "com.guardian.controlparental";

async function openAndroidSettings(action: string, data?: string) {
  try {
    await IntentLauncher.startActivityAsync(action, data ? { data } : undefined);
  } catch {
    await Linking.openSettings();
  }
}

function getAndroidVersion() {
  return typeof Platform.Version === "number"
    ? Platform.Version
    : parseInt(String(Platform.Version), 10);
}

export function PermissionSetupPrompt() {
  const colors = useColors();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    AsyncStorage.getItem(ACK_KEY).then((value) => {
      if (!value) setVisible(true);
    });
  }, []);

  if (Platform.OS !== "android") return null;

  async function requestNotifications() {
    const androidVersion = getAndroidVersion();
    if (androidVersion >= 33) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    } else {
      await Linking.openSettings();
    }
  }

  async function acknowledge() {
    await AsyncStorage.setItem(ACK_KEY, "true");
    setVisible(false);
  }

  const permissions = [
    {
      title: "Notificaciones",
      description: "Permite que Guardian te avise cuando detecte una app restringida.",
      icon: "bell",
      actionLabel: "Permitir",
      onPress: requestNotifications,
    },
    {
      title: "Acceso al uso de apps",
      description: "Necesario para saber que app esta abierta y calcular el uso diario.",
      icon: "activity",
      actionLabel: "Abrir ajuste",
      onPress: () => openAndroidSettings("android.settings.USAGE_ACCESS_SETTINGS"),
    },
    {
      title: "Servicio de accesibilidad",
      description: "Necesario para reaccionar cuando se abre una app bloqueada.",
      icon: "shield",
      actionLabel: "Abrir ajuste",
      onPress: () => openAndroidSettings("android.settings.ACCESSIBILITY_SETTINGS"),
    },
    {
      title: "Mostrar sobre otras apps",
      description: "Permite mostrar advertencias encima de otras aplicaciones.",
      icon: "layers",
      actionLabel: "Abrir ajuste",
      onPress: () =>
        openAndroidSettings(
          "android.settings.MANAGE_OVERLAY_PERMISSION",
          `package:${ANDROID_PACKAGE}`
        ),
    },
    {
      title: "Bateria sin restricciones",
      description: "Evita que Android cierre Guardian cuando esta monitoreando.",
      icon: "battery-charging",
      actionLabel: "Abrir app",
      onPress: () => Linking.openSettings(),
    },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}> 
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={[styles.heroIcon, { backgroundColor: colors.primary + "18" }]}> 
              <Feather name="shield" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>Activa los permisos de Guardian</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}> 
              Para monitorear en Android, Guardian necesita estos permisos especiales. Toca cada boton, activa el permiso en Ajustes y vuelve a la app.
            </Text>

            {permissions.map((permission) => (
              <View
                key={permission.title}
                style={[styles.permissionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.permissionIcon, { backgroundColor: colors.primary + "14" }]}> 
                  <Feather name={permission.icon as any} size={18} color={colors.primary} />
                </View>
                <View style={styles.permissionText}>
                  <Text style={[styles.permissionTitle, { color: colors.foreground }]}>{permission.title}</Text>
                  <Text style={[styles.permissionDesc, { color: colors.mutedForeground }]}>{permission.description}</Text>
                </View>
                <TouchableOpacity
                  onPress={permission.onPress}
                  style={[styles.actionButton, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.actionText}>{permission.actionLabel}</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              onPress={acknowledge}
              style={[styles.doneButton, { backgroundColor: colors.foreground }]}
            >
              <Text style={[styles.doneText, { color: colors.background }]}>Ya active los permisos</Text>
            </TouchableOpacity>
            <Text style={[styles.note, { color: colors.mutedForeground }]}> 
              Android no permite pedir algunos de estos permisos con una ventana normal; por eso se abren desde Ajustes.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(120,130,150,0.45)",
    marginBottom: 8,
  },
  content: {
    padding: 20,
    paddingBottom: 30,
    gap: 12,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    marginBottom: 4,
  },
  permissionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  permissionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionText: {
    flex: 1,
    gap: 2,
  },
  permissionTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  permissionDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  doneButton: {
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 6,
  },
  doneText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  note: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
    textAlign: "center",
  },
});
