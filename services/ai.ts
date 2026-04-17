import type { AppMode } from "@/context/MonitoringContext";
import { classifyPackage, isModeBlocked } from "@/context/MonitoringContext";

const DEFAULT_DOMAIN = "65ae1e57-ce4b-43b0-9d1f-9542faa4438c-00-13hw12onhg5rz.picard.replit.dev";
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

export function getTomorrowDayName(): string {
  return DAY_NAMES[(new Date().getDay() + 1) % 7] ?? "mañana";
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

  // Las apps del sistema NUNCA generan alertas ni se bloquean
  if (category === "system") {
    return { decision: "allow", reason: "App del sistema.", message: "Guardian permite esta app." };
  }

  const isBlocked = isModeBlocked(data.currentMode, data.packageName, data.appName, data.restrictedApps);

  if (data.currentMode === "sleep") {
    return { decision: "close", reason: `Modo dormir activo.`, message: "Es hora de descansar. Hasta mañana." };
  }

  if (data.currentMode === "school") {
    if (category === "educational") {
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
    if (category === "game") {
      return {
        decision: "close",
        reason: "Los juegos están bloqueados hasta que completes las tareas de mañana.",
        message: "Termina todas las materias de mañana con el tutor IA para desbloquear los juegos.",
      };
    }
    if (category === "social") {
      if (data.tasksCompleted) {
        return {
          decision: "warn",
          reason: `${data.appName} habilitada porque completaste tus tareas.`,
          message: "¡Buen trabajo! Completaste todas las tareas. Disfruta.",
        };
      }
      return {
        decision: "close",
        reason: `${data.appName} bloqueada hasta completar las tareas de mañana.`,
        message: "Termina todas las materias de mañana con el tutor para desbloquear el entretenimiento.",
      };
    }
    if (category === "educational") {
      return { decision: "allow", reason: "App educativa.", message: "Excelente elección para estudiar." };
    }
    if (isBlocked) {
      return { decision: "close", reason: "Restringida en modo estudio.", message: "Enfócate en el estudio." };
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

// =============================================
// RETO NOCTURNO — Preguntas por materia
// =============================================

const NIGHT_CHALLENGE_QUESTIONS: Record<string, Array<{ q: string; a: string; hint: string }>> = {
  "Álgebra": [
    { q: "Resuelve: 2x + 6 = 14. ¿Cuánto vale x?", a: "4", hint: "Resta 6 a ambos lados: 2x = 8, luego divide entre 2" },
    { q: "Si y = 3x - 5 y x = 4, ¿cuánto es y?", a: "7", hint: "Sustituye x=4: y = 3(4) - 5 = 12 - 5" },
    { q: "Despeja x: x/3 + 2 = 5", a: "9", hint: "Resta 2: x/3 = 3, luego multiplica por 3" },
  ],
  "Aritmética": [
    { q: "¿Cuánto es el 20% de 150?", a: "30", hint: "20% = 0.20. Multiplica 150 × 0.20" },
    { q: "¿Cuánto es 3/4 + 1/2?", a: "5/4", hint: "Denominador común 4: 3/4 + 2/4 = 5/4" },
    { q: "¿Cuánto es el MCM de 6 y 4?", a: "12", hint: "Múltiplos de 6: 6, 12. Múltiplos de 4: 4, 8, 12. El menor común es..." },
  ],
  "Química": [
    { q: "¿Cuál es el símbolo químico del Oxígeno?", a: "O", hint: "Es el elemento número 8 de la tabla periódica" },
    { q: "¿Cuántos átomos tiene la molécula de agua H₂O?", a: "3", hint: "2 hidrógenos + 1 oxígeno = ?" },
    { q: "¿Qué tipo de enlace se forma entre metales y no metales?", a: "iónico", hint: "Cuando uno cede y otro gana electrones" },
  ],
  "Geometría": [
    { q: "¿Cuánto mide el área de un cuadrado de lado 5 cm?", a: "25", hint: "Área = lado × lado = 5 × 5" },
    { q: "¿Cuántos grados suman los ángulos interiores de un triángulo?", a: "180", hint: "Regla básica de geometría" },
    { q: "¿Cuánto es el perímetro de un rectángulo de 6 cm x 4 cm?", a: "20", hint: "P = 2 × (largo + ancho) = 2 × (6 + 4)" },
  ],
  "Geografía": [
    { q: "¿Cuántos departamentos tiene el Perú?", a: "25", hint: "También llamadas regiones" },
    { q: "¿Cuál es el río más largo del Perú?", a: "el Amazonas", hint: "También es el río más largo del mundo" },
    { q: "¿En qué continente está el Perú?", a: "América del Sur", hint: "Es el continente del hemisferio occidental" },
  ],
  "Inglés": [
    { q: "¿Cómo se dice 'manzana' en inglés?", a: "apple", hint: "Es una fruta roja o verde muy común" },
    { q: "Completa: Yesterday I ___ to school. (go)", a: "went", hint: "El pasado irregular de 'go' es 'went'" },
    { q: "¿Cómo se dice 'hoy' en inglés?", a: "today", hint: "Piensa en 'today, tomorrow, yesterday'" },
  ],
  "Historia del Perú": [
    { q: "¿En qué año se proclamó la independencia del Perú?", a: "1821", hint: "28 de julio, proclamada por San Martín" },
    { q: "¿Quién fue el primer Inca del Tawantinsuyo?", a: "Manco Cápac", hint: "Según la leyenda, salió del lago Titicaca" },
    { q: "¿En qué siglo llegaron los españoles al Perú?", a: "XVI o siglo 16", hint: "Francisco Pizarro llegó en 1532" },
  ],
  "Lenguaje": [
    { q: "¿Cuál es el sujeto en 'El perro corre en el parque'?", a: "El perro", hint: "El sujeto es quien realiza la acción" },
    { q: "¿Qué tipo de palabra es 'rápidamente'?", a: "adverbio", hint: "Modifica al verbo, adjetivo u otro adverbio" },
    { q: "¿Cuántas sílabas tiene la palabra 'mariposa'?", a: "4", hint: "Ma-ri-po-sa" },
  ],
  "Literatura": [
    { q: "¿Quién escribió 'Cien años de soledad'?", a: "Gabriel García Márquez", hint: "Es un escritor colombiano, ganador del Nobel" },
    { q: "¿En qué género literario predomina la poesía?", a: "lírico", hint: "Los géneros literarios son épico, lírico y dramático" },
  ],
  "Razonamiento Matemático": [
    { q: "¿Cuál sigue en la serie: 2, 4, 8, 16...?", a: "32", hint: "Cada número se multiplica por 2" },
    { q: "Si hay 12 manzanas y comes 1/3, ¿cuántas quedan?", a: "8", hint: "1/3 de 12 = 4. Resta 12 - 4" },
  ],
  "Razonamiento Verbal": [
    { q: "¿Cuál es el sinónimo de 'veloz'?", a: "rápido", hint: "Significa que se mueve a gran velocidad" },
    { q: "¿Cuál es el antónimo de 'oscuro'?", a: "claro", hint: "Lo contrario a sin luz es..." },
  ],
  "Biología": [
    { q: "¿Cuántos cromosomas tiene una célula humana normal?", a: "46", hint: "Son 23 pares de cromosomas" },
    { q: "¿Cómo se llama el proceso por el que las plantas hacen su alimento?", a: "fotosíntesis", hint: "Las plantas usan la luz del sol y CO₂" },
  ],
  "Historia Universal": [
    { q: "¿En qué año comenzó la Primera Guerra Mundial?", a: "1914", hint: "Empezó tras el asesinato del Archiduque Francisco Fernando" },
    { q: "¿En qué país ocurrió la Revolución Francesa?", a: "Francia", hint: "Ocurrió en 1789" },
  ],
  "Trigonometría": [
    { q: "¿Cuánto es sen(30°)?", a: "0.5", hint: "Es uno de los ángulos notables: sen 30° = 1/2" },
    { q: "¿Cuánto es cos(0°)?", a: "1", hint: "En el ángulo 0, el coseno vale su máximo" },
  ],
  "Ed. Cívica": [
    { q: "¿Cuántos poderes tiene el Estado peruano?", a: "3", hint: "Ejecutivo, Legislativo y Judicial" },
    { q: "¿Cuántos años dura el mandato presidencial en el Perú?", a: "5", hint: "No tiene reelección inmediata" },
  ],
  "Religión": [
    { q: "¿Cuántos mandamientos hay en el Antiguo Testamento?", a: "10", hint: "Los Diez Mandamientos fueron dados a Moisés" },
    { q: "¿Qué significa 'Evangelio'?", a: "Buena nueva", hint: "Viene del griego 'euangelion'" },
  ],
  "Cómputo": [
    { q: "¿Cuántos bits tiene un byte?", a: "8", hint: "Es una medida básica de información digital" },
    { q: "¿Qué significa CPU?", a: "Central Processing Unit", hint: "Es el 'cerebro' de la computadora" },
  ],
};

export interface NightChallenge {
  question: string;
  hint: string;
  subject: string;
  correctAnswer: string;
}

export function generateNightChallengeQuestion(subjects: string[]): NightChallenge {
  const available = subjects.filter(s => NIGHT_CHALLENGE_QUESTIONS[s]);

  if (available.length === 0) {
    return {
      question: "¿Cuánto es 7 × 8?",
      hint: "Es la tabla del 7 o del 8",
      subject: "Matemáticas",
      correctAnswer: "56",
    };
  }

  const subject = available[Math.floor(Math.random() * available.length)];
  const questions = NIGHT_CHALLENGE_QUESTIONS[subject];
  const q = questions[Math.floor(Math.random() * questions.length)];
  return { question: q.q, hint: q.hint, subject, correctAnswer: q.a };
}

export function checkNightChallengeAnswer(correctAnswer: string, userAnswer: string): boolean {
  const normalize = (s: string) =>
    s.toLowerCase().trim()
      .replace(/[°.,\s]/g, "")
      .replace(/á/g, "a").replace(/é/g, "e").replace(/í/g, "i")
      .replace(/ó/g, "o").replace(/ú/g, "u");
  const correct = normalize(correctAnswer);
  const user = normalize(userAnswer);
  if (correct === user) return true;
  const parts = correctAnswer.split(/\s*o\s*/i);
  return parts.some(p => normalize(p) === user);
}

// =============================================
// Flujo de tutor estructurado — menú por materias
// =============================================

export function getSubjectMenu(subjects: string[]): string {
  if (subjects.length === 0) return "¡Listo! No tienes materias pendientes.";
  const list = subjects.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return `Estas son tus materias pendientes para mañana:\n\n${list}\n\nEscribe el número de la materia con la que quieres empezar.`;
}

export function detectMenuSelection(message: string, subjects: string[]): string | null {
  const trimmed = message.trim();
  const num = parseInt(trimmed, 10);
  if (!isNaN(num) && num >= 1 && num <= subjects.length) {
    return subjects[num - 1];
  }
  return detectSubject(message, subjects);
}

export function getTutorIntro(subject: string): string {
  const intros: Record<string, string> = {
    "Álgebra": "Vamos con **Álgebra**. Escríbeme el enunciado completo de tu ejercicio. Dime también qué intentaste hacer primero.",
    "Aritmética": "Vamos con **Aritmética**. ¿Qué problema tienes? Escríbeme el enunciado y dime qué parte te está confundiendo.",
    "Química": "Vamos con **Química**. Cuéntame qué ejercicio tienes. ¿Es sobre elementos, reacciones, fórmulas o la tabla periódica?",
    "Geometría": "Vamos con **Geometría**. Descríbeme la figura o el problema que tienes. ¿Qué datos te dan?",
    "Trigonometría": "Vamos con **Trigonometría**. Escríbeme el ejercicio. ¿Qué ángulos o funciones están involucrados?",
    "Razonamiento Matemático": "Vamos con **Razonamiento Matemático**. ¿Qué tipo de problema tienes? ¿Serie, patrón o problema de lógica?",
    "Geografía": "Vamos con **Geografía**. ¿Qué tema te tocó? ¿Es sobre el Perú, el mundo, climas o accidentes geográficos?",
    "Historia del Perú": "Vamos con **Historia del Perú**. ¿Qué época o tema tienes que estudiar? Cuéntame.",
    "Historia Universal": "Vamos con **Historia Universal**. ¿De qué época o evento es tu tarea?",
    "Inglés": "Let's work on **Inglés**. ¿Es gramática, vocabulario o comprensión de lectura? Escríbeme el ejercicio exacto.",
    "Biología": "Vamos con **Biología**. ¿El tema es sobre células, el cuerpo humano, ecosistemas o reproducción?",
    "Lenguaje": "Vamos con **Lenguaje**. ¿Es análisis de oraciones, gramática u ortografía? Escríbeme el ejercicio.",
    "Literatura": "Vamos con **Literatura**. ¿Qué obra o autor tienes que analizar? Cuéntame el tema.",
    "Razonamiento Verbal": "Vamos con **Razonamiento Verbal**. ¿Tienes analogías, sinónimos, antónimos o comprensión de texto?",
    "Ed. Cívica": "Vamos con **Ed. Cívica**. ¿El tema es sobre derechos, el Estado peruano o la Constitución?",
    "Religión": "Vamos con **Religión**. ¿Qué tema te asignaron? Cuéntame y lo trabajamos.",
    "Cómputo": "Vamos con **Cómputo**. ¿Es sobre hardware, software, internet o algo práctico de computación?",
  };
  return intros[subject] ?? `Vamos con **${subject}**. Cuéntame qué ejercicio o tema tienes de tarea. No te daré la respuesta directa, pero sí pistas para que tú mismo llegues a ella.`;
}

// =============================================
// Chat y análisis
// =============================================

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

export function detectSubject(message: string, subjects: string[]): string | null {
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
    return `Para el simulacro en ${detectedSubject}, recuerda repasar los conceptos clave. ${getSubjectHint(detectedSubject, message, turnCount)} ¿Quieres que repasemos otro tema del simulacro también?`;
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

export function localStudyTutor(
  message: string,
  history: ChatMessage[],
  currentSubject?: string | null,
  subjectTurnCount?: number,
): string {
  const lower = message.toLowerCase();
  const tomorrowSubjects = getTomorrowSubjects();
  const userHistory = history.filter(m => m.role === "user");
  const globalTurn = userHistory.length;
  const turn = subjectTurnCount ?? globalTurn;

  // --- Peticiones de juegos/apps: siempre redirigir ---
  if (isAskingForGame(lower) || isAskingForApp(lower)) {
    if (tomorrowSubjects.length > 0) {
      return "Los juegos y las redes sociales se desbloquean cuando termines todas las materias de mañana. Elige un número para continuar con la siguiente materia.";
    }
    return "Cuando termines todas las materias, el entretenimiento se desbloquea solo a las 7 PM.";
  }

  // --- MODO: estudiando una materia específica ---
  if (currentSubject) {
    // Detectar si Jefferson está preguntando sobre una materia DIFERENTE (intento de cambiar tema)
    const mentionedSubject = detectSubject(message, tomorrowSubjects.filter(s => s !== currentSubject));
    if (mentionedSubject && mentionedSubject !== currentSubject) {
      return `Primero terminemos con ${currentSubject}. Después pasamos a ${mentionedSubject}. ¿Qué ejercicio tienes de ${currentSubject}?`;
    }

    // Detectar si pide respuesta directa — NUNCA dar la respuesta
    const isAskingDirect =
      lower.includes("respuesta") || lower.includes("solución") || lower.includes("solucion") ||
      lower.includes("resultado") || lower.includes("cuánto es") || lower.includes("cuanto es") ||
      lower.includes("cómo se hace") || lower.includes("como se hace") ||
      lower.includes("dame la") || lower.includes("dime la") || lower.includes("dímela") ||
      lower.includes("cuál es la respuesta") || lower.includes("cual es la respuesta") ||
      lower.includes("resuélvelo") || lower.includes("resuelve") || lower.includes("hazlo tú") ||
      lower.includes("hazlo tu") || lower.includes("tú hazlo") || lower.includes("tu hazlo");
    if (isAskingDirect) {
      return `No puedo darte la respuesta directa de ${currentSubject}, pero sí te guío. ${getSubjectHint(currentSubject, message, turn)} ¿Qué datos te da el enunciado? Empieza por ahí.`;
    }

    // Detectar que Jefferson dice que entendió — pedir que explique con sus palabras antes de confirmar
    const seemsToUnderstand =
      lower.includes("entend") || lower.includes("ya sé") || lower.includes("ya se") ||
      lower.includes("es correcto") || lower.includes("entonces es") || lower.includes("creo que es") ||
      lower.includes("sería") || lower.includes("seria") || lower.includes("puede ser") ||
      lower.includes("ya terminé") || lower.includes("ya termine") || lower.includes("listo");
    if (seemsToUnderstand && turn >= 2) {
      const checks = [
        `Bien! Antes de darlo por terminado: explícame con tus propias palabras cómo resolviste el ejercicio de ${currentSubject}.`,
        `Excelente. ¿Puedes contarme el proceso paso a paso que seguiste? Así confirmo que lo entendiste bien.`,
        `Muy bien. Cuéntame qué aprendiste de este ejercicio de ${currentSubject}. Si me lo explicas correctamente, podemos pasar a la siguiente materia.`,
      ];
      return checks[turn % checks.length];
    }

    // Respuesta de tutor guiado para esa materia específica
    return getSubjectHint(currentSubject, message, turn);
  }

  // --- Sin materia activa: detectar si es pregunta conceptual/educativa ---
  const isConceptualQuestion =
    lower.startsWith("qué es") || lower.startsWith("que es") ||
    lower.startsWith("qué son") || lower.startsWith("que son") ||
    lower.startsWith("cómo funciona") || lower.startsWith("como funciona") ||
    lower.startsWith("cómo se") || lower.startsWith("como se") ||
    lower.startsWith("explica") || lower.startsWith("qué significa") ||
    lower.startsWith("que significa") || lower.startsWith("por qué") ||
    lower.startsWith("por que") || lower.startsWith("cuándo") ||
    lower.startsWith("cuando") || lower.startsWith("quién") ||
    lower.startsWith("quien") || lower.startsWith("cuál es") ||
    lower.startsWith("cual es") || lower.startsWith("dónde") ||
    lower.startsWith("donde") || lower.includes("qué es la") ||
    lower.includes("que es la") || lower.includes("qué es el") ||
    lower.includes("que es el") || lower.includes("qué es un") ||
    lower.includes("que es un") || lower.includes("cómo se llama") ||
    lower.includes("cómo se hace") || lower.includes("como se hace") ||
    lower.includes("para qué sirve") || lower.includes("para que sirve");

  if (isConceptualQuestion) {
    // Intentar detectar la materia involucrada para dar una respuesta más útil
    const detectedSub = detectSubject(message, ALL_SIMULACRO_SUBJECTS);
    if (detectedSub) {
      return `Buena pregunta sobre ${detectedSub}. ${getSubjectHint(detectedSub, message, globalTurn)} Si tienes un ejercicio específico de esta materia, cuéntame el enunciado y lo trabajamos juntos.`;
    }
    // Pregunta educativa general — responder útilmente y luego invitar a estudiar
    return `Esa es una buena pregunta. Puedo ayudarte a entender ese tema. Explícame un poco más el contexto: ¿es un concepto que viste en clase o algo que necesitas para una tarea? Si me dices de qué materia es, te puedo dar una explicación más precisa.`;
  }

  // Respuesta para mensajes que no son ni conceptuales ni entretenimiento
  const generalResponses = [
    "Cuéntame más. ¿De qué materia es esto y qué necesitas exactamente?",
    "¿Tienes un ejercicio o pregunta específica de alguna materia? Cuéntamelo y te ayudo.",
    "¿De qué tema es tu pregunta? Con más contexto puedo ayudarte mejor.",
    "Dime qué necesitas y lo vemos juntos. ¿Es una duda de alguna materia?",
  ];
  return generalResponses[globalTurn % generalResponses.length];
}

function localChat(message: string, history: ChatMessage[], usageContext: Record<string, unknown>): string {
  const usage = Array.isArray(usageContext.uso_hoy) ? usageContext.uso_hoy : [];
  const lower = message.toLowerCase();
  const mode = usageContext.modo_actual as string ?? "free";

  if (mode === "study" || mode === "school") {
    const currentSubject = usageContext.current_subject as string | null ?? null;
    const subjectTurnCount = usageContext.subject_turn_count as number ?? 0;
    return localStudyTutor(message, history, currentSubject, subjectTurnCount);
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
