import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import {
  getInstalledApps,
  getUsageStats,
  setRestrictedApps as setNativeRestrictedApps,
  startMonitoringService,
  stopMonitoringService,
  type DeviceAppInfo,
} from "@/services/deviceApps";

export type AppDecision = "allow" | "warn" | "close";
export type AppMode = "school" | "lunch" | "study" | "free" | "sleep";

export interface MonitoredApp {
  name: string;
  packageName: string;
  category: "distraction" | "educational" | "neutral" | "social" | "game" | "system";
  icon: string;
}

export interface UsageEntry {
  appName: string;
  packageName: string;
  minutes: number;
  decision: AppDecision;
  reason: string;
  timestamp: number;
}

export interface AIAction {
  id: string;
  appName: string;
  action: AppDecision;
  reason: string;
  message: string;
  timestamp: number;
  mode?: AppMode;
}

export interface BlockAttempt {
  id: string;
  appName: string;
  packageName: string;
  timestamp: number;
  mode: AppMode;
  reason: string;
}

export interface Schedule {
  schoolStart: number;
  schoolStartMin: number;
  schoolEnd: number;
  schoolEndMin: number;
  lunchEnd: number;
  lunchEndMin: number;
  gamesStart: number;
  gamesStartMin: number;
  bedtime: number;
  bedtimeMin: number;
}

export const SOCIAL_PACKAGES = [
  "com.zhiliaoapp.musically",
  "com.ss.android.ugc.trill",
  "com.instagram.android",
  "com.facebook.katana",
  "com.twitter.android",
  "com.snapchat.android",
  "com.whatsapp",
  "com.facebook.orca",
  "com.pinterest",
  "com.reddit.frontpage",
  "com.youtube.android",
  "com.google.android.youtube",
];

export const GAME_KEYWORDS = [
  "game", "games", "gaming", "candy", "clash", "minecraft",
  "roblox", "pubg", "freefire", "fortnite", "cod", "garena",
  "supercell", "king.com", "gameloft", "ubisoft", "ea.games",
];

export function classifyPackage(packageName: string, appName: string): MonitoredApp["category"] {
  const pkg = packageName.toLowerCase();
  const name = appName.toLowerCase();
  if (SOCIAL_PACKAGES.includes(pkg)) return "social";
  if (pkg.includes("tiktok") || pkg.includes("instagram") || pkg.includes("snapchat")) return "social";
  if (GAME_KEYWORDS.some((k) => pkg.includes(k) || name.includes(k))) return "game";
  if (pkg.includes("edu") || pkg.includes("learn") || pkg.includes("school") || pkg.includes("math") || pkg.includes("duolingo") || pkg.includes("khan")) return "educational";
  if (pkg.startsWith("com.android") || pkg.startsWith("com.google.android.")) return "system";
  return "neutral";
}

export function getCurrentMode(schedule: Schedule): AppMode {
  const now = new Date();
  const day = now.getDay(); // 0=Dom, 1=Lun, ..., 5=Vie, 6=Sab
  const hour = now.getHours();
  const min = now.getMinutes();
  const totalMin = hour * 60 + min;

  const isWeekend = day === 0 || day === 6; // Sábado o Domingo

  // Hora de dormir dinámica para garantizar 7-8 horas de sueño:
  // Noche de viernes (day=5) y noche de sábado (day=6): 23:30 (puede dormir más)
  // Noches de escuela (dom-jue): hora configurada (por defecto 22:00)
  const isFridayOrSaturdayNight = day === 5 || day === 6;
  const sleepTotal = isFridayOrSaturdayNight
    ? 23 * 60 + 30
    : schedule.bedtime * 60 + (schedule.bedtimeMin ?? 0);

  if (totalMin >= sleepTotal) return "sleep";

  // Fines de semana: modo libre todo el día
  if (isWeekend) return "free";

  // Días de semana (Lun-Vie): aplicar horario escolar
  const schoolStart = schedule.schoolStart * 60 + (schedule.schoolStartMin ?? 0);
  const schoolEnd = schedule.schoolEnd * 60 + (schedule.schoolEndMin ?? 0);
  const lunchEnd = schedule.lunchEnd * 60 + (schedule.lunchEndMin ?? 0);
  const gamesStart = (schedule.gamesStart ?? 19) * 60 + (schedule.gamesStartMin ?? 0);

  if (totalMin >= schoolStart && totalMin < schoolEnd) return "school";
  if (totalMin >= schoolEnd && totalMin < lunchEnd) return "lunch";
  if (totalMin >= lunchEnd && totalMin < gamesStart) return "study";

  // Después de gamesStart (19:00) hasta dormir: modo libre (juegos y redes permitidos)
  return "free";
}

