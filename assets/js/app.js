const weekdayNames = {
  1: "segunda",
  2: "terca",
  3: "quarta",
  4: "quinta",
  5: "sexta",
  6: "sabado",
  7: "domingo"
};

const todayAlertsEl = document.getElementById("today-alerts");
const alertsStatusEl = document.getElementById("alerts-status");
const upcomingAlertsBodyEl = document.getElementById("upcoming-alerts-body");
const housesBodyEl = document.getElementById("houses-body");
const houseFormEl = document.getElementById("house-form");
const houseFormStatusEl = document.getElementById("house-form-status");
const saveHouseButtonEl = document.getElementById("save-house-button");
const enableNotificationsBtnEl = document.getElementById("enable-notifications");
const logoutButtonEl = document.getElementById("logout-button");
const welcomeTextEl = document.getElementById("welcome-text");

function getSessionUser() {
  try {
    const raw = localStorage.getItem("sociedade_user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearSessionAndGoLogin() {
  localStorage.removeItem("sociedade_user");
  window.location.href = "/";
}

function updateFormStatus(message, tone = "muted") {
  if (!houseFormStatusEl) return;
  houseFormStatusEl.textContent = message;
  houseFormStatusEl.className = `status ${tone}`;
}

function isoWeekday(date) {
  const weekday = date.getDay(); // 0(domingo) ... 6(sabado)
  return weekday === 0 ? 7 : weekday;
}

function nextDateForWeekday(targetIso, fromDate, includeToday = true) {
  const currentIso = isoWeekday(fromDate);
  let daysToAdd = targetIso - currentIso;
  if (daysToAdd < 0 || (!includeToday && daysToAdd === 0)) {
    daysToAdd += 7;
  }
  const nextDate = new Date(fromDate);
  nextDate.setDate(fromDate.getDate() + daysToAdd);
  return nextDate;
}

function formatDatePt(date) {
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit"
  }).format(date);
}

function createTd(text) {
  const td = document.createElement("td");
  td.textContent = text ?? "";
  return td;
}

function renderHouses(houses) {
  if (!housesBodyEl) return;
  housesBodyEl.innerHTML = "";

  if (!houses.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.textContent = "Sem casas registadas.";
    tr.appendChild(td);
    housesBodyEl.appendChild(tr);
    return;
  }

  houses.forEach((house) => {
    const tr = document.createElement("tr");
    tr.appendChild(createTd(house.name));
    tr.appendChild(createTd(house.owner_name));
    tr.appendChild(
      createTd(`${weekdayNames[house.deposit_weekday] || "-"} ${house.deposit_deadline ? `ate ${house.deposit_deadline}` : ""}`)
    );
    tr.appendChild(
      createTd(`${weekdayNames[house.bonus_weekday] || "-"}${house.bonus_label ? ` (${house.bonus_label})` : ""}`)
    );
    tr.appendChild(createTd(house.is_active ? "sim" : "nao"));
    housesBodyEl.appendChild(tr);
  });
}

function notifyOncePerDay(key, title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const dayKey = new Date().toISOString().slice(0, 10);
  const storageKey = `sociedade_notification_${key}_${dayKey}`;
  if (localStorage.getItem(storageKey)) return;
  new Notification(title, { body });
  localStorage.setItem(storageKey, "1");
}

