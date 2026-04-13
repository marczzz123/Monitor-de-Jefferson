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

export const ALL_SIMULACRO_SUBJECTS = [
  "Geografía",
  "Lenguaje",
  "Inglés",
  "Cómputo",
  "Álgebra",
  "Aritmética",
  "Química",
  "Religión",
  "Literatura",
  "Razonamiento Matemático",
  "Historia del Perú",
  "Razonamiento Verbal",
  "Ed. Cívica",
  "Biología",
  "Geometría",
  "Historia Universal",
  "Trigonometría",
];

// Último simulacro: finales de marzo. El siguiente es aproximadamente cada 2 meses.
const LAST_SIMULACRO = new Date("2026-03-28");
const NEXT_SIMULACRO_APPROX = new Date("2026-05-28");

const DAY_NAMES: Record<number, string> = {
  0: "domingo",
  1: "lunes",
  2: "martes",
  3: "miércoles",
  4: "jueves",
  5: "viernes",
  6: "sábado",
};

const NEXT_DAY_SUBJECTS: Record<number, string[]> = {
  0: WEEKLY_SUBJECTS[1] ?? [],
  1: WEEKLY_SUBJECTS[2] ?? [],
  2: WEEKLY_SUBJECTS[3] ?? [],
  3: WEEKLY_SUBJECTS[4] ?? [],
  4: WEEKLY_SUBJECTS[5] ?? [],
  5: [],
  6: WEEKLY_SUBJECTS[1] ?? [],
};

export function getTodaySubjects(): string[] {
  return WEEKLY_SUBJECTS[new Date().getDay()] ?? [];
}

export function getTomorrowSubjects(): string[] {
  return NEXT_DAY_SUBJECTS[new Date().getDay()] ?? [];
}

export function getDayName(): string {
  return DAY_NAMES[new Date().getDay()] ?? "hoy";
}

function getDaysUntilNextSimulacro(): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = new Date(NEXT_SIMULACRO_APPROX);
  next.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
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
    return { decision: "close", reason: `Modo dormir activo.`, message: "Es hora de descansar. Hasta mañana." };
  }

  if (data.currentMode === "school") {
    if (category === "system" || category === "educational") {
      return { decision: "allow", reason: "Permitida en horario escolar.", message: "Permitida por Guardian." };
    }
    return { decision: "close", reason: `Horario de colegio activo.`, message: "Estás en horario escolar. Concéntrate en clases." };
  }

  if (data.currentMode === "lunch") {
    if (category === "social") {
      return { decision: "allow", reason: "Social permitida en almuerzo.", message: "Disfruta tu descanso." };
    }
    if (category === "game") {
      return { decision: "close", reason: "Juegos no en almuerzo.", message: "Los juegos se habilitan a las 7 PM." };
    }
    if (isBlocked) {
      return { decision: "close", reason: "No permitida en almuerzo.", message: "Solo apps sociales durante el almuerzo." };
    }
    return { decision: "allow", reason: "Permitida en almuerzo.", message: "Guardian permite esta app." };
  }

  if (data.currentMode === "study") {
    // NUNCA juegos en horario de estudio, sin excepción
    if (category === "game") {
      return {
        decision: "close",
        reason: "Los juegos están bloqueados hasta las 7 PM.",
        message: "Los juegos se habilitan automáticamente a las 7 PM. ¡Sigue estudiando!",
      };
    }
    if (category === "social") {
      if (data.tasksCompleted) {
        return {
          decision: "warn",
          reason: `${data.appName} habilitada porque completaste tus tareas. Recuerda que los juegos son a las 7 PM.`,
          message: "Buen trabajo! Social disponible 20 min. Los juegos son a las 7 PM.",
        };
      }
      return {
        decision: "close",
        reason: `${data.appName} bloqueada hasta completar tareas o las 7 PM.`,
        message: "Termina tus tareas para desbloquear redes sociales. Los juegos se habilitan a las 7 PM.",
      };
    }
    if (category === "educational") {
      return { decision: "allow", reason: "App educativa.", message: "Excelente elección para estudiar." };
    }
    if (isBlocked) {
      return { decision: "close", reason: "Restringida en modo estudio.", message: "Enfócate en el estudio." };
    }
    if (data.usageMinutes >= 45) {
      return { decision: "warn", reason: "Llevas mucho tiempo.", message: "Toma un descanso de 5 minutos." };
    }
    return { decision: "allow", reason: "Permitida en modo estudio.", message: "Guardian monitorea tu actividad." };
  }

  if (isBlocked || data.usageMinutes >= 30) {
    return { decision: "warn", reason: "Tiempo de uso elevado.", message: "Guardian recomienda una pausa." };
  }

  return { decision: "allow", reason: "Dentro de los límites.", message: "Guardian permite continuar." };
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

