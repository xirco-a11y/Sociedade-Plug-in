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
const importantNotesFormEl = document.getElementById("important-notes-form");
const importantNotesStatusEl = document.getElementById("important-notes-status");
const saveImportantNotesButtonEl = document.getElementById("save-important-notes-button");

const todayAlertsEl = document.getElementById("today-alerts");
const alertsStatusEl = document.getElementById("alerts-status");
const upcomingAlertsBodyEl = document.getElementById("upcoming-alerts-body");
const upcomingStatusEl = document.getElementById("upcoming-status");
const enableNotificationsBtnEl = document.getElementById("enable-notifications");
const conditionsMenuEl = document.getElementById("condicoes-menu");
const conditionsPanelsEl = document.getElementById("condicoes-panels");
const conditionsStatusEl = document.getElementById("condicoes-status");

const configMenuButtons = document.querySelectorAll("[data-config-menu]");
const configPanels = document.querySelectorAll("[data-config-panel]");

const userLabels = document.querySelectorAll("[data-user-label]");
const logoutButtons = document.querySelectorAll(".js-logout");

let housesCache = [];
let importantNotesCache = [];
let editingHouseId = null;
let rowMenuListenerBound = false;
let currentUsername = null;

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

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function canUserSeeHouseAlerts(house, username) {
  const owner = normalizeUsername(house?.owner_name);
  const user = normalizeUsername(username);

  if (!owner || !user) return false;
  return owner === "ambos" || owner === user;
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

function toMoneyNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoneyPt(value) {
  return new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(toMoneyNumber(value));
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

function createTd(text) {
  const td = document.createElement("td");
  td.textContent = text ?? "";
  return td;
}

function createConditionCell(cell, isHeader = false) {
  const cellEl = document.createElement(isHeader ? "th" : "td");
  if (cell && typeof cell === "object" && !Array.isArray(cell)) {
    const value = cell.value ?? "";
    if (cell.className) {
      cellEl.className = String(cell.className);
    }

    if (cell.href) {
      const linkEl = document.createElement("a");
      linkEl.href = String(cell.href);
      linkEl.target = "_blank";
      linkEl.rel = "noopener noreferrer";
      linkEl.textContent = String(value || cell.href);

      if (cell.strong) {
        const strongEl = document.createElement("strong");
        strongEl.appendChild(linkEl);
        cellEl.appendChild(strongEl);
      } else {
        cellEl.appendChild(linkEl);
      }

      return cellEl;
    }

    if (cell.strong) {
      const strongEl = document.createElement("strong");
      strongEl.textContent = String(value);
      cellEl.appendChild(strongEl);
    } else {
      cellEl.textContent = String(value);
    }
    return cellEl;
  }

  cellEl.textContent = String(cell ?? "");
  return cellEl;
}

function buildHouseScheduleRows(houses) {
  return houses
    .filter((house) => Boolean(house) && house.is_active !== false)
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt"))
    .map((house) => {
      const depositText = `${weekdayNames[house.deposit_weekday] || "-"}${house.deposit_deadline ? ` ate ${house.deposit_deadline}` : ""}`;
      const bonusText = `${weekdayNames[house.bonus_weekday] || "-"}${house.bonus_label ? ` (${house.bonus_label})` : ""}`;
      return [house.name || "-", depositText, bonusText];
    });
}

function buildHouseBonusLinkRows(houses) {
  return houses
    .filter((house) => Boolean(house) && house.is_active !== false)
    .map((house) => ({
      name: house.name || "-",
      bonusLink: String(house.bonus_link || "").trim()
    }))
    .filter((house) => Boolean(house.bonusLink))
    .sort((a, b) => a.name.localeCompare(b.name, "pt"))
    .map((house) => [
      house.name,
      {
        value: house.bonusLink,
        href: house.bonusLink
      }
    ]);
}

function getHouseObservation(house) {
  if (house?.notes) return String(house.notes);
  if (house?.owner_name === "ambos") return "cada um";
  return String(house?.owner_name || "");
}

function buildHouseValueRows(houses, source) {
  const activeHouses = houses
    .filter((house) => Boolean(house) && house.is_active !== false)
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt"));

  if (!activeHouses.length) return [];

  let totalValue = 0;
  let totalHalf = 0;

  const rows = activeHouses.map((house) => {
    const depositAmount = toMoneyNumber(house.deposit_amount);
    const withdrawalAmount = toMoneyNumber(house.withdrawal_amount);
    const value =
      source === "houses_values_withdrawal"
        ? withdrawalAmount
        : source === "houses_values_profit"
          ? withdrawalAmount - depositAmount
          : depositAmount;
    const halfValue = value / 2;
    const valueCell =
      source === "houses_values_profit"
        ? {
            value: formatMoneyPt(value),
            className: value < 0 ? "money-neg" : value > 0 ? "money-pos" : ""
          }
        : formatMoneyPt(value);
    const halfCell =
      source === "houses_values_profit"
        ? {
            value: formatMoneyPt(halfValue),
            className: halfValue < 0 ? "money-neg" : halfValue > 0 ? "money-pos" : ""
          }
        : formatMoneyPt(halfValue);

    totalValue += value;
    totalHalf += halfValue;

    return [
      house.name || "-",
      valueCell,
      halfCell,
      getHouseObservation(house)
    ];
  });

  const totalValueCell =
    source === "houses_values_profit"
      ? {
          value: formatMoneyPt(totalValue),
          className: totalValue < 0 ? "money-neg" : totalValue > 0 ? "money-pos" : "",
          strong: true
        }
      : {
          value: formatMoneyPt(totalValue),
          strong: true
        };
  const totalHalfCell =
    source === "houses_values_profit"
      ? {
          value: formatMoneyPt(totalHalf),
          className: totalHalf < 0 ? "money-neg" : totalHalf > 0 ? "money-pos" : "",
          strong: true
        }
      : {
          value: formatMoneyPt(totalHalf),
          strong: true
        };

  rows.push([
    { value: "Total", strong: true },
    totalValueCell,
    totalHalfCell,
    { value: "individual", strong: true }
  ]);

  return rows;
}

function buildConditionRows(block, houses) {
  if (block?.source === "houses_schedule") {
    const dynamicRows = buildHouseScheduleRows(houses);
    if (dynamicRows.length) return dynamicRows;
  }
  if (block?.source === "houses_bonus_links") {
    return buildHouseBonusLinkRows(houses);
  }
  if (
    block?.source === "houses_values_deposit" ||
    block?.source === "houses_values_withdrawal" ||
    block?.source === "houses_values_profit"
  ) {
    return buildHouseValueRows(houses, block.source);
  }

  if (Array.isArray(block?.rows)) return block.rows;
  if (Array.isArray(block?.fallbackRows)) return block.fallbackRows;
  return [];
}

function renderConditionTable(block, houses) {
  const container = document.createElement("div");
  if (block?.title) {
    const title = document.createElement("p");
    title.className = "condicoes-block-title";
    const strongEl = document.createElement("strong");
    strongEl.textContent = block.title;
    title.appendChild(strongEl);
    container.appendChild(title);
  }

  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  const table = document.createElement("table");
  const columns = Array.isArray(block?.columns) ? block.columns : [];
  const rows = buildConditionRows(block, houses);
  const columnCount = columns.length || (Array.isArray(rows[0]) ? rows[0].length : 1);

  if (columns.length) {
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    columns.forEach((column) => {
      tr.appendChild(createConditionCell(column, true));
    });
    thead.appendChild(tr);
    table.appendChild(thead);
  }

  const tbody = document.createElement("tbody");
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = columnCount;
    td.textContent = block?.emptyMessage || "Sem dados para mostrar.";
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      const cells = Array.isArray(row) ? row : [row];

      cells.forEach((cell) => {
        tr.appendChild(createConditionCell(cell));
      });

      for (let index = cells.length; index < columnCount; index += 1) {
        tr.appendChild(createConditionCell(""));
      }

      tbody.appendChild(tr);
    });
  }

  table.appendChild(tbody);
  wrap.appendChild(table);
  container.appendChild(wrap);
  return container;
}

