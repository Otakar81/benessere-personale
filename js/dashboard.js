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
		sonno: r.c[23]?.v || "",                    // Sonno (X)
		sensazioni: r.c[24]?.v || "-",              // Sensazioni (Y)
		valutazione: r.c[26]?.v || "-",             // Valutazione giornata (AA)
		suggerimento: r.c[27]?.v || "-",             // Suggerimenti di miglioramento (AB)

		// Box completo
		colazione: r.c[7]?.v || "",                 // H
		snackMattutino: r.c[9]?.v || "",            // J
		pranzo: r.c[11]?.v || "",                   // L
		snackPomeridiano: r.c[13]?.v || "",         // N
		cena: r.c[15]?.v || "",                     // P
		snackSerale: r.c[17]?.v || "",              // R
		attivita: r.c[22]?.v || "",                 // W (Attività fisica)
		note: r.c[25]?.v || ""                      // Z (Note/Eventi)
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
}

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

  // Peso/BMI
  if (chartPeso) chartPeso.destroy();
  
  chartPeso = new Chart(document.getElementById("chartPeso"), {
	  type: "line",
	  data: {
		labels,
		datasets: [
		  {
			label: "Peso (kg)",
			data: peso,
			borderWidth: 2,
			borderColor: "#2563eb",
			yAxisID: "y",
			spanGaps: true, // ✅ unisce i punti
			tension: 0.3,   // ✅ curva più morbida
		  },
		  {
			label: "BMI",
			data: bmi,
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
		scales: {
		  y: { beginAtZero: false },
		  y1: { position: "right", beginAtZero: false }
		}
	  }
	});

  // Kcal/Passi
  
  // === GRAFICO 1: Kcal ===
  const fabbisognoMedio = 2200;
  
  if (chartKcal) chartKcal.destroy();

  chartKcal = new Chart(document.getElementById("chartKcal"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Kcal giornaliere",
          data: kcal,
          backgroundColor: "rgba(37, 99, 235, 0.5)",
          borderColor: "#2563eb",
          borderWidth: 1,
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: "Kcal" },
        }
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
                backgroundColor: 'rgba(220,38,38,0.1)',
                color: '#dc2626',
                font: { style: 'italic' }
              }
            }
          }
        }
      }
    }
  });
  
    // Calcolo saldo calorico medio rispetto al fabbisogno
	const mediaKcalPeriodo = kcal.filter(Boolean).reduce((a, b) => a + b, 0) / kcal.filter(Boolean).length;
	const differenza = mediaKcalPeriodo - fabbisognoMedio;

	const saldoEl = document.getElementById("saldoKcal");

	if (!isNaN(differenza)) {
	  let messaggio = "";
	  let colore = "";

	  if (Math.abs(differenza) < 50) {
		messaggio = `⚖️ Bilanciato – apporto medio vicino al fabbisogno (${mediaKcalPeriodo.toFixed(0)} kcal)`;
		colore = "text-blue-600";
	  } else if (differenza < 0) {
		messaggio = `📉 Deficit medio di ${(Math.abs(differenza)).toFixed(0)} kcal/giorno (${mediaKcalPeriodo.toFixed(0)} kcal)`;
		colore = "text-green-600";
	  } else {
		messaggio = `📈 Surplus medio di ${differenza.toFixed(0)} kcal/giorno (${mediaKcalPeriodo.toFixed(0)} kcal)`;
		colore = "text-red-600";
	  }

	  saldoEl.textContent = messaggio;
	  saldoEl.className = `mt-3 text-center text-sm font-semibold ${colore}`;
	} else {
	  saldoEl.textContent = "–";
	}


  // === GRAFICO 2: Passi ===
  const passiMin = 8000;
  const passiMax = 10000;
  
  if (chartPassi) chartPassi.destroy();

	// Calcolo media mobile a 7 giorni
	function mediaMobile(arr, finestra = 7) {
	  return arr.map((_, i) => {
		const start = Math.max(0, i - finestra + 1);
		const subset = arr.slice(start, i + 1).filter(v => v != null);
		if (!subset.length) return null;
		const media = subset.reduce((a, b) => a + b, 0) / subset.length;
		return Math.round(media);
	  });
	}

	const passiMedia7 = mediaMobile(passi);

	chartPassi = new Chart(document.getElementById("chartPassi"), {
	  type: "bar",
	  data: {
		labels,
		datasets: [
		  {
			label: "Passi giornalieri",
			data: passi,
			backgroundColor: "rgba(249, 115, 22, 0.5)",
			borderColor: "#f97316",
			borderWidth: 1,
			yAxisID: "y",
		  },
		  {
			label: "Media mobile (7gg)",
			data: passiMedia7,
			type: "line",
			borderColor: "#3b82f6",
			borderWidth: 2,
			pointRadius: 0,
			tension: 0.3,
			yAxisID: "y",
		  }
		]
	  },
	  options: {
		responsive: true,
		scales: {
		  y: {
			beginAtZero: true,
			title: { display: true, text: "Passi" },
		  }
		},
		plugins: {
		  legend: { display: true, position: "top" },
		  annotation: {
			annotations: {
			  min: {
				type: 'line',
				yMin: passiMin,
				yMax: passiMin,
				borderColor: 'rgba(34,197,94,0.8)',
				borderWidth: 1.5,
				borderDash: [5, 5],
				label: {
				  enabled: true,
				  content: `Min consigliato (${passiMin})`,
				  position: 'start',
				  color: '#16a34a',
				  backgroundColor: 'rgba(34,197,94,0.1)'
				}
			  },
			  max: {
				type: 'line',
				yMin: passiMax,
				yMax: passiMax,
				borderColor: 'rgba(34,197,94,0.8)',
				borderWidth: 1.5,
				borderDash: [5, 5],
				label: {
				  enabled: true,
				  content: `Ottimale (${passiMax})`,
				  position: 'end',
				  color: '#16a34a',
				  backgroundColor: 'rgba(34,197,94,0.1)'
				}
			  }
			}
		  }
		}
	  }
	});
	
	// dopo aver calcolato passi e passiMedia7, e dopo aver creato chartPassi …

	// messaggio sotto il grafico passi
	const passiValidi = passi.filter(v => v != null);
	const mediaPassi = passiValidi.length
	  ? (passiValidi.reduce((a, b) => a + b, 0) / passiValidi.length)
	  : null;

	const minConsigliati = 8000;
	const maxConsigliati = 10000;

	const elPassi = document.getElementById("saldoPassi");
	if (mediaPassi != null && !isNaN(mediaPassi)) {
	  let mess = "";
	  let colore = "";

	  if (mediaPassi < minConsigliati) {
		mess = `📉 Media passi: ${Math.round(mediaPassi)} — sotto il minimo consigliato (${minConsigliati})`;
		colore = "text-orange-600";
	  } else if (mediaPassi > maxConsigliati) {
		mess = `📈 Media passi: ${Math.round(mediaPassi)} — sopra il massimo suggerito (${maxConsigliati})`;
		colore = "text-green-600";
	  } else {
		mess = `✅ Media passi: ${Math.round(mediaPassi)} — nel range consigliato (${minConsigliati}-${maxConsigliati})`;
		colore = "text-blue-600";
	  }

	  elPassi.textContent = mess;
	  elPassi.className = `mt-3 text-center text-sm font-semibold ${colore}`;
	} else {
	  elPassi.textContent = "–";
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
function aggiornaRiepilogo(dati) {
  if (!dati.length) return;
  const media = arr => arr.filter(Boolean).reduce((a, b) => a + b, 0) / arr.filter(Boolean).length;

  const peso = media(dati.map(d => d.peso));
  const kcal = media(dati.map(d => d.kcal));
  const passi = media(dati.map(d => d.passi));

  const div = document.getElementById("summary");
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
}

// === STATO PERSONALE CORRENTE ===
function aggiornaStatoPersonale(dati) {
  const statoEl = document.getElementById("statoPersonale");
  const suggerimentoEl = document.getElementById("ultimoSuggerimento");
  
  
  if (!dati || !dati.length) {
    statoEl.innerHTML = "";
    suggerimentoEl.innerHTML = `<span class="text-gray-400 italic">Nessun dato disponibile</span>`;
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
