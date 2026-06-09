// === CONFIGURAZIONE ===
const SHEET_ID = "1VITx37L378SVjvHV0cfYBeu0cqMZG7pe7bPgVuGP4uc";
const SHEET_NAME = "Foglio1"; // aggiorna se diverso
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`;
const DAILY_KCAL_TARGET = 1900;
const DAILY_KCAL_TARGET_TOLERANCE = 50;
const FOOD_DICTIONARY_URL = "data/food_dictionary.json";
const FOOD_DICTIONARY_CACHE_BUSTER = "2026-05-20-1";

let datiTotali = [];
let chartPeso, chartKcal, chartPassi;
let foodDictionary = null;
let foodCostSearchResults = [];
let liveCaloriesState = {
  total: null,
  target: DAILY_KCAL_TARGET,
  hasTodayEstimate: false
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadFoodDictionary() {
  if (foodDictionary) {
    return foodDictionary;
  }

  const dictionaryUrl = `${FOOD_DICTIONARY_URL}?v=${FOOD_DICTIONARY_CACHE_BUSTER}`;
  const response = await fetch(dictionaryUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Impossibile caricare food_dictionary.json");
  }

  foodDictionary = await response.json();
  return foodDictionary;
}

function parseDashboardDate(dateValue) {
  if (!dateValue || typeof dateValue !== "string") return null;

  const [gg, mm, aaaa] = dateValue.split("/");
  if (!gg || !mm || !aaaa) return null;

  const parsed = new Date(`${aaaa}-${mm}-${gg}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resetLiveCaloriesState() {
  liveCaloriesState.total = null;
  liveCaloriesState.hasTodayEstimate = false;
}

function setLiveCaloriesState(result) {
  liveCaloriesState.total = Number(result?.total);
  liveCaloriesState.hasTodayEstimate = Number.isFinite(liveCaloriesState.total);
}

function getFoodCostElements() {
  return {
    input: document.getElementById("foodCostSearch"),
    clearButton: document.getElementById("foodCostClear"),
    dropdown: document.getElementById("foodCostDropdown"),
    results: document.getElementById("foodCostResults"),
    simulation: document.getElementById("foodCostSimulation")
  };
}

function setFoodCostDropdownVisible(isVisible) {
  const { dropdown } = getFoodCostElements();
  if (!dropdown) return;

  dropdown.classList.toggle("hidden", !isVisible);
}

function updateFoodCostClearButton() {
  const { input, clearButton } = getFoodCostElements();
  if (!input || !clearButton) return;

  clearButton.classList.toggle("hidden", input.value.length === 0);
}

function clearFoodCostDropdown() {
  const { results, simulation } = getFoodCostElements();
  foodCostSearchResults = [];

  if (results) {
    results.innerHTML = "";
  }

  if (simulation) {
    simulation.innerHTML = "";
    simulation.classList.add("hidden");
  }

  setFoodCostDropdownVisible(false);
}

function clearFoodCostSimulation() {
  const { simulation } = getFoodCostElements();
  if (simulation) {
    simulation.innerHTML = "";
    simulation.classList.add("hidden");
  }
}

function renderFoodCostMessage(message, tone = "info") {
  const { simulation } = getFoodCostElements();
  if (!simulation) return;

  const toneClass = tone === "danger"
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-slate-200 bg-slate-50 text-slate-600";

  simulation.innerHTML = `
    <div class="rounded-lg border px-3 py-2 ${toneClass}">
      ${escapeHtml(message)}
    </div>
  `;
  simulation.classList.remove("hidden");
  setFoodCostDropdownVisible(true);
}

function renderFoodCostResults(matches) {
  const { results } = getFoodCostElements();
  if (!results) return;

  foodCostSearchResults = matches;

  if (matches.length === 0) {
    results.innerHTML = `
      <p class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
        Nessun alimento trovato.
      </p>
    `;
    setFoodCostDropdownVisible(true);
    return;
  }

  results.innerHTML = matches.map((item, index) => `
    <div class="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <div class="truncate text-sm font-semibold text-slate-800">${escapeHtml(item.name)}</div>
        <div class="text-xs font-medium text-slate-500">≈ ${Math.round(item.kcal)} kcal</div>
      </div>
      <button
        type="button"
        class="w-full rounded bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 sm:w-auto"
        data-food-cost-index="${index}"
      >
        + Simula
      </button>
    </div>
  `).join("");
  setFoodCostDropdownVisible(true);
}

async function updateFoodCostSearch() {
  const { input, results } = getFoodCostElements();
  if (!input || !results) return;

  const query = input.value.trim();
  updateFoodCostClearButton();
  clearFoodCostSimulation();

  if (query.length < 2) {
    clearFoodCostDropdown();
    return;
  }

  let dictionary;
  try {
    dictionary = await loadFoodDictionary();
  } catch (error) {
    console.warn(error);
    foodCostSearchResults = [];
    results.innerHTML = "";
    renderFoodCostMessage("Dizionario alimentare non disponibile al momento.");
    return;
  }

  renderFoodCostResults(window.liveCaloriesUtils.findFoodCostMatches(query, dictionary));
}

function simulateFoodCost(index) {
  const item = foodCostSearchResults[index];
  if (!item) return;

  if (!liveCaloriesState.hasTodayEstimate || !Number.isFinite(liveCaloriesState.total)) {
    renderFoodCostMessage("Kcal provvisorie di oggi non disponibili: simulazione non calcolabile.");
    return;
  }

  const simulatedTotal = Math.round(liveCaloriesState.total + item.kcal);
  const residualInfo = window.liveCaloriesUtils?.computeCalorieResidual(
    simulatedTotal,
    liveCaloriesState.target,
    DAILY_KCAL_TARGET_TOLERANCE
  );

  if (!residualInfo || residualInfo.status === "unknown") {
    renderFoodCostMessage("Target calorico non disponibile: simulazione non calcolabile.");
    return;
  }

  if (residualInfo.status === "exceeded") {
    renderFoodCostMessage(
      `Se aggiungi "${item.name}", oggi arrivi a circa ${simulatedTotal} kcal. Superi il target di circa ${residualInfo.amount} kcal.`,
      "danger"
    );
    return;
  }

  const remaining = residualInfo.status === "balanced" ? 0 : residualInfo.amount;
  renderFoodCostMessage(
    `Se aggiungi "${item.name}", oggi arrivi a circa ${simulatedTotal} kcal. Residuo stimato: ${remaining} kcal.`,
    "success"
  );
}

function initFoodCostSearch() {
  const { input, clearButton, results } = getFoodCostElements();
  if (!input || !results) return;

  input.addEventListener("input", updateFoodCostSearch);
  input.addEventListener("focus", () => {
    updateFoodCostClearButton();
    if (foodCostSearchResults.length > 0 || results.innerHTML.trim()) {
      setFoodCostDropdownVisible(true);
    }
  });

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      input.value = "";
      updateFoodCostClearButton();
      clearFoodCostDropdown();
      input.focus();
    });
  }

  results.addEventListener("click", event => {
    const button = event.target.closest("[data-food-cost-index]");
    if (!button) return;

    simulateFoodCost(Number(button.dataset.foodCostIndex));
  });
}

