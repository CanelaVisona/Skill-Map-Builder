// Conjugación de títulos de tareas escritos en imperativo con voseo ("Meditá", "Comé",
// "Escribí", "Lavate los dientes", "Hacelo"). En "Tareas de hoy":
//   - con el ▶ andando, el verbo pasa a gerundio: "Meditando", "Lavándome los dientes".
//   - confirmada, pasa a pretérito en primera persona: "Medité", "Me lavé los dientes".
// Solo se toca la primera palabra (más "tu/tus" → "mi/mis" en el resto). Si la primera palabra no
// parece un imperativo voseante, el título queda igual.

const ACCENTED: Record<string, string> = { a: "á", e: "é", i: "í", o: "ó", u: "ú" };
const unaccent = (s: string) => s.replace(/[áéíóú]/g, (c) => ({ á: "a", é: "e", í: "i", ó: "o", ú: "u" })[c]!);

// Palabras con tilde al final que no son imperativos.
const NOT_VERBS = new Set([
  "más", "sí", "así", "aquí", "ahí", "allí", "acá", "allá", "ya", "mamá", "papá", "sofá", "café",
  "bebé", "puré", "menú", "champú", "colibrí", "maní", "esquí", "rubí", "ají", "jabalí", "también",
  "jamás", "quizá", "está", "esté", "será", "habrá", "podrá", "tendrá", "bidé", "comité", "carné",
  "té", "sé", "dé", "mí", "tú", "él", "paté", "canapé", "consomé", "parqué", "suflé", "frappé",
  "cliché", "chalé", "corsé", "bisturí", "maniquí", "frenesí", "alhelí", "pirulí", "Perú", "vudú",
  "canadá", "panamá", "bogotá", "sofás",
]);
// Sustantivos que terminan como un verbo con pronombre pegado ("toma+te", "mode+lo").
const NOUNS_LIKE_CLITIC = new Set([
  "tomate", "chocolate", "paquete", "aceite", "juguete", "billete", "banquete", "filete", "cohete",
  "aguacate", "rescate", "remate", "debate", "combate", "escaparate", "disparate", "cachete",
  "sorbete", "jinete", "gabinete", "piquete", "alicate", "chupete", "palote", "garrote", "escote",
  "modelo", "cabello", "martillo", "castillo", "anillo", "pasillo", "cuchillo", "bolsillo", "ladrillo",
  "tornillo", "camello", "sello", "cuello", "bella", "botella", "estrella", "huella", "olla", "pantalla",
  "toalla", "medalla", "batalla", "muralla", "valla", "silla", "mejilla", "semilla", "orilla", "pastilla",
  "almohadilla", "tortilla", "ardilla", "rodilla", "zapatilla", "vainilla", "manzanilla", "mantequilla",
  "regalo", "regalos", "caramelo", "caramelos", "pomelo", "pomelos", "modelos", "estilo", "estilos",
  "kilos", "hilos", "palos", "intervalo", "protocolo", "escala", "escalas", "novela", "novelas",
  "mochila", "mochilas", "consola", "consolas", "canela", "velas", "telas", "pilas", "bolas", "colas",
  "salas", "animales", "materiales", "señales", "canales", "pañales", "postales", "metales",
  "tamales", "frutales", "hospitales", "vegetales", "cereales", "manuales", "rituales", "mensuales",
]);

// Pronombres pegados al imperativo (de más largo a más corto) y cómo quedan antes del verbo en
// pasado y pegados al gerundio. "te" es reflexivo: desde quien la hace pasa a "me".
const CLITICS: { suffix: string; pre: string; post: string }[] = [
  { suffix: "telos", pre: "me los", post: "melos" },
  { suffix: "telas", pre: "me las", post: "melas" },
  { suffix: "selos", pre: "se los", post: "selos" },
  { suffix: "selas", pre: "se las", post: "selas" },
  { suffix: "telo", pre: "me lo", post: "melo" },
  { suffix: "tela", pre: "me la", post: "mela" },
  { suffix: "selo", pre: "se lo", post: "selo" },
  { suffix: "sela", pre: "se la", post: "sela" },
  { suffix: "los", pre: "los", post: "los" },
  { suffix: "las", pre: "las", post: "las" },
  { suffix: "les", pre: "les", post: "les" },
  { suffix: "lo", pre: "lo", post: "lo" },
  { suffix: "la", pre: "la", post: "la" },
  { suffix: "le", pre: "le", post: "le" },
  { suffix: "te", pre: "me", post: "me" },
];

