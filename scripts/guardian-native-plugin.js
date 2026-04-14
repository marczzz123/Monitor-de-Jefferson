const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function addPermission(manifest, name) {
  manifest["uses-permission"] = manifest["uses-permission"] || [];
  const exists = manifest["uses-permission"].some((permission) => permission.$["android:name"] === name);
  if (!exists) manifest["uses-permission"].push({ $: { "android:name": name } });
}

function addApplicationItem(application, key, name, item) {
  application[key] = application[key] || [];
  const exists = application[key].some((entry) => entry.$["android:name"] === name);
  if (!exists) application[key].push(item);
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function injectPackage(androidRoot) {
  const candidates = [
    path.join(androidRoot, "app/src/main/java/com/guardian/controlparental/MainApplication.kt"),
    path.join(androidRoot, "app/src/main/java/com/guardian/controlparental/MainApplication.java"),
  ];
  const mainApplication = candidates.find((candidate) => fs.existsSync(candidate));
  if (!mainApplication) return;
  let content = fs.readFileSync(mainApplication, "utf8");

  if (mainApplication.endsWith(".kt")) {
    if (!content.includes("import com.guardian.controlparental.GuardianNativePackage")) {
      content = content.replace(
        "import com.facebook.react.ReactApplication",
        "import com.facebook.react.ReactApplication\nimport com.guardian.controlparental.GuardianNativePackage"
      );
    }
    if (!content.includes("add(GuardianNativePackage())")) {
      if (content.includes("PackageList(this).packages.apply {")) {
        content = content.replace(
          "PackageList(this).packages.apply {",
          "PackageList(this).packages.apply {\n              add(GuardianNativePackage())"
        );
      } else {
        content = content.replace(
          /return packages/g,
          "packages.add(GuardianNativePackage())\n            return packages"
        );
      }
    }
  } else {
    if (!content.includes("import com.guardian.controlparental.GuardianNativePackage;")) {
      content = content.replace(
        "import com.facebook.react.ReactApplication;",
        "import com.facebook.react.ReactApplication;\nimport com.guardian.controlparental.GuardianNativePackage;"
      );
    }
    if (!content.includes("new GuardianNativePackage()")) {
      content = content.replace(
        /return packages;/g,
        "packages.add(new GuardianNativePackage());\n            return packages;"
      );
    }
  }
  fs.writeFileSync(mainApplication, content);
}

const nativePackage = `package com.guardian.controlparental;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class GuardianNativePackage implements ReactPackage {
  @Override
  public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
    List<NativeModule> modules = new ArrayList<>();
    modules.add(new GuardianDeviceAppsModule(reactContext));
    return modules;
  }

  @Override
  public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
    return Collections.emptyList();
  }
}
`;

const nativeModule = `package com.guardian.controlparental;

import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;
import android.text.TextUtils;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class GuardianDeviceAppsModule extends ReactContextBaseJavaModule {
  private static final String PREFS_NAME = "guardian_native";
  private static final String RESTRICTED_KEY = "restricted_packages";
  private static final String MONITORING_KEY = "monitoring_enabled";
  private static final String MODE_KEY = "current_mode";
  private final ReactApplicationContext reactContext;

  public GuardianDeviceAppsModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
  }

  @Override
  public String getName() {
    return "GuardianDeviceApps";
  }

  @ReactMethod
  public void getInstalledApps(Promise promise) {
    try {
      PackageManager pm = reactContext.getPackageManager();
      Intent intent = new Intent(Intent.ACTION_MAIN, null);
      intent.addCategory(Intent.CATEGORY_LAUNCHER);
      List<ResolveInfo> apps = pm.queryIntentActivities(intent, 0);
      Collections.sort(apps, new ResolveInfo.DisplayNameComparator(pm));
      Set<String> seen = new HashSet<>();
      WritableArray result = Arguments.createArray();

      for (ResolveInfo info : apps) {
        if (info.activityInfo == null || info.activityInfo.packageName == null) continue;
        String packageName = info.activityInfo.packageName;
        if (packageName.equals(reactContext.getPackageName()) || seen.contains(packageName)) continue;
        seen.add(packageName);
        String label = String.valueOf(info.loadLabel(pm));
        WritableMap app = Arguments.createMap();
        app.putString("name", label);
        app.putString("packageName", packageName);
        app.putString("category", inferCategory(label, packageName));
        app.putString("icon", inferIcon(label, packageName));
        result.pushMap(app);
      }
      promise.resolve(result);
    } catch (Exception error) {
      promise.reject("INSTALLED_APPS_ERROR", error);
    }
  }

  @ReactMethod
  public void getUsageStats(Promise promise) {
    try {
      WritableArray result = Arguments.createArray();
      if (!hasUsagePermission()) {
        promise.resolve(result);
        return;
      }

      UsageStatsManager manager = (UsageStatsManager) reactContext.getSystemService(Context.USAGE_STATS_SERVICE);
      if (manager == null) {
        promise.resolve(result);
        return;
      }

      long now = System.currentTimeMillis();
      Calendar calendar = Calendar.getInstance();
      calendar.set(Calendar.HOUR_OF_DAY, 0);
      calendar.set(Calendar.MINUTE, 0);
      calendar.set(Calendar.SECOND, 0);
      calendar.set(Calendar.MILLISECOND, 0);
      long start = calendar.getTimeInMillis();
      List<UsageStats> stats = manager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, now);
      if (stats == null) {
        promise.resolve(result);
        return;
      }

      Collections.sort(stats, new Comparator<UsageStats>() {
        @Override
        public int compare(UsageStats left, UsageStats right) {
          return Long.compare(right.getLastTimeUsed(), left.getLastTimeUsed());
        }
      });

      PackageManager pm = reactContext.getPackageManager();
      Set<String> seen = new HashSet<>();
      for (UsageStats stat : stats) {
        String packageName = stat.getPackageName();
        long total = stat.getTotalTimeInForeground();
        if (packageName == null || seen.contains(packageName) || total <= 0 || packageName.equals(reactContext.getPackageName())) continue;
        seen.add(packageName);
        String label = packageName;
        try {
          label = String.valueOf(pm.getApplicationLabel(pm.getApplicationInfo(packageName, 0)));
        } catch (Exception ignored) {}

        WritableMap app = Arguments.createMap();
        app.putString("name", label);
        app.putString("packageName", packageName);
        app.putString("category", inferCategory(label, packageName));
        app.putString("icon", inferIcon(label, packageName));
        app.putInt("minutes", Math.max(1, (int) Math.ceil(total / 60000.0)));
        app.putDouble("lastTimeUsed", stat.getLastTimeUsed());
        result.pushMap(app);
      }
      promise.resolve(result);
    } catch (Exception error) {
      promise.reject("USAGE_STATS_ERROR", error);
    }
  }

  @ReactMethod
  public void hasUsageStatsPermission(Promise promise) {
    promise.resolve(hasUsagePermission());
  }

  @ReactMethod
  public void isAccessibilityServiceEnabled(Promise promise) {
    promise.resolve(isGuardianAccessibilityEnabled());
  }

  @ReactMethod
  public void setRestrictedApps(ReadableArray packageNames, Promise promise) {
    try {
      Set<String> packages = new HashSet<>();
      for (int i = 0; i < packageNames.size(); i++) {
        String packageName = packageNames.getString(i);
        if (packageName != null && packageName.length() > 0) packages.add(packageName);
      }
      getPrefs().edit().putStringSet(RESTRICTED_KEY, packages).apply();
      promise.resolve(true);
    } catch (Exception error) {
      promise.reject("RESTRICTED_APPS_ERROR", error);
    }
  }

  @ReactMethod
  public void setCurrentMode(String mode, Promise promise) {
    try {
      getPrefs().edit().putString(MODE_KEY, mode).apply();
      promise.resolve(true);
    } catch (Exception error) {
      promise.reject("SET_MODE_ERROR", error);
    }
  }

  @ReactMethod
  public void startMonitoringService(Promise promise) {
    try {
      getPrefs().edit().putBoolean(MONITORING_KEY, true).apply();
      Intent intent = new Intent(reactContext, GuardianMonitoringService.class);
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        reactContext.startForegroundService(intent);
      } else {
        reactContext.startService(intent);
      }
      promise.resolve(true);
    } catch (Exception error) {
      promise.reject("SERVICE_START_ERROR", error);
    }
  }

  @ReactMethod
  public void stopMonitoringService(Promise promise) {
    try {
      getPrefs().edit().putBoolean(MONITORING_KEY, false).apply();
      Intent intent = new Intent(reactContext, GuardianMonitoringService.class);
      reactContext.stopService(intent);
      promise.resolve(true);
    } catch (Exception error) {
      promise.reject("SERVICE_STOP_ERROR", error);
    }
  }

  private SharedPreferences getPrefs() {
    return reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
  }

  private boolean hasUsagePermission() {
    try {
      AppOpsManager appOps = (AppOpsManager) reactContext.getSystemService(Context.APP_OPS_SERVICE);
      if (appOps == null) return false;
      int mode;
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        mode = appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), reactContext.getPackageName());
      } else {
        mode = appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), reactContext.getPackageName());
      }
      return mode == AppOpsManager.MODE_ALLOWED;
    } catch (Exception error) {
      return false;
    }
  }

  private boolean isGuardianAccessibilityEnabled() {
    String expected = new ComponentName(reactContext, GuardianAccessibilityService.class).flattenToString();
    String enabledServices = Settings.Secure.getString(reactContext.getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
    if (enabledServices == null) return false;
    TextUtils.SimpleStringSplitter splitter = new TextUtils.SimpleStringSplitter(':');
    splitter.setString(enabledServices);
    while (splitter.hasNext()) {
      if (expected.equalsIgnoreCase(splitter.next())) return true;
    }
    return false;
  }

  private String inferCategory(String label, String packageName) {
    String text = (label + " " + packageName).toLowerCase();
    if (text.contains("youtube") || text.contains("tiktok") || text.contains("instagram") || text.contains("facebook") || text.contains("snapchat")) return "distraction";
    if (text.contains("roblox") || text.contains("freefire") || text.contains("free.fire") || text.contains("game") || text.contains("games") || text.contains("gaming") || text.contains("minecraft") || text.contains("clash") || text.contains("brawl") || text.contains("pubg") || text.contains("fortnite") || text.contains("garena") || text.contains("moonton") || text.contains("mobile.legends") || text.contains("subway") || text.contains("templerun") || text.contains("among") || text.contains("playrix") || text.contains("miniclip") || text.contains("zynga") || text.contains("netmarble") || text.contains("mihoyo") || text.contains("hoyoverse") || text.contains("genshin") || text.contains("tencent") || text.contains("riotgames") || text.contains("wildrift") || text.contains("steam") || text.contains("nintendo") || text.contains("pokemon") || text.contains("epicgames") || text.contains("voodoo") || text.contains("saygames")) return "distraction";
    if (text.contains("classroom") || text.contains("duolingo") || text.contains("khan") || text.contains("meet") || text.contains("zoom") || text.contains("calculator") || text.contains("school") || text.contains("learn")) return "educational";
    return "neutral";
  }

  private String inferIcon(String label, String packageName) {
    String text = (label + " " + packageName).toLowerCase();
    if (text.contains("youtube") || text.contains("video")) return "play-circle";
    if (text.contains("instagram") || text.contains("camera")) return "camera";
    if (text.contains("whatsapp") || text.contains("message")) return "message-circle";
    if (text.contains("chrome") || text.contains("browser")) return "globe";
    if (text.contains("game") || text.contains("roblox") || text.contains("freefire")) return "crosshair";
    if (text.contains("school") || text.contains("learn") || text.contains("classroom")) return "book-open";
    return "smartphone";
  }
}
`;

const service = `package com.guardian.controlparental;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

public class GuardianMonitoringService extends Service {
  private static final String CHANNEL_ID = "guardian_monitoring";
  private static final int NOTIFICATION_ID = 2001;

  @Override
  public void onCreate() {
    super.onCreate();
    createChannel();
    startForeground(NOTIFICATION_ID, buildNotification());
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    startForeground(NOTIFICATION_ID, buildNotification());
    return START_STICKY;
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  private Notification buildNotification() {
    int icon = getApplicationInfo().icon;
    if (icon == 0) icon = android.R.drawable.ic_dialog_info;
    Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
      ? new Notification.Builder(this, CHANNEL_ID)
      : new Notification.Builder(this);
    return builder
      .setSmallIcon(icon)
      .setContentTitle("Guardian monitoreando")
      .setContentText("Control parental activo revisando el uso de apps")
      .setOngoing(true)
      .build();
  }

  private void createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Guardian monitoreo", NotificationManager.IMPORTANCE_LOW);
      NotificationManager manager = getSystemService(NotificationManager.class);
      if (manager != null) manager.createNotificationChannel(channel);
    }
  }
}
`;

const accessibilityService = `package com.guardian.controlparental;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.SystemClock;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class GuardianAccessibilityService extends AccessibilityService {
  private static final String PREFS_NAME = "guardian_native";
  private static final String RESTRICTED_KEY = "restricted_packages";
  private static final String MONITORING_KEY = "monitoring_enabled";
  private static final String MODE_KEY = "current_mode";
  private long lastBlockAt = 0;
  private String lastBlockedPackage = "";

  private static final List<String> LUNCH_ALLOWED = Arrays.asList(
    "com.zhiliaoapp.musically",
    "com.ss.android.ugc.trill",
    "com.ss.android.ugc.aweme",
    "com.instagram.android"
  );

  private static final String[] GAME_KEYWORDS = {
    "game", "games", "gaming", "roblox", "freefire", "free.fire", "minecraft",
    "clash", "brawl", "pubg", "fortnite", "garena", "moonton", "mobile.legends",
    "mlbb", "subway", "templerun", "among", "playrix", "miniclip", "zynga",
    "netmarble", "mihoyo", "hoyoverse", "genshin", "tencent", "riotgames",
    "wildrift", "steam", "nintendo", "pokemon", "epicgames", "voodoo", "saygames",
    "candy", "candy.crush", "king.com", "supercell", "gameloft", "ubisoft",
    "ea.games", "eagames", "callofduty", "honorofkings", "playdemic"
  };

  // Navegadores donde se chequea la URL
  private static final String[] BROWSER_PACKAGES = {
    "com.android.chrome",
    "com.chrome.beta",
    "com.chrome.dev",
    "org.mozilla.firefox",
    "org.mozilla.fenix",
    "com.opera.browser",
    "com.opera.mini.native",
    "com.sec.android.app.sbrowser",
    "com.UCMobile.intl",
    "com.brave.browser",
    "com.microsoft.emmx",
    "com.duckduckgo.mobile.android",
    "com.kiwibrowser.browser"
  };

  // Dominios de IA bloqueados en modo escuela/estudio
  private static final String[] BLOCKED_URL_KEYWORDS = {
    "chatgpt.com", "chat.openai.com", "openai.com",
    "gemini.google.com", "bard.google.com",
    "claude.ai", "anthropic.com",
    "perplexity.ai",
    "copilot.microsoft.com", "bing.com/chat",
    "character.ai", "you.com", "poe.com",
    "gpt", "chat-gpt"
  };

  // Clases/pantallas de Ajustes de Accesibilidad que Jefferson podria usar para desactivar el servicio
  private static final String[] ACCESSIBILITY_SETTINGS_CLASSES = {
    "com.android.settings.accessibility.AccessibilitySettings",
    "com.android.settings.accessibility.AccessibilityDetailsSettingsActivity",
    "com.android.settings.accessibility.ToggleAccessibilityServicePreferenceFragment",
    "com.android.settings.SubSettings",
    "com.samsung.accessibility.AccessibilitySettings"
  };

  // Paquetes de Ajustes del sistema
  private static final String[] SETTINGS_PACKAGES = {
    "com.android.settings",
    "com.samsung.android.settings",
    "com.miui.securitycenter",
    "com.coloros.safecenter",
    "com.huawei.systemmanager"
  };

  private static final String[] SYSTEM_PREFIXES = {
    "android.", "com.google.android.gms", "com.google.android.gsf",
    "com.google.android.inputmethod", "com.qualcomm.", "com.mediatek."
  };

  @Override
  public void onAccessibilityEvent(AccessibilityEvent event) {
    if (event == null || event.getPackageName() == null) return;
    int type = event.getEventType();

    SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    if (!prefs.getBoolean(MONITORING_KEY, false)) return;

    String packageName = event.getPackageName().toString();
    if (packageName.equals(getPackageName())) return;

    String mode = prefs.getString(MODE_KEY, "free");

    // 1. PROTECCION DE ACCESIBILIDAD: bloquear pantallas de Ajustes que desactivan este servicio
    if (isSettingsApp(packageName) && isRestrictiveMode(mode)) {
      String className = event.getClassName() != null ? event.getClassName().toString() : "";
      boolean isAccessibilityScreen = false;
      for (String ac : ACCESSIBILITY_SETTINGS_CLASSES) {
        if (className.equals(ac)) { isAccessibilityScreen = true; break; }
      }
      // Si no coincide exactamente, chequeamos por keywords en el título de la ventana
      if (!isAccessibilityScreen && event.getText() != null) {
        for (CharSequence txt : event.getText()) {
          if (txt != null) {
            String t = txt.toString().toLowerCase();
            if (t.contains("accesibilidad") || t.contains("accessibility") || t.contains("guardian")) {
              isAccessibilityScreen = true;
              break;
            }
          }
        }
      }
      // También bloqueamos si la clase es SubSettings (pantalla genérica dentro de Ajustes)
      if (!isAccessibilityScreen && className.contains("SubSettings")) {
        isAccessibilityScreen = true;
      }
      if (isAccessibilityScreen) {
        long nowA = SystemClock.elapsedRealtime();
        if (!"settings_block".equals(lastBlockedPackage) || nowA - lastBlockAt > 2000) {
          lastBlockedPackage = "settings_block";
          lastBlockAt = nowA;
          performGlobalAction(GLOBAL_ACTION_HOME);
        }
        return;
      }
      return; // Otras pantallas de Ajustes se permiten
    }

    // 2. Solo procesar eventos de cambio de ventana para lo demás
    if (type != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED && type != AccessibilityEvent.TYPE_WINDOWS_CHANGED) {
      // Para navegadores también procesamos TYPE_WINDOW_CONTENT_CHANGED
      if (type != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) return;
    }

    // 3. BLOQUEO DE SITIOS WEB DE IA en navegadores (modo escuela/estudio)
    if (isBrowserApp(packageName) && isRestrictiveMode(mode)) {
      // Chequear URL desde los textos del evento
      if (event.getText() != null) {
        for (CharSequence text : event.getText()) {
          if (text != null && isBlockedUrl(text.toString())) {
            blockNow(packageName);
            return;
          }
        }
      }
      // Chequear la descripción del contenido
      CharSequence desc = event.getContentDescription();
      if (desc != null && isBlockedUrl(desc.toString())) {
        blockNow(packageName);
        return;
      }
      // Chequear árbol de nodos (URL bar)
      if (type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED || type == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
        try {
          AccessibilityNodeInfo root = getRootInActiveWindow();
          if (root != null) {
            String foundUrl = findUrlInTree(root, 0);
            root.recycle();
            if (foundUrl != null && isBlockedUrl(foundUrl)) {
              blockNow(packageName);
              return;
            }
          }
        } catch (Exception ignored) {}
      }
      return; // No bloquear el navegador en sí, solo la URL
    }

    // 4. Apps del sistema puras → siempre permitidas
    if (isSystemApp(packageName)) return;

    Set<String> restricted = new HashSet<>(prefs.getStringSet(RESTRICTED_KEY, Collections.<String>emptySet()));
    boolean shouldBlock = false;

    if ("sleep".equals(mode)) {
      shouldBlock = true;
    } else if ("school".equals(mode)) {
      shouldBlock = restricted.contains(packageName);
    } else if ("lunch".equals(mode)) {
      shouldBlock = !LUNCH_ALLOWED.contains(packageName);
    } else if ("study".equals(mode)) {
      shouldBlock = restricted.contains(packageName) || isGameApp(packageName);
    } else {
      shouldBlock = restricted.contains(packageName);
    }

    if (shouldBlock) blockNow(packageName);
  }

  @Override
  public void onInterrupt() {}

  private void blockNow(String packageName) {
    long now = SystemClock.elapsedRealtime();
    if (packageName.equals(lastBlockedPackage) && now - lastBlockAt < 1500) return;
    lastBlockedPackage = packageName;
    lastBlockAt = now;
    performGlobalAction(GLOBAL_ACTION_HOME);
  }

  private boolean isRestrictiveMode(String mode) {
    return "school".equals(mode) || "study".equals(mode) || "sleep".equals(mode);
  }

  private boolean isSettingsApp(String packageName) {
    for (String s : SETTINGS_PACKAGES) {
      if (s.equals(packageName)) return true;
    }
    return false;
  }

  private boolean isBrowserApp(String packageName) {
    for (String b : BROWSER_PACKAGES) {
      if (b.equals(packageName)) return true;
    }
    return false;
  }

  private boolean isBlockedUrl(String text) {
    if (text == null || text.length() > 500) return false;
    String lower = text.toLowerCase();
    for (String keyword : BLOCKED_URL_KEYWORDS) {
      if (lower.contains(keyword)) return true;
    }
    return false;
  }

  private String findUrlInTree(AccessibilityNodeInfo node, int depth) {
    if (node == null || depth > 4) return null;
    CharSequence text = node.getText();
    if (text != null) {
      String t = text.toString();
      if (t.length() < 300 && (t.startsWith("http") || t.startsWith("www.") || t.contains(".com") || t.contains(".ai"))) {
        return t;
      }
    }
    for (int i = 0; i < Math.min(node.getChildCount(), 8); i++) {
      AccessibilityNodeInfo child = node.getChild(i);
      String url = findUrlInTree(child, depth + 1);
      if (child != null) child.recycle();
      if (url != null) return url;
    }
    return null;
  }

  private boolean isSystemApp(String packageName) {
    for (String prefix : SYSTEM_PREFIXES) {
      if (packageName.startsWith(prefix)) return true;
    }
    return false;
  }

  private boolean isGameApp(String packageName) {
    String pkg = packageName.toLowerCase();
    for (String keyword : GAME_KEYWORDS) {
      if (pkg.contains(keyword)) return true;
    }
    return false;
  }
}
`;

const receiver = `package com.guardian.controlparental;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public class GuardianBootReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    if (intent == null || !Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
    Intent serviceIntent = new Intent(context, GuardianMonitoringService.class);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(serviceIntent);
    } else {
      context.startService(serviceIntent);
    }
  }
}
`;

const accessibilityConfig = `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
  android:accessibilityEventTypes="typeWindowStateChanged|typeWindowsChanged|typeWindowContentChanged|typeViewTextChanged"
  android:accessibilityFeedbackType="feedbackGeneric"
  android:accessibilityFlags="flagReportViewIds"
  android:canRetrieveWindowContent="true"
  android:canPerformGestures="false"
  android:description="@string/guardian_accessibility_description"
  android:notificationTimeout="100" />
`;

module.exports = function withGuardianNative(config) {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    addPermission(manifest, "android.permission.QUERY_ALL_PACKAGES");
    addPermission(manifest, "android.permission.PACKAGE_USAGE_STATS");
    addPermission(manifest, "android.permission.FOREGROUND_SERVICE");
    addPermission(manifest, "android.permission.FOREGROUND_SERVICE_DATA_SYNC");
    addPermission(manifest, "android.permission.POST_NOTIFICATIONS");
    addPermission(manifest, "android.permission.RECEIVE_BOOT_COMPLETED");

    const application = manifest.application?.[0];
    if (application) {
      addApplicationItem(application, "service", ".GuardianMonitoringService", {
        $: {
          "android:name": ".GuardianMonitoringService",
          "android:exported": "false",
          "android:foregroundServiceType": "dataSync",
        },
      });
      addApplicationItem(application, "service", ".GuardianAccessibilityService", {
        $: {
          "android:name": ".GuardianAccessibilityService",
          "android:permission": "android.permission.BIND_ACCESSIBILITY_SERVICE",
          "android:exported": "true",
        },
        "intent-filter": [
          {
            action: [{ $: { "android:name": "android.accessibilityservice.AccessibilityService" } }],
          },
        ],
        "meta-data": [
          {
            $: {
              "android:name": "android.accessibilityservice",
              "android:resource": "@xml/guardian_accessibility_service",
            },
          },
        ],
      });
      addApplicationItem(application, "receiver", ".GuardianBootReceiver", {
        $: {
          "android:name": ".GuardianBootReceiver",
          "android:enabled": "true",
          "android:exported": "true",
        },
        "intent-filter": [
          {
            action: [{ $: { "android:name": "android.intent.action.BOOT_COMPLETED" } }],
          },
        ],
      });
    }
    return config;
  });

  return withDangerousMod(config, ["android", async (config) => {
    const androidRoot = config.modRequest.platformProjectRoot;
    const javaRoot = path.join(androidRoot, "app/src/main/java/com/guardian/controlparental");
    const resRoot = path.join(androidRoot, "app/src/main/res");
    writeFile(path.join(javaRoot, "GuardianNativePackage.java"), nativePackage);
    writeFile(path.join(javaRoot, "GuardianDeviceAppsModule.java"), nativeModule);
    writeFile(path.join(javaRoot, "GuardianMonitoringService.java"), service);
    writeFile(path.join(javaRoot, "GuardianAccessibilityService.java"), accessibilityService);
    writeFile(path.join(javaRoot, "GuardianBootReceiver.java"), receiver);
    writeFile(path.join(resRoot, "xml/guardian_accessibility_service.xml"), accessibilityConfig);

    const stringsPath = path.join(resRoot, "values/strings.xml");
    if (fs.existsSync(stringsPath)) {
      let strings = fs.readFileSync(stringsPath, "utf8");
      if (!strings.includes("guardian_accessibility_description")) {
        strings = strings.replace("</resources>", "  <string name=\"guardian_accessibility_description\">Permite que Guardian detecte apps restringidas y vuelva al inicio cuando se abran.</string>\n</resources>");
        fs.writeFileSync(stringsPath, strings);
      }
    }

    injectPackage(androidRoot);
    return config;
  }]);
};
