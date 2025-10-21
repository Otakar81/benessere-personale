// ==========================
// 🧭 Service Worker – v2.0
// Aggiornato per refresh immediato e cache controllata
// ==========================

const CACHE_NAME = "benessere-personale-cache-v3"; // cambiare questo valore a ogni rilascio
const URLS_TO_CACHE = [
  "./",
  "index.html",
  "manifest.json",
  "icon-192.png",
  "icon-512.png",
  // Aggiungi qui eventuali file CSS/JS principali
];

// Installazione – prepara la nuova cache
self.addEventListener("install", (event) => {
  self.skipWaiting(); // forza l’attivazione immediata
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
});

// Attivazione – rimuove le vecchie cache e aggiorna le pagine aperte
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim()) // subito attivo su tutte le tab aperte
  );
});

// Fetch – usa la cache, poi fallback a rete
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Se presente in cache, restituiscilo; altrimenti prendi da rete
      return response || fetch(event.request);
    })
  );
});