type Parsed = { infinitive: string; clitic: { pre: string; post: string } | null };

function parseImperative(word: string): Parsed | null {
  const w = word.toLowerCase();
  if (NOT_VERBS.has(w) || NOUNS_LIKE_CLITIC.has(w)) return null;
  // Sin pronombre: termina en á/é/í ("Meditá", "Comé", "Escribí").
  const last = w.slice(-1);
  if ("áéí".includes(last)) {
    if (w.length < 3 || /[áéíóú]/.test(w.slice(0, -1))) return null;
    return { infinitive: unaccent(w) + "r", clitic: null };
  }
  for (const c of CLITICS) {
    if (!w.endsWith(c.suffix)) continue;
    const stem = w.slice(0, -c.suffix.length);
    const double = c.suffix.length >= 4;
    // Con dos pronombres lleva tilde ("Ponételo"); con uno no ("Lavate", "Hacelo").
    if (double ? !/[áéí]$/.test(stem) : !/[aei]$/.test(stem)) continue;
    if (/[áéíóú]/.test(double ? stem.slice(0, -1) : stem)) continue;
    const plain = unaccent(stem);
    if (plain.length < 3) continue;
    // Diptongos al final no son raíces de verbo ("escue+la", "sue+lo", "bai+le"), salvo gui/qui.
    if (/(?<![gq])(ie|ue)$|(ai|ei|oi)$/.test(plain)) continue;
    if (/^[^aeiouáéíóú]*[aeiou]$/.test(plain)) continue; // una sola sílaba: "cla+se", "pa+la"
    return { infinitive: plain + "r", clitic: { pre: c.pre, post: c.post } };
  }
  return null;
}

const IRREGULAR_GERUND: Record<string, string> = {
  ir: "yendo", andar: "yendo", decir: "diciendo", venir: "viniendo", poder: "pudiendo",
  dormir: "durmiendo", morir: "muriendo", reir: "riendo", sonreir: "sonriendo", freir: "friendo",
  oir: "oyendo", convenir: "conviniendo", prevenir: "previniendo", intervenir: "interviniendo",
};
// -ir con e→i en el gerundio ("pedir" → "pidiendo").
const E_TO_I = new Set([
  "pedir", "seguir", "conseguir", "perseguir", "proseguir", "sentir", "consentir", "presentir",
  "mentir", "repetir", "servir", "vestir", "desvestir", "revestir", "preferir", "divertir",
  "convertir", "invertir", "sugerir", "advertir", "competir", "corregir", "elegir", "medir",
  "despedir", "impedir", "expedir", "hervir", "requerir", "digerir", "referir", "transferir",
  "rendir", "regir", "derretir", "concebir", "gemir", "reñir", "teñir",
]);

function gerund(inf: string): string {
  if (IRREGULAR_GERUND[inf]) return IRREGULAR_GERUND[inf];
  const stem = inf.slice(0, -2);
  if (inf.endsWith("ar")) return stem + "ando";
  if (E_TO_I.has(inf)) {
    const i = stem.lastIndexOf("e");
    return stem.slice(0, i) + "i" + stem.slice(i + 1) + "iendo";
  }
  if (/[aeiou]$/.test(stem)) return stem + "yendo"; // leyendo, trayendo, construyendo
  return stem + "iendo";
}

const IRREGULAR_PAST: Record<string, string> = {
  hacer: "hice", deshacer: "deshice", rehacer: "rehice", satisfacer: "satisfice",
  poner: "puse", componer: "compuse", proponer: "propuse", suponer: "supuse", disponer: "dispuse",
  exponer: "expuse", reponer: "repuse", tener: "tuve", obtener: "obtuve", mantener: "mantuve",
  contener: "contuve", detener: "detuve", sostener: "sostuve", retener: "retuve", entretener: "entretuve",
  decir: "dije", venir: "vine", convenir: "convine", prevenir: "previne", intervenir: "intervine",
  traer: "traje", atraer: "atraje", distraer: "distraje", extraer: "extraje", estar: "estuve",
  saber: "supe", querer: "quise", poder: "pude", caber: "cupe", andar: "fui", ir: "fui", ser: "fui",
  dar: "di", ver: "vi", conducir: "conduje", traducir: "traduje", producir: "produje",
  reducir: "reduje", introducir: "introduje", deducir: "deduje",
};