function isAskingForGame(lower: string): boolean {
  return (
    lower.includes("jugar") ||
    lower.includes("free fire") ||
    lower.includes("freefire") ||
    lower.includes("roblox") ||
    lower.includes("minecraft") ||
    lower.includes("fortnite") ||
    lower.includes("pubg") ||
    lower.includes("juego") ||
    lower.includes("videojuego")
  );
}

function isSimulacroQuestion(lower: string): boolean {
  return (
    lower.includes("simulacro") ||
    lower.includes("examen general") ||
    lower.includes("prueba general") ||
    lower.includes("todos los temas") ||
    lower.includes("repasar todo") ||
    lower.includes("preparar el examen") ||
    lower.includes("estudiar todo")
  );
}

function hasDiscussedHomework(history: ChatMessage[]): boolean {
  const userMsgs = history.filter(m => m.role === "user").map(m => m.content.toLowerCase());
  const keywords = ["tarea", "ejercicio", "problema", "materia", "clase", "examen", "práctica",
    "practica", "pregunta", "ayuda con", "como se", "cómo se", "qué es", "que es",
    "explica", "entend", "geografía", "algebra", "aritmética", "química", "biología",
    "historia", "inglés", "literatura", "geometría", "trigonometría"];
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

function getSubjectHint(subject: string, message: string, turn: number): string {
  const sub = subject.toLowerCase();
  const pick = (arr: string[]) => arr[turn % arr.length];

  if (["álgebra", "aritmética", "trigonometría", "geometría", "razonamiento matemático"].some(s => sub.includes(s))) {
    return pick([
      `Para ${subject}: primero identifica qué tipo de operación necesitas. ¿Qué datos te da el problema?`,
      `Antes de resolverlo: ¿ya intentaste algo? Cuéntame qué paso diste primero y te digo si vas bien.`,
      `En ${subject} el proceso es lo importante. Organiza los datos que tienes y dime cuál sería tu primer paso.`,
      `¿Viste un ejemplo similar en clase? Cuéntame cómo lo resolvió tu profesor y lo comparamos con tu ejercicio.`,
      `¿Qué fórmula o regla aprendiste que podría aplicarse aquí? No importa si no estás seguro, inténtalo.`,
    ]);
  }
  if (sub.includes("historia")) {
    return pick([
      `La historia tiene causas y consecuencias. ¿Quiénes son los personajes principales y qué situación los llevó a actuar así?`,
      `¿Cuándo pasó, dónde y por qué fue importante? Con esas tres preguntas ya tienes la estructura de la respuesta.`,
      `¿Hay fechas o nombres clave que recuerdas? Son tus puntos de apoyo. Dime qué sabes y construimos desde ahí.`,
    ]);
  }
  if (sub.includes("biolog")) {
    return pick([
      `En biología todo tiene una función. ¿El ejercicio habla de células, organismos, ecosistemas o el cuerpo humano?`,
      `Piensa en el proceso biológico involucrado. ¿Es sobre reproducción, nutrición, respiración? Eso te da la clave.`,
    ]);
  }
  if (sub.includes("quimic")) {
    return pick([
      `¿El ejercicio es sobre elementos, compuestos, reacciones o la tabla periódica? Cuéntame más.`,
      `Identifica primero si es una reacción química o una fórmula. De ahí empieza el proceso.`,
    ]);
  }
  if (sub.includes("geograf")) {
    return pick([
      `¿Te preguntan sobre un país, una región, un clima o un fenómeno natural? La ubicación es clave.`,
      `¿Tienes el mapa a mano? Ubicar visualmente el lugar ayuda mucho. ¿De qué continente o país se trata?`,
    ]);
  }
  if (sub.includes("inglés") || sub.includes("english")) {
    return pick([
      `Primero identifica el tiempo verbal: ¿presente, pasado o futuro? Una vez que lo sabes, el resto es más fácil.`,
      `Intenta traducir la oración completa. ¿Qué crees que significa? Después revisamos juntos.`,
      `¿Es gramática o vocabulario? Dime la pregunta exacta y te doy una pista sin darte la respuesta.`,
    ]);
  }
  if (sub.includes("literatur")) {
    return pick([
      `¿El texto es narrativo, poético o dramático? Eso cambia todo el análisis literario.`,
      `¿Recuerdas el autor o la época? Eso te da contexto para entender el mensaje de la obra.`,
    ]);
  }
  if (sub.includes("lenguaje")) {
    return pick([
      `Analiza la oración completa. ¿Puedes identificar el sujeto y el predicado? Eso nos da el camino.`,
      `¿Qué regla gramatical se aplica aquí? Cuéntame qué aprendiste en clase sobre este tema.`,
    ]);
  }
  if (sub.includes("razonamiento verbal")) {
    return pick([
      `El razonamiento verbal trata de relaciones entre palabras. ¿Qué relación ves entre los términos que te dan?`,
      `Elimina las opciones que claramente no son correctas. ¿Cuáles te quedan como posibles?`,
    ]);
  }
  if (sub.includes("cívica")) {
    return pick([
      `¿La pregunta es sobre la constitución, los derechos humanos o las instituciones del Estado?`,
      `Piensa: ¿qué valor o principio cívico está en juego en esta pregunta?`,
    ]);
  }
  if (sub.includes("religión")) {
    return pick([`¿De qué texto o enseñanza trata la pregunta? Conecta con los valores que viste en clase.`]);
  }
  if (sub.includes("cómputo") || sub.includes("computo")) {
    return pick([
      `¿Es sobre hardware, software, internet o programación? Eso me ayuda a guiarte mejor.`,
      `¿Es una pregunta teórica o tienes que hacer algo práctico? Cuéntame más.`,
    ]);
  }
  return `Cuéntame más sobre tu tarea de ${subject}. Entre más detalles me des, mejor puedo guiarte.`;
}

function getSimulacroResponse(message: string, history: ChatMessage[]): string {
  const lower = message.toLowerCase();
  const daysLeft = getDaysUntilNextSimulacro();
  const turnCount = history.filter(m => m.role === "user").length;

  const detectedSubject = detectSubject(message, ALL_SIMULACRO_SUBJECTS);

  if (detectedSubject) {
    return `Para el simulacro en ${subject_area(detectedSubject)}, recuerda repasar los conceptos clave. ${getSubjectHint(detectedSubject, message, turnCount)} ¿Quieres que repasemos otro tema del simulacro también?`;
  }

  if (lower.includes("cuándo") || lower.includes("cuando") || lower.includes("fecha") || lower.includes("falta")) {
    if (daysLeft <= 0) {
      return "El simulacro está muy cerca o ya pasó. ¡Es momento de repasar todo con calma! ¿Por qué materia empezamos?";
    }
    return `El próximo simulacro es aproximadamente en ${daysLeft} días. ${daysLeft < 14 ? "¡Ya está cerca, hay que prepararse!" : "Tienes tiempo, pero es bueno ir repasando poco a poco."} ¿Quieres empezar a repasar algún tema?`;
  }

  const allSubjectsList = ALL_SIMULACRO_SUBJECTS.join(", ");
  if (turnCount === 0 || lower.includes("simulacro") || lower.includes("todos los temas")) {
    return `El simulacro cubre TODOS los temas: ${allSubjectsList}. ${daysLeft > 0 ? `Faltan aproximadamente ${daysLeft} días.` : "¡Está muy cerca!"} ¿Por cuál materia quieres empezar a repasar? Te ayudo con pistas y ejemplos de cada una.`;
  }

  return `Para preparar el simulacro, lo mejor es repasar poco a poco cada materia. ¿Cuál te genera más dudas: las matemáticas (Álgebra, Aritmética, Geometría, Trigonometría), las ciencias (Biología, Química) o las humanidades (Historia, Geografía, Literatura)?`;
}

function subject_area(subject: string): string {
  const sub = subject.toLowerCase();
  if (["álgebra", "aritmética", "trigonometría", "geometría", "razonamiento matemático"].some(s => sub.includes(s))) return "Matemáticas";
  if (sub.includes("biolog") || sub.includes("quimic")) return "Ciencias";
  if (sub.includes("histor") || sub.includes("geograf")) return "Ciencias Sociales";
  return subject;
}

function localStudyTutor(message: string, history: ChatMessage[]): string {
  const lower = message.toLowerCase();
  const todaySubjects = getTodaySubjects();
  const tomorrowSubjects = getTomorrowSubjects();
  const dayName = getDayName();
  const userHistory = history.filter(m => m.role === "user");
  const turnCount = userHistory.length;

  if (isSimulacroQuestion(lower)) {
    return getSimulacroResponse(message, history);
  }

  if (isAskingForGame(lower)) {
    return "Los juegos se habilitan automáticamente a las 7 PM. Mientras tanto, ¿te ayudo con alguna tarea? A las 7 tienes tiempo libre para jugar.";
  }

  if (isAskingForApp(lower)) {
    if (!hasDiscussedHomework(history)) {
      if (todaySubjects.length > 0) {
        return `Antes de usar esa aplicación, dame los temas de cada materia que tienes hoy (${dayName}: ${todaySubjects.join(", ")}) para ayudarte con tus tareas. Recuerda que no te daré la respuesta directa, te daré ejemplos similares para que aprendas. ¡A las 7 PM ya puedes usar todo libremente!`;
      }
      return "Antes de usar esa app, dime qué tareas tienes hoy. Te ayudo con ellas y a las 7 PM tienes tiempo libre para todo.";
    }
    return "Sigue un poco más con tus tareas. Recuerda que a las 7 PM se desbloquea todo automáticamente, sin necesidad de que hagas nada.";
  }

  const detectedSubject = detectSubject(message, [...todaySubjects, ...ALL_SIMULACRO_SUBJECTS]);

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
    return "Recuerda que no doy respuestas directas, te guío para que las descubras tú mismo. ¿Qué datos tienes en el ejercicio? Empieza por ahí.";
  }

  const seemsToUnderstand =
    lower.includes("entend") ||
    lower.includes("ya sé") || lower.includes("ya se") ||
    lower.includes("es correcto") ||
    lower.includes("entonces es") ||
    lower.includes("creo que es") ||
    lower.includes("puede ser") ||
    lower.includes("sería") || lower.includes("seria");

  if (seemsToUnderstand && turnCount >= 2) {
    const confirmations = [
      "Muy bien! Explícame con tus propias palabras lo que entendiste y te confirmo si vas por el camino correcto.",
      "Excelente razonamiento. ¿Puedes explicarme el proceso que seguiste para llegar a esa conclusión?",
      "Bien! Cuéntame por qué crees que eso es correcto. Así me aseguro de que lo entendiste del todo.",
    ];
    return confirmations[turnCount % confirmations.length];
  }

  if (detectedSubject) {
    return getSubjectHint(detectedSubject, message, turnCount);
  }

  if (turnCount === 0) {
    const tomorrowReminder = tomorrowSubjects.length > 0
      ? ` Mañana también tienes: ${tomorrowSubjects.join(", ")}, así que si terminas rápido puedes adelantar algo.`
      : "";
    if (todaySubjects.length > 0) {
      return `Hola Jefferson! Hoy es ${dayName} y tienes: ${todaySubjects.join(", ")}. ¿En cuál necesitas ayuda? No te daré las respuestas, pero sí buenas pistas. A las 7 PM tienes tiempo libre para juegos y redes.${tomorrowReminder}`;
    }
    return `Hola Jefferson! ¿En qué necesitas ayuda hoy? Cuéntame tu tarea y te guío. A las 7 PM tienes tiempo libre para todo.`;
  }

  const generalResponses = [
    "Cuéntame más sobre el ejercicio. ¿Qué dice exactamente el enunciado?",
    "Interesante. ¿Qué ya intentaste hacer? Muéstrame tu proceso.",
    "Para ayudarte mejor: ¿de qué materia es esto y qué pide exactamente?",
    "Piensa: ¿qué información te da el problema? Lista los datos que tienes.",
    "¿Viste algo similar en clase? Cuéntame cómo lo explicó tu profesor.",
    "Buen intento. Si tuvieras que explicarle esto a un compañero, ¿por dónde empezarías?",
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

  if (isSimulacroQuestion(lower)) {
    return getSimulacroResponse(message, history);
  }

  if (usage.length === 0) {
    return "Todavía no veo actividad del dispositivo. Activa el permiso de uso de apps y vuelve a iniciar el monitoreo.";
  }

  if (lower.includes("uso") || lower.includes("tiempo") || lower.includes("app")) {
    const summary = usage.slice(0, 3).map((e) => {
      const item = e as { app?: string; minutos?: number };
      return `${item.app ?? "App"}: ${item.minutos ?? 0} min`;
    }).join(", ");
    return `Veo estas apps con actividad hoy: ${summary}. Puedes marcar como restringidas las que sean distracción.`;
  }

  return "Estoy conectado. Puedo ayudarte con tareas, el simulacro o revisar el uso de apps. ¿Qué necesitas?";
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
