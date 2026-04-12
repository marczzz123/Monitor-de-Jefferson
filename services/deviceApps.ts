import { NativeModules, Platform } from "react-native";

export interface DeviceAppInfo {
  name: string;
  packageName: string;
  category: "distraction" | "educational" | "neutral";
  icon: string;
}

export interface DeviceUsageEntry extends DeviceAppInfo {
  minutes: number;
  lastTimeUsed: number;
}

interface GuardianDeviceAppsModule {
  getInstalledApps: () => Promise<DeviceAppInfo[]>;
  getUsageStats: () => Promise<DeviceUsageEntry[]>;
  hasUsageStatsPermission: () => Promise<boolean>;
  isAccessibilityServiceEnabled: () => Promise<boolean>;
  setRestrictedApps: (packageNames: string[]) => Promise<boolean>;
  startMonitoringService: () => Promise<boolean>;
  stopMonitoringService: () => Promise<boolean>;
}

const nativeModule = NativeModules.GuardianDeviceApps as GuardianDeviceAppsModule | undefined;

export async function getInstalledApps(): Promise<DeviceAppInfo[]> {
  if (Platform.OS !== "android" || !nativeModule?.getInstalledApps) return [];
  return nativeModule.getInstalledApps();
}

export async function getUsageStats(): Promise<DeviceUsageEntry[]> {
  if (Platform.OS !== "android" || !nativeModule?.getUsageStats) return [];
  return nativeModule.getUsageStats();
}

export async function hasUsageStatsPermission(): Promise<boolean> {
  if (Platform.OS !== "android" || !nativeModule?.hasUsageStatsPermission) return false;
  return nativeModule.hasUsageStatsPermission();
}

export async function isAccessibilityServiceEnabled(): Promise<boolean> {
  if (Platform.OS !== "android" || !nativeModule?.isAccessibilityServiceEnabled) return false;
  return nativeModule.isAccessibilityServiceEnabled();
}

export async function setRestrictedApps(packageNames: string[]): Promise<boolean> {
  if (Platform.OS !== "android" || !nativeModule?.setRestrictedApps) return false;
  return nativeModule.setRestrictedApps(packageNames);
}

export async function startMonitoringService(): Promise<boolean> {
  if (Platform.OS !== "android" || !nativeModule?.startMonitoringService) return false;
  return nativeModule.startMonitoringService();
}

export async function stopMonitoringService(): Promise<boolean> {
  if (Platform.OS !== "android" || !nativeModule?.stopMonitoringService) return false;
  return nativeModule.stopMonitoringService();
}
