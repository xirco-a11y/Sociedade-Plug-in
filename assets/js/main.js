const statusElement = document.getElementById("supabase-status");

function updateStatus(message, state) {
  if (!statusElement) {
    return;
  }

  statusElement.textContent = message;
  statusElement.dataset.state = state;
}

async function initSupabase() {
  updateStatus("A ligar ao Supabase...", "loading");

  try {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("SDK do Supabase nao carregou.");
    }

    const response = await fetch("/api/supabase-config", {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      let serverMessage = "Nao foi possivel obter a configuracao do Supabase.";

      try {
        const body = await response.json();
        if (body && body.error) {
          serverMessage = body.error;
        }
      } catch {
        // Mantem a mensagem padrao.
      }

      throw new Error(serverMessage);
    }

    const { supabaseUrl, supabaseAnonKey } = await response.json();

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Configuracao do Supabase incompleta.");
    }

    const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
    window.supabaseClient = supabaseClient;

    // Teste leve para confirmar que o cliente foi inicializado.
    const { error } = await supabaseClient.auth.getSession();
    if (error) {
      throw error;
    }

    updateStatus("Supabase ligado com sucesso.", "success");
  } catch (error) {
    console.error("Erro ao iniciar Supabase:", error);
    updateStatus(`Erro ao ligar Supabase: ${error.message}`, "error");
  }
}

document.addEventListener("DOMContentLoaded", initSupabase);