function renderLiveCaloriesEmpty(message, note = "") {
  const card = document.getElementById("liveCaloriesCard");
  if (!card) return;

  resetLiveCaloriesState();

  card.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="text-2xl" aria-hidden="true">🍽️</span>
      <h2 class="text-xl font-semibold text-gray-800 sm:text-2xl">Kcal provvisorie oggi</h2>
    </div>
    <p class="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
      ${escapeHtml(message)}
    </p>
    ${note ? `<p class="mt-3 text-sm leading-relaxed text-slate-500">${escapeHtml(note)}</p>` : ""}
  `;
}

function renderLiveCaloriesCard(result, target) {
  const card = document.getElementById("liveCaloriesCard");
  if (!card) return;

  const residualInfo = window.liveCaloriesUtils.computeCalorieResidual(
    result.total,
    target,
    DAILY_KCAL_TARGET_TOLERANCE
  );

  let residualLabel = "Residuo non disponibile";
  let residualClass = "text-slate-600";

  if (residualInfo.status === "remaining") {
    residualLabel = `Residuo ${residualInfo.amount} kcal`;
    residualClass = "text-emerald-600";
  } else if (residualInfo.status === "exceeded") {
    residualLabel = `Sforamento ${residualInfo.amount} kcal`;
    residualClass = "text-rose-600";
  } else if (residualInfo.status === "balanced") {
    residualLabel = "Target centrato";
    residualClass = "text-blue-600";
  }

  const matchedCount = result.matched.length;
  const unmatchedCount = result.unmatched.length;
  const partialCount = result.matched.filter(item => item.estimationMode === "components").length;
  const sourceLabel = item => {
    if (item.source === "inline-kcal") return "valore dichiarato";
    if (item.source === "derived") return "voce derived";
    return "voce historical";
  };
  const detailsRows = [
    ...result.matched.map(item => {
      const score = Math.round(item.score * 100);
      const componentCoverage = item.totalComponents > 1
        ? `${item.matchedComponentCount}/${item.totalComponents} componenti stimati`
        : "stima parziale";

      if (item.estimationMode === "components") {
        const componentRows = [
          ...item.matchedComponents.map(component => {
            const componentScore = Math.round(component.score * 100);
            const componentIcon = component.matchType === "exact" ? "✓" : "~";
            const componentColor = component.matchType === "exact" ? "text-emerald-600" : "text-amber-500";
            const confidenceText = component.matchType === "exact"
              ? ""
              : ` (confidenza ${componentScore}%)`;
            const renderedComponentIcon = component.source === "inline-kcal"
              ? "≈"
              : componentIcon;
            const renderedComponentColor = component.source === "inline-kcal"
              ? "text-blue-600"
              : componentColor;
            const renderedConfidenceText = component.source === "inline-kcal"
              ? ` (${sourceLabel(component)})`
              : component.matchType === "exact"
                ? ` (${sourceLabel(component)})`
                : ` (confidenza ${componentScore}%, ${sourceLabel(component)})`;

            return `
              <div class="text-xs leading-relaxed text-slate-500 sm:text-sm">
                <span class="font-semibold ${renderedComponentColor}">${renderedComponentIcon}</span>
                ${escapeHtml(component.input)} → <strong>${component.kcal} kcal</strong>${renderedConfidenceText}
              </div>
            `;
          }),
          ...item.unmatchedComponents.map(component => `
            <div class="text-xs leading-relaxed text-slate-500 sm:text-sm">
              <span class="font-semibold text-rose-600">!</span>
              ${escapeHtml(component.input)} → non stimato
            </div>
          `)
        ].join("");

        return `
          <li>
            <div>
              <span class="font-semibold text-amber-500">~</span>
              ${escapeHtml(item.label)}: ${escapeHtml(item.input)} → <strong>${item.kcal} kcal</strong>
              <span class="text-slate-500">(stima parziale, ${componentCoverage})</span>
            </div>
            <div class="mt-1 space-y-1 pl-5">
              ${componentRows}
            </div>
          </li>
        `;
      }

      if (item.matchType === "exact") {
        return `<li><span class="font-semibold text-emerald-600">✓</span> ${escapeHtml(item.label)}: ${escapeHtml(item.input)} → <strong>${item.kcal} kcal</strong> <span class="text-slate-500">(${sourceLabel(item)})</span></li>`;
      }

      if (item.matchType === "inline-kcal") {
        return `<li><span class="font-semibold text-blue-600">≈</span> ${escapeHtml(item.label)}: ${escapeHtml(item.input)} → <strong>${item.kcal} kcal</strong> <span class="text-slate-500">(valore dichiarato)</span></li>`;
      }

      return `<li><span class="font-semibold text-amber-500">~</span> ${escapeHtml(item.label)}: ${escapeHtml(item.input)} stimato da "${escapeHtml(item.matchedKey)}" → <strong>${item.kcal} kcal</strong> (confidenza ${score}%, ${sourceLabel(item)})</li>`;
    }),
    ...result.unmatched.map(item =>
      `<li><span class="font-semibold text-rose-600">!</span> ${escapeHtml(item.label)}: ${escapeHtml(item.input)} → non stimato</li>`
    )
  ].join("");

  card.innerHTML = `
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="w-full sm:max-w-2xl">
        <div class="flex items-center gap-2">
          <span class="text-2xl" aria-hidden="true">🍽️</span>
          <h2 class="text-xl font-semibold text-gray-800 sm:text-2xl">Kcal provvisorie oggi</h2>
        </div>
        <p class="mt-2 text-sm leading-relaxed text-slate-500 sm:text-base">
          ${matchedCount} pasti riconosciuti · ${unmatchedCount} ${unmatchedCount === 1 ? "non riconosciuto" : "non riconosciuti"}
        </p>
        ${partialCount > 0 ? `
          <p class="mt-1 text-sm leading-relaxed text-amber-600 sm:text-base">
            ${partialCount} ${partialCount === 1 ? "stima parziale" : "stime parziali"} da componenti
          </p>
        ` : ""}
      </div>

      <div class="w-full rounded-2xl bg-blue-50 px-4 py-3 sm:w-auto sm:min-w-[220px] sm:text-right">
        <div class="text-2xl font-bold text-slate-900 sm:text-3xl">≈ ${result.total} kcal</div>
        <div class="mt-1 text-sm font-medium text-slate-600">Affidabilita: ${escapeHtml(result.reliability)}</div>
        <div class="mt-1 text-sm font-semibold ${residualClass}">${escapeHtml(residualLabel)}</div>
      </div>
    </div>

    <p class="mt-4 text-sm leading-relaxed text-slate-500">
      Stima indicativa calcolata dallo storico personale. Il valore definitivo resta quello elaborato da Gemini.
    </p>

    ${detailsRows ? `
      <details class="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <summary class="cursor-pointer text-sm font-semibold text-slate-700 marker:text-blue-600">
          Mostra dettagli stima
        </summary>
        <ul class="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
          ${detailsRows}
        </ul>
      </details>
    ` : ""}
  `;
}

async function aggiornaStimaLiveOggi(dati) {
  if (!window.liveCaloriesUtils) {
    renderLiveCaloriesEmpty(
      "Stima kcal live non disponibile.",
      "La dashboard resta consultabile, ma la logica locale di stima non e' stata caricata correttamente."
    );
    return;
  }

  let dictionary;

  try {
    dictionary = await loadFoodDictionary();
  } catch (error) {
    console.warn(error);
    renderLiveCaloriesEmpty(
      "Stima kcal live non disponibile.",
      "Non e' stato possibile caricare lo storico personale dei pasti."
    );
    return;
  }

  const today = new Date();
  const todayRow = dati.find(row => {
    const rowDate = parseDashboardDate(row.data);
    return rowDate && window.liveCaloriesUtils.isSameDay(rowDate, today);
  });

  if (!todayRow) {
    renderLiveCaloriesEmpty("Nessun dato alimentare registrato oggi.");
    return;
  }

  const meals = [
    todayRow.colazione,
    todayRow.snackMattutino,
    todayRow.pranzo,
    todayRow.snackPomeridiano,
    todayRow.cena,
    todayRow.snackSerale
  ].filter(value => String(value || "").trim());

  if (meals.length === 0) {
    renderLiveCaloriesEmpty("Nessun pasto inserito oggi.");
    return;
  }

  const result = window.liveCaloriesUtils.estimateTodayCalories(todayRow, dictionary);

  if (result.matched.length === 0) {
    resetLiveCaloriesState();
    renderLiveCaloriesEmpty(
      "Stima non disponibile: nessun alimento riconosciuto nello storico.",
      "Completa i pasti di oggi o arricchisci lo storico per ottenere una stima piu' affidabile."
    );
    return;
  }

  setLiveCaloriesState(result);
  renderLiveCaloriesCard(result, DAILY_KCAL_TARGET);
}

// === FETCH DATI DAL GOOGLE SHEET ===
async function caricaDati() {
  const res = await fetch(SHEET_URL);
  
  const text = await res.text();
  const json = JSON.parse(text.substr(47).slice(0, -2));
  const rows = json.table.rows;

  // console.log("Esempio prima riga Sheet:", rows[0].c.map(c => c?.v));

  datiTotali = rows.map(r => {
	  
	  const cleanNumber = v => {
		if (v == null) return null;
		return parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(',', '.')) || null;
	  };

	  return {
		data: r.c[1]?.f || r.c[1]?.v,               // Data (B)
		peso: parseFloat(r.c[2]?.v) || null, // C
		altezza: r.c[3]?.v || "",            // Altezza (D)		
		bmi: parseFloat(r.c[4]?.v) || null, // E
		grasso: r.c[5]?.v || "",            // Altezza (F)
		muscolo: r.c[6]?.v || "",            // Altezza (G)
		kcalRange: r.c[19]?.v || "-",               // Kcal Giornata (Range) (T)
		kcal: cleanNumber(r.c[20]?.v),              // Kcal Giornata numerica (U)
		passi: cleanNumber(r.c[21]?.v),             // Passi totali (V)
		sonno: r.c[24]?.v || "",                    // Sonno (X)
		sensazioni: r.c[25]?.v || "-",              // Sensazioni (Y)
		valutazione: r.c[27]?.v || "-",             // Valutazione giornata (AA)
		suggerimento: r.c[28]?.v || "-",             // Suggerimenti di miglioramento (AB)

		// kcal per pasto 👇
        kcalColazione: cleanNumber(r.c[8]?.v),
        kcalSnackMattutino: cleanNumber(r.c[10]?.v),
        kcalPranzo: cleanNumber(r.c[12]?.v),
        kcalSnackPomeridiano: cleanNumber(r.c[14]?.v),
        kcalCena: cleanNumber(r.c[16]?.v),
        kcalSnackSerale: cleanNumber(r.c[18]?.v),

        // Kcal consumate
        kcalConsumate: cleanNumber(r.c[23]?.v),

		// Box completo
		colazione: r.c[7]?.v || "",                 // H
		snackMattutino: r.c[9]?.v || "",            // J
		pranzo: r.c[11]?.v || "",                   // L
		snackPomeridiano: r.c[13]?.v || "",         // N
		cena: r.c[15]?.v || "",                     // P
		snackSerale: r.c[17]?.v || "",              // R
		attivita: r.c[22]?.v || "",                 // W (Attività fisica)
		note: r.c[26]?.v || ""                      // Z (Note/Eventi)
	  };
	}).filter(d => d.data);

	
	// Ordina i dati per data crescente
	datiTotali = datiTotali.sort((a, b) => {
	  const [ga, ma, aa] = a.data.split("/");
	  const [gb, mb, ab] = b.data.split("/");
	  return new Date(`${aa}-${ma}-${ga}`) - new Date(`${ab}-${mb}-${gb}`);
	});

  document.getElementById("last-update").textContent =
    datiTotali[datiTotali.length - 1].data;

  await aggiornaStimaLiveOggi(datiTotali);
  impostaPeriodoDefault();
} // Fine caricaDati

// === FILTRI DI DATA ===
function impostaPeriodoDefault() {
  const oggi = new Date();
  const unMeseFa = new Date();
  unMeseFa.setDate(oggi.getDate() - 30);

  document.getElementById("endDate").value = oggi.toISOString().split("T")[0];
  document.getElementById("startDate").value = unMeseFa
    .toISOString()
    .split("T")[0];

  aggiornaDashboard();
}

document.getElementById("applyFilter").addEventListener("click", aggiornaDashboard);

// === Toggle vista Riepilogo ===
document.getElementById("toggleRiepilogo").addEventListener("click", (event) => {
  const btn = event.target;
  const current = btn.dataset.mode;
  const next = current === "default" ? "settimana" :
               current === "settimana" ? "confronto" : "default";
  btn.dataset.mode = next;

  // Aggiorna il box di riepilogo
  aggiornaRiepilogo(getDatiFiltrati(), next);

});

// === Toggle grafico Peso/BMI ↔ Composizione ===
document.getElementById("togglePeso").addEventListener("click", () => {
  const btn = event.target;
  const current = btn.dataset.mode;
  const next = current === "default" ? "composizione" : "default";
  btn.dataset.mode = next;

  // Aggiorna il grafico
  aggiornaGraficoPeso(getDatiFiltrati(), next);

  // Aggiorna titolo
  const titolo = document.getElementById("titoloPeso");
  titolo.textContent = (next === "default")
    ? "📈 Peso / BMI"
    : "🧍‍♂️ Composizione corporea";
});

// === Toggle grafico Kcal ===
document.getElementById("toggleKcal").addEventListener("click", (event) => {
  const btn = event.target;
  const current = btn.dataset.mode;
  const next = current === "default"
    ? "distribuzione"
    : current === "distribuzione"
      ? "confronto"
      : "default";

  btn.dataset.mode = next;

  // Aggiorna il grafico
  aggiornaGraficoKcal(getDatiFiltrati(), next);

  // Aggiorna il titolo
  const titolo = document.getElementById("titoloKcal");
  titolo.textContent =
    next === "default"
      ? "🔥 Kcal giornaliere"
      : next === "distribuzione"
        ? "🥧 Distribuzione per pasto"
        : "📆 Feriali vs weekend";
});

// === Toggle grafico Passi / Attività fisica ===
document.getElementById("togglePassi").addEventListener("click", (event) => {
  const btn = event.target;
  const current = btn.dataset.mode;
  const next = current === "default" ? "attivita" : "default";
  btn.dataset.mode = next;

  aggiornaGraficoPassi(getDatiFiltrati(), next);

  const titolo = document.getElementById("titoloPassi");
  titolo.textContent = (next === "default")
    ? "🚶 Num. Passi"
    : "🔥 Attività fisica";
});


// === Toggle grafico Benessere (Sonno / Sensazioni) ===
document.getElementById("toggleBenessere").addEventListener("click", (event) => {
  const btn = event.target;
  const current = btn.dataset.mode;
  const next =
    current === "default" ? "sensazioni" :
    current === "sensazioni" ? "correlazione" :
    "default";

  btn.dataset.mode = next;

  aggiornaGraficoBenessere(getDatiFiltrati(), next);

  const titolo = document.getElementById("titoloBenessere");
  titolo.textContent =
    next === "default"
      ? "💤 Ore di sonno"
      : next === "sensazioni"
        ? "😊 Sensazioni"
        : "📈 Sonno ↔ Sensazioni";
});





// === Funzioni di supporto ===
function getDatiFiltrati() {
  const start = new Date(document.getElementById("startDate").value);
  const end = new Date(document.getElementById("endDate").value);

  return datiTotali.filter(d => {
    const [gg, mm, aaaa] = d.data.split("/");
    const data = new Date(`${aaaa}-${mm}-${gg}`);
    return data >= start && data <= end;
  });
}


function aggiornaDashboard() {
  const start = new Date(document.getElementById("startDate").value);
  const end = new Date(document.getElementById("endDate").value);

  const filtrati = datiTotali.filter(d => {
    const [gg, mm, aaaa] = d.data.split("/");
    const data = new Date(`${aaaa}-${mm}-${gg}`);
    return data >= start && data <= end;
  });

  aggiornaGrafici(filtrati);
  // aggiornaTabella(filtrati);
  aggiornaTabellaResponsive(filtrati);

  aggiornaRiepilogo(filtrati);
  aggiornaStatoPersonale(datiTotali);
}

// === GRAFICI ===
function aggiornaGrafici(dati) {
  const labels = dati.map(d => d.data);
  const peso = dati.map(d => d.peso);
  const bmi = dati.map(d => d.bmi);
  const kcal = dati.map(d => d.kcal);
  const passi = dati.map(d => d.passi);

  // === GRAFICO 1: PESO/BMI -> % Grasso e muscolo ===
  aggiornaGraficoPeso(dati);

  // === GRAFICO 2: Kcal -> Distribuzione per pasto -> Confronto feriali vs weekend ===
  aggiornaGraficoKcal(dati);

  // === GRAFICO 3: Passi -> Attività fisica (da implementare) ===
  aggiornaGraficoPassi(dati);

  // === GRAFICO 4: Benessere (Sonno / Sensazioni) ===
  aggiornaGraficoBenessere(dati);

} // Fine aggiornaGrafici

function aggiornaGraficoPeso(dati, mode = "default") {
  const labels = dati.map(d => d.data);
  const ctx = document.getElementById("chartPeso");

  if (chartPeso) chartPeso.destroy();

  if (mode === "default") {
    // Vista originale: Peso + BMI
    chartPeso = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Peso (kg)",
            data: dati.map(d => d.peso),
            borderWidth: 2,
            borderColor: "#2563eb",
            yAxisID: "y",
            spanGaps: true,
            tension: 0.3,
          },
          {
            label: "BMI",
            data: dati.map(d => d.bmi),
            borderWidth: 2,
            borderColor: "#10b981",
            yAxisID: "y1",
            spanGaps: true,
            tension: 0.3,
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "top" } },
        scales: {
          y: { title: { display: true, text: "Peso (kg)" } },
          y1: { position: "right", title: { display: true, text: "BMI" } }
        }
      }
    });
  }

  else if (mode === "composizione") {
    // Vista alternativa: Massa muscolare + Grasso corporeo
    const parsePercent = v => {
      if (v == null || v === "") return null;
      const num = parseFloat(v);
      return isNaN(num) ? null : num * 100;
    };

    const muscolo = dati.map(d => parsePercent(d.muscolo));
    const grasso = dati.map(d => parsePercent(d.grasso));

    chartPeso = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "% Massa muscolare",
            data: muscolo,
            borderWidth: 2,
            borderColor: "#3b82f6",
            tension: 0.3,
            spanGaps: true,
          },
          {
            label: "% Grasso corporeo",
            data: grasso,
            borderWidth: 2,
            borderColor: "#ef4444",
            tension: 0.3,
            spanGaps: true,
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "top" } },
        scales: {
          y: { min: 15, max: 50, title: { display: true, text: "%" } }
        }
      }
    });
  }
}

function aggiornaGraficoKcal(dati, mode = "default") {
  const ctx = document.getElementById("chartKcal");
  if (chartKcal) chartKcal.destroy();

  // === VISTA 1: Default ===
  if (mode === "default") {
    const labels = dati.map(d => d.data);
    const kcal = dati.map(d => d.kcal);

    // Colori weekend
    const backgroundColors = dati.map(d => {
      const [gg, mm, aaaa] = d.data.split("/");
      const day = new Date(`${aaaa}-${mm}-${gg}`).getDay();
      return (day === 0 || day === 6)
        ? "rgba(249, 115, 22, 0.6)"
        : "rgba(37, 99, 235, 0.5)";
    });

    chartKcal = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Kcal giornaliere",
          data: kcal,
          backgroundColor: backgroundColors,
          borderColor: "#2563eb",
          borderWidth: 1,
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "Kcal" } }
        },
        plugins: {
          legend: { display: false },
          annotation: {
            annotations: {
              fabbisogno: {
                type: 'line',
                yMin: DAILY_KCAL_TARGET,
                yMax: DAILY_KCAL_TARGET,
                borderColor: 'rgba(220,38,38,0.8)',
                borderWidth: 2,
                borderDash: [6, 6],
                label: {
                  enabled: true,
                  content: `Fabbisogno medio ${DAILY_KCAL_TARGET} kcal`,
                  position: 'end',
                  color: '#dc2626',
                  backgroundColor: 'rgba(220,38,38,0.1)',
                }
              }
            }
          }
        }
      }
    });

    // Aggiorna saldo calorico sotto al grafico
    const kcalValidi = kcal.filter(Boolean);
    const mediaKcalPeriodo = kcalValidi.reduce((a,b)=>a+b,0) / kcalValidi.length;
    const differenza = mediaKcalPeriodo - DAILY_KCAL_TARGET;
    const saldoEl = document.getElementById("saldoKcal");

    if (!isNaN(differenza)) {
      let messaggio, colore;
      if (Math.abs(differenza) < DAILY_KCAL_TARGET_TOLERANCE) {
        messaggio = `⚖️ Bilanciato – apporto medio vicino al fabbisogno (${mediaKcalPeriodo.toFixed(0)} kcal)`;
        colore = "text-blue-600";
      } else if (differenza < 0) {
        messaggio = `📉 Deficit medio di ${Math.abs(differenza).toFixed(0)} kcal/giorno`;
        colore = "text-green-600";
      } else {
        messaggio = `📈 Surplus medio di ${differenza.toFixed(0)} kcal/giorno`;
        colore = "text-red-600";
      }
      saldoEl.textContent = messaggio;
      saldoEl.className = `mt-3 text-center text-sm font-semibold ${colore}`;
    } else {
      saldoEl.textContent = "–";
    }

    return; // fine vista default
  }

  // === VISTA 2: Distribuzione per pasto (torta) ===
  if (mode === "distribuzione") {
    const pasti = [
      { label: "Colazione", key: "kcalColazione", color: "#3b82f6" },
      { label: "Snack Mattutino", key: "kcalSnackMattutino", color: "#a855f7" },
      { label: "Pranzo", key: "kcalPranzo", color: "#10b981" },
      { label: "Snack Pomeridiano", key: "kcalSnackPomeridiano", color: "#f59e0b" },
      { label: "Cena", key: "kcalCena", color: "#f97316" },
      { label: "Snack Serale", key: "kcalSnackSerale", color: "#ec4899" },
    ];

    const totali = pasti.map(p =>
      dati.map(d => d[p.key] || 0).reduce((a, b) => a + b, 0)
    );
    const sommaTot = totali.reduce((a,b)=>a+b,0);
    const labels = pasti.map(p => p.label);
    const colors = pasti.map(p => p.color);

    chartKcal = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data: totali,
          backgroundColor: colors,
          borderColor: "#fff",
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        aspectRatio: 1.4,
        cutout: "55%",
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.parsed;
                const perc = ((v / sommaTot) * 100).toFixed(1);
                return `${ctx.label}: ${v.toFixed(0)} kcal (${perc}%)`;
              }
            }
          },
          // ✅ ATTIVA DATI SEMPRE VISIBILI
          datalabels: {
            color: "#fff",
            font: {
              weight: "bold",
              size: 12
            },
            formatter: (value, ctx) => {
              const perc = (value / sommaTot) * 100;
              return perc >= 4 ? `${perc.toFixed(0)}%` : ""; // mostra solo se >4%
            }
          }
        }
      },
      plugins: [ChartDataLabels] // ✅ registra il plugin
    });


    document.getElementById("saldoKcal").textContent =
      "📊 Distribuzione totale kcal per pasto nel periodo selezionato";

    return;
  }

  // === VISTA 3: Confronto feriali vs weekend ===
  if (mode === "confronto") {
    const pasti = [
      { label: "Colazione", key: "kcalColazione", color: "#3b82f6" },
      { label: "Snack Mattutino", key: "kcalSnackMattutino", color: "#a855f7" },
      { label: "Pranzo", key: "kcalPranzo", color: "#10b981" },
      { label: "Snack Pomeridiano", key: "kcalSnackPomeridiano", color: "#f59e0b" },
      { label: "Cena", key: "kcalCena", color: "#f97316" },
      { label: "Snack Serale", key: "kcalSnackSerale", color: "#ec4899" },
    ];

    // Divide dati tra feriali e weekend
    const isWeekend = d => {
      const [gg, mm, aaaa] = d.data.split("/");
      const day = new Date(`${aaaa}-${mm}-${gg}`).getDay();
      return day === 0 || day === 6;
    };
    const feriali = dati.filter(d => !isWeekend(d));
    const weekend = dati.filter(d => isWeekend(d));

    const media = arr => arr.filter(Boolean).reduce((a,b)=>a+b,0) / arr.filter(Boolean).length;

    const kcalFeriali = pasti.map(p => media(feriali.map(d => d[p.key])));
    const kcalWeekend = pasti.map(p => media(weekend.map(d => d[p.key])));

    chartKcal = new Chart(ctx, {
      type: "bar",
      data: {
        labels: pasti.map(p => p.label),
        datasets: [
          {
            label: "Feriali",
            data: kcalFeriali,
            backgroundColor: "rgba(37, 99, 235, 0.6)",
          },
          {
            label: "Weekend",
            data: kcalWeekend,
            backgroundColor: "rgba(249, 115, 22, 0.6)",
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(0)} kcal`
            }
          }
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "Kcal medie per pasto" } }
        }
      }
    });

    document.getElementById("saldoKcal").textContent =
      "📆 Confronto medio kcal per pasto: feriali vs weekend";
  }
}