export function getModeLabel(mode: AppMode): string {
  switch (mode) {
    case "school": return "Modo Colegio";
    case "lunch": return "Modo Almuerzo";
    case "study": return "Modo Estudio";
    case "sleep": return "Modo Dormir";
    default: return "Modo Libre";
  }
}

export function getModeDescription(mode: AppMode): string {
  switch (mode) {
    case "school": return "Solo funciones esenciales y emergencias";
    case "lunch": return "Solo apps sociales (TikTok, Instagram)";
    case "study": return "Asistente de estudio activo con IA";
    case "sleep": return "Bloqueo nocturno activado";
    default: return "Tiempo libre con monitoreo activo";
  }
}

export function isModeBlocked(mode: AppMode, packageName: string, appName: string, restrictedApps: string[]): boolean {
  const category = classifyPackage(packageName, appName);

  if (mode === "sleep") return true;
  if (mode === "school") {
    if (category === "system") return false;
    return true;
  }
  if (mode === "lunch") {
    if (category === "social") return false;
    if (category === "game") return true;
    if (category === "distraction") return true;
    return restrictedApps.includes(packageName);
  }
  if (mode === "study") {
    if (category === "game") return true;
    if (category === "social") return true;
    if (category === "educational") return false;
    return restrictedApps.includes(packageName);
  }

  return restrictedApps.includes(packageName);
}

interface MonitoringContextType {
  isMonitoring: boolean;
  currentApp: MonitoredApp | null;
  currentMode: AppMode;
  todayUsage: UsageEntry[];
  recentActions: AIAction[];
  blockAttempts: BlockAttempt[];
  restrictedApps: string[];
  schedule: Schedule;
  sensitivity: number;
  tasksCompleted: boolean;
  toggleMonitoring: () => void;
  toggleRestrictedApp: (packageName: string) => void;
  updateSchedule: (schedule: Schedule) => void;
  updateSensitivity: (level: number) => void;
  addAction: (action: AIAction) => void;
  addBlockAttempt: (attempt: Omit<BlockAttempt, "id">) => void;
  setTasksCompleted: (done: boolean) => void;
  getUsageContext: () => Record<string, unknown>;
  allApps: MonitoredApp[];
  refreshInstalledApps: () => Promise<void>;
}

const MonitoringContext = createContext<MonitoringContextType | null>(null);

function normalizeApp(app: DeviceAppInfo): MonitoredApp {
  const category = classifyPackage(app.packageName, app.name);
  return {
    name: app.name,
    packageName: app.packageName,
    category,
    icon: app.icon || "smartphone",
  };
}