function pastFirstPerson(inf: string): string {
  if (IRREGULAR_PAST[inf]) return IRREGULAR_PAST[inf];
  const stem = inf.slice(0, -2);
  if (inf.endsWith("ar")) {
    if (stem.endsWith("c")) return stem.slice(0, -1) + "qué"; // practiqué
    if (stem.endsWith("gu")) return stem.slice(0, -2) + "güé"; // averigüé
    if (stem.endsWith("g")) return stem + "ué"; // jugué
    if (stem.endsWith("z")) return stem.slice(0, -1) + "cé"; // empecé
    return stem + "é";
  }
  return stem + "í";
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// Lo que se le dice a uno pasa a primera persona en el resto del título.
const FIRST_PERSON: Record<string, string> = { tu: "mi", tus: "mis", Tu: "Mi", Tus: "Mis" };
// Palabras que suelen unir dos órdenes ("Meditá y escribí", "Lavate, vestite y desayuná").
const JOINERS = new Set(["y", "e", "o", "u", "ni", "luego", "después", "despues", "entonces", "pero", "mientras", "antes"]);

function conjugateWord(word: string, parsed: Parsed, tense: "gerund" | "past"): string {
  const upper = word.charAt(0) !== word.charAt(0).toLowerCase();
  let verb: string;
  if (tense === "gerund") {
    verb = gerund(parsed.infinitive);
    // Pronombre pegado: el gerundio lleva tilde ("Lavándome", "Haciéndolo").
    if (parsed.clitic) verb = verb.replace(/([ae])(ndo)$/, (_x, v: string, n: string) => ACCENTED[v] + n) + parsed.clitic.post;
  } else {
    verb = pastFirstPerson(parsed.infinitive);
    if (parsed.clitic) verb = parsed.clitic.pre + " " + verb;
  }
  return upper ? capitalize(verb) : verb;
}

const cache = new Map<string, string>();

// Conjuga todos los verbos en imperativo del título. La primera palabra se reconoce sola; las
// demás tienen que estar en minúscula (una con mayúscula en el medio es un nombre: "Llamá a
// José") y, si no llevan tilde ("lavate", "hacelo"), venir después de una coma o de un "y/o/
// luego…", para no confundir sustantivos como "regalo" o "animales" con un verbo + pronombre.
export function conjugateTaskTitle(title: string, tense: "gerund" | "past"): string {
  const key = tense + "\u0000" + title;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const words = [...title.matchAll(/\p{L}+/gu)];
  const out: string[] = [];
  let cursor = 0;
  let anyVerb = false;
  let prevWord = "";
  words.forEach((m, i) => {
    const word = m[0];
    const start = m.index!;
    const gap = title.slice(cursor, start);
    out.push(gap);
    cursor = start + word.length;
    let parsed: Parsed | null = null;
    if (i === 0) parsed = parseImperative(word);
    else if (word === word.toLowerCase()) {
      const candidate = parseImperative(word);
      const afterJoiner = JOINERS.has(prevWord.toLowerCase()) || /[,;:.!?\-–—/+→]/.test(gap);
      // En el medio, "-los/-las/-les" casi siempre es un plural ("animales", "regalos").
      const pluralClitic = /(los|las|les)$/.test(word) && !!candidate?.clitic;
      if (candidate && (!candidate.clitic || (afterJoiner && !pluralClitic))) parsed = candidate;
    }
    if (parsed) {
      anyVerb = true;
      out.push(conjugateWord(word, parsed, tense));
    } else out.push(word);
    prevWord = word;
  });
  out.push(title.slice(cursor));
  let result = title;
  if (anyVerb) {
    // Segunda pasada solo para "tu/tus" → "mi/mis" (palabras que no son verbos).
    result = out.join("").replace(/(?<!\p{L})(tu|tus|Tu|Tus)(?!\p{L})/gu, (w) => FIRST_PERSON[w]);
  }
  cache.set(key, result);
  return result;
}
