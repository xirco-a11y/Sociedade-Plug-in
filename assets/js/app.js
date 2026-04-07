const weekdayNames = {
  1: "segunda",
  2: "terca",
  3: "quarta",
  4: "quinta",
  5: "sexta",
  6: "sabado",
  7: "domingo"
};

const housesBodyEl = document.getElementById("houses-body");
const housesStatusEl = document.getElementById("houses-status");
const houseFormEl = document.getElementById("house-form");
const houseFormTitleEl = document.getElementById("house-form-title");
const houseFormStatusEl = document.getElementById("house-form-status");
const saveHouseButtonEl = document.getElementById("save-house-button");
const cancelHouseEditButtonEl = document.getElementById("cancel-house-edit-button");

const passwordFormEl = document.getElementById("password-form");
const passwordFormStatusEl = document.getElementById("password-form-status");
const changePasswordButtonEl = document.getElementById("change-password-button");

const todayAlertsEl = document.getElementById("today-alerts");
const alertsStatusEl = document.getElementById("alerts-status");
const upcomingAlertsBodyEl = document.getElementById("upcoming-alerts-body");
const upcomingStatusEl = document.getElementById("upcoming-status");
const enableNotificationsBtnEl = document.getElementById("enable-notifications");

const configMenuButtons = document.querySelectorAll("[data-config-menu]");
const configPanels = document.querySelectorAll("[data-config-panel]");

const userLabels = document.querySelectorAll("[data-user-label]");
const logoutButtons = document.querySelectorAll(".js-logout");

let housesCache = [];
let editingHouseId = null;
let rowMenuListenerBound = false;

function setStatus(element, message, tone) {
  if (!element) return;
  element.textContent = message || "";
  element.className = `status ${tone || "muted"}`;
}

function getSessionUser() {
  try {
    const raw = localStorage.getItem("sociedade_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function goToLoginAndClear() {
  localStorage.removeItem("sociedade_user");
  window.location.href = "/";
}

function ensureAuthenticated() {
  const user = getSessionUser();
  if (!user || !user.username) {
    goToLoginAndClear();
    return null;
  }
  return user;
}

function isoWeekday(date) {
  const weekday = date.getDay();
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

function notifyOncePerDay(key, title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const dayKey = new Date().toISOString().slice(0, 10);
  const storageKey = `sociedade_notification_${key}_${dayKey}`;
  if (localStorage.getItem(storageKey)) return;

  new Notification(title, { body });
  localStorage.setItem(storageKey, "1");
}

function buildAlertData(houses) {
  const today = new Date();
  const todayIso = isoWeekday(today);
  const todaysAlerts = [];
  const upcomingRows = [];

  houses.forEach((house) => {
    if (!house.is_active || !house.reminder_enabled) return;

    const depositDay = Number(house.deposit_weekday);
    const bonusDay = Number(house.bonus_weekday);
    const checkDay = depositDay === 1 ? 7 : depositDay - 1;

    if (todayIso === checkDay) {
      todaysAlerts.push({
        id: `${house.id}_check`,
        text: `${house.name}: verificar conta e condicoes para deposito de ${weekdayNames[depositDay]}.`,
        notificationTitle: `Aviso ${house.name}`,
        notificationBody: "Amanha e dia de deposito. Verifica se esta tudo direitinho."
      });
    }

    if (todayIso === bonusDay) {
      todaysAlerts.push({
        id: `${house.id}_bonus`,
        text: `${house.name}: hoje e dia de bonus/deposito (${house.deposit_deadline || "sem hora definida"}).`,
        notificationTitle: `Bonus ${house.name}`,
        notificationBody: "Hoje e dia do bonus. Nao esquecer de depositar."
      });
    }

    upcomingRows.push({
      houseName: house.name,
      checkDate: nextDateForWeekday(checkDay, today, true),
      bonusDate: nextDateForWeekday(bonusDay, today, true)
    });
  });

  upcomingRows.sort((a, b) => a.checkDate - b.checkDate);
  return { todaysAlerts, upcomingRows };
}

function setConfigPanel(panelName) {
  if (!configMenuButtons.length || !configPanels.length) return;

  configMenuButtons.forEach((button) => {
    const active = button.dataset.configMenu === panelName;
    button.classList.toggle("active", active);
  });

  configPanels.forEach((panel) => {
    const active = panel.dataset.configPanel === panelName;
    panel.classList.toggle("active", active);
  });
}

function initConfigMenus() {
  if (!configMenuButtons.length || !configPanels.length) return;

  const hashPanel = String(window.location.hash || "").replace("#", "");
  const initialPanel = hashPanel === "password" ? "password" : "houses";
  setConfigPanel(initialPanel);

  configMenuButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const panelName = button.dataset.configMenu;
      if (!panelName) return;
      setConfigPanel(panelName);
      window.location.hash = panelName;
    });
  });
}

