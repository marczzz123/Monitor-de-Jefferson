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
import { activateDeviceAdmin, isDeviceAdminActive } from "@/services/deviceApps";

const ACK_KEY = "@guardian_permissions_acknowledged_v3";
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
  const [adminActive, setAdminActive] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    Promise.all([
      AsyncStorage.getItem(ACK_KEY),
      isDeviceAdminActive(),
    ]).then(([value, isAdmin]) => {
      setAdminActive(isAdmin);
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

  async function handleActivateAdmin() {
    await activateDeviceAdmin();
    const active = await isDeviceAdminActive();
    setAdminActive(active);
  }

  async function acknowledge() {
    await AsyncStorage.setItem(ACK_KEY, "true");
    setVisible(false);
  }

  const permissions = [
    {
      title: "Administrador de dispositivo",
      description: adminActive
        ? "Activo - Guardian no puede ser desinstalado sin tu permiso."
        : "IMPORTANTE: Activa esto para que Jefferson no pueda desinstalar Guardian.",
      icon: "shield" as const,
      actionLabel: adminActive ? "Activo" : "Activar",
      onPress: handleActivateAdmin,
      disabled: adminActive,
      highlight: !adminActive,
    },
    {
      title: "Notificaciones",
      description: "Permite que Guardian te avise cuando detecte una app restringida.",
      icon: "bell" as const,
      actionLabel: "Permitir",
      onPress: requestNotifications,
      disabled: false,
      highlight: false,
    },
    {
      title: "Acceso al uso de apps",
      description: "Necesario para saber que app esta abierta y calcular el uso diario.",
      icon: "activity" as const,
      actionLabel: "Abrir ajuste",
      onPress: () => openAndroidSettings("android.settings.USAGE_ACCESS_SETTINGS"),
      disabled: false,
      highlight: false,
    },
    {
      title: "Servicio de accesibilidad",
      description: "Activa Guardian - Control Parental en Accesibilidad para cerrar apps restringidas.",
      icon: "eye" as const,
      actionLabel: "Abrir ajuste",
      onPress: () => openAndroidSettings("android.settings.ACCESSIBILITY_SETTINGS"),
      disabled: false,
      highlight: false,
    },
    {
      title: "Mostrar sobre otras apps",
      description: "Permite mostrar advertencias encima de otras aplicaciones.",
      icon: "layers" as const,
      actionLabel: "Abrir ajuste",
      onPress: () => openAndroidSettings("android.settings.MANAGE_OVERLAY_PERMISSION", `package:${ANDROID_PACKAGE}`),
      disabled: false,
      highlight: false,
    },
    {
      title: "Bateria sin restricciones",
      description: "Evita que Android cierre Guardian cuando esta monitoreando.",
      icon: "battery-charging" as const,
      actionLabel: "Abrir ajuste",
      onPress: () => Linking.openSettings(),
      disabled: false,
      highlight: false,
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
            <Text style={[styles.title, { color: colors.foreground }]}>Configura Guardian</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Para funcionar correctamente Guardian necesita estos permisos. El mas importante es el primero.
            </Text>
            {permissions.map((perm, i) => (
              <View key={i} style={[styles.permissionRow, { backgroundColor: colors.card }, perm.highlight && { borderWidth: 1.5, borderColor: colors.primary }]}>
                <View style={[styles.permissionIcon, { backgroundColor: colors.primary + "15" }]}>
                  <Feather name={perm.icon} size={18} color={colors.primary} />
                </View>
                <View style={styles.permissionText}>
                  <Text style={[styles.permissionTitle, { color: colors.foreground }]}>{perm.title}</Text>
                  <Text style={[styles.permissionDesc, { color: colors.mutedForeground }]}>{perm.description}</Text>
                </View>
                {!perm.disabled && (
                  <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primary }]} onPress={perm.onPress}>
                    <Text style={styles.actionText}>{perm.actionLabel}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity style={[styles.doneButton, { backgroundColor: colors.primary }]} onPress={acknowledge}>
              <Text style={[styles.doneText, { color: "#fff" }]}>Listo, entendido</Text>
            </TouchableOpacity>
            <Text style={[styles.note, { color: colors.mutedForeground }]}>
              Puedes volver a ver este panel desde Configuracion → Permisos
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "92%", paddingBottom: 32 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#ccc", alignSelf: "center", marginTop: 12, marginBottom: 4 },
  content: { padding: 20, gap: 12 },
  heroIcon: { width: 56, height: 56, borderRadius: 18, alignSelf: "center", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19, marginBottom: 4 },
  permissionRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 12, gap: 10 },
  permissionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  permissionText: { flex: 1, gap: 2 },
  permissionTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  permissionDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
  actionButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  actionText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  doneButton: { alignItems: "center", paddingVertical: 14, borderRadius: 14, marginTop: 6 },
  doneText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  note: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, textAlign: "center" },
});
