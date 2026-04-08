const hedgeFormEl = document.getElementById("hedge-form");
const hedgeStatusEl = document.getElementById("hedge-status");
const hedgeTableBodyEl = document.getElementById("hedge-table-body");

const summaryStakeEl = document.getElementById("hedge-summary-stake");
const summaryOddEl = document.getElementById("hedge-summary-odd");
const summaryReturnEl = document.getElementById("hedge-summary-return");
const summaryCounterStakeEl = document.getElementById("hedge-summary-counter-stake");
const summaryNetEl = document.getElementById("hedge-summary-net");
const summaryNetIndividualEl = document.getElementById("hedge-summary-net-individual");
const summaryBreakEvenEl = document.getElementById("hedge-summary-break-even");

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

function parseNumber(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const normalized = raw.replace(/\s+/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function setHedgeStatus(message, tone = "muted") {
  if (!hedgeStatusEl) return;
  hedgeStatusEl.textContent = message;
  hedgeStatusEl.className = `status ${tone}`;
}

function setSummaryValue(element, value, toneClass) {
  if (!element) return;
  element.textContent = value;
  element.classList.remove("money-pos", "money-neg");
  if (toneClass) {
    element.classList.add(toneClass);
  }
}

function clearSummary() {
  setSummaryValue(summaryStakeEl, "--");
  setSummaryValue(summaryOddEl, "--");
  setSummaryValue(summaryReturnEl, "--");
  setSummaryValue(summaryCounterStakeEl, "--");
  setSummaryValue(summaryNetEl, "--");
  setSummaryValue(summaryNetIndividualEl, "--");
  setSummaryValue(summaryBreakEvenEl, "--");
}

function formatMoney(value) {
  return moneyFormatter.format(value);
}

function formatOdd(value) {
  return oddFormatter.format(value);
}

function buildRow(stake, protectedReturn, odd) {
  const hedgeStake = protectedReturn / odd;
  const netResult = protectedReturn - stake - hedgeStake;
  return {
    odd,
    hedgeStake,
    netResult,
    netResultIndividual: netResult / 2
  };
}

function clearTable() {
  if (!hedgeTableBodyEl) return;
  hedgeTableBodyEl.innerHTML = "";
}

function renderTable(rows, selectedOdd) {
  if (!hedgeTableBodyEl) return;
  hedgeTableBodyEl.innerHTML = "";

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    const isSelected =
      selectedOdd !== null &&
      Math.abs(Number(row.odd.toFixed(2)) - Number(selectedOdd.toFixed(2))) < 0.000001;
    if (isSelected) tr.classList.add("is-selected");

    const oddTd = document.createElement("td");
    oddTd.textContent = formatOdd(row.odd);

    const stakeTd = document.createElement("td");
    stakeTd.textContent = formatMoney(row.hedgeStake);

    const netTd = document.createElement("td");
    netTd.textContent = formatMoney(row.netResult);
    netTd.className = row.netResult >= 0 ? "money-pos" : "money-neg";

    const netIndividualTd = document.createElement("td");
    netIndividualTd.textContent = formatMoney(row.netResultIndividual);
    netIndividualTd.className = row.netResultIndividual >= 0 ? "money-pos" : "money-neg";

    tr.appendChild(oddTd);
    tr.appendChild(stakeTd);
    tr.appendChild(netTd);
    tr.appendChild(netIndividualTd);
    hedgeTableBodyEl.appendChild(tr);
  });
}

function readInputs() {
  if (!hedgeFormEl) return null;
  const formData = new FormData(hedgeFormEl);
  return {
    stake: parseNumber(formData.get("stake")),
    odd: parseNumber(formData.get("odd")),
    counterOdd: parseNumber(formData.get("counterOdd")),
    minOdd: parseNumber(formData.get("minOdd")),
    maxOdd: parseNumber(formData.get("maxOdd")),
    step: parseNumber(formData.get("step"))
  };
}

function renderSummary(stake, odd, protectedReturn, counterOdd) {
  setSummaryValue(summaryStakeEl, formatMoney(stake));
  setSummaryValue(summaryOddEl, formatOdd(odd));
  setSummaryValue(summaryReturnEl, formatMoney(protectedReturn));

  const breakEvenOdd = odd > 1 ? odd / (odd - 1) : null;
  setSummaryValue(summaryBreakEvenEl, breakEvenOdd ? formatOdd(breakEvenOdd) : "--");

  if (!counterOdd || counterOdd <= 1) {
    setSummaryValue(summaryCounterStakeEl, "--");
    setSummaryValue(summaryNetEl, "--");
    setSummaryValue(summaryNetIndividualEl, "--");
    return;
  }

  const counterRow = buildRow(stake, protectedReturn, counterOdd);
  setSummaryValue(summaryCounterStakeEl, formatMoney(counterRow.hedgeStake));
  setSummaryValue(
    summaryNetEl,
    formatMoney(counterRow.netResult),
    counterRow.netResult >= 0 ? "money-pos" : "money-neg"
  );
  setSummaryValue(
    summaryNetIndividualEl,
    formatMoney(counterRow.netResultIndividual),
    counterRow.netResultIndividual >= 0 ? "money-pos" : "money-neg"
  );
}

function calculate() {
  const values = readInputs();
  if (!values) return;

  const { stake, odd, counterOdd } = values;
  let { minOdd, maxOdd, step } = values;

  if (!stake || stake <= 0) {
    clearTable();
    clearSummary();
    setHedgeStatus("Indica um valor valido para o saldo real.", "error");
    return;
  }

  if (!odd || odd <= 1) {
    clearTable();
    clearSummary();
    setHedgeStatus("Indica uma odd inicial acima de 1.00.", "error");
    return;
  }

  if (!minOdd || minOdd <= 1) minOdd = 1.01;
  if (!maxOdd || maxOdd <= 1) maxOdd = Math.max(odd + 0.4, 1.01);
  if (!step || step <= 0) step = 0.01;

  if (maxOdd < minOdd) {
    const temp = minOdd;
    minOdd = maxOdd;
    maxOdd = temp;
  }

  const protectedReturn = stake * odd;
  renderSummary(stake, odd, protectedReturn, counterOdd);

  const rows = [];
  const seenOdds = new Set();
  let currentOdd = minOdd;
  let safety = 0;
  const maxRows = 3000;

  while (currentOdd <= maxOdd + 0.000001 && safety < maxRows) {
    const displayOdd = Number(currentOdd.toFixed(2));
    if (!seenOdds.has(displayOdd)) {
      rows.push(buildRow(stake, protectedReturn, displayOdd));
      seenOdds.add(displayOdd);
    }
    currentOdd += step;
    safety += 1;
  }

  if (!rows.length) {
    clearTable();
    setHedgeStatus("Nao foi possivel gerar a tabela. Verifica os limites da odd.", "error");
    return;
  }

  renderTable(rows, counterOdd && counterOdd > 1 ? counterOdd : null);

  const breakEvenOdd = odd > 1 ? odd / (odd - 1) : null;
  const breakEvenText = breakEvenOdd ? ` | break-even: ${formatOdd(breakEvenOdd)}` : "";
  setHedgeStatus(`${rows.length} odds calculadas.${breakEvenText}`, "ok");
}

function initHedgeCalculator() {
  if (!hedgeFormEl) return;

  hedgeFormEl.addEventListener("submit", (event) => {
    event.preventDefault();
    calculate();
  });

  hedgeFormEl.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", calculate);
  });

  calculate();
}

initHedgeCalculator();
