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
    Mon: "Lunedì",
    Tue: "Martedì",
    Wed: "Mercoledì",
    Thu: "Giovedì",
    Fri: "Venerdì",
    Sat: "Sabato",
    Sun: "Domenica",
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

  function sanitizeText(value, fallback = "") {
    if (value === null || value === undefined) return fallback;
    const normalized = String(value).trim();
    return normalized || fallback;
  }

  function createElementWithText(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    element.textContent = sanitizeText(text);
    return element;
  }

  function createDetailRow(label, value, className = "") {
    const row = document.createElement("div");
    row.className = `result-meta result-detail-row ${className}`.trim();

    row.appendChild(createElementWithText("span", "", label));

    const valueContainer = document.createElement("span");
    if (value instanceof Node) {
      valueContainer.appendChild(value);
    } else {
      valueContainer.textContent = sanitizeText(value);
    }

    row.appendChild(valueContainer);
    return row;
  }

  function createEmailNode(email) {
    const safeEmail = sanitizeText(email);
    if (!safeEmail) {
      return document.createTextNode("Non indicata");
    }

    const emailLink = document.createElement("a");
    emailLink.href = `mailto:${encodeURIComponent(safeEmail)}`;
    emailLink.textContent = safeEmail;
    return emailLink;
  }

  function normalizeWebsiteUrl(url) {
    const trimmed = sanitizeText(url);
    if (!trimmed) return "";

    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    try {
      const parsed = new URL(candidate);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return "";
      }
      return parsed.toString();
    } catch {
      return "";
    }
  }

  function createWebsiteNode(website) {
    const normalized = normalizeWebsiteUrl(website);
    if (!normalized) {
      return document.createTextNode("Non disponibile");
    }

    const websiteLink = document.createElement("a");
    websiteLink.href = normalized;
    websiteLink.target = "_blank";
    websiteLink.rel = "noopener noreferrer";
    websiteLink.textContent = normalized;
    websiteLink.setAttribute(
      "aria-label",
      `Visita il sito ${normalized} (si apre in una nuova scheda)`,
    );
    return websiteLink;
  }

  function formatContactNodes(contact) {
    return {
      email: createEmailNode(contact?.public_email),
      website: createWebsiteNode(contact?.website_url),
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
      const contact = formatContactNodes(item.contact);
      const marker = L.marker([item.lat, item.lng]).addTo(state.map);
      const popup = document.createElement("div");
      popup.className = "popup";
      popup.appendChild(createElementWithText("div", "popup-title", item.name));

      const popupStatus = document.createElement("div");
      popupStatus.className = "popup-status";
      popupStatus.appendChild(
        createElementWithText(
          "span",
          `status-pill ${statusClassMap[item.catechesis.status]}`,
          statusMap[item.catechesis.status],
        ),
      );
      popupStatus.appendChild(
        createElementWithText(
          "span",
          `badge ${item.catechesis.source_level === "VERIFIED" ? "verified" : "community"}`,
          item.catechesis.source_level === "VERIFIED"
            ? "Verificata"
            : "Segnalata dalla community",
        ),
      );
      popup.appendChild(popupStatus);

      [
        ["Giorni", formatDays(item.catechesis.days)],
        ["Orario", sanitizeText(item.catechesis.time, "Non indicato")],
        ["Inizio catechesi", formatStartDate(item.catechesis.start_date)],
      ].forEach(([label, value]) => {
        const row = document.createElement("div");
        row.className = "popup-row";
        row.appendChild(createElementWithText("span", "", label));
        row.appendChild(createElementWithText("span", "", value));
        popup.appendChild(row);
      });

      const emailRow = document.createElement("div");
      emailRow.className = "popup-row";
      emailRow.appendChild(createElementWithText("span", "", "Email"));
      const emailValue = document.createElement("span");
      emailValue.appendChild(contact.email);
      emailRow.appendChild(emailValue);
      popup.appendChild(emailRow);

      const websiteRow = document.createElement("div");
      websiteRow.className = "popup-row";
      websiteRow.appendChild(createElementWithText("span", "", "Sito web"));
      const websiteValue = document.createElement("span");
      websiteValue.appendChild(contact.website);
      websiteRow.appendChild(websiteValue);
      popup.appendChild(websiteRow);

      marker.bindPopup(popup);
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
        const contact = formatContactNodes(item.contact);
        const card = document.createElement("div");
        card.className = `result-card ${state.activeId === item.id ? "active" : ""}`;
        card.dataset.id = item.id;
        card.appendChild(createElementWithText("div", "result-title", item.name));
        card.appendChild(createElementWithText("div", "result-meta", item.address));

        const meta = document.createElement("div");
        meta.className = "result-meta";
        meta.appendChild(createElementWithText("span", "", `${item.distance.toFixed(1)} km`));
        meta.appendChild(
          createElementWithText(
            "span",
            `status-pill ${statusClassMap[item.catechesis.status]}`,
            statusMap[item.catechesis.status],
          ),
        );
        meta.appendChild(
          createElementWithText(
            "span",
            `badge ${item.catechesis.source_level === "VERIFIED" ? "verified" : "community"}`,
            item.catechesis.source_level === "VERIFIED"
              ? "Verificata"
              : "Segnalata dalla community",
          ),
        );
        card.appendChild(meta);

        card.appendChild(createDetailRow("Giorni", formatDays(item.catechesis.days)));
        card.appendChild(
          createDetailRow("Orario", sanitizeText(item.catechesis.time, "Non indicato")),
        );
        card.appendChild(
          createDetailRow("Inizio catechesi", formatStartDate(item.catechesis.start_date)),
        );
        card.appendChild(createDetailRow("Email", contact.email));
        card.appendChild(createDetailRow("Sito web", contact.website));

        if (item.catechesis.last_verified_at) {
          card.appendChild(
            createElementWithText(
              "div",
              "result-meta",
              `Aggiornato il ${formatDate(item.catechesis.last_verified_at)}`,
            ),
          );
        }

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
    const contact = formatContactNodes(parish.contact);

    elements.modalContent.innerHTML = "";
    elements.modalContent.appendChild(createElementWithText("h3", "", parish.name));
    elements.modalContent.appendChild(createElementWithText("p", "", parish.address));

    const distanceSection = document.createElement("div");
    distanceSection.className = "modal-section";
    distanceSection.appendChild(createElementWithText("strong", "", "Distanza"));
    distanceSection.appendChild(
      createElementWithText("div", "", `${parish.distance.toFixed(1)} km`),
    );
    elements.modalContent.appendChild(distanceSection);

    const catechesisSection = document.createElement("div");
    catechesisSection.className = "modal-section";
    catechesisSection.appendChild(
      createElementWithText("strong", "", `Catechesi ${parish.catechesis.year}`),
    );
    catechesisSection.appendChild(
      createElementWithText(
        "div",
        `status-pill ${statusClassMap[parish.catechesis.status]}`,
        statusMap[parish.catechesis.status],
      ),
    );
    catechesisSection.appendChild(
      createElementWithText("div", "result-meta", `Giorni: ${formatDays(parish.catechesis.days)}`),
    );
    catechesisSection.appendChild(
      createElementWithText(
        "div",
        "result-meta",
        `Orario: ${sanitizeText(parish.catechesis.time, "Non indicato")}`,
      ),
    );
    catechesisSection.appendChild(
      createElementWithText(
        "div",
        "result-meta",
        `Inizio catechesi: ${formatStartDate(parish.catechesis.start_date)}`,
      ),
    );

    const emailRow = document.createElement("div");
    emailRow.className = "result-meta";
    emailRow.appendChild(document.createTextNode("Email: "));
    emailRow.appendChild(contact.email);
    catechesisSection.appendChild(emailRow);

    const websiteRow = document.createElement("div");
    websiteRow.className = "result-meta";
    websiteRow.appendChild(document.createTextNode("Sito web: "));
    websiteRow.appendChild(contact.website);
    catechesisSection.appendChild(websiteRow);

    if (parish.catechesis.last_verified_at) {
      catechesisSection.appendChild(
        createElementWithText(
          "div",
          "result-meta",
          `Aggiornato il ${formatDate(parish.catechesis.last_verified_at)}`,
        ),
      );
    }

    catechesisSection.appendChild(
      createElementWithText(
        "div",
        `badge ${parish.catechesis.source_level === "VERIFIED" ? "verified" : "community"}`,
        parish.catechesis.source_level === "VERIFIED"
          ? "Verificata"
          : "Segnalata dalla community",
      ),
    );

    if (parish.catechesis.source_level === "COMMUNITY") {
      catechesisSection.appendChild(
        createElementWithText(
          "div",
          "alert-community",
          "Consigliato contattare la parrocchia prima di recarsi alle catechesi per conferma.",
        ),
      );
    }

    elements.modalContent.appendChild(catechesisSection);

    if (formUrl) {
      const formLink = createElementWithText(
        "a",
        "action-btn",
        "Richiedi info catechesi (si apre in una nuova scheda)",
      );
      formLink.href = formUrl;
      formLink.target = "_blank";
      formLink.rel = "noopener noreferrer";
      formLink.setAttribute(
        "aria-label",
        "Richiedi informazioni sulla catechesi (si apre in una nuova scheda)",
      );
      elements.modalContent.appendChild(formLink);
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
      const contentContainer = document.getElementById("content-container");
      if (contentContainer) {
        contentContainer.scrollIntoView({ behavior: "smooth", block: "start" });
      }
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
