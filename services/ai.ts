import type { AppMode } from "@/context/MonitoringContext";
import { classifyPackage, isModeBlocked } from "@/context/MonitoringContext";

const DEFAULT_DOMAIN = "a43b924a-f0ef-4c28-85d2-21942eebaeb4-00-3vrf51um4ch25.riker.replit.dev";
const configuredDomain = process.env.EXPO_PUBLIC_DOMAIN?.replace(/^https?:\/\//, "").replace(/\/$/, "");
const BASE = `https://${configuredDomain || DEFAULT_DOMAIN}`;

export const WEEKLY_SUBJECTS: Record<number, string[]> = {
  1: ["Geografía", "Lenguaje", "Inglés", "Cómputo"],
  2: ["Álgebra", "Aritmética", "Química"],
  3: ["Religión", "Literatura", "Razonamiento Matemático", "Historia del Perú"],
  4: ["Razonamiento Verbal", "Ed. Cívica", "Biología", "Geometría"],
  5: ["Inglés", "Historia Universal", "Trigonometría"],
};

const DAY_NAMES: Record<number, string> = {
  0: "domingo",
  1: "lunes",
  2: "martes",
  3: "miércoles",
  4: "jueves",
  5: "viernes",
  6: "sábado",
};

export function getTodaySubjects(): string[] {
  return WEEKLY_SUBJECTS[new Date().getDay()] ?? [];
}

export function getDayName(): string {
  return DAY_NAMES[new Date().getDay()] ?? "hoy";
}

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
      return { decision: "allow", reason: `${data.appName} es social, permitida en almuerzo.`, message: "Modo almuerzo: apps sociales disponibles." };
    }
    if (category === "game") {
      return { decision: "close", reason: "Juegos no permitidos durante almuerzo.", message: "Solo TikTok e Instagram disponibles ahora." };
    }
    if (isBlocked) {
      return { decision: "close", reason: `${data.appName} no está en la lista de almuerzo.`, message: "Solo apps sociales en el almuerzo." };
    }
    return { decision: "allow", reason: "Permitida durante el almuerzo.", message: "Guardian permite esta app." };
  }

  if (data.currentMode === "study") {
    if (category === "game") {
      return { decision: "close", reason: "Juegos no permitidos en modo estudio.", message: "Primero termina de estudiar." };
    }
    if (category === "social") {
      if (data.tasksCompleted) {
        return { decision: "warn", reason: `${data.appName} disponible por tareas completadas. Límite 20 min.`, message: "Buen trabajo. Disfruta con moderación." };
      }
      return { decision: "close", reason: `${data.appName} bloqueada hasta completar tareas.`, message: "Completa tus tareas primero." };
    }
    if (category === "educational") {
      return { decision: "allow", reason: "App educativa permitida en modo estudio.", message: "Excelente elección para estudiar." };
    }
    if (isBlocked) {
      return { decision: "close", reason: `${data.appName} restringida en modo estudio.`, message: "Enfócate en el estudio." };
    }
    if (data.usageMinutes >= 45) {
      return { decision: "warn", reason: "Llevas mucho tiempo. Descansa.", message: "Toma un descanso de 5 minutos." };
    }
    return { decision: "allow", reason: "Permitida en modo estudio.", message: "Guardian monitorea tu actividad." };
  }

  if (isBlocked || data.usageMinutes >= 30) {
    return { decision: "warn", reason: `${data.appName} puede distraer.`, message: "Guardian recomienda una pausa." };
  }

  return { decision: "allow", reason: `${data.appName} dentro de los límites.`, message: "Guardian permite continuar." };
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

function isAskingForApp(lower: string): boolean {
  return (
    lower.includes("quiero usar") ||
    lower.includes("puedo usar") ||
    lower.includes("abre") ||
    lower.includes("déjame usar") ||
    lower.includes("deja usar") ||
    lower.includes("tiktok") ||
    lower.includes("instagram") ||
    lower.includes("youtube") ||
    lower.includes("snapchat") ||
    lower.includes("facebook") ||
    lower.includes("jugar") ||
    lower.includes("free fire") ||
    lower.includes("freefire") ||
    lower.includes("roblox") ||
    lower.includes("minecraft") ||
    lower.includes("fortnite") ||
    lower.includes("pubg")
  );
}