function aggiornaGraficoPassi(dati, mode = "default") {
  const ctx = document.getElementById("chartPassi");
  if (chartPassi) chartPassi.destroy();

  // === VISTA 1: Passi giornalieri (default) ===
  if (mode === "default") {
    const labels = dati.map(d => d.data);
    const passi = dati.map(d => d.passi);
    const backgroundColors = dati.map(d => {
      const [gg, mm, aaaa] = d.data.split("/");
      const day = new Date(`${aaaa}-${mm}-${gg}`).getDay();
      return (day === 0 || day === 6)
        ? "rgba(249, 115, 22, 0.6)" // weekend
        : "rgba(37, 99, 235, 0.5)"; // feriali
    });

    chartPassi = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Passi giornalieri",
          data: passi,
          backgroundColor: backgroundColors,
          borderColor: "#2563eb",
          borderWidth: 1,
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "Numero di passi" } }
        },
        plugins: { legend: { display: false } }
      }
    });

    // === Riepilogo sintetico anche per la vista "Passi" ===
    const passiValidi = passi.filter(Boolean);

    if (passiValidi.length) {
      const media = passiValidi.reduce((a, b) => a + b, 0) / passiValidi.length;

      let livello, colore, emoji;
      if (media >= 10000) { livello = "Ottimo"; colore = "text-green-600"; emoji = "🏆"; }
      else if (media >= 8000) { livello = "Buono"; colore = "text-blue-600"; emoji = "🚶‍♂️"; }
      else if (media >= 5000) { livello = "Basso"; colore = "text-yellow-600"; emoji = "⚠️"; }
      else { livello = "Molto basso"; colore = "text-red-600"; emoji = "🛋️"; }

      const riepilogoEl = document.getElementById("riepilogoAttivita");
      riepilogoEl.className = `mt-3 text-center text-sm font-semibold ${colore}`;
      riepilogoEl.textContent = `${emoji} Media ${media.toFixed(0)} passi/giorno — livello ${livello}`;
    }

    return;
  }

  // === VISTA 2: Attività fisica (Kcal consumate) ===
    if (mode === "attivita") {

      // Livelli di attività predefiniti, per il grafico
      const livelloAlto = 500;
      const livelloMedio = 250;

      const labels = dati.map(d => d.data);
      const kcal = dati.map(d => Number(d.kcalConsumate) || 0);

      // Media mobile (rolling) su N giorni: per i primi giorni usa finestra "parziale"
      const rollingAverage = (values, window = 7) => {
        return values.map((_, i) => {
          const start = Math.max(0, i - window + 1);
          const slice = values.slice(start, i + 1);
          const sum = slice.reduce((a, b) => a + b, 0);
          return sum / slice.length;
        });
      };

      const kcalMA7 = rollingAverage(kcal, 7);

      // Definizione soglie e colori
      const backgroundColors = kcal.map(v => {
        if (v >= livelloAlto) return "rgba(34,197,94,0.8)";   // verde - alta attività
        if (v >= livelloMedio) return "rgba(234,179,8,0.8)";  // giallo - moderata
        return "rgba(239,68,68,0.8)";                         // rosso - bassa
      });

      chartPassi = new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [{
            label: "Kcal consumate",
            data: kcal,
            backgroundColor: backgroundColors,
            borderColor: "#fff",
            borderWidth: 1,
          },
          {
            label: "Media mobile 7gg",
            data: kcalMA7,
            type: "line",
            borderColor: "#2563eb",
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.3,
            yAxisID: "y",
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: "Kcal consumate" }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const val = ctx.parsed.y;
                  if (ctx.dataset.label === "Media mobile 7gg") {
                    return `Media 7gg: ${val.toFixed(0)} kcal`;
                  }
                  return `${val.toFixed(0)} kcal`;
                }
              }
            }
          }
        }
      });

      // === Riepilogo sintetico ===
      const kcalValidi = kcal.filter(v => Number.isFinite(v) && v > 0);
      const media = kcalValidi.length
        ? kcalValidi.reduce((a, b) => a + b, 0) / kcalValidi.length
        : 0;

      let livello, colore, emoji;
      if (media >= livelloAlto) { livello = "Alta attività"; colore = "text-green-600"; emoji = "💪"; }
      else if (media >= livelloMedio) { livello = "Moderata"; colore = "text-yellow-600"; emoji = "🏃"; }
      else { livello = "Bassa"; colore = "text-red-600"; emoji = "🛋"; }

      document.getElementById("riepilogoAttivita").className = `mt-3 text-center text-sm font-semibold ${colore}`;
      document.getElementById("riepilogoAttivita").textContent =
        `${emoji} Media ${media.toFixed(0)} kcal/giorno — livello ${livello}`;
    }
}