function renderConditionBlock(block, houses, importantNotes) {
  if (!block || typeof block !== "object") return null;

  if (block.type === "heading") {
    const heading = document.createElement("h3");
    heading.textContent = block.text || "";
    return heading;
  }

  if (block.type === "paragraph") {
    const paragraph = document.createElement("p");
    paragraph.textContent = block.text || "";
    return paragraph;
  }

  if (block.type === "note") {
    const paragraph = document.createElement("p");
    const strongEl = document.createElement("strong");
    strongEl.textContent = block.text || "";
    paragraph.appendChild(strongEl);
    return paragraph;
  }

  if (block.type === "list") {
    const items =
      block.source === "important_notes"
        ? normalizeImportantNotes(importantNotes)
        : Array.isArray(block.items)
          ? block.items
          : [];
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = block.emptyMessage || "Sem dados para mostrar.";
      return empty;
    }

    const list = document.createElement("ul");
    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = String(item || "");
      list.appendChild(li);
    });
    return list;
  }

  if (block.type === "table") {
    return renderConditionTable(block, houses);
  }

  return null;
}

function setConditionsPanel(panelName) {
  if (!conditionsMenuEl || !conditionsPanelsEl) return;
  const menuButtons = conditionsMenuEl.querySelectorAll("[data-condicoes-menu]");
  const panels = conditionsPanelsEl.querySelectorAll("[data-condicoes-panel]");

  menuButtons.forEach((button) => {
    const active = button.dataset.condicoesMenu === panelName;
    button.classList.toggle("active", active);
  });

  panels.forEach((panel) => {
    const active = panel.dataset.condicoesPanel === panelName;
    panel.classList.toggle("active", active);
  });
}