function hasDiscussedHomework(history: ChatMessage[]): boolean {
  const userMsgs = history.filter(m => m.role === "user").map(m => m.content.toLowerCase());
  const keywords = ["tarea", "ejercicio", "problema", "materia", "clase", "examen", "práctica", "practica", "pregunta", "ayuda con", "como se", "cómo se", "qué es", "que es", "explica", "entend"];
  return userMsgs.some(msg => keywords.some(kw => msg.includes(kw)));
}

function detectSubject(message: string, subjects: string[]): string | null {
  const lower = message.toLowerCase();
  for (const sub of subjects) {
    if (lower.includes(sub.toLowerCase())) return sub;
    const words = sub.toLowerCase().split(" ");
    if (words.some(w => w.length > 4 && lower.includes(w))) return sub;
  }
  if (/algebra|algebr/.test(lower)) return "Álgebra";
  if (/aritm/.test(lower)) return "Aritmética";
  if (/trigonom/.test(lower)) return "Trigonometría";
  if (/geometr/.test(lower)) return "Geometría";
  if (/razon.*mat|mat.*razon/.test(lower)) return "Razonamiento Matemático";
  if (/razon.*verb|verb.*razon/.test(lower)) return "Razonamiento Verbal";
  if (/geograf/.test(lower)) return "Geografía";
  if (/historia.*per|peru/.test(lower)) return "Historia del Perú";
  if (/historia.*univ/.test(lower)) return "Historia Universal";
  if (/histor/.test(lower)) return "Historia";
  if (/ingles|inglés|english/.test(lower)) return "Inglés";
  if (/quimic/.test(lower)) return "Química";
  if (/biolog/.test(lower)) return "Biología";
  if (/literatur/.test(lower)) return "Literatura";
  if (/lenguaje|gramátic|gramatic|verbo|oracion/.test(lower)) return "Lenguaje";
  if (/civica|cívica|civismo/.test(lower)) return "Ed. Cívica";
  if (/religion|religión/.test(lower)) return "Religión";
  if (/computo|cómputo|computacion|informatica/.test(lower)) return "Cómputo";
  return null;
}