let chartBenessere;

function aggiornaGraficoBenessere(dati, mode = "default") {
  const ctx = document.getElementById("chartBenessere");
  const riepilogoEl = document.getElementById("riepilogoBenessere");
  if (!ctx) return;
  if (chartBenessere) chartBenessere.destroy();
  riepilogoEl.textContent = "";

  // === VISTA 1: ORE DI SONNO ===
  if (mode === "default") {
    const labels = dati.map(d => d.data);
    const ore = dati.map(d => {
      const [hh, mm] = (d.sonno || "0:0").split(":");
      return parseInt(hh) + (parseInt(mm) / 60);
    }).filter(v => !isNaN(v) && v > 0);

    const backgroundColors = dati.map(d => {
      const [gg, mm, aaaa] = d.data.split("/");
      const day = new Date(`${aaaa}-${mm}-${gg}`).getDay();
      return (day === 0 || day === 6)
        ? "rgba(249,115,22,0.6)"  // weekend
        : "rgba(37,99,235,0.5)";  // feriali
    });

    const oreConsigliate = 7;

    chartBenessere = new Chart(ctx, {
      type: "bar",
      data: {
        labels: dati.map(d => d.data),
        datasets: [{
          label: "Ore di sonno",
          data: dati.map(d => {
            const [hh, mm] = (d.sonno || "0:0").split(":");
            return parseInt(hh) + (parseInt(mm) / 60);
          }),
          backgroundColor: backgroundColors,
          borderColor: "#2563eb",
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax: 10,
            title: { display: true, text: "Ore di sonno" }
          }
        },
        plugins: {
          legend: { display: false },
          annotation: {
            annotations: {
              soglia: {
                type: 'line',
                yMin: oreConsigliate,
                yMax: oreConsigliate,
                borderColor: 'rgba(220,38,38,0.8)',
                borderWidth: 2,
                borderDash: [6, 6],
                label: {
                  enabled: true,
                  content: `Soglia consigliata: ${oreConsigliate}h`,
                  position: 'end',
                  color: '#dc2626',
                  backgroundColor: 'rgba(220,38,38,0.1)',
                }
              }
            }
          }
        }
      }
    });

    // Media ore sonno nel periodo
    if (ore.length) {
      const media = ore.reduce((a,b)=>a+b,0)/ore.length;
      riepilogoEl.innerHTML = `
        😴 <strong>Media ore di sonno:</strong> ${media.toFixed(1)}h<br>
        📊 Barre colorate = feriali (blu) / weekend (arancioni)
      `;
    } else {
      riepilogoEl.textContent = "ℹ️ Nessun dato disponibile sul sonno";
    }

    return;
  }

  // === VISTA 2: SENSAZIONI (1–5) ===
  if (mode === "sensazioni") {
    const labels = dati.map(d => d.data);
    const sensazioni = dati.map(d => parseFloat(d.sensazioni) || null);

    chartBenessere = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Sensazioni (1–5)",
          data: sensazioni,
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245,158,11,0.2)",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: "#f59e0b"
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            min: 0,
            max: 5,
            ticks: { stepSize: 1 },
            title: { display: true, text: "Livello sensazione" }
          }
        },
        plugins: {
          legend: { position: "top" },
          tooltip: {
            callbacks: {
              label: ctx => `Sensazione: ${ctx.parsed.y.toFixed(1)}`
            }
          }
        }
      }
    });

    const media = sensazioni.filter(Boolean);
    if (media.length) {
      const m = media.reduce((a, b) => a + b, 0) / media.length;
      riepilogoEl.textContent = `😊 Media sensazioni periodo: ${m.toFixed(2)} / 5`;
    } else {
      riepilogoEl.textContent = "ℹ️ Nessun dato di sensazioni disponibile";
    }
    return;
  }

  // === VISTA 3: CORRELAZIONE SONNO ↔ SENSAZIONI ===
  if (mode === "correlazione") {
    const punti = dati
      .map(d => {
        const [hh, mm] = (d.sonno || "0:0").split(":");
        const ore = parseInt(hh) + (parseInt(mm) / 60);
        const sens = parseFloat(d.sensazioni);
        return (!isNaN(ore) && !isNaN(sens)) ? { x: ore, y: sens, label: d.data } : null;
      })
      .filter(Boolean);

    if (punti.length >= 3) {
      const xs = punti.map(p => p.x);
      const ys = punti.map(p => p.y);
      const meanX = xs.reduce((a,b)=>a+b,0)/xs.length;
      const meanY = ys.reduce((a,b)=>a+b,0)/ys.length;
      const num = xs.reduce((sum,i,idx)=>sum + (i-meanX)*(ys[idx]-meanY),0);
      const den = Math.sqrt(xs.reduce((s,i)=>s+(i-meanX)**2,0) * ys.reduce((s,i)=>s+(i-meanY)**2,0));
      const corr = num/den;

      let emoji = corr > 0.5 ? "🟢" : corr < -0.5 ? "🔴" : "🟡";
      riepilogoEl.textContent = `${emoji} Correlazione stimata (Pearson r): ${corr.toFixed(2)} — `;
      riepilogoEl.textContent += corr > 0
        ? "più dormi → migliori sensazioni"
        : corr < 0
          ? "più dormi → peggiori sensazioni (!)"
          : "nessuna relazione evidente";
    } else {
      riepilogoEl.textContent = "ℹ️ Dati insufficienti per calcolare la correlazione";
    }

    chartBenessere = new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: [{
          label: "Correlazione sonno ↔ sensazioni",
          data: punti,
          backgroundColor: "rgba(37,99,235,0.6)",
          borderColor: "#2563eb",
          pointRadius: 5
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `📅 ${ctx.raw.label} → ${ctx.raw.x.toFixed(1)}h / sensazione ${ctx.raw.y}`
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: "Ore di sonno" },
            min: 4,
            max: 10
          },
          y: {
            title: { display: true, text: "Sensazioni (1–5)" },
            min: 0,
            max: 5,
            ticks: { stepSize: 1 }
          }
        }
      }
    });
  }
}



