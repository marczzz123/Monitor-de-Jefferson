import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import {
  getInstalledApps,
  getUsageStats,
  setRestrictedApps as setNativeRestrictedApps,
  setCurrentMode as setNativeCurrentMode,
  startMonitoringService,
  stopMonitoringService,
  type DeviceAppInfo,
} from "@/services/deviceApps";
import { getTodaySubjects, getTomorrowSubjects } from "@/services/ai";

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
  "roblox", "pubg", "freefire", "free.fire", "fortnite", "cod", "callofduty", "garena",
  "supercell", "king.com", "gameloft", "ubisoft", "ea.games", "eagames",
  "moonton", "mobile.legends", "mlbb", "brawl", "royale", "subway", "templerun",
  "among", "playrix", "miniclip", "zynga", "netmarble", "mihoyo", "hoyoverse",
  "genshin", "tencent", "honorofkings", "riotgames", "wildrift", "steam",
  "nintendo", "pokemon", "epicgames", "epic.games", "voodoo", "saygames",
];

const SYSTEM_PKG_PREFIXES = [
  "com.android.",
  "android.",
  "com.google.android.",
  "com.samsung.android.",
  "com.samsung.",
  "com.sec.android.",
  "com.sec.",
  "com.miui.",
  "com.xiaomi.",
  "com.huawei.",
  "com.honor.",
  "com.hihonor.",
  "com.oppo.",
  "com.coloros.",
  "com.realme.",
  "com.oneplus.",
  "com.vivo.",
  "com.iqoo.",
  "com.asus.",
  "com.motorola.",
  "com.lenovo.",
  "com.lge.",
  "com.sonyericsson.",
  "com.sony.",
  "com.htc.",
  "com.qualcomm.",
  "com.mediatek.",
];

const SYSTEM_APP_NAMES = [
  "teléfono", "telefono", "phone", "dialer", "marcador",
  "contactos", "contacts", "agenda",
  "mensajes", "messages", "sms", "mms",
  "configuración", "configuracion", "settings", "ajustes",
  "calculadora", "calculator",
  "reloj", "clock", "alarma", "alarm", "temporizador",
  "cámara", "camara", "camera",
  "galería", "galeria", "gallery", "fotos", "photos",
  "archivos", "files", "file manager", "gestor",
  "notas", "notes",
  "calendario", "calendar",
  "linterna", "flashlight",
  "grabadora", "recorder",
  "brújula", "compass",
  "play store", "app store",
];

export function classifyPackage(packageName: string, appName: string): MonitoredApp["category"] {
  const pkg = packageName.toLowerCase();
  const name = appName.toLowerCase();

  if (SOCIAL_PACKAGES.includes(pkg)) return "social";
  if (pkg.includes("tiktok") || pkg.includes("instagram") || pkg.includes("snapchat")
    || pkg.includes("facebook") || pkg.includes("twitter") || pkg.includes("whatsapp")) return "social";

  if (GAME_KEYWORDS.some((k) => pkg.includes(k) || name.includes(k))) return "game";

  if (pkg.includes("edu") || pkg.includes("learn") || pkg.includes("school")
    || pkg.includes("math") || pkg.includes("duolingo") || pkg.includes("khan")
    || pkg.includes("coursera") || pkg.includes("udemy")) return "educational";

  if (SYSTEM_PKG_PREFIXES.some(prefix => pkg.startsWith(prefix))) return "system";

  if (SYSTEM_APP_NAMES.some(n => name.includes(n))) return "system";

  return "neutral";
}