function getSubjectHint(subject: string, message: string, turnInSubject: number): string {
  const sub = subject.toLowerCase();
  const lower = message.toLowerCase();

  const pick = (arr: string[]) => arr[turnInSubject % arr.length];

  if (["álgebra", "aritmética", "trigonometría", "geometría", "razonamiento matemático"].some(s => sub.includes(s))) {
    return pick([
      `Para ${subject}, primero identifica qué tipo de operación necesitas. ¿Qué datos te da el problema?`,
      `Interesante! Antes de resolverlo, dime: ¿ya intentaste hacerlo? Cuéntame qué paso diste primero.`,
      `En matemáticas el proceso es lo importante. Organiza los datos que tienes y dime cuál es el primer paso que harías.`,
      `¿Has visto un ejemplo similar en clase? Cuéntame cómo lo resolvió tu profesor y lo comparamos con tu ejercicio.`,
      `Piensa: ¿qué fórmula o regla aprendiste que podría aplicarse aquí? No es necesario que sea la correcta, solo intenta.`,
    ]);
  }

  if (sub.includes("historia")) {
    return pick([
      `La historia tiene causas y consecuencias. Piensa: ¿quiénes son los personajes principales y qué situación los llevó a actuar así?`,
      `Para entender este evento histórico, pregúntate: ¿cuándo pasó, dónde y por qué fue importante? Eso te da la estructura de la respuesta.`,
      `¿Hay fechas o nombres clave que recuerdas del tema? Esos son tus puntos de apoyo. Dime qué sabes y construimos desde ahí.`,
    ]);
  }

  if (sub.includes("biolog")) {
    return pick([
      `En biología todo tiene una función. ¿El ejercicio habla de células, organismos, ecosistemas o el cuerpo humano? Dime más y te guío.`,
      `Piensa en el concepto general primero: ¿qué proceso biológico está involucrado? Eso te dará la clave de la respuesta.`,
    ]);
  }

  if (sub.includes("quimic")) {
    return pick([
      `La química es lógica si vas paso a paso. ¿El ejercicio es sobre elementos, reacciones o fórmulas? Cuéntame más.`,
      `¿Recuerdas la tabla periódica? Para este tipo de ejercicio, identificar el elemento o compuesto es el primer paso.`,
    ]);
  }

  if (sub.includes("geograf")) {
    return pick([
      `Para geografía, piensa en ubicación y características. ¿Te preguntan sobre un país, región o fenómeno natural?`,
      `¿Tienes el mapa a mano? A veces ver la ubicación visual ayuda mucho. Dime qué parte del mundo involucra la pregunta.`,
    ]);
  }

  if (sub.includes("inglés") || sub.includes("english")) {
    return pick([
      `Para inglés, primero identifica el tiempo verbal: ¿es presente, pasado o futuro? Una vez que lo sabes, el resto es más fácil.`,
      `Intenta traducir la oración completa primero. ¿Qué crees que significa? Después revisamos juntos.`,
      `¿Es gramática o vocabulario? Dime la pregunta exacta y te doy una pista sin darte la respuesta.`,
    ]);
  }

  if (sub.includes("literatur")) {
    return pick([
      `Para literatura, identifica primero el tipo de texto: ¿es narrativo, poético o dramático? Eso cambia todo el análisis.`,
      `¿Recuerdas al autor o la época de la obra? Eso te da contexto para entender mejor el mensaje.`,
    ]);
  }

  if (sub.includes("lenguaje")) {
    return pick([
      `Analiza la oración completa. ¿Puedes identificar el sujeto y el predicado? Eso nos da el camino para responder.`,
      `Para esta pregunta de lenguaje, piensa en la regla gramatical que se aplica. ¿Qué aprendiste en clase sobre este tema?`,
    ]);
  }

  if (sub.includes("razonamiento verbal")) {
    return pick([
      `El razonamiento verbal se trata de entender relaciones entre palabras. Lee con calma la pregunta: ¿qué relación hay entre los términos que te dan?`,
      `Elimina las opciones que claramente no son correctas. Eso te facilita elegir entre las que quedan.`,
    ]);
  }

  if (sub.includes("cívica")) {
    return pick([
      `Ed. Cívica trata sobre los derechos y deberes de los ciudadanos. ¿La pregunta es sobre la constitución, el gobierno o los derechos humanos?`,
      `Piensa en el concepto principal: ¿qué valor o norma civic está en juego aquí?`,
    ]);
  }

  if (sub.includes("religión")) {
    return pick([
      `Para religión, piensa en los valores y enseñanzas que viste en clase. ¿De qué texto o evento habla la pregunta?`,
    ]);
  }

  if (sub.includes("cómputo") || sub.includes("computo")) {
    return pick([
      `Para cómputo, dime si es sobre hardware, software, internet o programación. Así te guío mejor.`,
      `¿Tienes que hacer un ejercicio práctico o es una pregunta teórica? Cuéntame más.`,
    ]);
  }

  return `Cuéntame más sobre tu tarea de ${subject}. Entre más detalles me des, mejor puedo guiarte para que encuentres la respuesta tú mismo.`;
}

