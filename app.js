const $ = id => document.getElementById(id);
const today = new Date();
const monthKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
let currentMonth = monthKey(today);
let data = {};

const fresh = () => ({deposits:[], meals:{}, rate:50, cook:230, showFinal:false});
const num = value => Number(value) || 0;

function normalizeMonth(source) {
  const s = source && typeof source === "object" ? source : fresh();
  if (!Array.isArray(s.deposits)) s.deposits = [];
  if (!s.meals || typeof s.meals !== "object") s.meals = {};
  if (!Number.isFinite(Number(s.rate)) || Number(s.rate) <= 0) s.rate = 50;
  if (!Number.isFinite(Number(s.cook)) || Number(s.cook) < 0) s.cook = 230;

  // Migrate the old per-deposit gas fields to one monthly gas charge.
  // Keep the first deposit's gas amount; if it is missing, use the first
  // non-zero historical gas entry. All later deposits become zero-gas.
  if (s.deposits.length) {
    let monthlyGas = num(s.deposits[0].gas);
    if (monthlyGas === 0) {
      const oldGasEntry = s.deposits.find(d => num(d && d.gas) > 0);
      if (oldGasEntry) monthlyGas = num(oldGasEntry.gas);
    }
    s.deposits = s.deposits.map((d, index) => ({
      amount: d && d.amount !== undefined ? String(d.amount) : "0",
      gas: index === 0 ? String(monthlyGas) : "0"
    }));
  }

  // Old versions permanently set settled=true. Convert that state to a
  // visible preview, but never keep the editing lock.
  s.showFinal = Boolean(s.showFinal || s.settled || (s.final !== null && s.final !== undefined));
  s.settled = false;
  delete s.final;
  return s;
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem("falconMessTracker") || "{}");
    data = saved && typeof saved === "object" ? saved : {};
  } catch (error) {
    console.error("Could not read saved tracker data", error);
    data = {};
  }
  Object.keys(data).forEach(key => { data[key] = normalizeMonth(data[key]); });
  if (!data[currentMonth]) data[currentMonth] = fresh();
  save();
  render();
}

function save() {
  localStorage.setItem("falconMessTracker", JSON.stringify(data));
}
function state() { return data[currentMonth]; }
function daysInMonth() {
  const [year, month] = currentMonth.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}
function mealCount(value) {
  return value === "Both" ? 2 : (value === "Morning" || value === "Night" ? 1 : 0);
}
function stats() {
  const s = state();
  const deposits = s.deposits.reduce((sum, item) => sum + num(item.amount), 0);
  const gas = s.deposits.length ? num(s.deposits[0].gas) : 0;
  const mealRate = Math.max(1, num(s.rate) || 50);
  const consumed = Object.values(s.meals).reduce((sum, value) => sum + mealCount(value), 0);
  const mealBudget = deposits - gas;
  const mealExpense = consumed * mealRate;
  const balanceBeforeCook = mealBudget - mealExpense;
  const finalBalance = balanceBeforeCook - num(s.cook);
  return {
    deposits, gas, mealBudget, mealRate, consumed,
    available: Math.max(0, Math.floor(mealBudget / mealRate)),
    mealExpense, balanceBeforeCook,
    remaining: Math.max(0, Math.floor(balanceBeforeCook / mealRate)),
    finalBalance
  };
}
function money(value) { return `₹${Number(value || 0).toLocaleString("en-IN", {maximumFractionDigits:2})}`; }
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}

function render() {
  const s = state();
  const st = stats();
  $("month").value = currentMonth;
  $("rate").value = s.rate;
  $("cook").value = s.cook;
  $("available").textContent = st.available;
  $("consumed").textContent = st.consumed;
  $("remaining").textContent = st.remaining;

  // These controls are intentionally never disabled by month-end preview.
  $("rate").disabled = false;
  $("cook").disabled = false;
  $("addDeposit").disabled = false;

  if (!s.deposits.length) {
    $("deposits").innerHTML = '<div class="panel muted">No deposits added yet.</div>';
  } else {
    $("deposits").innerHTML = s.deposits.map((deposit, index) => {
      const isFirst = index === 0;
      const gasValue = isFirst ? num(deposit.gas) : 0;
      return `<div class="panel">
        <div class="deposit-title">Deposit #${index+1}<button class="danger" type="button" data-remove="${index}">Remove</button></div>
        <div class="grid2">
          <div><label>Deposit Amount (₹)</label><input type="number" min="0" step="0.01" data-dep="${index}" data-field="amount" value="${esc(deposit.amount)}"></div>
          <div><label>Gas Charge (₹) ${isFirst ? "(monthly – first deposit only)" : "(not charged again)"}</label><input type="number" min="0" step="0.01" data-dep="${index}" data-field="gas" value="${gasValue}" ${isFirst ? "" : "disabled"}></div>
        </div>
        <p class="muted">Net Deposit: ${money(num(deposit.amount)-gasValue)}</p>
      </div>`;
    }).join("");
  }

  let daysHTML = "";
  for (let day = 1; day <= daysInMonth(); day++) {
    const value = s.meals[day] || "Off";
    const count = mealCount(value);
    daysHTML += `<div class="day">
      <div class="daytop"><span>Day ${day}</span><span>${value}</span></div>
      <div class="choices">${["Morning","Night","Both","Off"].map(option => `<button type="button" data-day="${day}" data-value="${option}" class="${value===option?"active":""}">${option}</button>`).join("")}</div>
      <div class="dayfoot"><span>Meals: ${count}</span><span>Cost: ${money(count*st.mealRate)}</span></div>
    </div>`;
  }
  $("days").innerHTML = daysHTML;

  if (s.showFinal) {
    const final = st.finalBalance;
    $("settlement").innerHTML = `<div class="result">
      <b class="${final >= 0 ? "refund" : "due"}">${final >= 0 ? "REFUND" : "DUE"}</b>
      <strong class="${final >= 0 ? "refund" : "due"}">${money(Math.abs(final))}</strong>
      <div class="muted">${final >= 0 ? "This amount is refundable to you." : "This amount is payable by you."}<br>
      Deposits: ${money(st.deposits)} · Gas charged once: ${money(st.gas)}<br>
      Meal expenses: ${money(st.mealExpense)} · Cook charge: ${money(s.cook)}<br><br>
      Preview only — your month is not locked. You can continue editing and recalculate anytime.</div>
      <div class="full-row"><button type="button" id="backDashboard">Back to Dashboard</button><button type="button" class="primary" id="settle">Recalculate</button></div>
    </div>`;
  } else {
    $("settlement").innerHTML = '<div class="muted">Calculate anytime to preview your current Due or Refund. This will not lock the month.</div><button class="primary full" type="button" id="settle">Calculate Final Result</button>';
  }
  save();
}

