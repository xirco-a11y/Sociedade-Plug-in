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

function toBoolean(value, defaultValue = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "on" || normalized === "yes";
  }
  return defaultValue;
}

function firstValue(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseHouseId(req, body) {
  const queryId = firstValue(req?.query?.id);
  const raw = String(queryId || body?.id || "").trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);
  return isUuid ? raw : null;
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

function normalizeHousePayload(body) {
  return {
    name: String(body.name || "").trim().toLowerCase(),
    owner_name: String(body.ownerName || "").trim().toLowerCase(),
    deposit_weekday: Number(body.depositWeekday),
    deposit_deadline: String(body.depositDeadline || "23:59").trim(),
    bonus_weekday: Number(body.bonusWeekday),
    bonus_label: String(body.bonusLabel || "").trim(),
    reminder_enabled: toBoolean(body.reminderEnabled, true),
    notes: String(body.notes || "").trim(),
    is_active: toBoolean(body.isActive, true)
  };
}

function validateHouse(house) {
  if (!house.name) return "Nome da casa e obrigatorio.";
  if (!["goncalo", "xico", "ambos"].includes(house.owner_name)) {
    return "Responsavel invalido (goncalo, xico, ambos).";
  }
  if (!Number.isInteger(house.deposit_weekday) || house.deposit_weekday < 1 || house.deposit_weekday > 7) {
    return "Dia de deposito invalido.";
  }
  if (!Number.isInteger(house.bonus_weekday) || house.bonus_weekday < 1 || house.bonus_weekday > 7) {
    return "Dia de bonus invalido.";
  }
  if (!/^\d{2}:\d{2}$/.test(house.deposit_deadline)) {
    return "Hora limite de deposito invalida (HH:MM).";
  }
  return null;
}

async function listHouses(baseUrl, serviceKey) {
  const url =
    `${baseUrl}/rest/v1/bet_houses` +
    "?select=id,name,owner_name,deposit_weekday,deposit_deadline,bonus_weekday,bonus_label,reminder_enabled,is_active,notes" +
    "&order=name.asc";

  const response = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/json"
    }
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(pickErrorMessage(payload, "Erro ao listar casas."));
  }

  return Array.isArray(payload) ? payload : [];
}

async function insertHouse(baseUrl, serviceKey, housePayload) {
  const response = await fetch(`${baseUrl}/rest/v1/bet_houses`, {
    method: "POST",
    headers: {
      ...jsonHeaders(serviceKey),
      Prefer: "return=representation"
    },
    body: JSON.stringify(housePayload)
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(pickErrorMessage(payload, "Erro ao inserir casa."));
  }
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error("Nao foi devolvido registo apos inserir casa.");
  }

  return payload[0];
}

async function updateHouse(baseUrl, serviceKey, houseId, housePayload) {
  const response = await fetch(`${baseUrl}/rest/v1/bet_houses?id=eq.${encodeURIComponent(houseId)}`, {
    method: "PATCH",
    headers: {
      ...jsonHeaders(serviceKey),
      Prefer: "return=representation"
    },
    body: JSON.stringify(housePayload)
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(pickErrorMessage(payload, "Erro ao atualizar casa."));
  }
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error("Casa nao encontrada para atualizar.");
  }

  return payload[0];
}

async function removeHouse(baseUrl, serviceKey, houseId) {
  const response = await fetch(`${baseUrl}/rest/v1/bet_houses?id=eq.${encodeURIComponent(houseId)}`, {
    method: "DELETE",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/json",
      Prefer: "return=representation"
    }
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(pickErrorMessage(payload, "Erro ao remover casa."));
  }

  const deleted = Array.isArray(payload) && payload.length > 0;
  return { deleted, house: deleted ? payload[0] : null };
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
      const houses = await listHouses(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      res.status(200).json({ houses });
      return;
    }

    if (req.method === "POST") {
      const body = parseBody(req.body);
      const house = normalizeHousePayload(body);
      const validationError = validateHouse(house);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const created = await insertHouse(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, house);
      res.status(201).json({ house: created });
      return;
    }

    if (req.method === "PUT") {
      const body = parseBody(req.body);
      const houseId = parseHouseId(req, body);
      if (!houseId) {
        res.status(400).json({ error: "ID da casa invalido." });
        return;
      }

      const house = normalizeHousePayload(body);
      const validationError = validateHouse(house);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const updated = await updateHouse(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, houseId, house);
      res.status(200).json({ house: updated });
      return;
    }

    if (req.method === "DELETE") {
      const houseId = parseHouseId(req, {});
      if (!houseId) {
        res.status(400).json({ error: "ID da casa invalido." });
        return;
      }

      const result = await removeHouse(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, houseId);
      if (!result.deleted) {
        res.status(404).json({ error: "Casa nao encontrada para remover." });
        return;
      }

      res.status(200).json({ deleted: true, house: result.house });
      return;
    }

    res.status(405).json({ error: "Metodo nao permitido." });
  } catch (error) {
    res.status(500).json({
      error: error.message || "Erro interno na API de casas."
    });
  }
};
