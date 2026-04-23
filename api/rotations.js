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

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function firstValue(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

function parseUuid(value) {
  const raw = String(value || "").trim();
  return isValidUuid(raw) ? raw : null;
}

function parseDateOnly(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const parsed = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return raw;
}

function parseMoneyInput(value, options = {}) {
  const allowNegative = Boolean(options.allowNegative);
  const defaultValue = Number.isFinite(options.defaultValue) ? options.defaultValue : 0;
  const emptyAsDefault = options.emptyAsDefault !== false;

  if (typeof value === "number" && Number.isFinite(value)) {
    if (!allowNegative && value < 0) return NaN;
    return Number(value.toFixed(2));
  }

  const raw = String(value ?? "").trim();
  if (!raw) return emptyAsDefault ? defaultValue : NaN;

  const normalized = raw.replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return NaN;
  if (!allowNegative && parsed < 0) return NaN;
  return Number(parsed.toFixed(2));
}

function parseOddInput(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = raw.replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 1) return NaN;
  return Number(parsed.toFixed(2));
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

function normalizeRotationPayload(body) {
  const entryTypeRaw = String(body.entryType ?? body.entry_type ?? "rotation")
    .trim()
    .toLowerCase();
  const entryType = ["rotation", "bonus_payout"].includes(entryTypeRaw) ? entryTypeRaw : "rotation";

  const rotationDate = parseDateOnly(body.rotationDate ?? body.rotation_date ?? "");
  const houseABet = String(
    body.houseABet ?? body.house_a_bet ?? body.betLabel ?? body.bet_label ?? ""
  ).trim();
  const houseBBet = String(
    body.houseBBet ?? body.house_b_bet ?? body.matchLabel ?? body.match_label ?? ""
  ).trim();
  const houseAOdd = parseOddInput(body.houseAOdd ?? body.house_a_odd ?? body.odd);
  const houseBOdd = parseOddInput(body.houseBOdd ?? body.house_b_odd ?? "");
  const nowIso = new Date().toISOString();

  return {
    entry_type: entryType,
    username: normalizeUsername(body.username),
    rotation_date: rotationDate || "",
    house_a_id: parseUuid(body.houseAId ?? body.house_a_id),
    house_b_id: parseUuid(body.houseBId ?? body.house_b_id),
    amount_house_a: parseMoneyInput(body.amountHouseA ?? body.amount_house_a, {
      allowNegative: false,
      emptyAsDefault: false
    }),
    amount_house_b: parseMoneyInput(body.amountHouseB ?? body.amount_house_b, {
      allowNegative: false,
      emptyAsDefault: false
    }),
    house_a_bet: houseABet,
    house_a_odd: houseAOdd,
    house_b_bet: houseBBet,
    house_b_odd: houseBOdd,
    profit_loss: parseMoneyInput(body.profitLoss ?? body.profit_loss, {
      allowNegative: true,
      emptyAsDefault: false
    }),
    notes: String(body.notes ?? "").trim() || null,
    bet_label: houseABet || null,
    match_label: houseBBet || null,
    odd: Number.isFinite(houseAOdd) ? houseAOdd : null,
    updated_at: nowIso
  };
}

function validateRotationPayload(payload) {
  const allowedUsers = new Set(["goncalo", "xico"]);
  if (!allowedUsers.has(payload.username)) {
    return "Utilizador invalido para registo.";
  }

  if (!payload.rotation_date) {
    return "Data da rotacao invalida (YYYY-MM-DD).";
  }

  if (!["rotation", "bonus_payout"].includes(payload.entry_type)) {
    return "Tipo de registo invalido.";
  }

  if (payload.entry_type === "bonus_payout") {
    if (!payload.house_a_id) {
      return "Casa do bonus invalida.";
    }

    if (Number.isNaN(payload.profit_loss) || payload.profit_loss < 0) {
      return "Lucro individual do bonus invalido.";
    }

    payload.house_b_id = null;
    payload.amount_house_a = 0;
    payload.amount_house_b = 0;
    payload.house_a_bet = "bonus pagou";
    payload.house_a_odd = 1;
    payload.house_b_bet = null;
    payload.house_b_odd = null;
    payload.bet_label = "bonus pagou";
    payload.match_label = null;
    payload.odd = null;

    if (payload.notes && payload.notes.length > 1000) {
      return "Nota demasiado longa (max. 1000 caracteres).";
    }

    return null;
  }

  if (!payload.house_a_id || !payload.house_b_id) {
    return "As duas casas sao obrigatorias.";
  }

  if (payload.house_b_id === payload.house_a_id) {
    return "Casa 1 e Casa 2 nao podem ser iguais.";
  }

  if (Number.isNaN(payload.amount_house_a) || payload.amount_house_a <= 0) {
    return "Valor apostado da casa 1 invalido.";
  }

  if (Number.isNaN(payload.amount_house_b) || payload.amount_house_b <= 0) {
    return "Valor apostado da casa 2 invalido.";
  }

  if (!payload.house_a_bet) {
    return "Indica o que apostaste na casa 1.";
  }

  if (!payload.house_b_bet) {
    return "Indica o que apostaste na casa 2.";
  }

  if (payload.house_a_bet.length > 160 || payload.house_b_bet.length > 160) {
    return "Descricao da aposta demasiado longa (max. 160 caracteres por casa).";
  }

  if (payload.house_a_odd === null || Number.isNaN(payload.house_a_odd)) {
    return "Odd da casa 1 invalida.";
  }

  if (payload.house_b_odd === null || Number.isNaN(payload.house_b_odd)) {
    return "Odd da casa 2 invalida.";
  }

  if (Number.isNaN(payload.profit_loss)) {
    return "Lucro/Prejuizo invalido.";
  }

  if (payload.notes && payload.notes.length > 1000) {
    return "Nota demasiado longa (max. 1000 caracteres).";
  }

  return null;
}

async function fetchHousesByIds(baseUrl, serviceKey, houseIds) {
  const uniqueHouseIds = [...new Set(houseIds.filter(Boolean))];
  if (!uniqueHouseIds.length) return [];

  const params = new URLSearchParams();
  params.set("select", "id,name,owner_name,is_active");
  params.set("id", `in.(${uniqueHouseIds.join(",")})`);

  const response = await fetch(`${baseUrl}/rest/v1/bet_houses?${params.toString()}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/json"
    }
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(pickErrorMessage(payload, "Erro ao validar casas da rotacao."));
  }

  return Array.isArray(payload) ? payload : [];
}

async function validateRotationHouses(baseUrl, serviceKey, payload) {
  const requiredIds =
    payload.entry_type === "bonus_payout"
      ? [payload.house_a_id]
      : [payload.house_a_id, payload.house_b_id];
  const houses = await fetchHousesByIds(baseUrl, serviceKey, requiredIds);
  const housesById = new Map(houses.map((house) => [house.id, house]));

  for (const houseId of requiredIds) {
    const house = housesById.get(houseId);
    if (!house) {
      return "Uma das casas selecionadas nao existe.";
    }

    const owner = normalizeUsername(house.owner_name);
    if (owner !== "ambos" && owner !== payload.username) {
      return `A casa "${house.name}" nao pertence ao utilizador autenticado.`;
    }

    if (house.is_active === false) {
      return `A casa "${house.name}" esta inativa.`;
    }
  }

  return null;
}

function rotationSelectColumns() {
  return [
    "id",
    "username",
    "entry_type",
    "rotation_date",
    "house_a_id",
    "house_b_id",
    "amount_house_a",
    "amount_house_b",
    "house_a_bet",
    "house_a_odd",
    "house_b_bet",
    "house_b_odd",
    "profit_loss",
    "notes",
    "created_at",
    "updated_at"
  ].join(",");
}

async function listRotations(baseUrl, serviceKey, username, dateFrom, dateTo) {
  const params = new URLSearchParams();
  params.set("select", rotationSelectColumns());
  if (username && username !== "all") {
    params.set("username", `eq.${username}`);
  }
  params.set("order", "rotation_date.desc,created_at.desc");

  if (dateFrom) {
    params.append("rotation_date", `gte.${dateFrom}`);
  }
  if (dateTo) {
    params.append("rotation_date", `lte.${dateTo}`);
  }

  const response = await fetch(`${baseUrl}/rest/v1/weekly_rotations?${params.toString()}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/json"
    }
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(pickErrorMessage(payload, "Erro ao listar rotacoes."));
  }
  return Array.isArray(payload) ? payload : [];
}

