const loginForm = document.getElementById("login-form");
const loginButton = document.getElementById("login-button");
const statusElement = document.getElementById("login-status");

function updateStatus(message, state) {
  if (!statusElement) return;
  statusElement.textContent = message;
  statusElement.dataset.state = state;
}

async function handleLogin(event) {
  event.preventDefault();

  if (!loginForm) return;

  const formData = new FormData(loginForm);
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");

  if (!username || !password) {
    updateStatus("Preenche username e password.", "error");
    return;
  }

  updateStatus("A validar credenciais...", "loading");
  if (loginButton) loginButton.disabled = true;

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || "Login invalido.");
    }

    updateStatus(`Bem-vindo, ${payload.username}.`, "success");
    loginForm.reset();
  } catch (error) {
    console.error("Erro de login:", error);
    updateStatus(error.message || "Nao foi possivel entrar.", "error");
  } finally {
    if (loginButton) loginButton.disabled = false;
  }
}

if (loginForm) {
  loginForm.addEventListener("submit", handleLogin);
}