function closeRowMenus(exceptWrapper = null) {
  document.querySelectorAll(".house-row-menu").forEach((wrapper) => {
    if (exceptWrapper && wrapper === exceptWrapper) return;
    const trigger = wrapper.querySelector(".house-row-menu-trigger");
    const dropdown = wrapper.querySelector(".house-row-dropdown");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
    if (dropdown) dropdown.classList.add("hidden");
  });
}

function bindRowMenuOutsideClick() {
  if (rowMenuListenerBound) return;
  rowMenuListenerBound = true;

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      closeRowMenus();
      return;
    }

    const insideMenu = target.closest(".house-row-menu");
    if (!insideMenu) {
      closeRowMenus();
    }
  });
}

function createHouseActionsMenu(house) {
  const wrapper = document.createElement("div");
  wrapper.className = "house-row-menu";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "button secondary tiny house-row-menu-trigger";
  trigger.setAttribute("aria-label", `Acoes da casa ${house.name}`);
  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-expanded", "false");
  trigger.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 7.25A4.75 4.75 0 1 0 12 16.75A4.75 4.75 0 1 0 12 7.25ZM20 13.12V10.88L17.93 10.39C17.77 9.79 17.52 9.22 17.2 8.7L18.33 6.88L16.12 4.67L14.3 5.8C13.78 5.48 13.21 5.23 12.61 5.07L12.12 3H9.88L9.39 5.07C8.79 5.23 8.22 5.48 7.7 5.8L5.88 4.67L3.67 6.88L4.8 8.7C4.48 9.22 4.23 9.79 4.07 10.39L2 10.88V13.12L4.07 13.61C4.23 14.21 4.48 14.78 4.8 15.3L3.67 17.12L5.88 19.33L7.7 18.2C8.22 18.52 8.79 18.77 9.39 18.93L9.88 21H12.12L12.61 18.93C13.21 18.77 13.78 18.52 14.3 18.2L16.12 19.33L18.33 17.12L17.2 15.3C17.52 14.78 17.77 14.21 17.93 13.61L20 13.12Z" fill="currentColor"/></svg>';

  const dropdown = document.createElement("div");
  dropdown.className = "house-row-dropdown hidden";
  dropdown.setAttribute("role", "menu");

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "house-row-dropdown-item";
  editButton.textContent = "Editar";
  editButton.setAttribute("role", "menuitem");
  editButton.addEventListener("click", () => {
    closeRowMenus();
    startHouseEdit(house.id);
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "house-row-dropdown-item danger";
  deleteButton.textContent = "Eliminar";
  deleteButton.setAttribute("role", "menuitem");
  deleteButton.addEventListener("click", () => {
    closeRowMenus();
    handleHouseDelete(house.id, house.name);
  });

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = !dropdown.classList.contains("hidden");
    closeRowMenus(wrapper);

    if (isOpen) {
      dropdown.classList.add("hidden");
      trigger.setAttribute("aria-expanded", "false");
      return;
    }

    dropdown.classList.remove("hidden");
    trigger.setAttribute("aria-expanded", "true");
  });

  dropdown.appendChild(editButton);
  dropdown.appendChild(deleteButton);
  wrapper.appendChild(trigger);
  wrapper.appendChild(dropdown);
  return wrapper;
}