export function getCurrentMode(schedule: Schedule): AppMode {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const min = now.getMinutes();
  const totalMin = hour * 60 + min;

  const isWeekend = day === 0 || day === 6;

  const isFridayOrSaturdayNight = day === 5 || day === 6;
  const sleepTotal = isFridayOrSaturdayNight
    ? 23 * 60 + 30
    : schedule.bedtime * 60 + (schedule.bedtimeMin ?? 0);

  if (totalMin >= sleepTotal) return "sleep";

  if (isWeekend) return "free";

  const schoolStart = schedule.schoolStart * 60 + (schedule.schoolStartMin ?? 0);
  const schoolEnd = schedule.schoolEnd * 60 + (schedule.schoolEndMin ?? 0);
  const lunchEnd = schedule.lunchEnd * 60 + (schedule.lunchEndMin ?? 0);
  const gamesStart = (schedule.gamesStart ?? 19) * 60 + (schedule.gamesStartMin ?? 0);

  if (totalMin >= schoolStart && totalMin < schoolEnd) return "school";
  if (totalMin >= schoolEnd && totalMin < lunchEnd) return "lunch";
  if (totalMin >= lunchEnd && totalMin < gamesStart) return "study";

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
    if (category === "system" || category === "educational") return false;
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
  subjectsDone: Record<string, boolean>;
  sleepOverrideUntil: number | null;
  toggleMonitoring: () => void;
  toggleRestrictedApp: (packageName: string) => void;
  updateSchedule: (schedule: Schedule) => void;
  updateSensitivity: (level: number) => void;
  addAction: (action: AIAction) => void;
  addBlockAttempt: (attempt: Omit<BlockAttempt, "id">) => void;
  setTasksCompleted: (done: boolean) => void;
  markSubjectDone: (subject: string) => void;
  resetSubjectsDone: () => void;
  grantNightExtraTime: () => void;
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

function getEffectiveRestrictedApps(apps: MonitoredApp[], restrictedApps: string[], mode: AppMode): string[] {
  const packages = new Set(restrictedApps);
  for (const app of apps) {
    if (isModeBlocked(mode, app.packageName, app.name, restrictedApps)) {
      packages.add(app.packageName);
    } else if (!restrictedApps.includes(app.packageName)) {
      packages.delete(app.packageName);
    }
  }
  return [...packages];
}

function getTodayDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
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
  const [subjectsDone, setSubjectsDone] = useState<Record<string, boolean>>({});
  const [sleepOverrideUntil, setSleepOverrideUntil] = useState<number | null>(null);
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
  const sleepOverrideRef = useRef<number | null>(null);

  useEffect(() => { scheduleRef.current = schedule; }, [schedule]);
  useEffect(() => { sleepOverrideRef.current = sleepOverrideUntil; }, [sleepOverrideUntil]);

  const getEffectiveMode = useCallback(() => {
    const override = sleepOverrideRef.current;
    if (override && Date.now() < override) return "free" as AppMode;
    return getCurrentMode(scheduleRef.current);
  }, []);

  useEffect(() => {
    loadData();
    refreshInstalledApps();
    setCurrentMode(getEffectiveMode());
    setIsMonitoring(true);
    startMonitoringService().catch(() => {});
    modeIntervalRef.current = setInterval(() => {
      setCurrentMode(getEffectiveMode());
    }, 30000);
    return () => {
      if (modeIntervalRef.current) clearInterval(modeIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    appsRef.current = allApps;
  }, [allApps]);

  useEffect(() => {
    const effectiveRestrictedApps = getEffectiveRestrictedApps(allApps, restrictedApps, currentMode);
    setNativeRestrictedApps(effectiveRestrictedApps).catch(() => {});
    setNativeCurrentMode(currentMode).catch(() => {});
  }, [allApps, restrictedApps, currentMode]);

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

        // Load subjectsDone but reset if it's a new day
        const todayKey = getTodayDateKey();
        if (data.subjectsDoneDate === todayKey && data.subjectsDone) {
          setSubjectsDone(data.subjectsDone);
        }

        // Load sleepOverride but ignore if expired
        if (data.sleepOverrideUntil && Date.now() < data.sleepOverrideUntil) {
          setSleepOverrideUntil(data.sleepOverrideUntil);
          sleepOverrideRef.current = data.sleepOverrideUntil;
        }
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
        const effectiveRestrictedApps = getEffectiveRestrictedApps(appsRef.current, restrictedApps, getEffectiveMode());
        setNativeRestrictedApps(effectiveRestrictedApps).catch(() => {});
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
      const effective = getEffectiveRestrictedApps(appsRef.current, next, getEffectiveMode());
      setNativeRestrictedApps(effective).catch(() => {});
      return next;
    });
  }

  function updateSchedule(s: Schedule) {
    setSchedule(s);
    scheduleRef.current = s;
    setCurrentMode(getEffectiveMode());
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

  function markSubjectDone(subject: string) {
    setSubjectsDone((prev) => {
      const next = { ...prev, [subject]: true };
      saveData({ subjectsDone: next, subjectsDoneDate: getTodayDateKey() });
      return next;
    });
  }

  function resetSubjectsDone() {
    setSubjectsDone({});
    saveData({ subjectsDone: {}, subjectsDoneDate: getTodayDateKey() });
  }

  function setTasksCompleted(done: boolean) {
    if (done) {
      const tomorrow = getTomorrowSubjects();
      const allDone: Record<string, boolean> = {};
      for (const s of tomorrow) allDone[s] = true;
      setSubjectsDone(allDone);
      saveData({ subjectsDone: allDone, subjectsDoneDate: getTodayDateKey() });
    } else {
      resetSubjectsDone();
    }
  }

  function grantNightExtraTime() {
    const until = Date.now() + 10 * 60 * 1000;
    setSleepOverrideUntil(until);
    sleepOverrideRef.current = until;
    setCurrentMode("free");
    saveData({ sleepOverrideUntil: until });
    setTimeout(() => {
      setSleepOverrideUntil(null);
      sleepOverrideRef.current = null;
      setCurrentMode(getCurrentMode(scheduleRef.current));
    }, 10 * 60 * 1000);
  }

  const tomorrowSubjects = getTomorrowSubjects();
  const tasksCompleted = tomorrowSubjects.length === 0
    || tomorrowSubjects.every(s => subjectsDone[s]);

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
      materias_mañana: tomorrowSubjects,
      materias_completadas: Object.keys(subjectsDone).filter(k => subjectsDone[k]),
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
        subjectsDone,
        sleepOverrideUntil,
        toggleMonitoring,
        toggleRestrictedApp,
        updateSchedule,
        updateSensitivity,
        addAction,
        addBlockAttempt,
        setTasksCompleted,
        markSubjectDone,
        resetSubjectsDone,
        grantNightExtraTime,
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
