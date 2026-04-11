const DEFAULT_DOMAIN = "a43b924a-f0ef-4c28-85d2-21942eebaeb4-00-3vrf51um4ch25.riker.replit.dev";
const configuredDomain = process.env.EXPO_PUBLIC_DOMAIN?.replace(/^https?:\/\//, "").replace(/\/$/, "");
const BASE = `https://${configuredDomain || DEFAULT_DOMAIN}`;

export interface AnalyzeRequest {
  appName: string;
  packageName: string;
  usageMinutes: number;
  timeOfDay: string;
  isSchoolHours: boolean;
  isNightTime: boolean;
  restrictedApps: string[];
}

export interface AnalyzeResult {
  decision: "allow" | "warn" | "close";
  reason: string;
  message: string;
}

function localAnalyze(data: AnalyzeRequest): AnalyzeResult {
  const isRestricted = data.restrictedApps.includes(data.packageName);

  if (data.isNightTime && (isRestricted || data.usageMinutes >= 10)) {
    return {
      decision: "close",
      reason: `Es hora de dormir y ${data.appName} no debe seguir abierta.`,
      message: `Guardian recomienda cerrar ${data.appName} ahora.`,
    };
  }

  if (data.isSchoolHours && isRestricted) {
    return {
      decision: "close",
      reason: `${data.appName} esta restringida durante horario escolar.`,
      message: `Durante clases, Guardian debe bloquear ${data.appName}.`,
    };
  }

  if (isRestricted || data.usageMinutes >= 30) {
    return {
      decision: "warn",
      reason: `${data.appName} puede distraer o ya tiene mucho tiempo de uso hoy.`,
      message: "Guardian recomienda hacer una pausa.",
    };
  }

  return {
    decision: "allow",
    reason: `${data.appName} no supera las reglas actuales.`,
    message: "Guardian permite continuar con monitoreo activo.",
  };
}

export async function analyzeApp(data: AnalyzeRequest): Promise<AnalyzeResult> {
  try {
    const res = await fetch(`${BASE}/api/ai/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Error al analizar app");
    return res.json();
  } catch {
    return localAnalyze(data);
  }
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function localChat(message: string, usageContext: Record<string, unknown>) {
  const usage = Array.isArray(usageContext.uso_hoy) ? usageContext.uso_hoy : [];
  const lower = message.toLowerCase();

  if (usage.length === 0) {
    return "Todavia no veo actividad real del dispositivo. Activa Acceso al uso de apps, abre algunas aplicaciones en el telefono y vuelve a iniciar el monitoreo.";
  }

  if (lower.includes("uso") || lower.includes("tiempo") || lower.includes("app")) {
    const summary = usage
      .slice(0, 3)
      .map((entry) => {
        const item = entry as { app?: string; minutos?: number };
        return `${item.app ?? "App"}: ${item.minutos ?? 0} min`;
      })
      .join(", ");
    return `Veo estas apps con actividad hoy: ${summary}. Puedes marcar como restringidas las que sean distraccion.`;
  }

  return "Estoy conectado. Puedo ayudarte a revisar el uso real de apps, elegir restricciones y explicar las decisiones de Guardian.";
}

async function emitLocalReply(
  text: string,
  onChunk: (text: string) => void,
  onDone: () => void
) {
  const chunks = text.match(/.{1,34}(\s|$)/g) ?? [text];
  for (const chunk of chunks) {
    onChunk(chunk);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  onDone();
}

export async function streamChat(
  message: string,
  history: ChatMessage[],
  usageContext: Record<string, unknown>,
  onChunk: (text: string) => void,
  onDone: () => void
) {
  try {
    const { fetch: expoFetch } = await import("expo/fetch");
    const res = await expoFetch(`${BASE}/api/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history, usageContext }),
    });

    if (!res.ok || !res.body) throw new Error("Error al conectar con la IA");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) onChunk(data.content);
            if (data.done) onDone();
          } catch {}
        }
      }
    }
    onDone();
  } catch {
    await emitLocalReply(localChat(message, usageContext), onChunk, onDone);
  }
}
