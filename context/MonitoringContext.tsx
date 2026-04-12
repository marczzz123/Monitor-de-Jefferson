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
  refreshInstalledApps: () => Promise<void>;
}

const MonitoringContext = createContext<MonitoringContextType | null>(null);

function normalizeApp(app: DeviceAppInfo): MonitoredApp {
  return {
    name: app.name,
    packageName: app.packageName,
    category: app.category,
    icon: app.icon || "smartphone",
  };
}

export function MonitoringProvider({ children }: { children: React.ReactNode }) {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentApp, setCurrentApp] = useState<MonitoredApp | null>(null);
  const [todayUsage, setTodayUsage] = useState<UsageEntry[]>([]);
  const [recentActions, setRecentActions] = useState<AIAction[]>([]);
  const [restrictedApps, setRestrictedApps] = useState<string[]>([]);
  const [allApps, setAllApps] = useState<MonitoredApp[]>([]);
  const [schedule, setSchedule] = useState<Schedule>({
    schoolStart: 8,
    schoolEnd: 14,
    bedtime: 21,
  });
  const [sensitivity, setSensitivity] = useState(2);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appsRef = useRef<MonitoredApp[]>([]);

  useEffect(() => {
    loadData();
    refreshInstalledApps();
  }, []);

  useEffect(() => {
    appsRef.current = allApps;
  }, [allApps]);

  useEffect(() => {
    setNativeRestrictedApps(restrictedApps).catch(() => {});
  }, [restrictedApps]);

  async function loadData() {
    try {
      const stored = await AsyncStorage.getItem("@guardian_data");
      if (stored) {
        const data = JSON.parse(stored);
        if (Array.isArray(data.restrictedApps)) setRestrictedApps(data.restrictedApps);
        if (data.schedule) setSchedule(data.schedule);
        if (typeof data.sensitivity === "number") setSensitivity(data.sensitivity);
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

      if (usage.length === 0) {
        setCurrentApp(null);
        return;
      }

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
    } catch {
      setCurrentApp(null);
    }
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
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
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
