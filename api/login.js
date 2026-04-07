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

function pickRpcError(payload, fallback) {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  if (payload.message) return payload.message;
  if (payload.error) return payload.error;
  return fallback;
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

  const keyRole = getJwtRole(SUPABASE_SERVICE_ROLE_KEY);
  if (keyRole !== "service_role") {
    res.status(500).json({
      error:
        "SUPABASE_SERVICE_ROLE_KEY invalida. A chave atual nao e service_role (parece anon)."
    });
    return;
  }

  const body = parseBody(req.body);
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!username || !password) {
    res.status(400).json({ error: "Username e password sao obrigatorios." });
    return;
  }

  try {
    const rpcResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/login_with_password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        p_username: username,
        p_password: password
      })
    });

    const rpcPayload = await rpcResponse.json().catch(() => null);

    if (!rpcResponse.ok) {
      const message = pickRpcError(
        rpcPayload,
        "Erro ao validar credenciais no Supabase."
      );
      res.status(500).json({ error: message });
      return;
    }

    if (!Array.isArray(rpcPayload) || rpcPayload.length === 0) {
      res.status(401).json({ error: "Credenciais invalidas." });
      return;
    }

    const user = rpcPayload[0];
    res.status(200).json({
      ok: true,
      userId: user.user_id,
      username: user.username
    });
  } catch (error) {
    res.status(500).json({
      error: "Erro interno no login."
    });
  }
};