function renderConditionsPage(config, houses, importantNotes) {
  if (!conditionsMenuEl || !conditionsPanelsEl) return 0;

  const sections = Array.isArray(config?.sections) ? config.sections : [];
  conditionsMenuEl.innerHTML = "";
  conditionsPanelsEl.innerHTML = "";

  if (!sections.length) return 0;

  sections.forEach((section, index) => {
    const sectionId = String(section?.id || `menu-${index + 1}`);
    const menuLabel = section?.label || section?.title || sectionId;

    const menuButton = document.createElement("button");
    menuButton.type = "button";
    menuButton.className = "config-menu-button";
    menuButton.dataset.condicoesMenu = sectionId;
    menuButton.textContent = menuLabel;
    menuButton.addEventListener("click", () => {
      setConditionsPanel(sectionId);
      if (window.history.replaceState) {
        window.history.replaceState(null, "", `#${sectionId}`);
      } else {
        window.location.hash = sectionId;
      }
    });
    conditionsMenuEl.appendChild(menuButton);

    const panel = document.createElement("section");
    panel.className = "config-panel condicoes-panel";
    panel.dataset.condicoesPanel = sectionId;

    if (section?.title) {
      const title = document.createElement("h2");
      title.textContent = section.title;
      panel.appendChild(title);
    }

    if (section?.description) {
      const description = document.createElement("p");
      description.className = "muted";
      description.textContent = section.description;
      panel.appendChild(description);
    }

    const blocks = Array.isArray(section?.blocks) ? section.blocks : [];
    blocks.forEach((block) => {
      const blockEl = renderConditionBlock(block, houses, importantNotes);
      if (blockEl) panel.appendChild(blockEl);
    });

    conditionsPanelsEl.appendChild(panel);
  });

  const hashPanel = String(window.location.hash || "").replace("#", "");
  const initialPanel = sections.some((section) => String(section?.id) === hashPanel)
    ? hashPanel
    : String(sections[0].id || "");

  if (initialPanel) {
    setConditionsPanel(initialPanel);
  }

  return sections.length;
}