function renderAlerts(houses) {
  if (!todayAlertsEl || !alertsStatusEl || !upcomingAlertsBodyEl) return;

  todayAlertsEl.innerHTML = "";
  upcomingAlertsBodyEl.innerHTML = "";

  const today = new Date();
  const todayIso = isoWeekday(today);
  const todaysAlerts = [];

  houses.forEach((house) => {
    if (!house.is_active || !house.reminder_enabled) return;
    const depositDay = Number(house.deposit_weekday);
    const bonusDay = Number(house.bonus_weekday);
    const checkDay = depositDay === 1 ? 7 : depositDay - 1;

    if (todayIso === checkDay) {
      const msg = `${house.name}: verificar conta e condicoes para deposito de ${weekdayNames[depositDay]}.`;
      todaysAlerts.push(msg);
      notifyOncePerDay(
        `${house.id}_check`,
        `Aviso ${house.name}`,
        "Amanha e dia de deposito. Verifica se esta tudo direitinho."
      );
    }

    if (todayIso === bonusDay) {
      const msg = `${house.name}: hoje e dia de bonus/deposito (${house.deposit_deadline || "sem hora definida"}).`;
      todaysAlerts.push(msg);
      notifyOncePerDay(
        `${house.id}_bonus`,
        `Bonus ${house.name}`,
        "Hoje e dia do bonus. Nao esquecer de depositar."
      );
    }

    const nextCheck = nextDateForWeekday(checkDay, today, true);
    const nextBonus = nextDateForWeekday(bonusDay, today, true);
    const tr = document.createElement("tr");
    tr.appendChild(createTd(house.name));
    tr.appendChild(createTd(formatDatePt(nextCheck)));
    tr.appendChild(createTd(formatDatePt(nextBonus)));
    upcomingAlertsBodyEl.appendChild(tr);
  });

  if (!todaysAlerts.length) {
    const li = document.createElement("li");
    li.textContent = "Sem alertas para hoje.";
    todayAlertsEl.appendChild(li);
    alertsStatusEl.textContent = "Voltamos a avisar automaticamente quando existir tarefa.";
    alertsStatusEl.className = "status warn";
  } else {
    todaysAlerts.forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      todayAlertsEl.appendChild(li);
    });
    alertsStatusEl.textContent = `${todaysAlerts.length} aviso(s) ativo(s) hoje.`;
    alertsStatusEl.className = "status ok";
  }
}

async function fetchHouses() {
  const response = await fetch("/api/houses", {
    headers: { Accept: "application/json" }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Nao foi possivel carregar casas.");
  }

  return payload.houses || [];
}

async function refreshData() {
  const houses = await fetchHouses();
  renderHouses(houses);
  renderAlerts(houses);
}

async function createHouse(payload) {
  const response = await fetch("/api/houses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "Nao foi possivel guardar casa.");
  }
  return body.house;
}

async function handleHouseSubmit(event) {
  event.preventDefault();
  if (!houseFormEl) return;

  const formData = new FormData(houseFormEl);
  const name = String(formData.get("name") || "").trim().toLowerCase();
  const ownerName = String(formData.get("ownerName") || "").trim().toLowerCase();
  const depositWeekday = Number(formData.get("depositWeekday"));
  const depositDeadline = String(formData.get("depositDeadline") || "").trim();
  const bonusWeekday = Number(formData.get("bonusWeekday"));
  const bonusLabel = String(formData.get("bonusLabel") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const reminderEnabled = formData.get("reminderEnabled") === "on";

  if (!name) {
    updateFormStatus("Indica o nome da casa.", "error");
    return;
  }

  updateFormStatus("A guardar casa...", "warn");
  if (saveHouseButtonEl) saveHouseButtonEl.disabled = true;

  try {
    await createHouse({
      name,
      ownerName,
      depositWeekday,
      depositDeadline,
      bonusWeekday,
      bonusLabel,
      reminderEnabled,
      notes
    });
    houseFormEl.reset();
    updateFormStatus("Casa adicionada com sucesso.", "ok");
    await refreshData();
  } catch (error) {
    updateFormStatus(error.message || "Falha ao adicionar casa.", "error");
  } finally {
    if (saveHouseButtonEl) saveHouseButtonEl.disabled = false;
  }
}

async function enableBrowserNotifications() {
  if (!("Notification" in window)) {
    alert("Este browser nao suporta notificacoes.");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    alert("Notificacoes ativadas.");
    await refreshData();
  } else {
    alert("Notificacoes nao permitidas.");
  }
}

async function init() {
  const user = getSessionUser();
  if (!user || !user.username) {
    clearSessionAndGoLogin();
    return;
  }

  if (welcomeTextEl) {
    welcomeTextEl.textContent = `Sessao ativa: ${user.username}`;
  }

  if (logoutButtonEl) {
    logoutButtonEl.addEventListener("click", clearSessionAndGoLogin);
  }

  if (enableNotificationsBtnEl) {
    enableNotificationsBtnEl.addEventListener("click", enableBrowserNotifications);
  }

  if (houseFormEl) {
    houseFormEl.addEventListener("submit", handleHouseSubmit);
  }

  try {
    await refreshData();
  } catch (error) {
    if (alertsStatusEl) {
      alertsStatusEl.textContent = error.message || "Erro ao carregar dados.";
      alertsStatusEl.className = "status error";
    }
  }
}

init();
