function parseBody(body) {
  if (!body) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

function decodeBase64Url(input) {
  const normalized = String(input || "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64").toString("utf8");
}

function getJwtRole(jwt) {
  try {
    const parts = String(jwt || "").split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    return payload?.role || null;
  } catch {
    return null;
  }
}

function isClearlyNotServiceRoleKey(key) {
  const raw = String(key || "").trim();
  const jwtRole = getJwtRole(raw);
  if (jwtRole && jwtRole !== "service_role") return true;
  if (raw.startsWith("sb_publishable_")) return true;
  return false;
}

function jsonHeaders(serviceKey) {
  return {
    "Content-Type": "application/json",
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`
  };
}

function pickErrorMessage(payload, fallback) {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  if (payload.message) return payload.message;
  if (payload.error) return payload.error;
  return fallback;
}

function normalizeImportantNotes(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  const text = String(value ?? "");
  if (!text.trim()) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeImportantNotesPayload(body) {
  const key = String(body.key || "").trim().toLowerCase();
  const importantNotes = normalizeImportantNotes(
    body.importantNotes ?? body.important_notes ?? body.items ?? ""
  );

  return {
    key: key || "important_notes",
    importantNotes
  };
}

function validateImportantNotesPayload(payload) {
  if (payload.key !== "important_notes") {
    return "Chave de configuracao invalida.";
  }
  if (payload.importantNotes.length > 120) {
    return "Demasiadas observacoes. Limite: 120 linhas.";
  }
  const tooLongNote = payload.importantNotes.find((note) => note.length > 300);
  if (tooLongNote) {
    return "Cada observacao deve ter no maximo 300 caracteres.";
  }
  return null;
}

function extractImportantNotesFromRow(row) {
  const value = row?.setting_value;
  if (!value || typeof value !== "object") return [];
  return normalizeImportantNotes(value.items);
}

async function readImportantNotes(baseUrl, serviceKey) {
  const url =
    `${baseUrl}/rest/v1/app_settings` +
    "?select=setting_key,setting_value" +
    "&setting_key=eq.important_notes" +
    "&limit=1";

  const response = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/json"
    }
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(pickErrorMessage(payload, "Erro ao ler observacoes importantes."));
  }

  if (!Array.isArray(payload) || payload.length === 0) return [];
  return extractImportantNotesFromRow(payload[0]);
}

async function upsertImportantNotes(baseUrl, serviceKey, importantNotes) {
  const nowIso = new Date().toISOString();
  const body = [
    {
      setting_key: "important_notes",
      setting_value: { items: importantNotes },
      updated_at: nowIso
    }
  ];

  const response = await fetch(`${baseUrl}/rest/v1/app_settings`, {
    method: "POST",
    headers: {
      ...jsonHeaders(serviceKey),
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(pickErrorMessage(payload, "Erro ao guardar observacoes importantes."));
  }
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error("Nao foi devolvido registo apos guardar observacoes.");
  }

  return extractImportantNotesFromRow(payload[0]);
}

module.exports = async (req, res) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({
      error: "Faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY na Vercel."
    });
    return;
  }

  if (isClearlyNotServiceRoleKey(SUPABASE_SERVICE_ROLE_KEY)) {
    res.status(500).json({
      error:
        "SUPABASE_SERVICE_ROLE_KEY invalida. A chave atual parece anon/publishable e nao service role."
    });
    return;
  }

  try {
    if (req.method === "GET") {
      const queryKey = String(req?.query?.key || "").trim().toLowerCase();
      if (queryKey && queryKey !== "important_notes") {
        res.status(400).json({ error: "Chave de configuracao invalida." });
        return;
      }

      const importantNotes = await readImportantNotes(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      res.status(200).json({
        key: "important_notes",
        importantNotes
      });
      return;
    }

    if (req.method === "PUT") {
      const body = parseBody(req.body);
      const normalized = normalizeImportantNotesPayload(body);
      const validationError = validateImportantNotesPayload(normalized);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const savedNotes = await upsertImportantNotes(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        normalized.importantNotes
      );
      res.status(200).json({
        key: "important_notes",
        importantNotes: savedNotes
      });
      return;
    }

    res.status(405).json({ error: "Metodo nao permitido." });
  } catch (error) {
    res.status(500).json({
      error: error.message || "Erro interno na API de settings."
    });
  }
};