async function insertRotation(baseUrl, serviceKey, payload) {
  const response = await fetch(`${baseUrl}/rest/v1/weekly_rotations?select=${rotationSelectColumns()}`, {
    method: "POST",
    headers: {
      ...jsonHeaders(serviceKey),
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(pickErrorMessage(body, "Erro ao guardar rotacao."));
  }

  if (!Array.isArray(body) || body.length === 0) {
    throw new Error("Nao foi devolvido registo apos guardar rotacao.");
  }

  return body[0];
}

async function deleteRotation(baseUrl, serviceKey, rotationId, username) {
  const params = new URLSearchParams();
  params.set("id", `eq.${rotationId}`);
  params.set("username", `eq.${username}`);

  const response = await fetch(`${baseUrl}/rest/v1/weekly_rotations?${params.toString()}`, {
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
    throw new Error(pickErrorMessage(payload, "Erro ao remover rotacao."));
  }

  if (!Array.isArray(payload) || payload.length === 0) return null;
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

  if (isClearlyNotServiceRoleKey(SUPABASE_SERVICE_ROLE_KEY)) {
    res.status(500).json({
      error:
        "SUPABASE_SERVICE_ROLE_KEY invalida. A chave atual parece anon/publishable e nao service role."
    });
    return;
  }

  try {
    if (req.method === "GET") {
      const username = normalizeUsername(firstValue(req?.query?.username));
      const dateFromRaw = parseDateOnly(firstValue(req?.query?.dateFrom ?? req?.query?.date_from));
      const dateToRaw = parseDateOnly(firstValue(req?.query?.dateTo ?? req?.query?.date_to));

      if (!username) {
        res.status(400).json({ error: "Parametro username e obrigatorio." });
        return;
      }

      if (!["goncalo", "xico", "all"].includes(username)) {
        res.status(400).json({ error: "Username invalido." });
        return;
      }

      if (dateFromRaw === null || dateToRaw === null) {
        res.status(400).json({ error: "Parametros de data invalidos (YYYY-MM-DD)." });
        return;
      }

      if (dateFromRaw && dateToRaw && dateFromRaw > dateToRaw) {
        res.status(400).json({ error: "dateFrom nao pode ser maior que dateTo." });
        return;
      }

      const rotations = await listRotations(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        username,
        dateFromRaw || null,
        dateToRaw || null
      );

      res.status(200).json({
        username,
        dateFrom: dateFromRaw || null,
        dateTo: dateToRaw || null,
        rotations
      });
      return;
    }

    if (req.method === "POST") {
      const body = parseBody(req.body);
      const normalized = normalizeRotationPayload(body);
      const validationError = validateRotationPayload(normalized);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const houseValidationError = await validateRotationHouses(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        normalized
      );
      if (houseValidationError) {
        res.status(400).json({ error: houseValidationError });
        return;
      }

      const created = await insertRotation(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, normalized);
      res.status(201).json({ rotation: created });
      return;
    }

    if (req.method === "DELETE") {
      const rotationId = parseUuid(firstValue(req?.query?.id));
      const username = normalizeUsername(firstValue(req?.query?.username));

      if (!rotationId) {
        res.status(400).json({ error: "ID de registo invalido." });
        return;
      }

      if (!["goncalo", "xico"].includes(username)) {
        res.status(400).json({ error: "Username invalido." });
        return;
      }

      const deleted = await deleteRotation(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        rotationId,
        username
      );
      if (!deleted) {
        res.status(404).json({ error: "Registo nao encontrado para remover." });
        return;
      }

      res.status(200).json({ deleted: true, rotation: deleted });
      return;
    }

    res.status(405).json({ error: "Metodo nao permitido." });
  } catch (error) {
    res.status(500).json({
      error: error.message || "Erro interno na API de rotacoes."
    });
  }
};