function resetHouseFormState() {
  editingHouseId = null;
  if (!houseFormEl) return;

  houseFormEl.reset();
  const houseIdInput = houseFormEl.elements.houseId;
  if (houseIdInput) houseIdInput.value = "";

  if (houseFormEl.elements.depositDeadline) houseFormEl.elements.depositDeadline.value = "23:59";
  if (houseFormEl.elements.reminderEnabled) houseFormEl.elements.reminderEnabled.checked = true;
  if (houseFormEl.elements.isActive) houseFormEl.elements.isActive.checked = true;

  if (houseFormTitleEl) houseFormTitleEl.textContent = "Adicionar nova casa";
  if (saveHouseButtonEl) saveHouseButtonEl.textContent = "Guardar Casa";
  if (cancelHouseEditButtonEl) cancelHouseEditButtonEl.classList.add("hidden");
}

function startHouseEdit(houseId) {
  if (!houseFormEl) return;
  const house = housesCache.find((item) => item.id === houseId);
  if (!house) return;

  editingHouseId = house.id;

  if (houseFormEl.elements.houseId) houseFormEl.elements.houseId.value = house.id;
  if (houseFormEl.elements.name) houseFormEl.elements.name.value = house.name || "";
  if (houseFormEl.elements.ownerName) houseFormEl.elements.ownerName.value = house.owner_name || "goncalo";
  if (houseFormEl.elements.depositWeekday) {
    houseFormEl.elements.depositWeekday.value = String(house.deposit_weekday || 1);
  }
  if (houseFormEl.elements.depositDeadline) {
    houseFormEl.elements.depositDeadline.value = house.deposit_deadline || "23:59";
  }
  if (houseFormEl.elements.bonusWeekday) {
    houseFormEl.elements.bonusWeekday.value = String(house.bonus_weekday || 1);
  }
  if (houseFormEl.elements.bonusLabel) {
    houseFormEl.elements.bonusLabel.value = house.bonus_label || "";
  }
  if (houseFormEl.elements.notes) houseFormEl.elements.notes.value = house.notes || "";
  if (houseFormEl.elements.reminderEnabled) {
    houseFormEl.elements.reminderEnabled.checked = Boolean(house.reminder_enabled);
  }
  if (houseFormEl.elements.isActive) {
    houseFormEl.elements.isActive.checked = Boolean(house.is_active);
  }

  if (houseFormTitleEl) houseFormTitleEl.textContent = `Editar casa: ${house.name}`;
  if (saveHouseButtonEl) saveHouseButtonEl.textContent = "Atualizar Casa";
  if (cancelHouseEditButtonEl) cancelHouseEditButtonEl.classList.remove("hidden");
  setStatus(houseFormStatusEl, `Modo edicao ativo para ${house.name}.`, "warn");
  houseFormEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handleHouseDelete(houseId, houseName) {
  const confirmed = window.confirm(`Queres remover a casa "${houseName}"?`);
  if (!confirmed) return;

  setStatus(houseFormStatusEl, "A remover casa...", "warn");
  try {
    await removeHouse(houseId);
    if (editingHouseId === houseId) {
      resetHouseFormState();
    }
    setStatus(houseFormStatusEl, `Casa "${houseName}" removida com sucesso.`, "ok");
    await refreshData();
  } catch (error) {
    setStatus(houseFormStatusEl, error.message || "Falha ao remover casa.", "error");
  }
}

function renderHousesTable(houses) {
  if (!housesBodyEl) return;
  bindRowMenuOutsideClick();
  housesBodyEl.innerHTML = "";

  if (!houses.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.textContent = "Sem casas registadas.";
    tr.appendChild(td);
    housesBodyEl.appendChild(tr);
    setStatus(housesStatusEl, "Ainda nao tens casas registadas.", "warn");
    return;
  }

  houses.forEach((house) => {
    const tr = document.createElement("tr");
    tr.appendChild(createTd(house.name));
    tr.appendChild(createTd(house.owner_name));
    tr.appendChild(
      createTd(`${weekdayNames[house.deposit_weekday] || "-"}${house.deposit_deadline ? ` ate ${house.deposit_deadline}` : ""}`)
    );
    tr.appendChild(
      createTd(`${weekdayNames[house.bonus_weekday] || "-"}${house.bonus_label ? ` (${house.bonus_label})` : ""}`)
    );
    tr.appendChild(createTd(house.is_active ? "sim" : "nao"));

    const actionTd = document.createElement("td");
    actionTd.className = "table-actions";
    actionTd.appendChild(createHouseActionsMenu(house));
    tr.appendChild(actionTd);

    housesBodyEl.appendChild(tr);
  });

  setStatus(housesStatusEl, `${houses.length} casa(s) registada(s).`, "ok");
}

function renderTodayAlerts(todaysAlerts) {
  if (!todayAlertsEl) return;
  todayAlertsEl.innerHTML = "";

  if (!todaysAlerts.length) {
    const li = document.createElement("li");
    li.textContent = "Sem alertas para hoje.";
    todayAlertsEl.appendChild(li);
    setStatus(alertsStatusEl, "Sem tarefas para hoje.", "warn");
    return;
  }

  todaysAlerts.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item.text;
    todayAlertsEl.appendChild(li);
    notifyOncePerDay(item.id, item.notificationTitle, item.notificationBody);
  });

  setStatus(alertsStatusEl, `${todaysAlerts.length} aviso(s) ativo(s) hoje.`, "ok");
}

