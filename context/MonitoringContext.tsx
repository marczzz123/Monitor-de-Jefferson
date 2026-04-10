import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type AppDecision = "allow" | "warn" | "close";

export interface MonitoredApp {
  name: string;
  packageName: string;
  category: "distraction" | "educational" | "neutral";
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
}

export interface Schedule {
  schoolStart: number;
  schoolEnd: number;
  bedtime: number;
}

const MOCK_APPS: MonitoredApp[] = [
  { name: "YouTube", packageName: "com.google.android.youtube", category: "distraction", icon: "play-circle" },
  { name: "TikTok", packageName: "com.zhiliaoapp.musically", category: "distraction", icon: "video" },
  { name: "Instagram", packageName: "com.instagram.android", category: "distraction", icon: "camera" },
  { name: "WhatsApp", packageName: "com.whatsapp", category: "neutral", icon: "message-circle" },
  { name: "Chrome", packageName: "com.android.chrome", category: "neutral", icon: "globe" },
  { name: "Duolingo", packageName: "com.duolingo", category: "educational", icon: "book-open" },
  { name: "Khan Academy", packageName: "org.khanacademy.android", category: "educational", icon: "book" },
  { name: "Free Fire", packageName: "com.dts.freefireth", category: "distraction", icon: "crosshair" },
  { name: "Roblox", packageName: "com.roblox.client", category: "distraction", icon: "grid" },
  { name: "Calculadora", packageName: "com.android.calculator2", category: "educational", icon: "hash" },
];

interface MonitoringContextType {
  isMonitoring: boolean;
  currentApp: MonitoredApp | null;
  todayUsage: UsageEntry[];
  recentActions: AIAction[];
  restrictedApps: string[];
  schedule: Schedule;
  sensitivity: number;
  toggleMonitoring: () => void;
  toggleRestrictedApp: (packageName: string) => void;
  updateSchedule: (schedule: Schedule) => void;
  updateSensitivity: (level: number) => void;
  addAction: (action: AIAction) => void;
  getUsageContext: () => Record<string, unknown>;
  allApps: MonitoredApp[];
}

const MonitoringContext = createContext<MonitoringContextType | null>(null);

export function MonitoringProvider({ children }: { children: React.ReactNode }) {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentApp, setCurrentApp] = useState<MonitoredApp | null>(null);
  const [todayUsage, setTodayUsage] = useState<UsageEntry[]>([]);
  const [recentActions, setRecentActions] = useState<AIAction[]>([]);
  const [restrictedApps, setRestrictedApps] = useState<string[]>([
    "com.google.android.youtube",
    "com.zhiliaoapp.musically",
    "com.dts.freefireth",
    "com.roblox.client",
    "com.instagram.android",
  ]);
  const [schedule, setSchedule] = useState<Schedule>({
    schoolStart: 8,
    schoolEnd: 14,
    bedtime: 21,
  });
  const [sensitivity, setSensitivity] = useState(2);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const stored = await AsyncStorage.getItem("@guardian_data");
      if (stored) {
        const data = JSON.parse(stored);
        if (data.restrictedApps) setRestrictedApps(data.restrictedApps);
        if (data.schedule) setSchedule(data.schedule);
        if (data.sensitivity) setSensitivity(data.sensitivity);
        if (data.recentActions) setRecentActions(data.recentActions.slice(0, 20));
      }
    } catch {}
  }

  async function saveData(data: {
    restrictedApps?: string[];
    schedule?: Schedule;
    sensitivity?: number;
    recentActions?: AIAction[];
  }) {
    try {
      const existing = await AsyncStorage.getItem("@guardian_data");
      const current = existing ? JSON.parse(existing) : {};
      await AsyncStorage.setItem("@guardian_data", JSON.stringify({ ...current, ...data }));
    } catch {}
  }

  const simulateMonitoring = useCallback(() => {
    const distractionApps = MOCK_APPS.filter((a) => restrictedApps.includes(a.packageName));
    const allTargets = distractionApps.length > 0 ? distractionApps : MOCK_APPS;
    const app = allTargets[Math.floor(Math.random() * allTargets.length)];
    setCurrentApp(app);

    setTodayUsage((prev) => {
      const existing = prev.find((u) => u.packageName === app.packageName);
      if (existing) {
        return prev.map((u) =>
          u.packageName === app.packageName ? { ...u, minutes: u.minutes + 1 } : u
        );
      }
      return [
        ...prev,
        {
          appName: app.name,
          packageName: app.packageName,
          minutes: 1,
          decision: "allow" as AppDecision,
          reason: "",
          timestamp: Date.now(),
        },
      ];
    });
  }, [restrictedApps]);

  useEffect(() => {
    if (isMonitoring) {
      simulateMonitoring();
      intervalRef.current = setInterval(simulateMonitoring, 8000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setCurrentApp(null);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isMonitoring, simulateMonitoring]);

  function toggleMonitoring() {
    setIsMonitoring((prev) => !prev);
  }

  function toggleRestrictedApp(packageName: string) {
    setRestrictedApps((prev) => {
      const next = prev.includes(packageName)
        ? prev.filter((p) => p !== packageName)
        : [...prev, packageName];
      saveData({ restrictedApps: next });
      return next;
    });
  }

  function updateSchedule(s: Schedule) {
    setSchedule(s);
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
        u.packageName === action.appName
          ? { ...u, decision: action.action, reason: action.reason }
          : u
      )
    );
  }

  function getUsageContext() {
    const now = new Date();
    const hour = now.getHours();
    const isSchoolHours = hour >= schedule.schoolStart && hour < schedule.schoolEnd;
    const isNightTime = hour >= schedule.bedtime;
    return {
      fecha: now.toLocaleDateString("es-ES"),
      hora: `${hour}:${String(now.getMinutes()).padStart(2, "0")}`,
      horario_escolar: isSchoolHours,
      hora_dormir: isNightTime,
      apps_restringidas: restrictedApps.length,
      uso_hoy: todayUsage.map((u) => ({
        app: u.appName,
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
        todayUsage,
        recentActions,
        restrictedApps,
        schedule,
        sensitivity,
        toggleMonitoring,
        toggleRestrictedApp,
        updateSchedule,
        updateSensitivity,
        addAction,
        getUsageContext,
        allApps: MOCK_APPS,
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