async function fetchConditionsConfig() {
  const response = await fetch("/assets/data/condicoes.json", {
    headers: { Accept: "application/json" }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Nao foi possivel carregar o menu de condicoes.");
  }

  return payload;
}

async function fetchImportantNotes() {
  const response = await fetch("/api/settings?key=important_notes", {
    headers: { Accept: "application/json" }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Nao foi possivel carregar observacoes importantes.");
  }
  return normalizeImportantNotes(payload.importantNotes);
}

async function saveImportantNotes(notes) {
  const response = await fetch("/api/settings", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      key: "important_notes",
      importantNotes: normalizeImportantNotes(notes)
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Nao foi possivel guardar observacoes importantes.");
  }
  return normalizeImportantNotes(payload.importantNotes);
}

async function initConditionsPage() {
  if (!conditionsMenuEl || !conditionsPanelsEl) return;

  setStatus(conditionsStatusEl, "A carregar menus de condicoes...", "warn");

  let config;
  try {
    config = await fetchConditionsConfig();
  } catch (error) {
    setStatus(conditionsStatusEl, error.message || "Falha ao carregar condicoes.", "error");
    return;
  }

  let houses = [];
  let importantNotes = [];
  const warnings = [];
  try {
    houses = await fetchHouses();
  } catch {
    warnings.push("Menus carregados, mas sem atualizar Datas, Links Bonus e Valores pelas casas configuradas.");
  }
  try {
    importantNotes = await fetchImportantNotes();
  } catch {
    warnings.push("Observacoes importantes indisponiveis na base de dados.");
  }

  const sectionsCount = renderConditionsPage(config, houses, importantNotes);
  if (!sectionsCount) {
    setStatus(conditionsStatusEl, "Nenhum menu de condicoes foi encontrado.", "error");
    return;
  }

  if (warnings.length) {
    setStatus(conditionsStatusEl, warnings.join(" "), "warn");
    return;
  }

  importantNotesCache = importantNotes;
  setStatus(conditionsStatusEl, `${sectionsCount} menu(s) de condicoes carregado(s).`, "ok");
}

function notifyOncePerDay(key, title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const dayKey = new Date().toISOString().slice(0, 10);
  const storageKey = `sociedade_notification_${key}_${dayKey}`;
  if (localStorage.getItem(storageKey)) return;

  new Notification(title, { body });
  localStorage.setItem(storageKey, "1");
}

function buildAlertData(houses, username) {
  const today = new Date();
  const todayIso = isoWeekday(today);
  const todaysAlerts = [];
  const upcomingRows = [];

  houses.forEach((house) => {
    if (!house.is_active || !house.reminder_enabled) return;
    if (!canUserSeeHouseAlerts(house, username)) return;

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
  const availablePanels = new Set(["houses", "important-notes", "password"]);
  const initialPanel = availablePanels.has(hashPanel) ? hashPanel : "houses";
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
  if (houseFormEl.elements.depositAmount) houseFormEl.elements.depositAmount.value = "0";
  if (houseFormEl.elements.withdrawalAmount) houseFormEl.elements.withdrawalAmount.value = "0";
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
  if (houseFormEl.elements.bonusLink) {
    houseFormEl.elements.bonusLink.value = house.bonus_link || "";
  }
  if (houseFormEl.elements.depositAmount) {
    houseFormEl.elements.depositAmount.value = toMoneyNumber(house.deposit_amount).toFixed(2);
  }
  if (houseFormEl.elements.withdrawalAmount) {
    houseFormEl.elements.withdrawalAmount.value = toMoneyNumber(house.withdrawal_amount).toFixed(2);
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
    td.colSpan = 8;
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
    tr.appendChild(createTd(formatMoneyPt(house.deposit_amount)));
    tr.appendChild(createTd(formatMoneyPt(house.withdrawal_amount)));
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

  const { todaysAlerts, upcomingRows } = buildAlertData(houses, currentUsername);
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
    bonusLink: String(formData.get("bonusLink") || "").trim(),
    depositAmount: String(formData.get("depositAmount") || "").trim(),
    withdrawalAmount: String(formData.get("withdrawalAmount") || "").trim(),
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

  if (toMoneyNumber(payload.depositAmount) < 0 || toMoneyNumber(payload.withdrawalAmount) < 0) {
    setStatus(houseFormStatusEl, "Valores de deposito/levantamento devem ser iguais ou superiores a 0.", "error");
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

async function loadImportantNotesForm() {
  if (!importantNotesFormEl) return;
  setStatus(importantNotesStatusEl, "A carregar observacoes importantes...", "warn");

  try {
    const notes = await fetchImportantNotes();
    importantNotesCache = notes;
    if (importantNotesFormEl.elements.importantNotes) {
      importantNotesFormEl.elements.importantNotes.value = notes.join("\n");
    }
    setStatus(importantNotesStatusEl, "Observacoes carregadas.", "ok");
  } catch (error) {
    setStatus(importantNotesStatusEl, error.message || "Falha ao carregar observacoes importantes.", "error");
  }
}

async function handleImportantNotesSubmit(event) {
  event.preventDefault();
  if (!importantNotesFormEl) return;

  const rawText = String(importantNotesFormEl.elements.importantNotes?.value || "");
  const notes = normalizeImportantNotes(rawText);

  setStatus(importantNotesStatusEl, "A guardar observacoes importantes...", "warn");
  if (saveImportantNotesButtonEl) saveImportantNotesButtonEl.disabled = true;

  try {
    const savedNotes = await saveImportantNotes(notes);
    importantNotesCache = savedNotes;
    if (importantNotesFormEl.elements.importantNotes) {
      importantNotesFormEl.elements.importantNotes.value = savedNotes.join("\n");
    }
    setStatus(importantNotesStatusEl, "Observacoes guardadas com sucesso.", "ok");
  } catch (error) {
    setStatus(importantNotesStatusEl, error.message || "Falha ao guardar observacoes importantes.", "error");
  } finally {
    if (saveImportantNotesButtonEl) saveImportantNotesButtonEl.disabled = false;
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
  currentUsername = normalizeUsername(user.username);

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

  if (importantNotesFormEl) {
    importantNotesFormEl.addEventListener("submit", handleImportantNotesSubmit);
    await loadImportantNotesForm();
  }

  if (passwordFormEl) {
    passwordFormEl.addEventListener("submit", (event) => handlePasswordSubmit(event, user));
  }

  if (conditionsMenuEl && conditionsPanelsEl) {
    await initConditionsPage();
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
