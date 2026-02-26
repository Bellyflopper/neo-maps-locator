(() => {
  const CONFIG = window.APP_CONFIG || {};
  const PARISHES_URL = "./data/parishes_public.json";
  const CACHE_KEY = "geo_cache_v1";
  const CACHE_TTL = 1000 * 60 * 60 * 24 * 30;

  const state = {
    parishes: [],
    origin: null,
    results: [],
    activeId: null,
    originMarker: null,
    markers: new Map(),
    map: null,
  };

  const elements = {
    form: document.getElementById("search-form"),
    input: document.getElementById("search-input"),
    availableOnly: document.getElementById("available-only"),
    results: document.getElementById("results"),
    resultsCount: document.getElementById("results-count"),
    resultsSummary: document.getElementById("results-summary"),
    missingLocation: document.getElementById("missing-location"),
    modal: document.getElementById("modal"),
    modalContent: document.getElementById("modal-content"),
    toastContainer: document.getElementById("toast-container"),
    tabs: Array.from(document.querySelectorAll(".tab-btn")),
  };

  const dayMap = {
    Mon: "Lun",
    Tue: "Mar",
    Wed: "Mer",
    Thu: "Gio",
    Fri: "Ven",
    Sat: "Sab",
    Sun: "Dom",
  };

  const statusMap = {
    AVAILABLE: "Disponibile",
    NOT_AVAILABLE: "Non disponibile",
    UNKNOWN: "Da verificare",
  };

  const statusClassMap = {
    AVAILABLE: "status-available",
    NOT_AVAILABLE: "status-not",
    UNKNOWN: "status-unknown",
  };

  function normalizeQuery(value) {
    return value.toLowerCase().trim().replace(/\s+/g, " ");
  }

  function getCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function setCache(cache) {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  }

  function setCacheEntry(query, data) {
    const cache = getCache();
    cache[query] = { ...data, timestamp: Date.now() };
    setCache(cache);
  }

  function getCacheEntry(query) {
    const cache = getCache();
    const entry = cache[query];
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL) return null;
    return entry;
  }

  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      toast.addEventListener("transitionend", () => toast.remove());
    }, 3500);
  }

  function debounce(fn, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), wait);
    };
  }

  function initTabs() {
    elements.tabs.forEach((button) => {
      button.addEventListener("click", () => {
        elements.tabs.forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");
        document.body.dataset.view = button.dataset.view;
        if (button.dataset.view === "map" && state.map) {
          setTimeout(() => state.map.invalidateSize(), 150);
        }
      });
    });
  }

  function initMap() {
    state.map = L.map("map", { zoomControl: true }).setView([41.9028, 12.4964], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(state.map);
  }

  async function loadParishes() {
    const response = await fetch(PARISHES_URL);
    const data = await response.json();
    state.parishes = (data.parishes || []).filter((p) => p.is_active !== false);
  }

  async function geocode(query) {
    const normalized = normalizeQuery(query);
    const cached = getCacheEntry(normalized);
    if (cached) return cached;

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query,
    )}&limit=1&countrycodes=it`;
    const response = await fetch(url, { headers: { "Accept-Language": "it" } });

    if (response.status === 429) {
      throw new Error("RATE_LIMIT");
    }
    if (!response.ok) {
      throw new Error("GEOCODE_FAILED");
    }

    const json = await response.json();
    if (!json.length) {
      throw new Error("NO_RESULTS");
    }

    const location = {
      lat: parseFloat(json[0].lat),
      lng: parseFloat(json[0].lon),
    };

    setCacheEntry(normalized, location);
    return location;
  }

  function haversineDistance(a, b) {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;

    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function formatStartDate(value) {
    const formatted = formatDate(value);
    return formatted || "Non indicata";
  }

  function escapeHtml(value) {
    if (!value) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function buildEmailLink(email) {
    if (!email) return "Non indicata";
    const safeEmail = escapeHtml(email);
    return `<a href="mailto:${encodeURIComponent(email)}">${safeEmail}</a>`;
  }

  function normalizeWebsiteUrl(url) {
    if (!url) return "";
    const trimmed = url.trim();
    if (!trimmed) return "";
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }

  function buildWebsiteLink(website) {
    const normalized = normalizeWebsiteUrl(website);
    if (!normalized) return "Non disponibile";
    const safeUrl = escapeHtml(normalized);
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl}</a>`;
  }

  function formatContactHtml(contact) {
    return {
      email: buildEmailLink(contact?.public_email),
      website: buildWebsiteLink(contact?.website_url),
    };
  }

  function formatDays(days) {
    return days?.length ? days.map((d) => dayMap[d] || d).join(", ") : "Non indicati";
  }

  function buildGoogleFormUrl(parish) {
    const base = CONFIG.GOOGLE_FORM_BASE_URL || "";
    if (!base) return "";

    const params = new URLSearchParams();
    if (CONFIG.GOOGLE_FORM_FIELD_PARISH_ID) {
      params.append(CONFIG.GOOGLE_FORM_FIELD_PARISH_ID, parish.id);
    }
    if (CONFIG.GOOGLE_FORM_FIELD_PARISH_NAME) {
      params.append(CONFIG.GOOGLE_FORM_FIELD_PARISH_NAME, parish.name);
    }

    return `${base}?${params.toString()}`;
  }

  function updateMap(results) {
    state.markers.forEach((marker) => marker.remove());
    state.markers.clear();

    results.forEach((item) => {
      const contact = formatContactHtml(item.contact);
      const marker = L.marker([item.lat, item.lng]).addTo(state.map);
      marker.bindPopup(
        `<div class="popup">
          <div class="popup-title">${item.name}</div>
          <div class="popup-status">
            <span class="status-pill ${statusClassMap[item.catechesis.status]}">
              ${statusMap[item.catechesis.status]}
            </span>
            <span class="badge ${
              item.catechesis.source_level === "VERIFIED" ? "verified" : "community"
            }">
              ${
                item.catechesis.source_level === "VERIFIED"
                  ? "Verificata"
                  : "Segnalata dalla community"
              }
            </span>
          </div>
          <div class="popup-row">
            <span>Giorni</span>
            <span>${formatDays(item.catechesis.days)}</span>
          </div>
          <div class="popup-row">
            <span>Orario</span>
            <span>${item.catechesis.time || "Non indicato"}</span>
          </div>
          <div class="popup-row">
            <span>Inizio catechesi</span>
            <span>${formatStartDate(item.catechesis.start_date)}</span>
          </div>
          <div class="popup-row">
            <span>Email</span>
            <span>${contact.email}</span>
          </div>
          <div class="popup-row">
            <span>Sito web</span>
            <span>${contact.website}</span>
          </div>
        </div>`,
      );
      state.markers.set(item.id, marker);
    });
  }

  function updateOriginMarker(origin) {
    if (state.originMarker) {
      state.originMarker.remove();
    }
    state.originMarker = L.circleMarker([origin.lat, origin.lng], {
      radius: 8,
      color: "#4338ca",
      fillColor: "#5c4ddf",
      fillOpacity: 0.7,
      weight: 2,
    }).addTo(state.map);
  }

  function renderResults(results, missingLocation) {
    elements.results.innerHTML = "";
    elements.resultsCount.textContent = `${results.length} parrocchie`;
    elements.resultsSummary.textContent = state.origin
      ? `Da ${elements.input.value.trim()}`
      : "Nessuna ricerca attiva";

    if (!results.length) {
      const empty = document.createElement("div");
      empty.className = "result-card";
      empty.textContent = "Nessuna parrocchia trovata nel raggio selezionato.";
      elements.results.appendChild(empty);
    } else {
      results.forEach((item) => {
        const contact = formatContactHtml(item.contact);
        const card = document.createElement("div");
        card.className = `result-card ${state.activeId === item.id ? "active" : ""}`;
        card.dataset.id = item.id;
        card.innerHTML = `
          <div class="result-title">${item.name}</div>
          <div class="result-meta">${item.address}</div>
          <div class="result-meta">
            <span>${item.distance.toFixed(1)} km</span>
            <span class="status-pill ${statusClassMap[item.catechesis.status]}">
              ${statusMap[item.catechesis.status]}
            </span>
            <span class="badge ${
              item.catechesis.source_level === "VERIFIED" ? "verified" : "community"
            }">
              ${
                item.catechesis.source_level === "VERIFIED"
                  ? "Verificata"
                  : "Segnalata dalla community"
              }
            </span>
          </div>
          <div class="result-meta result-detail-row">
            <span>Inizio catechesi</span>
            <span>${formatStartDate(item.catechesis.start_date)}</span>
          </div>
          <div class="result-meta result-detail-row">
            <span>Email</span>
            <span>${contact.email}</span>
          </div>
          <div class="result-meta result-detail-row">
            <span>Sito web</span>
            <span>${contact.website}</span>
          </div>
          ${
            item.catechesis.last_verified_at
              ? `<div class="result-meta">Aggiornato il ${formatDate(
                  item.catechesis.last_verified_at,
                )}</div>`
              : ""
          }
        `;

        card.addEventListener("click", () => focusResult(item.id));
        elements.results.appendChild(card);
      });
    }

    elements.missingLocation.textContent = missingLocation.length
      ? `Posizione non disponibile per: ${missingLocation.join(", ")}`
      : "";
  }

  function focusResult(id) {
    state.activeId = id;
    const item = state.results.find((result) => result.id === id);
    if (!item) return;
    const marker = state.markers.get(id);
    if (marker) {
      marker.openPopup();
      state.map.setView([item.lat, item.lng], 14);
    }
    renderResults(state.results, state.missingLocation);
  }

  function openDetails(id) {
    const parish = state.results.find((item) => item.id === id);
    if (!parish) return;

    state.activeId = id;
    const formUrl = buildGoogleFormUrl(parish);

    elements.modalContent.innerHTML = `
      <h3>${parish.name}</h3>
      <p>${parish.address}</p>
      <div class="modal-section">
        <strong>Distanza</strong>
        <div>${parish.distance.toFixed(1)} km</div>
      </div>
      <div class="modal-section">
        <strong>Catechesi ${parish.catechesis.year}</strong>
        <div class="status-pill ${statusClassMap[parish.catechesis.status]}">
          ${statusMap[parish.catechesis.status]}
        </div>
        <div class="result-meta">
          Giorni: ${formatDays(parish.catechesis.days)}
        </div>
        <div class="result-meta">
          Orario: ${parish.catechesis.time || "Non indicato"}
        </div>
        <div class="result-meta">
          Inizio catechesi: ${formatStartDate(parish.catechesis.start_date)}
        </div>
        <div class="result-meta">
          Email: ${formatContactEmail(parish.contact?.public_email)}
        </div>
        ${
          parish.catechesis.last_verified_at
            ? `<div class="result-meta">Aggiornato il ${formatDate(
                parish.catechesis.last_verified_at,
              )}</div>`
            : ""
        }

        <div class="badge ${
          parish.catechesis.source_level === "VERIFIED" ? "verified" : "community"
        }">
          ${
            parish.catechesis.source_level === "VERIFIED"
              ? "Verificata"
              : "Segnalata dalla community"
          }
        </div>
        ${
          parish.catechesis.source_level === "COMMUNITY"
            ? `<div class="alert-community">
                Consigliato contattare la parrocchia prima di recarsi alle catechesi per conferma.
              </div>`
            : ""
        }
      </div>
      ${
        formUrl
          ? `<button class="action-btn" data-form="${formUrl}">
              Richiedi info catechesi
            </button>`
          : ""
      }
    `;

    const formButton = elements.modalContent.querySelector(".action-btn");
    if (formButton) {
      formButton.addEventListener("click", () => {
        const url = formButton.getAttribute("data-form");
        if (url) {
          window.open(url, "_blank");
        }
      });
    }

    elements.modal.classList.add("active");
    elements.modal.setAttribute("aria-hidden", "false");
    renderResults(state.results, state.missingLocation);
  }

  function closeModal() {
    elements.modal.classList.remove("active");
    elements.modal.setAttribute("aria-hidden", "true");
  }

  function setupModal() {
    elements.modal.addEventListener("click", (event) => {
      const target = event.target;
      if (target && target.dataset.close) {
        closeModal();
      }
    });
  }

  function extractRadius() {
    const checked = document.querySelector('input[name="radius"]:checked');
    return checked ? parseInt(checked.value, 10) : 10;
  }

  async function performSearch(event) {
    event.preventDefault();
    const query = elements.input.value.trim();
    if (!query) {
      showToast("Inserisci un indirizzo o una zona di Roma.", "error");
      return;
    }

    try {
      const origin = await geocode(query);
      state.origin = origin;
      updateOriginMarker(origin);
      state.map.setView([origin.lat, origin.lng], 12);
      const radius = extractRadius();
      const availableOnly = elements.availableOnly.checked;

      const results = [];
      const missingLocation = [];

      state.parishes.forEach((parish) => {
        if (!parish.lat || !parish.lng) {
          missingLocation.push(parish.name);
          return;
        }

        if (availableOnly && parish.catechesis?.status !== "AVAILABLE") {
          return;
        }

        const distance = haversineDistance(origin, {
          lat: parish.lat,
          lng: parish.lng,
        });

        if (distance <= radius) {
          results.push({ ...parish, distance });
        }
      });

      results.sort((a, b) => a.distance - b.distance);
      state.results = results;
      state.missingLocation = missingLocation;
      updateMap(results);
      renderResults(results, missingLocation);
      showToast("Ricerca completata.", "success");
    } catch (error) {
      if (error.message === "RATE_LIMIT") {
        showToast("Troppi tentativi: attendi un momento e riprova.", "error");
      } else if (error.message === "NO_RESULTS") {
        showToast("Nessun risultato trovato per la ricerca inserita.", "error");
      } else {
        showToast("Impossibile completare la ricerca. Riprova più tardi.", "error");
      }
    }
  }

  function setupEvents() {
    elements.form.addEventListener("submit", performSearch);
    elements.results.addEventListener("click", (event) => {
      const target = event.target.closest(".result-card");
      if (target) {
        focusResult(target.dataset.id);
      }
    });
  }

  function setupDebouncedInput() {
    const syncInput = debounce(() => {
      elements.resultsSummary.textContent = elements.input.value.trim()
        ? `Da ${elements.input.value.trim()}`
        : "Nessuna ricerca attiva";
    }, 300);
    elements.input.addEventListener("input", syncInput);
  }

  function initYear() {
    const year = document.getElementById("year");
    if (year) {
      year.textContent = new Date().getFullYear().toString();
    }
  }

  async function init() {
    initTabs();
    initMap();
    setupModal();
    setupEvents();
    setupDebouncedInput();
    initYear();
    await loadParishes();
  }

  init();
})();