function localStudyTutor(message: string, history: ChatMessage[]): string {
  const lower = message.toLowerCase();
  const todaySubjects = getTodaySubjects();
  const dayName = getDayName();
  const userHistory = history.filter(m => m.role === "user");
  const turnCount = userHistory.length;

  if (isAskingForApp(lower)) {
    if (!hasDiscussedHomework(history)) {
      if (todaySubjects.length > 0) {
        return `Hola Jefferson! Antes de usar esa aplicación, dame los temas de cada materia que tienes hoy (${dayName}: ${todaySubjects.join(", ")}) para ayudarte con tus tareas. Recuerda que no te daré la respuesta, te daré ejemplos similares o relacionados. ¡Quiero ayudarte a aprender!`;
      }
      return "Antes de usar esa app, dime qué tareas tienes hoy. Te ayudo con ellas primero. ¡No te daré las respuestas directas, sino que te guiaré para que las descubras!";
    }
    return "Sigue trabajando un poco más en tus tareas. Cuando las termines y marques que terminaste, puedes disfrutar tus apps.";
  }

  const detectedSubject = detectSubject(message, todaySubjects);

  const isAskingDirect =
    lower.includes("respuesta") ||
    lower.includes("solución") ||
    lower.includes("solucion") ||
    lower.includes("resultado") ||
    lower.includes("cuánto es") ||
    lower.includes("cuanto es") ||
    lower.includes("cómo se hace") ||
    lower.includes("como se hace") ||
    lower.includes("dame la") ||
    lower.includes("dime la") ||
    lower.includes("cuál es") ||
    lower.includes("cual es");

  if (isAskingDirect) {
    if (detectedSubject) {
      return `No te daré la respuesta directa, ¡pero sí te ayudaré a encontrarla! ${getSubjectHint(detectedSubject, message, turnCount)}`;
    }
    return "Recuerda que no doy respuestas directas, te guío para que las descubras tú mismo. Cuéntame más sobre el ejercicio: ¿qué datos tienes y qué necesitas encontrar?";
  }

  const seemsToUnderstand =
    lower.includes("entend") ||
    lower.includes("ya sé") ||
    lower.includes("ya se") ||
    lower.includes("es correcto") ||
    lower.includes("entonces es") ||
    lower.includes("creo que es") ||
    lower.includes("puede ser") ||
    lower.includes("sería") ||
    lower.includes("seria");

  if (seemsToUnderstand && turnCount >= 2) {
    const confirmations = [
      "Muy bien! Explícame con tus propias palabras lo que entendiste y te confirmo si vas por el camino correcto.",
      "Excelente razonamiento. ¿Puedes explicarme el proceso que seguiste para llegar a esa conclusión?",
      "Bien! Antes de confirmarte, cuéntame por qué crees que eso es correcto. Así me aseguro de que lo entendiste.",
    ];
    return confirmations[turnCount % confirmations.length];
  }

  if (detectedSubject) {
    return getSubjectHint(detectedSubject, message, turnCount);
  }

  if (turnCount === 0) {
    if (todaySubjects.length > 0) {
      return `Hola Jefferson! Hoy es ${dayName} y tienes estas materias: ${todaySubjects.join(", ")}. ¿En cuál necesitas ayuda? Recuerda que no te daré las respuestas, sino que te guiaré con pistas para que las descubras tú.`;
    }
    return `Hola Jefferson! ¿En qué necesitas ayuda hoy? Cuéntame tu tarea y te guío paso a paso. ¡No te daré la respuesta directa, pero sí te daré buenos ejemplos!`;
  }

  const generalResponses = [
    "Cuéntame más sobre el ejercicio. ¿Qué dice exactamente el enunciado?",
    "Interesante. ¿Qué ya intentaste hacer? Muéstrame tu proceso.",
    "Para ayudarte mejor, necesito más detalles. ¿De qué materia es esto y qué pide el ejercicio?",
    "Piensa: ¿qué información te da el problema? Empieza listando los datos que tienes.",
    "¿Viste algo similar en clase? Cuéntame cómo lo explicó tu profesor y lo comparamos con tu ejercicio.",
    "Buen intento. Ahora dime: si tuvieras que explicarle esto a un compañero, ¿por dónde empezarías?",
  ];
  return generalResponses[turnCount % generalResponses.length];
}

function localChat(message: string, history: ChatMessage[], usageContext: Record<string, unknown>): string {
  const usage = Array.isArray(usageContext.uso_hoy) ? usageContext.uso_hoy : [];
  const lower = message.toLowerCase();
  const mode = usageContext.modo_actual as string ?? "free";

  if (mode === "study" || mode === "school") {
    return localStudyTutor(message, history);
  }

  if (usage.length === 0) {
    return "Todavía no veo actividad del dispositivo. Activa el permiso de uso de apps, abre algunas aplicaciones y vuelve a iniciar el monitoreo.";
  }

  if (lower.includes("uso") || lower.includes("tiempo") || lower.includes("app")) {
    const summary = usage.slice(0, 3).map((e) => {
      const item = e as { app?: string; minutos?: number };
      return `${item.app ?? "App"}: ${item.minutos ?? 0} min`;
    }).join(", ");
    return `Veo estas apps con actividad hoy: ${summary}. Puedes marcar como restringidas las que sean distracción.`;
  }

  return "Estoy conectado. Puedo ayudarte a revisar el uso de apps, elegir restricciones y explicar las decisiones de Guardian.";
}

async function emitLocalReply(text: string, onChunk: (text: string) => void, onDone: () => void) {
  const chunks = text.match(/.{1,38}(\s|$)/g) ?? [text];
  for (const chunk of chunks) {
    onChunk(chunk);
    await new Promise((resolve) => setTimeout(resolve, 22));
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
    const reply = localChat(message, history, usageContext);
    await emitLocalReply(reply, onChunk, onDone);
  }
}
