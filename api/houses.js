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

function jsonHeaders(serviceKey) {
  return {
    "Content-Type": "application/json",
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`
  };
}

function normalizeHousePayload(body) {
  return {
    name: String(body.name || "").trim().toLowerCase(),
    owner_name: String(body.ownerName || "").trim().toLowerCase(),
    deposit_weekday: Number(body.depositWeekday),
    deposit_deadline: String(body.depositDeadline || "23:59").trim(),
    bonus_weekday: Number(body.bonusWeekday),
    bonus_label: String(body.bonusLabel || "").trim(),
    reminder_enabled: Boolean(body.reminderEnabled),
    notes: String(body.notes || "").trim(),
    is_active: true
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
    const message = payload?.message || payload?.error || "Erro ao listar casas.";
    throw new Error(message);
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
    const message = payload?.message || payload?.error || "Erro ao inserir casa.";
    throw new Error(message);
  }

  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error("Nao foi devolvido registo apos inserir casa.");
  }

  return payload[0];
}

module.exports = async (req, res) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({
      error: "Faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY na Vercel."
    });
    return;
  }

  const keyRole = getJwtRole(SUPABASE_SERVICE_ROLE_KEY);
  if (keyRole !== "service_role") {
    res.status(500).json({
      error:
        "SUPABASE_SERVICE_ROLE_KEY invalida. A chave atual nao e service_role (parece anon)."
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

    res.status(405).json({ error: "Metodo nao permitido." });
  } catch (error) {
    res.status(500).json({
      error: error.message || "Erro interno na API de casas."
    });
  }
};
