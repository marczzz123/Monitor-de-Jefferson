import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as IntentLauncher from "expo-intent-launcher";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  AppStateStatus,
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
import {
  activateDeviceAdmin,
  isDeviceAdminActive,
  isAccessibilityServiceEnabled,
} from "@/services/deviceApps";

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

async function openAccessibilitySettings() {
  const androidVersion = getAndroidVersion();

  const goToAccessibility = async () => {
    try {
      await IntentLauncher.startActivityAsync(
        "android.settings.ACCESSIBILITY_DETAILS_SETTINGS",
        { data: `package:${ANDROID_PACKAGE}` }
      );
    } catch {
      try {
        await IntentLauncher.startActivityAsync("android.settings.ACCESSIBILITY_SETTINGS");
      } catch {
        await Linking.openSettings();
      }
    }
  };

  if (androidVersion >= 33) {
    Alert.alert(
      "Paso previo necesario",
      "En Android 13 o superior debes permitir configuraciones restringidas primero:\n\n1. Presiona \"Ir a info de la app\"\n2. Toca el menú ⋮ (tres puntos arriba a la derecha)\n3. Selecciona \"Permitir configuraciones restringidas\"\n4. Vuelve aquí y presiona \"Ir a Accesibilidad\"",
      [
        {
          text: "Ir a info de la app",
          onPress: () =>
            openAndroidSettings(
              "android.settings.APPLICATION_DETAILS_SETTINGS",
              `package:${ANDROID_PACKAGE}`
            ),
        },
        { text: "Ir a Accesibilidad", onPress: goToAccessibility },
        { text: "Cancelar", style: "cancel" },
      ]
    );
  } else {
    await goToAccessibility();
  }
}

export function PermissionSetupPrompt() {
  const colors = useColors();
  const [visible, setVisible] = useState(false);
  const [adminActive, setAdminActive] = useState(false);
  // Estado separado para la alerta post-reinicio de accesibilidad
  const [accessibilityAlert, setAccessibilityAlert] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const checkingRef = useRef(false);

  // Verifica todos los permisos y actualiza el estado
  const checkPermissions = useCallback(async () => {
    if (Platform.OS !== "android" || checkingRef.current) return;
    checkingRef.current = true;
    try {
      const [ackValue, isAdmin, accessOk] = await Promise.all([
        AsyncStorage.getItem(ACK_KEY),
        isDeviceAdminActive(),
        isAccessibilityServiceEnabled(),
      ]);
      setAdminActive(isAdmin);

      if (!ackValue) {
        // Primera vez: mostrar el panel completo
        setVisible(true);
      } else if (!accessOk) {
        // Ya configurado antes pero la accesibilidad se desactivó (por reinicio u otro motivo)
        setAccessibilityAlert(true);
      } else {
        setAccessibilityAlert(false);
      }
    } catch {}
    checkingRef.current = false;
  }, []);

  // Verificar al montar el componente
  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  // Re-verificar cada vez que la app vuelve al primer plano (después de reinicio, de ajustes, etc.)
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === "active") {
        // App vuelve a primer plano — re-verificar accesibilidad
        checkPermissions();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [checkPermissions]);

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
      description: getAndroidVersion() >= 33
        ? "Android 13+: primero ve a info de la app → ⋮ menú → \"Permitir configuraciones restringidas\", luego activa aquí."
        : "Activa Guardian - Control Parental en Accesibilidad para cerrar apps restringidas.",
      icon: "eye" as const,
      actionLabel: "Activar",
      onPress: openAccessibilitySettings,
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
      onPress: () => openAndroidSettings("android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS", `package:${ANDROID_PACKAGE}`),
      disabled: false,
      highlight: false,
    },
  ];

  return (
    <>
      {/* Panel completo de primera configuración */}
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

      {/* Alerta compacta cuando la accesibilidad se desactivó (ej. tras reinicio) */}
      <Modal visible={accessibilityAlert && !visible} animationType="fade" transparent>
        <View style={styles.alertBackdrop}>
          <View style={[styles.alertCard, { backgroundColor: colors.card }]}>
            <View style={[styles.alertIconWrap, { backgroundColor: colors.destructive + "15" }]}>
              <Feather name="alert-triangle" size={26} color={colors.destructive} />
            </View>
            <Text style={[styles.alertTitle, { color: colors.foreground }]}>
              ⚠️ Accesibilidad desactivada
            </Text>
            <Text style={[styles.alertBody, { color: colors.mutedForeground }]}>
              El servicio de Guardian se desactivó, probablemente al reiniciar el celular.{"\n\n"}
              El control parental no está funcionando. Actívalo de nuevo para retomar el monitoreo.
            </Text>
            <TouchableOpacity
              style={[styles.alertBtn, { backgroundColor: colors.primary }]}
              onPress={async () => {
                await openAccessibilitySettings();
              }}
            >
              <Feather name="eye" size={16} color="#fff" />
              <Text style={styles.alertBtnText}>Reactivar accesibilidad</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.alertBtnSecondary, { borderColor: colors.border }]}
              onPress={() => setAccessibilityAlert(false)}
            >
              <Text style={[styles.alertBtnSecondaryText, { color: colors.mutedForeground }]}>
                Ignorar por ahora
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
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
  // Alerta post-reinicio
  alertBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
  alertCard: { borderRadius: 20, padding: 24, width: "100%", maxWidth: 360, alignItems: "center", gap: 12 },
  alertIconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  alertTitle: { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  alertBody: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  alertBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 13, paddingHorizontal: 24, borderRadius: 14, width: "100%", justifyContent: "center" },
  alertBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  alertBtnSecondary: { paddingVertical: 10, borderRadius: 12, width: "100%", alignItems: "center", borderWidth: 1 },
  alertBtnSecondaryText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
