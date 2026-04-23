(() => {
  const rotationGridHeadEl = document.getElementById("rotation-grid-head");
  const rotationGridBodyEl = document.getElementById("rotation-grid-body");
  const rotationGridStatusEl = document.getElementById("rotation-grid-status");

  const rotationToggleFormButtonEl = document.getElementById("rotation-toggle-form");
  const bonusToggleFormButtonEl = document.getElementById("bonus-toggle-form");
  const rotationManageToggleButtonEl = document.getElementById("rotation-manage-toggle");

  const rotationFormSectionEl = document.getElementById("rotation-form-section");
  const bonusFormSectionEl = document.getElementById("bonus-form-section");
  const rotationManageSectionEl = document.getElementById("rotation-manage-section");

  const rotationFormEl = document.getElementById("rotation-form");
  const bonusFormEl = document.getElementById("bonus-form");

  const rotationDateEl = document.getElementById("rotation-date");
  const rotationHouseAEl = document.getElementById("rotation-house-a");
  const rotationHouseBEl = document.getElementById("rotation-house-b");

  const bonusDateEl = document.getElementById("bonus-date");
  const bonusHouseEl = document.getElementById("bonus-house");
  const bonusSaveButtonEl = document.getElementById("bonus-save-button");
  const bonusCancelButtonEl = document.getElementById("bonus-cancel-button");
  const bonusFormStatusEl = document.getElementById("bonus-form-status");

  const rotationManageFormEl = document.getElementById("rotation-manage-form");
  const rotationManageDateEl = document.getElementById("rotation-manage-date");
  const rotationManageHouseEl = document.getElementById("rotation-manage-house");
  const rotationManageListEl = document.getElementById("rotation-manage-list");
  const rotationManageStatusEl = document.getElementById("rotation-manage-status");

  const rotationSaveButtonEl = document.getElementById("rotation-save-button");
  const rotationCancelButtonEl = document.getElementById("rotation-cancel-button");
  const rotationFormStatusEl = document.getElementById("rotation-form-status");

  const statsGlobalProfitEl = document.getElementById("stats-global-profit");
  const statsGlobalLossEl = document.getElementById("stats-global-loss");
  const statsGlobalNetEl = document.getElementById("stats-global-net");
  const statsWeekProfitEl = document.getElementById("stats-week-profit");
  const statsWeekLossEl = document.getElementById("stats-week-loss");
  const statsWeekNetEl = document.getElementById("stats-week-net");

  if (!rotationGridHeadEl || !rotationGridBodyEl || !rotationFormEl) return;

  let currentUsername = "";
  let userHouses = [];
  let weekDays = [];
  let weekRange = null;
  let societyEntriesAllTime = [];
  let societyEntriesCurrentWeek = [];
  let weekEntries = [];

  const moneyFormatter = new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const oddFormatter = new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  function setStatus(element, message, tone = "muted") {
    if (!element) return;
    element.textContent = message || "";
    element.className = `status ${tone}`;
  }

  function normalizeUsername(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getSessionUser() {
    try {
      const raw = localStorage.getItem("sociedade_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function toIsoDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseIsoDate(value) {
    const raw = String(value || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const date = new Date(`${raw}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function isoWeekday(date) {
    const day = date.getDay();
    return day === 0 ? 7 : day;
  }

  function getCurrentWeekDays() {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (isoWeekday(today) - 1));

    const days = [];
    for (let index = 0; index < 7; index += 1) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + index);
      days.push({
        iso: toIsoDate(day),
        date: day
      });
    }
    return days;
  }

  function formatDayLabel(date) {
    const weekday = new Intl.DateTimeFormat("pt-PT", { weekday: "long" }).format(date);
    const dayMonthYear = new Intl.DateTimeFormat("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(date);
    return `${weekday} ${dayMonthYear}`;
  }

  function formatMoney(value) {
    const parsed = Number(value);
    return moneyFormatter.format(Number.isFinite(parsed) ? parsed : 0);
  }

  function formatOdd(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return "-";
    return oddFormatter.format(parsed);
  }

  function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function getEntryType(entry) {
    const explicitType = String(entry?.entry_type || "").trim().toLowerCase();
    if (explicitType === "bonus_payout" || explicitType === "rotation") {
      return explicitType;
    }

    // Fallback para registos antigos sem entry_type.
    if (!entry?.house_b_id) return "bonus_payout";
    return "rotation";
  }

  function setToneClass(element, value) {
    if (!element) return;
    element.classList.remove("money-pos", "money-neg");
    if (value > 0) element.classList.add("money-pos");
    if (value < 0) element.classList.add("money-neg");
  }

  function parseMoneyInput(value, options = {}) {
    const allowNegative = Boolean(options.allowNegative);
    const allowZero = Boolean(options.allowZero);
    const emptyAsDefault = options.emptyAsDefault !== false;
    const defaultValue = Number.isFinite(options.defaultValue) ? options.defaultValue : 0;

    if (typeof value === "number" && Number.isFinite(value)) {
      if (!allowNegative && value < 0) return NaN;
      if (!allowNegative && !allowZero && value === 0) return NaN;
      return Number(value.toFixed(2));
    }

    const raw = String(value ?? "").trim();
    if (!raw) return emptyAsDefault ? defaultValue : NaN;

    const normalized = raw.replace(",", ".");
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return NaN;
    if (!allowNegative && parsed < 0) return NaN;
    if (!allowNegative && !allowZero && parsed === 0) return NaN;
    return Number(parsed.toFixed(2));
  }

  function parseOddInput(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return NaN;
    const normalized = raw.replace(",", ".");
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 1) return NaN;
    return Number(parsed.toFixed(2));
  }

  function canUserUseHouse(house, username) {
    if (!house || house.is_active === false) return false;
    const owner = normalizeUsername(house.owner_name);
    return owner === "ambos" || owner === username;
  }

  async function fetchHouses() {
    const response = await fetch("/api/houses", {
      headers: { Accept: "application/json" }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Nao foi possivel carregar casas.");
    }
    return Array.isArray(payload.houses) ? payload.houses : [];
  }

  async function fetchEntries(username, range = null) {
    const params = new URLSearchParams({ username });
    if (range?.start) params.set("dateFrom", range.start);
    if (range?.end) params.set("dateTo", range.end);

    const response = await fetch(`/api/rotations?${params.toString()}`, {
      headers: { Accept: "application/json" }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Nao foi possivel carregar rotacoes desta semana.");
    }
    return Array.isArray(payload.rotations) ? payload.rotations : [];
  }

  async function createEntry(payload) {
    const response = await fetch("/api/rotations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || "Nao foi possivel guardar registo.");
    }
    return body.rotation;
  }

  async function deleteEntry(rotationId) {
    const params = new URLSearchParams({
      id: rotationId,
      username: currentUsername
    });

    const response = await fetch(`/api/rotations?${params.toString()}`, {
      method: "DELETE",
      headers: { Accept: "application/json" }
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || "Nao foi possivel apagar protecao.");
    }
    return body;
  }

  function fillHouseSelects() {
    if (rotationHouseAEl) {
      rotationHouseAEl.innerHTML = "";
      const emptyA = document.createElement("option");
      emptyA.value = "";
      emptyA.textContent = "Seleciona casa 1";
      rotationHouseAEl.appendChild(emptyA);
    }

    if (rotationHouseBEl) {
      rotationHouseBEl.innerHTML = "";
      const emptyB = document.createElement("option");
      emptyB.value = "";
      emptyB.textContent = "Seleciona casa 2";
      rotationHouseBEl.appendChild(emptyB);
    }

    if (bonusHouseEl) {
      bonusHouseEl.innerHTML = "";
      const emptyBonus = document.createElement("option");
      emptyBonus.value = "";
      emptyBonus.textContent = "Seleciona casa";
      bonusHouseEl.appendChild(emptyBonus);
    }

    if (rotationManageHouseEl) {
      rotationManageHouseEl.innerHTML = "";
      const emptyManage = document.createElement("option");
      emptyManage.value = "";
      emptyManage.textContent = "Todas as casas";
      rotationManageHouseEl.appendChild(emptyManage);
    }

    userHouses.forEach((house) => {
      if (rotationHouseAEl) {
        const optionA = document.createElement("option");
        optionA.value = house.id;
        optionA.textContent = house.name;
        rotationHouseAEl.appendChild(optionA);
      }

      if (rotationHouseBEl) {
        const optionB = document.createElement("option");
        optionB.value = house.id;
        optionB.textContent = house.name;
        rotationHouseBEl.appendChild(optionB);
      }

      if (bonusHouseEl) {
        const optionBonus = document.createElement("option");
        optionBonus.value = house.id;
        optionBonus.textContent = house.name;
        bonusHouseEl.appendChild(optionBonus);
      }

      if (rotationManageHouseEl) {
        const optionManage = document.createElement("option");
        optionManage.value = house.id;
        optionManage.textContent = house.name;
        rotationManageHouseEl.appendChild(optionManage);
      }
    });

    if (rotationHouseAEl && userHouses.length >= 1) {
      rotationHouseAEl.value = userHouses[0].id;
    }
    if (rotationHouseBEl) {
      rotationHouseBEl.value = userHouses.length >= 2 ? userHouses[1].id : "";
    }
    if (bonusHouseEl && userHouses.length >= 1) {
      bonusHouseEl.value = userHouses[0].id;
    }
    if (rotationManageHouseEl) {
      rotationManageHouseEl.value = "";
    }
  }

  function getHouseNameById(houseId) {
    const house = userHouses.find((item) => item.id === houseId);
    return house?.name || houseId || "-";
  }

  function getEntriesForHouseOnDay(houseId, dayIso) {
    return weekEntries.filter(
      (entry) =>
        String(entry.rotation_date || "") === dayIso &&
        (entry.house_a_id === houseId || entry.house_b_id === houseId)
    );
  }

  function buildDetailsTooltip(house, day, entries) {
    if (!entries.length) return "";

    const lines = [];
    lines.push(`${formatDayLabel(day.date)} - ${house.name}`);
    lines.push("");

    entries.forEach((entry, index) => {
      if (entry.entry_type === "bonus_payout") {
        lines.push(`${index + 1}) Bonus Pagou`);
        lines.push(`   Lucro individual: ${formatMoney(entry.profit_loss)}`);
        if (entry.notes) {
          lines.push(`   Nota: ${entry.notes}`);
        }
        if (index < entries.length - 1) {
          lines.push("");
        }
        return;
      }

      const isHouseA = entry.house_a_id === house.id;
      const ownBet = isHouseA ? entry.house_a_bet : entry.house_b_bet;
      const ownOdd = isHouseA ? entry.house_a_odd : entry.house_b_odd;
      const ownAmount = isHouseA ? entry.amount_house_a : entry.amount_house_b;
      const otherHouseId = isHouseA ? entry.house_b_id : entry.house_a_id;
      const otherBet = isHouseA ? entry.house_b_bet : entry.house_a_bet;
      const otherOdd = isHouseA ? entry.house_b_odd : entry.house_a_odd;
      const otherAmount = isHouseA ? entry.amount_house_b : entry.amount_house_a;
      const otherHouseName = getHouseNameById(otherHouseId);

      lines.push(`${index + 1}) Esta casa: ${ownBet || "-"} | odd ${formatOdd(ownOdd)} | ${formatMoney(ownAmount)}`);
      lines.push(
        `   Outra casa (${otherHouseName}): ${otherBet || "-"} | odd ${formatOdd(otherOdd)} | ${formatMoney(otherAmount)}`
      );
      lines.push(`   Lucro/Prejuizo: ${formatMoney(entry.profit_loss)}`);

      if (entry.notes) {
        lines.push(`   Nota: ${entry.notes}`);
      }

      if (index < entries.length - 1) {
        lines.push("");
      }
    });

    return lines.join("\n");
  }

  function calculateStats(entries) {
    let lucroSociedade = 0;
    let saldoProtecoes = 0;

    entries.forEach((entry) => {
      const value = toNumber(entry.profit_loss);
      const entryType = getEntryType(entry);

      if (entryType === "bonus_payout") {
        if (value > 0) lucroSociedade += value;
        return;
      }

      // Rotacoes/protecoes entram apenas aqui, seja lucro ou prejuizo.
      saldoProtecoes += value;
    });

    const prejuizoProtecoes = Math.max(0, -saldoProtecoes);

    return {
      lucroSociedade,
      prejuizoProtecoes,
      resultadoFinal: lucroSociedade - prejuizoProtecoes
    };
  }

  function renderStats() {
    const globalStats = calculateStats(societyEntriesAllTime);
    const weekStats = calculateStats(societyEntriesCurrentWeek);

    if (statsGlobalProfitEl) statsGlobalProfitEl.textContent = formatMoney(globalStats.lucroSociedade);
    if (statsGlobalLossEl) statsGlobalLossEl.textContent = formatMoney(globalStats.prejuizoProtecoes);
    if (statsGlobalNetEl) statsGlobalNetEl.textContent = formatMoney(globalStats.resultadoFinal);

    if (statsWeekProfitEl) statsWeekProfitEl.textContent = formatMoney(weekStats.lucroSociedade);
    if (statsWeekLossEl) statsWeekLossEl.textContent = formatMoney(weekStats.prejuizoProtecoes);
    if (statsWeekNetEl) statsWeekNetEl.textContent = formatMoney(weekStats.resultadoFinal);

    setToneClass(statsGlobalProfitEl, globalStats.lucroSociedade);
    setToneClass(statsGlobalLossEl, -globalStats.prejuizoProtecoes);
    setToneClass(statsGlobalNetEl, globalStats.resultadoFinal);
    setToneClass(statsWeekProfitEl, weekStats.lucroSociedade);
    setToneClass(statsWeekLossEl, -weekStats.prejuizoProtecoes);
    setToneClass(statsWeekNetEl, weekStats.resultadoFinal);
  }

  function renderWeekGrid() {
    rotationGridHeadEl.innerHTML = "";
    rotationGridBodyEl.innerHTML = "";

    const headerRow = document.createElement("tr");
    const dayHeader = document.createElement("th");
    dayHeader.textContent = "Dia";
    headerRow.appendChild(dayHeader);

    userHouses.forEach((house) => {
      const th = document.createElement("th");
      th.textContent = house.name;
      headerRow.appendChild(th);
    });
    rotationGridHeadEl.appendChild(headerRow);

    weekDays.forEach((day) => {
      const tr = document.createElement("tr");

      const dayTd = document.createElement("td");
      dayTd.textContent = formatDayLabel(day.date);
      dayTd.className = "rotation-day-cell";
      tr.appendChild(dayTd);

      userHouses.forEach((house) => {
        const isBonusDay = Number(house.bonus_weekday) === isoWeekday(day.date);
        const entriesForCell = getEntriesForHouseOnDay(house.id, day.iso);
        const done = entriesForCell.length > 0;
        const td = document.createElement("td");
        if (isBonusDay) {
          td.className = "rotation-mark-cell bonus";
          td.textContent = "bonus";
        } else {
          td.className = `rotation-mark-cell ${done ? "done" : "miss"}`;
          td.textContent = done ? "\u2713" : "X";
          if (done) {
            const tooltipText = buildDetailsTooltip(house, day, entriesForCell);
            td.title = tooltipText;
            td.setAttribute("aria-label", tooltipText);
            td.classList.add("has-details");
          }
        }
        tr.appendChild(td);
      });

      rotationGridBodyEl.appendChild(tr);
    });
  }

  function closeInputForms() {
    if (rotationFormSectionEl) rotationFormSectionEl.classList.add("hidden");
    if (bonusFormSectionEl) bonusFormSectionEl.classList.add("hidden");
    if (rotationToggleFormButtonEl) rotationToggleFormButtonEl.classList.remove("hidden");
    if (bonusToggleFormButtonEl) bonusToggleFormButtonEl.classList.remove("hidden");
  }

  function openRotationForm() {
    if (!rotationFormSectionEl || !rotationToggleFormButtonEl) return;
    closeInputForms();
    rotationFormSectionEl.classList.remove("hidden");
    rotationToggleFormButtonEl.classList.add("hidden");
    rotationFormSectionEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openBonusForm() {
    if (!bonusFormSectionEl || !bonusToggleFormButtonEl) return;
    closeInputForms();
    bonusFormSectionEl.classList.remove("hidden");
    bonusToggleFormButtonEl.classList.add("hidden");
    bonusFormSectionEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleManagePanel() {
    if (!rotationManageSectionEl) return;
    rotationManageSectionEl.classList.toggle("hidden");
    if (!rotationManageSectionEl.classList.contains("hidden")) {
      rotationManageSectionEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      renderManageList();
    }
  }

  function isDateInsideCurrentWeek(dateIso) {
    if (!weekRange) return false;
    return dateIso >= weekRange.start && dateIso <= weekRange.end;
  }

  function readPayloadFromForm() {
    const formData = new FormData(rotationFormEl);

    const rotationDate = String(formData.get("rotationDate") || "").trim();
    if (!parseIsoDate(rotationDate)) {
      throw new Error("Indica um dia valido.");
    }
    if (!isDateInsideCurrentWeek(rotationDate)) {
      throw new Error("O dia tem de ser entre segunda e domingo da semana atual.");
    }

    const houseAId = String(formData.get("houseAId") || "").trim();
    const houseBId = String(formData.get("houseBId") || "").trim();
    if (!houseAId || !houseBId) {
      throw new Error("Seleciona as duas casas.");
    }
    if (houseAId === houseBId) {
      throw new Error("Casa 1 e Casa 2 nao podem ser iguais.");
    }

    const amountHouseA = parseMoneyInput(formData.get("amountHouseA"), {
      allowNegative: false,
      emptyAsDefault: false
    });
    const amountHouseB = parseMoneyInput(formData.get("amountHouseB"), {
      allowNegative: false,
      emptyAsDefault: false
    });
    if (Number.isNaN(amountHouseA) || Number.isNaN(amountHouseB)) {
      throw new Error("Valor apostado invalido (usa valor acima de 0).");
    }

    const houseAOdd = parseOddInput(formData.get("houseAOdd"));
    const houseBOdd = parseOddInput(formData.get("houseBOdd"));
    if (Number.isNaN(houseAOdd) || Number.isNaN(houseBOdd)) {
      throw new Error("Odd invalida (usa valor >= 1.00).");
    }

    const houseABet = String(formData.get("houseABet") || "").trim();
    const houseBBet = String(formData.get("houseBBet") || "").trim();
    if (!houseABet || !houseBBet) {
      throw new Error("Indica o que apostaste nas duas casas.");
    }

    const profitLoss = parseMoneyInput(formData.get("profitLoss"), {
      allowNegative: true,
      emptyAsDefault: false
    });
    if (Number.isNaN(profitLoss)) {
      throw new Error("Lucro/Prejuizo invalido.");
    }

    return {
      username: currentUsername,
      entryType: "rotation",
      rotationDate,
      houseAId,
      amountHouseA,
      houseAOdd,
      houseABet,
      houseBId,
      amountHouseB,
      houseBOdd,
      houseBBet,
      profitLoss
    };
  }

  function readBonusPayloadFromForm() {
    if (!bonusFormEl) {
      throw new Error("Formulario de bonus indisponivel.");
    }

    const formData = new FormData(bonusFormEl);
    const bonusDate = String(formData.get("bonusDate") || "").trim();
    const bonusHouseId = String(formData.get("bonusHouseId") || "").trim();
    const bonusProfit = parseMoneyInput(formData.get("bonusProfit"), {
      allowNegative: false,
      allowZero: true,
      emptyAsDefault: false
    });
    const bonusNotes = String(formData.get("bonusNotes") || "").trim();

    if (!parseIsoDate(bonusDate)) {
      throw new Error("Indica um dia valido para o bonus.");
    }
    if (!isDateInsideCurrentWeek(bonusDate)) {
      throw new Error("O bonus tem de ser registado na semana atual.");
    }
    if (!bonusHouseId) {
      throw new Error("Seleciona a casa do bonus.");
    }
    if (Number.isNaN(bonusProfit) || bonusProfit < 0) {
      throw new Error("Lucro individual do bonus invalido.");
    }

    return {
      username: currentUsername,
      entryType: "bonus_payout",
      rotationDate: bonusDate,
      houseAId: bonusHouseId,
      profitLoss: bonusProfit,
      notes: bonusNotes || null
    };
  }

  function getManageFilterDate() {
    if (!rotationManageDateEl) return toIsoDate(new Date());
    const selected = String(rotationManageDateEl.value || "").trim();
    if (parseIsoDate(selected)) return selected;
    const fallback = toIsoDate(new Date());
    rotationManageDateEl.value = fallback;
    return fallback;
  }

  function getManageFilterHouseId() {
    if (!rotationManageHouseEl) return "";
    return String(rotationManageHouseEl.value || "").trim();
  }

  function buildManageItemText(entry) {
    if (entry.entry_type === "bonus_payout") {
      return `Bonus Pagou | ${getHouseNameById(entry.house_a_id)} | lucro ${formatMoney(entry.profit_loss)}`;
    }

    const houseA = getHouseNameById(entry.house_a_id);
    const houseB = getHouseNameById(entry.house_b_id);
    return `${houseA} vs ${houseB} | ${entry.house_a_bet} / ${entry.house_b_bet} | L/P ${formatMoney(entry.profit_loss)}`;
  }

  function renderManageList() {
    if (!rotationManageListEl) return;
    const selectedDate = getManageFilterDate();
    const selectedHouseId = getManageFilterHouseId();

    const filtered = weekEntries.filter((entry) => {
      const sameDate = String(entry.rotation_date || "") === selectedDate;
      if (!sameDate) return false;
      if (!selectedHouseId) return true;
      return entry.house_a_id === selectedHouseId || entry.house_b_id === selectedHouseId;
    });

    rotationManageListEl.innerHTML = "";
    if (!filtered.length) {
      const empty = document.createElement("p");
      empty.className = "rotation-manage-empty";
      empty.textContent = "Sem registos nesse filtro.";
      rotationManageListEl.appendChild(empty);
      setStatus(rotationManageStatusEl, "");
      return;
    }

    filtered.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "rotation-manage-item";

      const text = document.createElement("span");
      text.className = "rotation-manage-item-text";
      text.textContent = buildManageItemText(entry);

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "button secondary tiny";
      removeButton.dataset.deleteId = entry.id;
      removeButton.textContent = "Apagar";

      row.appendChild(text);
      row.appendChild(removeButton);
      rotationManageListEl.appendChild(row);
    });
  }

  async function refreshWeekData() {
    const [fetchedUserWeekEntries, fetchedSocietyAllEntries, fetchedSocietyWeekEntries] = await Promise.all([
      fetchEntries(currentUsername, weekRange),
      fetchEntries("all", null),
      fetchEntries("all", weekRange)
    ]);
    weekEntries = fetchedUserWeekEntries;
    societyEntriesAllTime = fetchedSocietyAllEntries;
    societyEntriesCurrentWeek = fetchedSocietyWeekEntries;
    renderWeekGrid();
    renderStats();
    renderManageList();
    setStatus(rotationGridStatusEl, `${weekEntries.length} registo(s) nesta semana.`, "ok");
  }

  function resetRotationForm() {
    if (!rotationFormEl) return;
    rotationFormEl.reset();
    if (rotationDateEl) {
      rotationDateEl.value = toIsoDate(new Date());
    }
    fillHouseSelects();
  }

  function resetBonusForm() {
    if (!bonusFormEl) return;
    bonusFormEl.reset();
    if (bonusDateEl) {
      bonusDateEl.value = toIsoDate(new Date());
    }
    fillHouseSelects();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!rotationSaveButtonEl) return;

    let payload;
    try {
      payload = readPayloadFromForm();
    } catch (error) {
      setStatus(rotationFormStatusEl, error.message || "Formulario invalido.", "error");
      return;
    }

    setStatus(rotationFormStatusEl, "A guardar rotacao...", "warn");
    rotationSaveButtonEl.disabled = true;

    try {
      await createEntry(payload);
      setStatus(rotationFormStatusEl, "Rotacao guardada com sucesso.", "ok");
      await refreshWeekData();
      resetRotationForm();
      closeInputForms();
    } catch (error) {
      setStatus(rotationFormStatusEl, error.message || "Falha ao guardar rotacao.", "error");
    } finally {
      rotationSaveButtonEl.disabled = false;
    }
  }

  async function handleBonusSubmit(event) {
    event.preventDefault();
    if (!bonusSaveButtonEl) return;

    let payload;
    try {
      payload = readBonusPayloadFromForm();
    } catch (error) {
      setStatus(bonusFormStatusEl, error.message || "Formulario de bonus invalido.", "error");
      return;
    }

    setStatus(bonusFormStatusEl, "A guardar bonus...", "warn");
    bonusSaveButtonEl.disabled = true;

    try {
      await createEntry(payload);
      setStatus(bonusFormStatusEl, "Bonus guardado com sucesso.", "ok");
      await refreshWeekData();
      resetBonusForm();
      closeInputForms();
    } catch (error) {
      setStatus(bonusFormStatusEl, error.message || "Falha ao guardar bonus.", "error");
    } finally {
      bonusSaveButtonEl.disabled = false;
    }
  }

  async function handleManageListClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const deleteButton = target.closest("button[data-delete-id]");
    if (!deleteButton) return;

    const rotationId = String(deleteButton.dataset.deleteId || "").trim();
    if (!rotationId) return;

    const confirmed = window.confirm("Queres apagar esta protecao?");
    if (!confirmed) return;

    deleteButton.disabled = true;
    setStatus(rotationManageStatusEl, "A apagar protecao...", "warn");

    try {
      await deleteEntry(rotationId);
      setStatus(rotationManageStatusEl, "Protecao apagada com sucesso.", "ok");
      await refreshWeekData();
    } catch (error) {
      setStatus(rotationManageStatusEl, error.message || "Falha ao apagar protecao.", "error");
    } finally {
      deleteButton.disabled = false;
    }
  }

  async function init() {
    const user = getSessionUser();
    if (!user || !user.username) {
      window.location.href = "/";
      return;
    }
    currentUsername = normalizeUsername(user.username);

    weekDays = getCurrentWeekDays();
    weekRange = {
      start: weekDays[0].iso,
      end: weekDays[weekDays.length - 1].iso
    };

    if (rotationDateEl) {
      rotationDateEl.value = toIsoDate(new Date());
    }
    if (bonusDateEl) {
      bonusDateEl.value = toIsoDate(new Date());
    }
    if (rotationManageDateEl) {
      rotationManageDateEl.value = toIsoDate(new Date());
    }

    if (rotationToggleFormButtonEl) {
      rotationToggleFormButtonEl.addEventListener("click", openRotationForm);
    }
    if (bonusToggleFormButtonEl) {
      bonusToggleFormButtonEl.addEventListener("click", openBonusForm);
    }
    if (rotationManageToggleButtonEl) {
      rotationManageToggleButtonEl.addEventListener("click", toggleManagePanel);
    }

    if (rotationCancelButtonEl) {
      rotationCancelButtonEl.addEventListener("click", () => {
        closeInputForms();
        setStatus(rotationFormStatusEl, "");
      });
    }
    if (bonusCancelButtonEl) {
      bonusCancelButtonEl.addEventListener("click", () => {
        closeInputForms();
        setStatus(bonusFormStatusEl, "");
      });
    }

    rotationFormEl.addEventListener("submit", handleSubmit);
    if (bonusFormEl) {
      bonusFormEl.addEventListener("submit", handleBonusSubmit);
    }
    if (rotationManageFormEl) {
      rotationManageFormEl.addEventListener("input", renderManageList);
      rotationManageFormEl.addEventListener("change", renderManageList);
    }
    if (rotationManageListEl) {
      rotationManageListEl.addEventListener("click", handleManageListClick);
    }

    try {
      const allHouses = await fetchHouses();
      userHouses = allHouses
        .filter((house) => canUserUseHouse(house, currentUsername))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt"));

      if (!userHouses.length) {
        setStatus(
          rotationGridStatusEl,
          "Nao tens casas ativas para esta folha. Configura em Configuracoes.",
          "error"
        );
        if (rotationToggleFormButtonEl) rotationToggleFormButtonEl.disabled = true;
        return;
      }

      if (userHouses.length < 2) {
        setStatus(
          rotationGridStatusEl,
          "Precisas de pelo menos 2 casas ativas para registar uma rotacao.",
          "warn"
        );
        if (rotationToggleFormButtonEl) rotationToggleFormButtonEl.disabled = true;
      }

      fillHouseSelects();
      await refreshWeekData();
    } catch (error) {
      setStatus(rotationGridStatusEl, error.message || "Erro ao carregar a semana.", "error");
      setStatus(rotationFormStatusEl, "Nao foi possivel iniciar a folha de rotacoes.", "error");
    }
  }

  init();
})();