export function MonitoringProvider({ children }: { children: React.ReactNode }) {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentApp, setCurrentApp] = useState<MonitoredApp | null>(null);
  const [currentMode, setCurrentMode] = useState<AppMode>("free");
  const [todayUsage, setTodayUsage] = useState<UsageEntry[]>([]);
  const [recentActions, setRecentActions] = useState<AIAction[]>([]);
  const [blockAttempts, setBlockAttempts] = useState<BlockAttempt[]>([]);
  const [restrictedApps, setRestrictedApps] = useState<string[]>([]);
  const [allApps, setAllApps] = useState<MonitoredApp[]>([]);
  const [tasksCompleted, setTasksCompleted] = useState(false);
  const [schedule, setSchedule] = useState<Schedule>({
    schoolStart: 7,
    schoolStartMin: 20,
    schoolEnd: 14,
    schoolEndMin: 30,
    lunchEnd: 15,
    lunchEndMin: 30,
    gamesStart: 19,
    gamesStartMin: 0,
    bedtime: 22,
    bedtimeMin: 0,
  });
  const [sensitivity, setSensitivity] = useState(2);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appsRef = useRef<MonitoredApp[]>([]);
  const scheduleRef = useRef(schedule);

  useEffect(() => { scheduleRef.current = schedule; }, [schedule]);

  useEffect(() => {
    loadData();
    refreshInstalledApps();
    const mode = getCurrentMode(scheduleRef.current);
    setCurrentMode(mode);
    modeIntervalRef.current = setInterval(() => {
      setCurrentMode(getCurrentMode(scheduleRef.current));
    }, 30000);
    return () => {
      if (modeIntervalRef.current) clearInterval(modeIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    appsRef.current = allApps;
  }, [allApps]);

  useEffect(() => {
    setNativeRestrictedApps(restrictedApps).catch(() => {});
  }, [restrictedApps]);

  async function loadData() {
    try {
      const stored = await AsyncStorage.getItem("@guardian_data_v2");
      if (stored) {
        const data = JSON.parse(stored);
        if (Array.isArray(data.restrictedApps)) setRestrictedApps(data.restrictedApps);
        if (data.schedule) {
          const s = data.schedule;
          setSchedule({
            schoolStart: s.schoolStart ?? 7,
            schoolStartMin: s.schoolStartMin ?? 20,
            schoolEnd: s.schoolEnd ?? 14,
            schoolEndMin: s.schoolEndMin ?? 30,
            lunchEnd: s.lunchEnd ?? 15,
            lunchEndMin: s.lunchEndMin ?? 30,
            gamesStart: s.gamesStart ?? 19,
            gamesStartMin: s.gamesStartMin ?? 0,
            bedtime: s.bedtime ?? 22,
            bedtimeMin: s.bedtimeMin ?? 0,
          });
        }
        if (typeof data.sensitivity === "number") setSensitivity(data.sensitivity);
        if (data.recentActions) setRecentActions(data.recentActions.slice(0, 20));
        if (data.blockAttempts) setBlockAttempts(data.blockAttempts.slice(0, 30));
      }
    } catch {}
  }

  async function saveData(data: Record<string, unknown>) {
    try {
      const existing = await AsyncStorage.getItem("@guardian_data_v2");
      const current = existing ? JSON.parse(existing) : {};
      await AsyncStorage.setItem("@guardian_data_v2", JSON.stringify({ ...current, ...data }));
    } catch {}
  }

  const refreshInstalledApps = useCallback(async () => {
    try {
      const deviceApps = await getInstalledApps();
      const normalized = deviceApps.map(normalizeApp);
      setAllApps(normalized);
      appsRef.current = normalized;
    } catch {
      setAllApps([]);
      appsRef.current = [];
    }
  }, []);

  const refreshDeviceUsage = useCallback(async () => {
    try {
      const usage = await getUsageStats();
      const appMap = new Map(appsRef.current.map((app) => [app.packageName, app]));
      if (usage.length === 0) { setCurrentApp(null); return; }
      const entries = usage.map((entry) => {
        const app = appMap.get(entry.packageName) ?? normalizeApp(entry);
        return {
          appName: app.name,
          packageName: app.packageName,
          minutes: entry.minutes,
          decision: "allow" as AppDecision,
          reason: "",
          timestamp: entry.lastTimeUsed || Date.now(),
        };
      });
      const first = usage[0];
      const firstApp = appMap.get(first.packageName) ?? normalizeApp(first);
      setTodayUsage(entries);
      setCurrentApp(firstApp);
    } catch { setCurrentApp(null); }
  }, []);

  useEffect(() => {
    if (isMonitoring) {
      refreshInstalledApps();
      refreshDeviceUsage();
      intervalRef.current = setInterval(refreshDeviceUsage, 8000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setCurrentApp(null);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isMonitoring, refreshDeviceUsage, refreshInstalledApps]);

  function toggleMonitoring() {
    setIsMonitoring((prev) => {
      const next = !prev;
      if (next) {
        setNativeRestrictedApps(restrictedApps).catch(() => {});
        startMonitoringService().catch(() => {});
      } else {
        stopMonitoringService().catch(() => {});
      }
      return next;
    });
  }

  function toggleRestrictedApp(packageName: string) {
    setRestrictedApps((prev) => {
      const next = prev.includes(packageName)
        ? prev.filter((p) => p !== packageName)
        : [...prev, packageName];
      saveData({ restrictedApps: next });
      setNativeRestrictedApps(next).catch(() => {});
      return next;
    });
  }

  function updateSchedule(s: Schedule) {
    setSchedule(s);
    scheduleRef.current = s;
    setCurrentMode(getCurrentMode(s));
    saveData({ schedule: s });
  }

  function updateSensitivity(level: number) {
    setSensitivity(level);
    saveData({ sensitivity: level });
  }

  function addAction(action: AIAction) {
    setRecentActions((prev) => {
      const next = [action, ...prev].slice(0, 20);
      saveData({ recentActions: next });
      return next;
    });
    setTodayUsage((prev) =>
      prev.map((u) =>
        u.appName === action.appName ? { ...u, decision: action.action, reason: action.reason } : u
      )
    );
  }

  function addBlockAttempt(attempt: Omit<BlockAttempt, "id">) {
    setBlockAttempts((prev) => {
      const next = [{ ...attempt, id: Date.now().toString() + Math.random().toString(36).slice(2, 7) }, ...prev].slice(0, 30);
      saveData({ blockAttempts: next });
      return next;
    });
  }

  function getUsageContext() {
    const now = new Date();
    const hour = now.getHours();
    const min = now.getMinutes();
    const totalMin = hour * 60 + min;
    const schoolStart = schedule.schoolStart * 60 + schedule.schoolStartMin;
    const schoolEnd = schedule.schoolEnd * 60 + schedule.schoolEndMin;
    const isSchoolHours = totalMin >= schoolStart && totalMin < schoolEnd;
    const isNightTime = totalMin >= schedule.bedtime * 60 + schedule.bedtimeMin;
    return {
      fecha: now.toLocaleDateString("es-ES"),
      hora: `${hour}:${String(min).padStart(2, "0")}`,
      modo_actual: currentMode,
      modo_etiqueta: getModeLabel(currentMode),
      horario_escolar: isSchoolHours,
      hora_dormir: isNightTime,
      tareas_completadas: tasksCompleted,
      apps_instaladas_detectadas: allApps.length,
      apps_restringidas: restrictedApps.length,
      uso_hoy: todayUsage.map((u) => ({
        app: u.appName,
        paquete: u.packageName,
        minutos: u.minutes,
        decision: u.decision,
      })),
      acciones_recientes: recentActions.slice(0, 5).map((a) => ({
        app: a.appName,
        accion: a.action,
        motivo: a.reason,
        cuando: new Date(a.timestamp).toLocaleTimeString("es-ES"),
      })),
    };
  }

  return (
    <MonitoringContext.Provider
      value={{
        isMonitoring,
        currentApp,
        currentMode,
        todayUsage,
        recentActions,
        blockAttempts,
        restrictedApps,
        schedule,
        sensitivity,
        tasksCompleted,
        toggleMonitoring,
        toggleRestrictedApp,
        updateSchedule,
        updateSensitivity,
        addAction,
        addBlockAttempt,
        setTasksCompleted,
        getUsageContext,
        allApps,
        refreshInstalledApps,
      }}
    >
      {children}
    </MonitoringContext.Provider>
  );
}

export function useMonitoring() {
  const ctx = useContext(MonitoringContext);
  if (!ctx) throw new Error("useMonitoring must be used inside MonitoringProvider");
  return ctx;
}
