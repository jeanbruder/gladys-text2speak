const DEFAULT_TIMEOUT_SECONDS = 5;
const MAX_MESSAGE_LENGTH = 500;

function normalizeBaseUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("L'adresse de l'API Text2Speak n'est pas configurée.");
  }

  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("Adresse Text2Speak invalide. Exemple : http://192.168.1.20:1337");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("L'API Text2Speak doit utiliser HTTP ou HTTPS.");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("L'adresse de base ne doit contenir ni identifiants, ni paramètres, ni fragment.");
  }

  return parsed.toString().replace(/\/+$/, "");
}

function timeoutSignal(seconds) {
  const value = Number(seconds ?? DEFAULT_TIMEOUT_SECONDS);
  if (!Number.isFinite(value) || value < 1 || value > 30) {
    throw new Error("Le délai HTTP doit être compris entre 1 et 30 secondes.");
  }
  return AbortSignal.timeout(value * 1000);
}

async function requestJson(baseUrl, path, options = {}, timeoutSeconds = DEFAULT_TIMEOUT_SECONDS, fetchImpl = fetch) {
  const url = `${normalizeBaseUrl(baseUrl)}${path}`;
  let response;

  try {
    response = await fetchImpl(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers
      },
      signal: timeoutSignal(timeoutSeconds)
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new Error(`Délai dépassé lors de l'appel à ${url}.`);
    }
    throw new Error(`Impossible de joindre Text2Speak (${error.message}).`);
  }

  const raw = await response.text();
  let body = {};
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      throw new Error(`Text2Speak a retourné une réponse non JSON (HTTP ${response.status}).`);
    }
  }

  if (!response.ok) {
    const detail = body.ERROR || body.error || body.message || response.statusText;
    const descriptions = {
      400: "Requête refusée par Text2Speak (message, priorité ou cible invalide)",
      413: "Le message dépasse la longueur maximale autorisée par Text2Speak",
      503: "La file d'attente Text2Speak est pleine"
    };
    throw new Error(`${descriptions[response.status] || `Erreur HTTP ${response.status}`} : ${detail}`);
  }

  return body;
}

export function parseTargets(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return [];
  }

  const targets = String(value)
    .split(",")
    .map((target) => target.trim().toLocaleLowerCase("fr-FR"))
    .filter(Boolean);

  if (targets.length === 0) return [];
  return [...new Set(targets)];
}

export function validateTargets(targets, layout) {
  if (!targets.length) return;

  if (!layout || typeof layout !== "object" || !layout.pieces || !layout.zones) {
    throw new Error("La réponse de GET /pieces de Text2Speak est invalide.");
  }

  const available = new Set([
    ...Object.keys(layout.pieces),
    ...Object.keys(layout.zones)
  ].map((name) => name.toLocaleLowerCase("fr-FR")));

  const unknown = targets.filter((target) => !available.has(target));
  if (unknown.length) {
    throw new Error(
      `Cible(s) Text2Speak inconnue(s) : ${unknown.join(", ")}. ` +
      `Pièces : ${Object.keys(layout.pieces).join(", ") || "aucune"}. ` +
      `Zones : ${Object.keys(layout.zones).join(", ") || "aucune"}.`
    );
  }
}

export function createText2SpeakClient({ fetchImpl = fetch } = {}) {
  // Injecting fetch keeps API behavior independently testable without a live server.
  async function getLayout(config) {
    return requestJson(
      config.base_url,
      "/pieces",
      {},
      config.timeout_seconds ?? DEFAULT_TIMEOUT_SECONDS,
      fetchImpl
    );
  }

  async function sendMessage(config, fields) {
    const message = typeof fields.message === "string" ? fields.message.trim() : "";
    if (!message) throw new Error("Le message à prononcer ne peut pas être vide.");
    if (message.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Le message dépasse ${MAX_MESSAGE_LENGTH} caractères.`);
    }

    const priority = Number(fields.priority ?? 5);
    if (!Number.isInteger(priority) || priority < 0 || priority > 9) {
      throw new Error("La priorité doit être un entier compris entre 0 et 9.");
    }

    const targets = parseTargets(fields.targets);
    const payload = {
      dire: message,
      priorite: priority
    };

    if (targets.length) {
      const layout = await getLayout(config);
      validateTargets(targets, layout);
      payload.cibles = targets;
    }

    const result = await requestJson(
      config.base_url,
      "/dire",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      config.timeout_seconds ?? DEFAULT_TIMEOUT_SECONDS,
      fetchImpl
    );

    if (result.id === undefined || result.id === null) {
      throw new Error("Text2Speak a accepté la requête sans retourner d'identifiant de tâche.");
    }

    return {
      job_id: String(result.id),
      queue_position: Number.isFinite(Number(result.position)) ? Number(result.position) : 0,
      accepted_targets: Array.isArray(result.cibles) ? result.cibles.join(", ") : ""
    };
  }

  async function testConnection(config) {
    const layout = await getLayout(config);
    const pieceCount = Object.keys(layout.pieces || {}).length;
    const zoneCount = Object.keys(layout.zones || {}).length;

    if (!pieceCount && !zoneCount) {
      throw new Error("Text2Speak répond, mais aucune pièce ni zone n'a été déclarée.");
    }

    return { pieceCount, zoneCount, defaultTargets: layout.defaut || [] };
  }

  return { getLayout, sendMessage, testConnection };
}