$("month").addEventListener("change", event => {
  currentMonth = event.target.value || monthKey(today);
  if (!data[currentMonth]) data[currentMonth] = fresh();
  $("reportArea").hidden = true;
  render();
});
$("rate").addEventListener("change", event => {
  state().rate = Math.max(1, num(event.target.value) || 50);
  render();
});
$("cook").addEventListener("change", event => {
  state().cook = Math.max(0, num(event.target.value));
  render();
});
$("addDeposit").addEventListener("click", () => {
  const s = state();
  s.deposits.push({amount:"1000", gas:s.deposits.length ? "0" : "150"});
  render();
});
$("deposits").addEventListener("change", event => {
  const index = event.target.dataset.dep;
  const field = event.target.dataset.field;
  if (index === undefined || !field) return;
  const i = Number(index);
  if (!state().deposits[i]) return;
  if (field === "gas" && i !== 0) return;
  state().deposits[i][field] = event.target.value;
  render();
});
$("deposits").addEventListener("click", event => {
  const rawIndex = event.target.dataset.remove;
  if (rawIndex === undefined) return;
  const s = state();
  const index = Number(rawIndex);
  const removed = s.deposits.splice(index, 1)[0];
  // If the first deposit is removed, carry its monthly gas charge to the new first deposit.
  if (index === 0 && s.deposits.length && removed) {
    s.deposits[0].gas = String(num(removed.gas));
  }
  render();
});
$("days").addEventListener("click", event => {
  const day = event.target.dataset.day;
  const value = event.target.dataset.value;
  if (day && value) {
    state().meals[day] = value;
    render();
  }
});
$("settlement").addEventListener("click", event => {
  if (event.target.id === "settle") {
    state().showFinal = true;
    render();
  }
  if (event.target.id === "backDashboard") {
    state().showFinal = false;
    render();
    $("dashboardHeading").scrollIntoView({behavior:"smooth", block:"start"});
  }
});
$("report").addEventListener("click", () => {
  const s = state();
  const st = stats();
  const lines = [
    `Mess Meal Tracker — ${currentMonth}`,
    `Total deposits: ${money(st.deposits)}`,
    `Monthly gas charge (first deposit only): ${money(st.gas)}`,
    `Meal budget: ${money(st.mealBudget)}`,
    `Meals available: ${st.available}`,
    `Meals consumed: ${st.consumed}`,
    `Remaining meals: ${st.remaining}`,
    `Meal expenses: ${money(st.mealExpense)}`,
    `Cook charge: ${money(s.cook)}`,
    `${st.finalBalance >= 0 ? "Refund" : "Due"}: ${money(Math.abs(st.finalBalance))} (preview)`,
    ...Array.from({length:daysInMonth()}, (_, i) => `Day ${i+1}: ${s.meals[i+1] || "Off"}`)
  ];
  $("reportArea").hidden = false;
  $("reportArea").innerHTML = `<b>Monthly Report</b><pre style="white-space:pre-wrap;color:#dbeafe;font:13px system-ui">${esc(lines.join("\n"))}</pre><button id="copyReport" class="full" type="button">Copy Report</button>`;
  $("copyReport").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      $("copyReport").textContent = "Copied!";
    } catch (error) {
      $("copyReport").textContent = "Copy unavailable — select report text";
    }
  });
});

load();

// Register a versioned service worker so browsers check for this release.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js?v=3", {updateViaCache:"none"})
      .then(registration => registration.update())
      .catch(error => console.warn("Service worker registration failed", error));
  });
}
