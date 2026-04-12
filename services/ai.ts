import type { AppMode } from "@/context/MonitoringContext";
import { classifyPackage, isModeBlocked } from "@/context/MonitoringContext";

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
  currentMode: AppMode;
  restrictedApps: string[];
  tasksCompleted?: boolean;
}

export interface AnalyzeResult {
  decision: "allow" | "warn" | "close";
  reason: string;
  message: string;
}

export function localAnalyzeWithMode(data: AnalyzeRequest): AnalyzeResult {
  const category = classifyPackage(data.packageName, data.appName);
  const isBlocked = isModeBlocked(data.currentMode, data.packageName, data.appName, data.restrictedApps);

  if (data.currentMode === "sleep") {
    return {
      decision: "close",
      reason: `Es hora de dormir. Guardian bloquea ${data.appName} automaticamente.`,
      message: "Modo dormir activo. Descansa bien.",
    };
  }

  if (data.currentMode === "school") {
    if (category === "system") {
      return { decision: "allow", reason: "App del sistema permitida en horario escolar.", message: "Permitida por Guardian." };
    }
    return {
      decision: "close",
      reason: `Modo colegio activo. ${data.appName} no esta permitida en horas de clase.`,
      message: "Estas en horario escolar. Concéntrate en clases.",
    };
  }

  if (data.currentMode === "lunch") {
    if (category === "social") {
      return {
        decision: "allow",
        reason: `${data.appName} es una app social permitida en el almuerzo.`,
        message: "Modo almuerzo: solo apps sociales permitidas.",
      };
    }
    if (category === "game") {
      return {
        decision: "close",
        reason: "Los juegos no están permitidos durante el almuerzo.",
        message: "Modo almuerzo: solo TikTok e Instagram están disponibles.",
      };
    }
    if (isBlocked) {
      return {
        decision: "close",
        reason: `${data.appName} no está en la lista de apps permitidas para el almuerzo.`,
        message: "Solo puedes usar apps sociales durante el almuerzo.",
      };
    }
    return { decision: "allow", reason: "Permitida durante el almuerzo.", message: "Guardian permite esta app." };
  }

  if (data.currentMode === "study") {
    if (category === "game") {
      return {
        decision: "close",
        reason: "Los juegos no están permitidos en modo estudio.",
        message: "Primero termina de estudiar.",
      };
    }
    if (category === "social") {
      if (data.tasksCompleted) {
        return { decision: "warn", reason: `${data.appName} disponible porque completaste las tareas. Limite de 20 minutos.`, message: "Buen trabajo. Disfruta con moderacion." };
      }
      return {
        decision: "close",
        reason: `${data.appName} está bloqueada hasta que completes las tareas de estudio.`,
        message: "Completa tus tareas primero. Guardian te lo recordara.",
      };
    }
    if (category === "educational") {
      return { decision: "allow", reason: "App educativa permitida en modo estudio.", message: "Excelente eleccion para estudiar." };
    }
    if (isBlocked) {
      return { decision: "close", reason: `${data.appName} esta restringida en modo estudio.`, message: "Enfocate en el estudio." };
    }
    if (data.usageMinutes >= 45) {
      return { decision: "warn", reason: `${data.appName} lleva mucho tiempo en uso. Toma un descanso.`, message: "Recuerda descansar la vista cada 45 minutos." };
    }
    return { decision: "allow", reason: "Permitida en modo estudio.", message: "Guardian monitorea tu actividad." };
  }

  if (isBlocked || data.usageMinutes >= 30) {
    return {
      decision: "warn",
      reason: `${data.appName} puede distraer o ya tiene mucho tiempo de uso.`,
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
    return localAnalyzeWithMode(data);
  }
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function localStudyTutor(message: string, history: ChatMessage[]): string {
  const lower = message.toLowerCase();
  const prevMessages = history.filter(m => m.role === "user").length;

  const isAskingAnswer = lower.includes("respuesta") || lower.includes("solucion") || lower.includes("resultado") || lower.includes("cuanto es") || lower.includes("como se hace") || lower.includes("dame la") || lower.includes("dime la");
  const seemsToUnderstand = lower.includes("entend") || lower.includes("ya se") || lower.includes("es correcto") || lower.includes("entonces es") || lower.includes("creo que es");
  const isGivingAnswer = /^\d+/.test(lower.trim()) || lower.includes("la respuesta es");
  const isMathProblem = lower.includes("suma") || lower.includes("resta") || lower.includes("multiplic") || lower.includes("divid") || lower.includes("ecuacion") || lower.includes("fraccion") || lower.includes("algebra");
  const isGeography = lower.includes("capital") || lower.includes("pais") || lower.includes("mapa") || lower.includes("continente");
  const isHistory = lower.includes("historia") || lower.includes("guerra") || lower.includes("revolution") || lower.includes("independencia");
  const isScience = lower.includes("celula") || lower.includes("atomo") || lower.includes("molecula") || lower.includes("planeta") || lower.includes("animal") || lower.includes("planta");
  const isLanguage = lower.includes("verbo") || lower.includes("gramatica") || lower.includes("sinonimo") || lower.includes("antonimo") || lower.includes("oracion") || lower.includes("punto");

  if (isAskingAnswer && prevMessages < 2) {
    if (isMathProblem) {
      return "Antes de darte la respuesta, intentemos resolverlo juntos. Primero dime: ¿que tipo de operacion crees que hay que hacer aqui? ¿Suma, resta, multiplicacion o division?";
    }
    return "Me encantaria guiarte para que lo descubras tu mismo. Cuéntame: ¿que ya sabes sobre este tema? Empezamos desde ahi.";
  }

  if (seemsToUnderstand && prevMessages >= 1) {
    return "Muy bien! Explícame con tus propias palabras lo que entendiste, y si es correcto te confirmo la respuesta completa.";
  }

  if (isGivingAnswer) {
    const affirmations = ["Excelente razonamiento", "Eso es correcto", "Muy bien", "Perfecto"];
    const pick = affirmations[prevMessages % affirmations.length];
    return `${pick}! Notaste que llegaste a esa conclusion usando la logica del problema. Ahora intenta explicarme por que es correcto ese resultado, para asegurarnos de que lo entendiste del todo.`;
  }

  if (isMathProblem) {
    return "En matematicas lo importante es el proceso. Dime que pasos darias para resolver esto, y te ayudo si te equivocas en alguno.";
  }

  if (isGeography) {
    return "Para geografia es util pensar en las regiones y sus caracteristicas. ¿Que pistas ya tienes? ¿En que continente crees que buscar?";
  }

  if (isHistory) {
    return "La historia tiene causas y consecuencias. Piensa: ¿que situacion provoco este evento? Eso te dara la clave.";
  }

  if (isScience) {
    return "En ciencias todo tiene una logica. ¿Que caracteristicas del tema recuerdas? Empieza por ahi y te guio.";
  }

  if (isLanguage) {
    return "Para esto, analiza la oracion completa. ¿Puedes identificar el sujeto y el predicado? Eso nos dara el camino.";
  }

  return "Cuéntame mas sobre tu tarea. Entre mas detalles me des, mejor puedo ayudarte a encontrar la respuesta por ti mismo.";
}

function localChat(message: string, usageContext: Record<string, unknown>): string {
  const usage = Array.isArray(usageContext.uso_hoy) ? usageContext.uso_hoy : [];
  const lower = message.toLowerCase();
  const mode = usageContext.modo_actual as string ?? "free";

  if (mode === "study" || mode === "school") {
    return localStudyTutor(message, []);
  }

  if (usage.length === 0) {
    return "Todavia no veo actividad del dispositivo. Activa Acceso al uso de apps, abre algunas aplicaciones y vuelve a iniciar el monitoreo.";
  }

  if (lower.includes("uso") || lower.includes("tiempo") || lower.includes("app")) {
    const summary = usage.slice(0, 3).map((e) => {
      const item = e as { app?: string; minutos?: number };
      return `${item.app ?? "App"}: ${item.minutos ?? 0} min`;
    }).join(", ");
    return `Veo estas apps con actividad hoy: ${summary}. Puedes marcar como restringidas las que sean distraccion.`;
  }

  return "Estoy conectado. Puedo ayudarte a revisar el uso real de apps, elegir restricciones y explicar las decisiones de Guardian.";
}

async function emitLocalReply(text: string, onChunk: (text: string) => void, onDone: () => void) {
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
    const mode = usageContext.modo_actual as string ?? "free";
    let reply: string;
    if (mode === "study") {
      reply = localStudyTutor(message, history);
    } else {
      reply = localChat(message, usageContext);
    }
    await emitLocalReply(reply, onChunk, onDone);
  }
}
