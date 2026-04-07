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

function pickErrorMessage(payload, fallback) {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  if (payload.message) return payload.message;
  if (payload.error) return payload.error;
  return fallback;
}

function extractBooleanResult(payload) {
  if (typeof payload === "boolean") return payload;
  if (payload && typeof payload === "object") {
    if (typeof payload.change_user_password === "boolean") return payload.change_user_password;
    if (typeof payload.change_password === "boolean") return payload.change_password;
  }
  if (Array.isArray(payload) && payload.length > 0 && payload[0] && typeof payload[0] === "object") {
    const firstValue = Object.values(payload[0])[0];
    if (typeof firstValue === "boolean") return firstValue;
  }
  return false;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo nao permitido." });
    return;
  }

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

  const body = parseBody(req.body);
  const username = String(body.username || "").trim().toLowerCase();
  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");

  if (!username || !currentPassword || !newPassword) {
    res.status(400).json({ error: "Username, senha atual e nova senha sao obrigatorios." });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ error: "A nova senha deve ter pelo menos 8 caracteres." });
    return;
  }

  if (newPassword === currentPassword) {
    res.status(400).json({ error: "A nova senha deve ser diferente da atual." });
    return;
  }

  try {
    const rpcResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/change_user_password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        p_username: username,
        p_current_password: currentPassword,
        p_new_password: newPassword
      })
    });

    const rpcPayload = await rpcResponse.json().catch(() => null);

    if (!rpcResponse.ok) {
      const message = pickErrorMessage(
        rpcPayload,
        "Erro ao atualizar senha no Supabase."
      );
      res.status(500).json({ error: message });
      return;
    }

    const changed = extractBooleanResult(rpcPayload);
    if (!changed) {
      res.status(401).json({ error: "Senha atual incorreta." });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Erro interno ao atualizar senha." });
  }
};