function renderUpcomingAlerts(upcomingRows) {
  if (!upcomingAlertsBodyEl) return;
  upcomingAlertsBodyEl.innerHTML = "";

  if (!upcomingRows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 3;
    td.textContent = "Sem casas com avisos ativos.";
    tr.appendChild(td);
    upcomingAlertsBodyEl.appendChild(tr);
    setStatus(upcomingStatusEl, "Sem dados de calendario.", "warn");
    return;
  }

  upcomingRows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.appendChild(createTd(row.houseName));
    tr.appendChild(createTd(formatDatePt(row.checkDate)));
    tr.appendChild(createTd(formatDatePt(row.bonusDate)));
    upcomingAlertsBodyEl.appendChild(tr);
  });

  setStatus(upcomingStatusEl, `${upcomingRows.length} casa(s) planeada(s).`, "ok");
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

async function updateHouse(houseId, payload) {
  const response = await fetch(`/api/houses?id=${encodeURIComponent(houseId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "Nao foi possivel atualizar casa.");
  }
  return body.house;
}

async function removeHouse(houseId) {
  const response = await fetch(`/api/houses?id=${encodeURIComponent(houseId)}`, {
    method: "DELETE",
    headers: { Accept: "application/json" }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "Nao foi possivel remover casa.");
  }
  return body;
}

async function changePassword(payload) {
  const response = await fetch("/api/change-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "Nao foi possivel atualizar senha.");
  }
  return body;
}

async function refreshData() {
  const houses = await fetchHouses();
  housesCache = houses;
  renderHousesTable(houses);

  const { todaysAlerts, upcomingRows } = buildAlertData(houses);
  renderTodayAlerts(todaysAlerts);
  renderUpcomingAlerts(upcomingRows);
}

function buildHousePayload(formData) {
  return {
    name: String(formData.get("name") || "").trim().toLowerCase(),
    ownerName: String(formData.get("ownerName") || "").trim().toLowerCase(),
    depositWeekday: Number(formData.get("depositWeekday")),
    depositDeadline: String(formData.get("depositDeadline") || "").trim(),
    bonusWeekday: Number(formData.get("bonusWeekday")),
    bonusLabel: String(formData.get("bonusLabel") || "").trim(),
    notes: String(formData.get("notes") || "").trim(),
    reminderEnabled: formData.get("reminderEnabled") === "on",
    isActive: formData.get("isActive") === "on"
  };
}

async function handleHouseSubmit(event) {
  event.preventDefault();
  if (!houseFormEl) return;

  const formData = new FormData(houseFormEl);
  const houseId = String(formData.get("houseId") || "").trim();
  const payload = buildHousePayload(formData);

  if (!payload.name) {
    setStatus(houseFormStatusEl, "Indica o nome da casa.", "error");
    return;
  }

  const isEdit = Boolean(houseId);
  setStatus(houseFormStatusEl, isEdit ? "A atualizar casa..." : "A guardar casa...", "warn");
  if (saveHouseButtonEl) saveHouseButtonEl.disabled = true;

  try {
    if (isEdit) {
      await updateHouse(houseId, payload);
      setStatus(houseFormStatusEl, "Casa atualizada com sucesso.", "ok");
    } else {
      await createHouse(payload);
      setStatus(houseFormStatusEl, "Casa adicionada com sucesso.", "ok");
    }

    resetHouseFormState();
    await refreshData();
  } catch (error) {
    setStatus(houseFormStatusEl, error.message || "Falha ao guardar casa.", "error");
  } finally {
    if (saveHouseButtonEl) saveHouseButtonEl.disabled = false;
  }
}

async function handlePasswordSubmit(event, user) {
  event.preventDefault();
  if (!passwordFormEl || !user || !user.username) return;

  const formData = new FormData(passwordFormEl);
  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    setStatus(passwordFormStatusEl, "Preenche todos os campos de senha.", "error");
    return;
  }

  if (newPassword.length < 8) {
    setStatus(passwordFormStatusEl, "A nova senha deve ter pelo menos 8 caracteres.", "error");
    return;
  }

  if (newPassword !== confirmPassword) {
    setStatus(passwordFormStatusEl, "A confirmacao nao coincide com a nova senha.", "error");
    return;
  }

  if (newPassword === currentPassword) {
    setStatus(passwordFormStatusEl, "A nova senha deve ser diferente da atual.", "error");
    return;
  }

  setStatus(passwordFormStatusEl, "A atualizar senha...", "warn");
  if (changePasswordButtonEl) changePasswordButtonEl.disabled = true;

  try {
    await changePassword({
      username: user.username,
      currentPassword,
      newPassword
    });
    passwordFormEl.reset();
    setStatus(passwordFormStatusEl, "Senha atualizada com sucesso.", "ok");
  } catch (error) {
    setStatus(passwordFormStatusEl, error.message || "Falha ao atualizar senha.", "error");
  } finally {
    if (changePasswordButtonEl) changePasswordButtonEl.disabled = false;
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
  const user = ensureAuthenticated();
  if (!user) return;

  userLabels.forEach((labelEl) => {
    labelEl.textContent = `Sessao ativa: ${user.username}`;
  });

  logoutButtons.forEach((button) => {
    button.addEventListener("click", goToLoginAndClear);
  });

  initConfigMenus();

  if (enableNotificationsBtnEl) {
    enableNotificationsBtnEl.addEventListener("click", enableBrowserNotifications);
  }

  if (houseFormEl) {
    resetHouseFormState();
    houseFormEl.addEventListener("submit", handleHouseSubmit);
  }

  if (cancelHouseEditButtonEl) {
    cancelHouseEditButtonEl.addEventListener("click", () => {
      resetHouseFormState();
      setStatus(houseFormStatusEl, "Edicao cancelada.", "warn");
    });
  }

  if (passwordFormEl) {
    passwordFormEl.addEventListener("submit", (event) => handlePasswordSubmit(event, user));
  }

  const needsHousesData =
    Boolean(housesBodyEl) ||
    Boolean(houseFormEl) ||
    Boolean(todayAlertsEl) ||
    Boolean(upcomingAlertsBodyEl);

  if (!needsHousesData) return;

  try {
    await refreshData();
  } catch (error) {
    const message = error.message || "Erro ao carregar dados.";
    setStatus(houseFormStatusEl, message, "error");
    setStatus(housesStatusEl, message, "error");
    setStatus(alertsStatusEl, message, "error");
    setStatus(upcomingStatusEl, message, "error");
  }
}

init();
