// === CONFIGURAZIONE ===
const SHEET_ID = "1VITx37L378SVjvHV0cfYBeu0cqMZG7pe7bPgVuGP4uc";
const SHEET_NAME = "Foglio1"; // aggiorna se diverso
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`;

let datiTotali = [];
let chartPeso, chartKcal, chartPassi;

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
    ? "📈 Andamento Peso / BMI"
    : "🧍‍♂️ Composizione corporea (% Grasso / % Muscolo)";
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
        ? "🥧 Distribuzione Kcal per pasto (periodo selezionato)"
        : "📆 Confronto Kcal per pasto (feriali vs weekend)";
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
    ? "🚶 Passi giornalieri"
    : "🔥 Attività fisica (Kcal consumate)";
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
  aggiornaTabella(filtrati);
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
          y: { beginAtZero: true, title: { display: true, text: "%" } }
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
    const fabbisognoMedio = 2200;

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
                yMin: fabbisognoMedio,
                yMax: fabbisognoMedio,
                borderColor: 'rgba(220,38,38,0.8)',
                borderWidth: 2,
                borderDash: [6, 6],
                label: {
                  enabled: true,
                  content: `Fabbisogno medio ${fabbisognoMedio} kcal`,
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
    const differenza = mediaKcalPeriodo - fabbisognoMedio;
    const saldoEl = document.getElementById("saldoKcal");

    if (!isNaN(differenza)) {
      let messaggio, colore;
      if (Math.abs(differenza) < 50) {
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

    document.getElementById("riepilogoAttivita").textContent = "";
    return;
  }

  // === VISTA 2: Attività fisica (Kcal consumate) ===
  if (mode === "attivita") {
    const labels = dati.map(d => d.data);
    const kcal = dati.map(d => d.kcalConsumate || 0);

    // Definizione soglie e colori
    const backgroundColors = kcal.map(v => {
      if (v >= 500) return "rgba(34,197,94,0.8)";   // verde - alta attività
      if (v >= 250) return "rgba(234,179,8,0.8)";   // giallo - moderata
      return "rgba(239,68,68,0.8)";                 // rosso - bassa
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
              label: ctx => `${ctx.parsed.y.toFixed(0)} kcal`
            }
          }
        }
      }
    });

    // === Riepilogo sintetico ===
    const media = kcal.filter(Boolean).reduce((a,b)=>a+b,0) / kcal.filter(Boolean).length;
    let livello, colore, emoji;
    if (media >= 500) { livello = "Alta attività"; colore = "text-green-600"; emoji = "💪"; }
    else if (media >= 250) { livello = "Moderata"; colore = "text-yellow-600"; emoji = "🏃"; }
    else { livello = "Bassa"; colore = "text-red-600"; emoji = "🛋"; }

    document.getElementById("riepilogoAttivita").className = `mt-3 text-center text-sm font-semibold ${colore}`;
    document.getElementById("riepilogoAttivita").textContent =
      `${emoji} Media ${media.toFixed(0)} kcal/giorno — livello ${livello}`;
  }
}



// === TABELLA ===
function aggiornaTabella(dati) {
  const tbody = document.querySelector("#dailyTable tbody");
  tbody.innerHTML = "";

  // Ordina i dati dalla più recente alla più vecchia
  const datiOrdinati = [...dati].sort((a, b) => {
    const [ga, ma, aa] = a.data.split("/");
    const [gb, mb, ab] = b.data.split("/");
    return new Date(`${ab}-${mb}-${gb}`) - new Date(`${aa}-${ma}-${ga}`);
  });

  datiOrdinati.forEach((d) => {
    // Riga principale (riepilogo)
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

    // Riga dettaglio (inizialmente nascosta)
    const dettaglio = document.createElement("tr");
    dettaglio.classList.add("hidden", "bg-gray-50");

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
            <div style="background:${colors[i]}; height:12px; width:100%; border-radius:2px;"></div>
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


    dettaglio.innerHTML = `
      <td colspan="6" class="p-4 text-sm text-gray-700 leading-relaxed">
        <div class="grid grid-cols-2 gap-x-6 gap-y-2">
          <div><strong>🍽 Colazione:</strong> ${d.colazione || "-"}</div>
          <div><strong>🥤 Snack Mattutino:</strong> ${d.snackMattutino || "-"}</div>
          <div><strong>🍝 Pranzo:</strong> ${d.pranzo || "-"}</div>
          <div><strong>🍪 Snack Pomeridiano:</strong> ${d.snackPomeridiano || "-"}</div>
          <div><strong>🍲 Cena:</strong> ${d.cena || "-"}</div>
          <div><strong>🍫 Snack Serale:</strong> ${d.snackSerale || "-"}</div>
          <div class="col-span-2"><strong>🏃‍♂️ Attività fisica:</strong> ${d.attivita || "-"}</div>
          <div class="col-span-2"><strong>📝 Note / Eventi:</strong> ${d.note || "-"}</div>
        </div>

        ${barraDistribuzione}
      </td>
    `;


    // Gestione click per apertura/chiusura
    const freccia = tr.querySelector("span:first-child");
    tr.addEventListener("click", () => {
      dettaglio.classList.toggle("hidden");
      freccia.style.transform = dettaglio.classList.contains("hidden")
        ? "rotate(0deg)"
        : "rotate(90deg)";
    });

    tbody.appendChild(tr);
    tbody.appendChild(dettaglio);
  });
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
      <div class="col-span-4 text-center text-sm text-gray-500 mt-2">
        📊 Vista: Riepilogo periodo selezionato
      </div>
    `;
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
      <div class="col-span-4 text-center text-sm text-gray-500 mt-2">
        📅 Vista: Settimana tipo (media mobile 7 giorni)
      </div>
    `;
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
      <div class="col-span-4 text-center text-sm text-gray-500 mt-2">
        🔁 Vista: Confronto con periodo precedente
      </div>
    `;
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



// === AVVIO ===
caricaDati();