// === TABELLA ===
function aggiornaTabellaResponsive(dati) {
  const tbody = document.querySelector("#dailyTable tbody");
  tbody.innerHTML = "";

  const isMobile = window.innerWidth < 768; // breakpoint mobile (tailwind: md)

  // Ordina i dati dalla più recente alla più vecchia
  const datiOrdinati = [...dati].sort((a, b) => {
    const [ga, ma, aa] = a.data.split("/");
    const [gb, mb, ab] = b.data.split("/");
    return new Date(`${ab}-${mb}-${gb}`) - new Date(`${aa}-${ma}-${ga}`);
  });

  datiOrdinati.forEach((d) => {
    if (!isMobile) {
      // --- DESKTOP / TABLET: tabella classica ---
      const tr = document.createElement("tr");
      tr.classList.add("cursor-pointer", "hover:bg-gray-50", "transition-colors");

      tr.innerHTML = `
        <td class="border p-2 flex items-center gap-2">
          <span class="transition-transform duration-200 text-gray-500">▶</span>
          <span>${d.data}</span>
        </td>
        <td class="border p-2 text-center">${d.kcalRange || "-"}</td>
        <td class="border p-2 text-right">${d.passi ?? "-"}</td>
        <td class="border p-2 text-center">${d.sonno || "-"}</td>
        <td class="border p-2 text-center">${d.sensazioni ?? "-"}</td>
        <td class="border p-2">${d.valutazione || "-"}</td>
      `;

      const dettaglioTr = document.createElement("tr");
      dettaglioTr.classList.add("hidden", "bg-gray-50");
      const dettaglioTd = creaDettaglioCell(d);
      dettaglioTr.appendChild(dettaglioTd);

      const freccia = tr.querySelector("span:first-child");
      tr.addEventListener("click", () => {
        dettaglioTr.classList.toggle("hidden");
        freccia.style.transform = dettaglioTr.classList.contains("hidden")
          ? "rotate(0deg)"
          : "rotate(90deg)";
        if (!dettaglioTr.classList.contains("hidden")) {
          tr.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });

      tbody.appendChild(tr);
      tbody.appendChild(dettaglioTr);

    } else {

      // --- MOBILE: card singola + dettaglio nascosto ---
      const cardTr = document.createElement("tr");
      const cardTd = document.createElement("td");
      cardTd.colSpan = 6;

      cardTd.className =
      "w-full max-w-[100vw] box-border border p-3 rounded-lg bg-white shadow-sm mb-2 cursor-pointer transition hover:bg-gray-50";


      cardTd.innerHTML = `
        <div class="flex justify-between items-center">
          <span class="font-semibold">📅 ${d.data}</span>
          <span class="text-gray-500 text-sm">${d.sensazioni !== "-" ? `😊 ${d.sensazioni}` : ""}</span>
        </div>
        <div class="text-sm mt-1">
          🔥 ${d.kcalRange || "-"} | 🚶 ${d.passi ?? "-"}
        </div>
        <div class="text-sm mt-1">
          😴 ${d.sonno || "-"}
        </div>
        <div class="text-xs mt-2 text-gray-700 whitespace-pre-wrap break-words">
          💬 ${d.valutazione || "-"}
        </div>
      `;

      // Riga dettaglio nascosta di default
      const dettaglioTr = document.createElement("tr");
      dettaglioTr.classList.add("hidden", "bg-gray-50");
      const dettaglioTd = creaDettaglioCell(d);
      dettaglioTr.appendChild(dettaglioTd);

      cardTd.addEventListener("click", () => {
        dettaglioTr.classList.toggle("hidden");
        cardTd.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      cardTr.appendChild(cardTd);
      tbody.appendChild(cardTr);
      tbody.appendChild(dettaglioTr);
    }
  });
}

// --- 🔧 Funzione helper: crea la cella dei dettagli (responsive grid) ---
function creaDettaglioCell(d) {

    // Calcolo distribuzione Kcal per pasto
    const pasti = [
      { label: "Colazione", kcal: d.kcalColazione },
      { label: "Snack Mattutino", kcal: d.kcalSnackMattutino },
      { label: "Pranzo", kcal: d.kcalPranzo },
      { label: "Snack Pomeridiano", kcal: d.kcalSnackPomeridiano },
      { label: "Cena", kcal: d.kcalCena },
      { label: "Snack Serale", kcal: d.kcalSnackSerale },
    ];

    const tot = pasti.reduce((s, p) => s + (p.kcal || 0), 0);

    // Colori distinti per ogni pasto
    const colors = ["#3b82f6", "#a855f7", "#10b981", "#f59e0b", "#f97316", "#ec4899"];

    // Crea barra colorata
    let barraDistribuzione = "";

    if (tot > 0) {
      const segmenti = pasti.map((p, i) => {
        const perc = ((p.kcal || 0) / tot) * 100;
        if (!perc) return "";
        // Ogni sezione: barra + etichetta
        return `
          <div class="flex flex-col items-center" style="width:${perc}%;">
            <div title="${p.kcal} Kcal" style="background:${colors[i]}; height:12px; width:100%; border-radius:2px;"></div>
            <span class="text-[10px] text-gray-600 mt-1 whitespace-nowrap">
              ${p.label.split(" ")[0]} ${Math.round(perc)}%
            </span>
          </div>
        `;
      }).join("");

      barraDistribuzione = `
        <div class="mt-4">
          <p class="text-xs text-gray-600 text-center mt-2">Distribuzione kcal giornaliera</p>

          <div class="flex justify-between items-end w-full text-center">
            ${segmenti}
          </div>
        </div>
      `;
    }


  const td = document.createElement("td");
  td.colSpan = 6;
  td.className = "p-4 text-sm text-gray-700 leading-relaxed";

  // layout responsivo: 2 colonne su desktop, 1 colonna su mobile
  td.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
      <div><strong>🍽 Colazione:</strong> ${d.colazione || "-"}</div>
      <div><strong>🥤 Snack Mattutino:</strong> ${d.snackMattutino || "-"}</div>
      <div><strong>🍝 Pranzo:</strong> ${d.pranzo || "-"}</div>
      <div><strong>🍪 Snack Pomeridiano:</strong> ${d.snackPomeridiano || "-"}</div>
      <div><strong>🍲 Cena:</strong> ${d.cena || "-"}</div>
      <div><strong>🍫 Snack Serale:</strong> ${d.snackSerale || "-"}</div>
      <div class="col-span-1 sm:col-span-2"><strong>🏃‍♂️ Attività fisica:</strong> ${d.attivita || "-"}</div>
      <div class="col-span-1 sm:col-span-2"><strong>📝 Note / Eventi:</strong> ${d.note || "-"}</div>

      <div class="col-span-1 sm:col-span-2">${barraDistribuzione}</div>
    </div>
  `;
  return td;
}


// === RIEPILOGO ===
function aggiornaRiepilogo(dati, mode = "default") {
  if (!dati.length) return;

  const media = arr => arr.filter(Boolean).reduce((a, b) => a + b, 0) / arr.filter(Boolean).length;

  const peso = media(dati.map(d => d.peso));
  const kcal = media(dati.map(d => d.kcal));
  const passi = media(dati.map(d => d.passi));

  const div = document.getElementById("summary");
  div.className = "grid grid-cols-2 sm:grid-cols-4 gap-3 text-center";

  if (mode === "default") {
    div.innerHTML = `
      <div class="bg-blue-50 rounded-lg p-3">
        <p class="font-semibold">Peso medio</p>
        <p>${peso ? peso.toFixed(1) + " kg" : "-"}</p>
      </div>
      <div class="bg-green-50 rounded-lg p-3">
        <p class="font-semibold">Kcal medie</p>
        <p>${kcal ? kcal.toFixed(0) : "-"}</p>
      </div>
      <div class="bg-orange-50 rounded-lg p-3">
        <p class="font-semibold">Passi medi</p>
        <p>${passi ? passi.toFixed(0) : "-"}</p>
      </div>
      <div class="bg-purple-50 rounded-lg p-3">
        <p class="font-semibold">Giorni considerati</p>
        <p>${dati.length}</p>
      </div>
    `;

    // Aggiorna il titolo
    const titolo = document.getElementById("titoloSummary");
    titolo.textContent = "📊 Vista: Riepilogo periodo selezionato"
  }

  else if (mode === "settimana") {
    // Media mobile 7 giorni (semplificata)
    const media7d = arr => arr.map((_, i) => {
      const start = Math.max(0, i - 6);
      const sub = arr.slice(start, i + 1).filter(Boolean);
      return sub.length ? sub.reduce((a,b)=>a+b,0)/sub.length : null;
    });

    const kcal7 = media7d(dati.map(d=>d.kcal));
    const passi7 = media7d(dati.map(d=>d.passi));
    const peso7 = media7d(dati.map(d=>d.peso));

    div.innerHTML = `
      <div class="bg-blue-50 rounded-lg p-3">
        <p class="font-semibold">Peso (media mobile 7gg)</p>
        <p>${peso7.at(-1)?.toFixed(1) || "-"}</p>
      </div>
      <div class="bg-green-50 rounded-lg p-3">
        <p class="font-semibold">Kcal (media mobile 7gg)</p>
        <p>${kcal7.at(-1)?.toFixed(0) || "-"}</p>
      </div>
      <div class="bg-orange-50 rounded-lg p-3">
        <p class="font-semibold">Passi (media mobile 7gg)</p>
        <p>${passi7.at(-1)?.toFixed(0) || "-"}</p>
      </div>
      <div class="bg-purple-50 rounded-lg p-3">
        <p class="font-semibold">Ultima data</p>
        <p>${dati.at(-1).data}</p>
      </div>
    `;

    // Aggiorna il titolo
    const titolo = document.getElementById("titoloSummary");
    titolo.textContent = "📅 Vista: Settimana tipo (media mobile 7 giorni)"
  }

  else if (mode === "confronto") {
    // Dividi il periodo in due metà e confronta
    const metà = Math.floor(dati.length / 2);
    const prima = dati.slice(0, metà);
    const seconda = dati.slice(metà);

    const delta = (arr1, arr2, key) => {
      const m1 = media(arr1.map(d => d[key]));
      const m2 = media(arr2.map(d => d[key]));
      return ((m2 - m1) / m1) * 100;
    };

    const dPeso = delta(prima, seconda, "peso");
    const dKcal = delta(prima, seconda, "kcal");
    const dPassi = delta(prima, seconda, "passi");

    const fmt = v => isNaN(v) ? "-" : (v >= 0 ? `📈 +${v.toFixed(1)}%` : `📉 ${v.toFixed(1)}%`);

    div.innerHTML = `
      <div class="bg-blue-50 rounded-lg p-3">
        <p class="font-semibold">Δ Peso</p>
        <p>${fmt(dPeso)}</p>
      </div>
      <div class="bg-green-50 rounded-lg p-3">
        <p class="font-semibold">Δ Kcal</p>
        <p>${fmt(dKcal)}</p>
      </div>
      <div class="bg-orange-50 rounded-lg p-3">
        <p class="font-semibold">Δ Passi</p>
        <p>${fmt(dPassi)}</p>
      </div>
      <div class="bg-purple-50 rounded-lg p-3">
        <p class="font-semibold">Periodi</p>
        <p>${prima.length} vs ${seconda.length} giorni</p>
      </div>
    `;

    // Aggiorna il titolo
    const titolo = document.getElementById("titoloSummary");
    titolo.textContent = "🔁 Vista: Confronto con periodo precedente"
  }
}


// === STATO PERSONALE CORRENTE ===
function aggiornaStatoPersonale(dati) {
  const statoEl = document.getElementById("statoPersonale");
  const suggerimentoEl = document.getElementById("ultimoSuggerimento");
  
  
  if (!dati || !dati.length) {
    statoEl.innerHTML = "";

    // Preserva gli a capo e spazi dal testo Excel
    const suggerimentoFormattato = suggerimento
      ? suggerimento
          .replace(/\r\n|\r|\n/g, '<br>')   // converte \n in <br>
          .replace(/\s{2,}/g, ' ')          // normalizza spazi multipli
      : "";

    suggerimentoEl.innerHTML = suggerimentoFormattato
      ? `💡 <strong>Ultimo suggerimento:</strong><br>${suggerimentoFormattato}`
      : `<span class="text-gray-400 italic">Nessun suggerimento recente disponibile</span>`;

        return;
      }

  // Trova l'ultima riga con un valore realmente valido (non null, non vuoto, non "-")
  const trovaUltimo = (campo) => {
    const riga = [...dati].reverse().find(row => {
      const v = row[campo];
      return (
        v !== null &&
        v !== undefined &&
        String(v).trim() !== "" &&
        String(v).trim() !== "-"
      );
    });
    return riga ? riga[campo] : null;
  };

  // console.log("Ultimo suggerimento trovato:", trovaUltimo("suggerimento"));

  // Recupera i valori più recenti
  const altezza = trovaUltimo("altezza");
  const peso = trovaUltimo("peso");
  const bmi = trovaUltimo("bmi");

  // Conversione % con due decimali
  const toPercent = (v) => {
    if (v == null || v === "") return "-";
    const num = parseFloat(v);
    if (isNaN(num)) return v;
    return `${(num * 100).toFixed(1)}%`;
  };

  const grasso = toPercent(trovaUltimo("grasso"));
  const muscolo = toPercent(trovaUltimo("muscolo"));

  // Suggerimento (con trimming extra)
  const suggerimento = (trovaUltimo("suggerimento") || "").trim();

  // Rendering valori
  statoEl.innerHTML = `
    <div>
      <div class="text-gray-500 text-sm">Altezza</div>
      <div class="text-xl font-semibold">${altezza || "-"}</div>
    </div>
    <div>
      <div class="text-gray-500 text-sm">Peso corrente</div>
      <div class="text-xl font-semibold">${peso || "-"}</div>
    </div>
    <div>
      <div class="text-gray-500 text-sm">BMI corrente</div>
      <div class="text-xl font-semibold">${bmi || "-"}</div>
    </div>
    <div>
      <div class="text-gray-500 text-sm">% Grasso</div>
      <div class="text-xl font-semibold">${grasso}</div>
    </div>
    <div>
      <div class="text-gray-500 text-sm">% Massa muscolare</div>
      <div class="text-xl font-semibold">${muscolo}</div>
    </div>
  `;

  suggerimentoEl.innerHTML = suggerimento
    ? `💡 <strong>Ultimo suggerimento:</strong> ${suggerimento}`
    : `<span class="text-gray-400 italic">Nessun suggerimento recente disponibile</span>`;
}


// === GESTIONE MODAL FULL SCREEN ===

// === Fullscreen universale (fix Recursion detected + supporto table/div) ===
const fullscreenModal = document.getElementById("fullscreenModal");
const fullscreenContent = document.getElementById("fullscreenContent");
const closeFullscreen = document.getElementById("closeFullscreen");

let fullscreenChart = null;

/**
 * Deep clone delle options ma *rimuove* tutte le funzioni.
 * Restituisce un oggetto "safe" per Chart.create senza scriptable functions.
 */
function sanitizeOptions(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "function") return undefined; // esclude funzioni
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(item => sanitizeOptions(item)).filter(i => i !== undefined);

  const out = {};
  for (const key of Object.keys(obj)) {
    try {
      const val = obj[key];
      if (typeof val === "function") {
        // salta completamente le funzioni
        continue;
      }
      // evita di copiare proprietà che possono essere riferimenti circolari evidenti
      const sanitized = sanitizeOptions(val);
      if (sanitized !== undefined) out[key] = sanitized;
    } catch (e) {
      // se qualcosa va storto, ignoriamo quella proprietà
      continue;
    }
  }
  return out;
}

document.querySelectorAll(".fullscreenBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    const section = btn.closest("section");
    if (!section) return;

    // Pulisce il contenuto precedente
    fullscreenContent.innerHTML = "";

    const canvas = section.querySelector("canvas");
    const table = section.querySelector("table");
    const firstDiv = section.querySelector("div");

    // ---------- Grafico Chart.js -------------
    if (canvas) {
      const originalChart = Chart.getChart(canvas);
      if (!originalChart) return;

      // Clona i dati (labels + data) in maniera sicura
      let chartData;
      try {
        chartData = typeof structuredClone === "function"
          ? structuredClone(originalChart.data)
          : JSON.parse(JSON.stringify(originalChart.data));
      } catch (err) {
        // fallback semplice: copia labels e dataset data numerici
        chartData = {
          labels: originalChart.data.labels ? [...originalChart.data.labels] : [],
          datasets: (originalChart.data.datasets || []).map(ds => ({
            label: ds.label,
            data: Array.isArray(ds.data) ? [...ds.data] : [],
            backgroundColor: Array.isArray(ds.backgroundColor) ? [...ds.backgroundColor] : ds.backgroundColor,
            borderColor: Array.isArray(ds.borderColor) ? [...ds.borderColor] : ds.borderColor,
            borderWidth: ds.borderWidth,
            type: ds.type
          }))
        };
      }

      // Crea una versione "safe" delle options rimuovendo le funzioni/scriptable
      const safeOptions = sanitizeOptions(originalChart.options) || {};
      // Forza alcune impostazioni per fullscreen
      safeOptions.responsive = true;
      safeOptions.maintainAspectRatio = false;

      const chartType = originalChart.config && originalChart.config.type ? originalChart.config.type : (originalChart.config && originalChart.config._config && originalChart.config._config.type) || "line";

      // Crea canvas e mostra modal PRIMA del Chart
      const newCanvas = document.createElement("canvas");
      newCanvas.id = "chartFullscreen";
      newCanvas.style.width = "100vw";
      newCanvas.style.height = "85vh";
      fullscreenContent.appendChild(newCanvas);
      fullscreenModal.classList.remove("hidden");

      // Crea il chart nel frame successivo per evitare il problema dimensioni 0
      requestAnimationFrame(() => {
        try {
          // Distruggi eventuale chart precedente
          if (fullscreenChart) {
            try { fullscreenChart.destroy(); } catch(e) {}
            fullscreenChart = null;
          }

          fullscreenChart = new Chart(newCanvas, {
            type: chartType,
            data: chartData,
            options: safeOptions
            // NOTA: non passiamo plugin espliciti qui (Chart usa i plugin registrati globalmente)
          });
        } catch (err) {
          console.error("Errore creando chart fullscreen:", err);
        }
      });

      return;
    }

    // ---------- Tabella ----------
    if (table) {
      const clone = table.cloneNode(true);
      clone.classList.add("w-full");
      fullscreenContent.classList.add("overflow-auto", "p-6");
      fullscreenContent.appendChild(clone);
      fullscreenModal.classList.remove("hidden");
      return;
    }

    // ---------- Altro contenuto ----------
    if (firstDiv) {
      fullscreenContent.classList.remove("overflow-auto", "p-6");
      fullscreenContent.appendChild(firstDiv.cloneNode(true));
      fullscreenModal.classList.remove("hidden");
    }
  });
});

// Chiudi modal
closeFullscreen.addEventListener("click", () => {
  fullscreenModal.classList.add("hidden");
  fullscreenContent.innerHTML = "";
  if (fullscreenChart) {
    try { fullscreenChart.destroy(); } catch(e) {}
    fullscreenChart = null;
  }
});

// === 🔁 Adattamento dinamico layout (mobile ↔ desktop) ===
/*
let lastIsMobile = window.innerWidth < 768;

window.addEventListener("resize", () => {
  const isMobile = window.innerWidth < 768;
  if (isMobile !== lastIsMobile) {
    lastIsMobile = isMobile;

    // Mostra o nasconde il thead in base alla modalità
    const thead = document.querySelector("#dailyTable thead");
    if (thead) thead.style.display = isMobile ? "none" : "table-header-group";

    // Ricalcola la tabella in base alla nuova dimensione
    const filtrati = getDatiFiltrati();
    aggiornaTabellaResponsive(filtrati);
  }
});
*/

// === 🔁 Adattamento dinamico layout (mobile ↔ desktop) ===
let lastIsMobile = window.innerWidth < 768;

function ridisegnaTabellaSeNecessario() {
  const isMobile = window.innerWidth < 768;
  if (isMobile !== lastIsMobile) {
    lastIsMobile = isMobile;

    // Mostra o nasconde il thead in base alla modalità
    const thead = document.querySelector("#dailyTable thead");
    if (thead) thead.style.display = isMobile ? "none" : "table-header-group";

    // Ricalcola la tabella
    const filtrati = getDatiFiltrati();
    aggiornaTabellaResponsive(filtrati);
  }
}

// Listener principale su resize
window.addEventListener("resize", () => {
  // piccola attesa per permettere il ricalcolo del viewport
  clearTimeout(window._resizeTimer);
  window._resizeTimer = setTimeout(ridisegnaTabellaSeNecessario, 200);
});

// Gestione orientamento mobile
window.addEventListener("orientationchange", () => {
  // forza il ridisegno dopo un breve delay
  setTimeout(ridisegnaTabellaSeNecessario, 300);
});



// === AVVIO ===
initFoodCostSearch();
caricaDati();
