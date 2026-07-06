import { supabase } from "./bh-user-data.js";

/*
  bh-map-core.js

  Cambios implementados aquí:
  - Tarjeta del anuncio: ahora está dentro del mapa (posicionada respecto a #mapWrap).
  - Cerrar tarjeta deselecciona marcador.
  - Marcadores “vistos”: blanco con borde naranja (persistido en localStorage).
  - Hover en listado resalta marcador.
  - Click en listado abre directamente listing.html?id=...
  - Listado ordenable (fecha desc por defecto + tamaño asc/desc).
  - Botón de geolocalización (zoom 14) encima del botón “Sol”.
  - Etiqueta “Comunidad / Ciudad / Zona” se actualiza automáticamente al mover el mapa (reverse geocoding con Nominatim).
*/

export function initMap(){
  const SUPABASE_URL = "https://dpusnylssfjnksbieimj.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_tSSgJcWWRfEe2uob7SFYgw_AqcBL7KK";

  const DEFAULT_CENTER = [37.9838, -1.1280];
  const DEFAULT_ZOOM = 13;

  const statusEl = document.getElementById("status");
  const placeLabelEl = document.getElementById("placeLabel");

  const listItemsEl = document.getElementById("listItems");

  // Tarjeta dentro del mapa
  const cardEl = document.getElementById("card");
  const cardCloseBtn = document.getElementById("cardClose");
  const heartBtn = document.getElementById("heartBtn");

  const badgeNewEl = document.getElementById("badgeNew");
  const mediaImgEl = document.getElementById("mediaImg");
  const mediaPlaceholderEl = document.getElementById("mediaPlaceholder");

  const cardAddrTopEl = document.getElementById("cardAddrTop");
  const cardAddrBottomEl = document.getElementById("cardAddrBottom");
  const cardPriceEl = document.getElementById("cardPrice");
  const cardFactsEl = document.getElementById("cardFacts");
  const cardAgencyEl = document.getElementById("cardAgency");

  // Sol overlay
  const sunOverlayEl = document.getElementById("sunOverlay");
  const sunOverlayLabelEl = document.getElementById("sunOverlayLabel");
  const sunPolarOverlaySvg = document.getElementById("sunPolarOverlay");

  const sunTimebarEl = document.getElementById("sunTimebar");
  const sunDateDockEl = document.getElementById("sunDateDock");
  const sunNowDockEl = document.getElementById("sunNowDock");
  const sunHoursRowEl = document.getElementById("sunHoursRow");
  const sunTrackEl = document.getElementById("sunTrack");
  const sunRangeEl = document.getElementById("sunRange");
  const sunDateEl = document.getElementById("sunDate");
  const sunNowBtn = document.getElementById("sunNowBtn");

  // Áreas
  const areaHintEl = document.getElementById("areaHint");
  const areaHintTextEl = document.getElementById("areaHintText");

  function setStatus(msg) { statusEl.textContent = msg || ""; }

  function euro(n) {
    try {
      return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
    } catch {
      return `${n} EUR`;
    }
  }

  function openCard() { cardEl.classList.add("visible"); }
  function closeCard() {
    cardEl.classList.remove("visible");
    // Pedido: cerrar tarjeta también deselecciona marcador
    deselectActiveMarker();
  }
  cardCloseBtn.addEventListener("click", closeCard);

  let heartOn = false;
  if (heartBtn) {
    heartBtn.addEventListener("click", () => {
      heartOn = !heartOn;
      heartBtn.style.borderColor = heartOn ? "rgba(26,115,232,0.55)" : "rgba(0,0,0,0.18)";
      heartBtn.style.boxShadow = heartOn ? "0 6px 18px rgba(26,115,232,0.18)" : "none";
    });
  }

  function setPhoto(url) {
    if (!url) {
      mediaImgEl.style.display = "none";
      mediaImgEl.removeAttribute("src");
      mediaPlaceholderEl.style.display = "grid";
      return;
    }

    mediaImgEl.src = url;
    mediaImgEl.style.display = "block";
    mediaPlaceholderEl.style.display = "none";

    mediaImgEl.onerror = () => {
      mediaImgEl.style.display = "none";
      mediaImgEl.removeAttribute("src");
      mediaPlaceholderEl.style.display = "grid";
    };
  }

  // ===== Carrusel de fotos de la tarjeta flotante =====================
  // Mismo lenguaje que el carrusel del listado: foto principal + flechas
  // (clase .listNav) + contador (clase .listHeroCount). Permite hojear
  // todas las fotos del anuncio sin abrir la ficha.
  const mediaSideEl = cardEl ? cardEl.querySelector(".mediaSide") : null;
  let cardPhotos = [];
  let cardPhotoIdx = 0;
  let cardPrevBtn = null;
  let cardNextBtn = null;
  let cardCountEl = null;

  function ensureCardCarouselControls() {
    if (!mediaSideEl || cardPrevBtn) return;
    const chevron = (d) =>
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

    cardPrevBtn = document.createElement("button");
    cardPrevBtn.type = "button";
    cardPrevBtn.className = "listNav listNavPrev";
    cardPrevBtn.setAttribute("aria-label", "Foto anterior");
    cardPrevBtn.innerHTML = chevron("M15 18l-6-6 6-6");

    cardNextBtn = document.createElement("button");
    cardNextBtn.type = "button";
    cardNextBtn.className = "listNav listNavNext";
    cardNextBtn.setAttribute("aria-label", "Foto siguiente");
    cardNextBtn.innerHTML = chevron("M9 6l6 6-6 6");

    cardCountEl = document.createElement("div");
    cardCountEl.className = "listHeroCount";

    mediaSideEl.appendChild(cardPrevBtn);
    mediaSideEl.appendChild(cardNextBtn);
    mediaSideEl.appendChild(cardCountEl);

    cardPrevBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (cardPhotos.length < 2) return;
      cardPhotoIdx = (cardPhotoIdx - 1 + cardPhotos.length) % cardPhotos.length;
      renderCardPhoto();
    });
    cardNextBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (cardPhotos.length < 2) return;
      cardPhotoIdx = (cardPhotoIdx + 1) % cardPhotos.length;
      renderCardPhoto();
    });

    // Deslizar con el dedo para pasar fotos (táctil / móvil).
    let swipeX = 0, swipeY = 0, swiping = false;
    mediaSideEl.addEventListener("touchstart", (e) => {
      if (cardPhotos.length < 2 || !e.touches || e.touches.length !== 1) {
        swiping = false;
        return;
      }
      swipeX = e.touches[0].clientX;
      swipeY = e.touches[0].clientY;
      swiping = true;
    }, { passive: true });

    mediaSideEl.addEventListener("touchmove", (e) => {
      if (!swiping || !e.touches || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - swipeX;
      const dy = e.touches[0].clientY - swipeY;
      // Gesto predominantemente horizontal: evita el scroll de la página.
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
        e.preventDefault();
      }
    }, { passive: false });

    mediaSideEl.addEventListener("touchend", (e) => {
      if (!swiping) return;
      swiping = false;
      const t = (e.changedTouches && e.changedTouches[0]) || null;
      if (!t || cardPhotos.length < 2) return;
      const dx = t.clientX - swipeX;
      const dy = t.clientY - swipeY;
      if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy)) return;
      if (dx < 0) {
        cardPhotoIdx = (cardPhotoIdx + 1) % cardPhotos.length;
      } else {
        cardPhotoIdx = (cardPhotoIdx - 1 + cardPhotos.length) % cardPhotos.length;
      }
      renderCardPhoto();
    }, { passive: true });
  }

  function renderCardPhoto() {
    const n = cardPhotos.length;
    setPhoto(n > 0 ? cardPhotos[cardPhotoIdx] : null);
    const multi = n > 1;
    // Las flechas usan la clase .listNav, que trae `display:grid !important`;
    // por eso hay que ocultarlas también con !important (un estilo inline normal
    // no podría ganarle).
    if (cardPrevBtn) cardPrevBtn.style.setProperty("display", multi ? "grid" : "none", "important");
    if (cardNextBtn) cardNextBtn.style.setProperty("display", multi ? "grid" : "none", "important");
    if (cardCountEl) {
      cardCountEl.style.display = multi ? "block" : "none";
      cardCountEl.textContent = `${cardPhotoIdx + 1}/${n}`;
    }
  }

  function setCardPhotos(photos) {
    ensureCardCarouselControls();
    cardPhotos = Array.isArray(photos) ? photos.filter(Boolean) : [];
    cardPhotoIdx = 0;
    renderCardPhoto();
  }

  function isRecent(listedAtIso, days = 14) {
    if (!listedAtIso) return false;
    const d = new Date(listedAtIso);
    if (isNaN(d.getTime())) return false;
    const diff = Date.now() - d.getTime();
    return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
  }

  function iconArea() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M4 10h16"/><path d="M10 10v10"/></svg>';
  }
  function iconType() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>';
  }
  function iconYear() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>';
  }
  function iconBuilt() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/></svg>';
  }
  function iconBed() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v11"/><path d="M3 13h18v5"/><path d="M21 18v-4a3 3 0 0 0-3-3H8v2"/></svg>';
  }
  function iconBath() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12V6a2 2 0 0 1 2-2 2 2 0 0 1 2 2"/><path d="M3 12h18v2a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/><path d="M6 20l-1 1"/><path d="M18 20l1 1"/></svg>';
  }

  function joinNonEmpty(parts, sep) {
    return parts.map(v => (v == null ? "" : String(v).trim()))
      .filter(v => v.length > 0)
      .join(sep);
  }

  function buildAddressTop(p) {
    const base = joinNonEmpty([p.street_name, p.street_number], " ");
    const extras = joinNonEmpty([p.building, p.staircase, p.floor, p.door], ", ");
    if (base && extras) return base + ", " + extras;
    return base || extras || "Dirección";
  }

  function buildAddressBottom(p) {
    const line = joinNonEmpty([p.postcode, p.city], " ");
    return line || "—";
  }

  // Persistencia “visto”
  const SEEN_KEY = "bh_seen_ids_v1";

  function loadSeenSet(){
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return new Set();
      return new Set(arr.map(String));
    } catch {
      return new Set();
    }
  }

  function saveSeenSet(set){
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(set)));
    } catch {}
  }

  const seenSet = loadSeenSet();

  function markSeen(listingId){
    if (!listingId) return;
    const id = String(listingId);
    if (seenSet.has(id)) return;
    seenSet.add(id);
    saveSeenSet(seenSet);
    // Actualiza marcador si existe
    const m = markerById.get(id);
    if (m && m._icon) {
      const dot = m._icon.querySelector(".dot");
      if (dot && !dot.classList.contains("active")) dot.classList.add("seen");
    }
  }

  function openCardForPoint(p) {
    // Marcar visto al abrir card (pedido)
    markSeen(p.listing_id);

    cardAddrTopEl.textContent = buildAddressTop(p);
    cardAddrBottomEl.textContent = buildAddressBottom(p);

    cardAddrTopEl.href = `listing.html?id=${encodeURIComponent(p.listing_id)}`;

    cardPriceEl.textContent = (p.price_eur != null) ? euro(p.price_eur) : "—";

    setCardPhotos(collectAllPhotoUrls(p));

    badgeNewEl.style.display = isRecent(p.listed_at, 14) ? "inline-flex" : "none";

    const m2 = (p.useful_area_m2 != null) ? `${p.useful_area_m2} m²` : "— m²";
    const beds = (p.bedrooms != null) ? `${p.bedrooms}` : "—";
    const baths = (p.bathrooms != null) ? `${p.bathrooms}` : "—";

    const builtFact = (p.built_area_m2 != null)
      ? `<div class="fact">${iconBuilt()}<span>${p.built_area_m2} m² Const.</span></div>`
      : "";
    const yearFact = (p.built_year != null)
      ? `<div class="fact">${iconYear()}<span>${p.built_year}</span></div>`
      : "";

    cardFactsEl.innerHTML = `
      <div class="fact">${iconArea()}<span>${m2} útiles</span></div>
      ${builtFact}
      <div class="fact">${iconBed()}<span>${beds}</span></div>
      <div class="fact">${iconBath()}<span>${baths}</span></div>
      ${yearFact}
    `;

    cardAgencyEl.textContent = p.agency_name || "—";
    openCard();
  }

  function toInt(v) {
    if (v == null || v === "") return null;
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : null;
  }

  function toText(v) {
    if (v == null) return null;
    const s = String(v).trim();
    return s.length ? s : null;
  }

  function toTextArray(csv) {
    if (!csv) return null;
    const arr = String(csv).split(",").map(s => s.trim()).filter(Boolean);
    return arr.length ? arr : null;
  }

  function getParams() {
    const u = new URL(window.location.href);

    let mode = (u.searchParams.get("mode") || "").trim().toLowerCase();
    if (!mode) mode = "buy";
    const allowed = ["buy","rent","room","new_build","all"];
    if (!allowed.includes(mode)) mode = "buy";

    return {
      city: (u.searchParams.get("city") || "").trim(),
      mode,

      priceMin: toInt(u.searchParams.get("price_min")),
      priceMax: toInt(u.searchParams.get("price_max")),

      listedSinceDays: toInt(u.searchParams.get("since_days")),
      availability: toText(u.searchParams.get("availability")),

      usefulMin: toInt(u.searchParams.get("useful_min")),
      usefulMax: toInt(u.searchParams.get("useful_max")),

      builtMin: toInt(u.searchParams.get("built_min")),
      builtMax: toInt(u.searchParams.get("built_max")),

      bedroomsMin: toInt(u.searchParams.get("bedrooms_min")),
      bathroomsMin: toInt(u.searchParams.get("bathrooms_min")),

      outdoorType: toText(u.searchParams.get("outdoor_type")),
      orientations: toTextArray(u.searchParams.get("orientations")),

      energyChoice: toText(u.searchParams.get("energy")),

      buildPeriods: toTextArray(u.searchParams.get("build_periods")),
      parkingTypes: toTextArray(u.searchParams.get("parking")),
      storageTypes: toTextArray(u.searchParams.get("storage")),
      accessibility: toTextArray(u.searchParams.get("accessibility"))
    };
  }

  const initialParams = getParams();

  const urlParamsForBadges = new URL(window.location.href).searchParams;
  const savedSearchIdForBadges = urlParamsForBadges.get("saved_search_id") || "";
  const sourceForBadges = urlParamsForBadges.get("source") || "";
  const hasSavedSearchBadgeContext = Boolean(savedSearchIdForBadges) && (
    sourceForBadges === "email_alert" ||
    sourceForBadges === "saved_search"
  );

  const newInSearchIds = new Set();

  async function loadNewInSearchIds(){
    newInSearchIds.clear();

    if (!hasSavedSearchBadgeContext) return;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    try {
      const { data, error } = await supabase
        .from("saved_search_matches")
        .select("listing_id")
        .eq("saved_search_id", savedSearchIdForBadges)
        .gte("matched_at", since);

      if (error) throw error;

      (data || []).forEach((row) => {
        if (row?.listing_id) newInSearchIds.add(String(row.listing_id));
      });
    } catch (e) {
      console.warn("No se pudieron cargar las etiquetas de búsqueda guardada", e);
    }
  }

  function getListingBadge(p){
    const id = String(p?.listing_id || "");

    if (hasSavedSearchBadgeContext && id && newInSearchIds.has(id)) {
      return { text: "Nuevo en tu búsqueda", type: "search" };
    }

    if (isRecent(p?.listed_at, 3)) {
      return { text: "Nuevo", type: "general" };
    }

    return null;
  }

  function createListBadge(p){
    const badge = getListingBadge(p);
    if (!badge) return null;

    const el = document.createElement("div");
    el.className = `listBadge listBadge-${badge.type}`;
    el.textContent = badge.text;
    return el;
  }

  // Extrae hasta `max` fotos adicionales (distintas de la principal) del punto,
  // tolerando varios nombres de campo posibles del backend.
  function getExtraPhotoUrls(p, max){
    const out = [];
    const main = p && p.main_photo_url;
    const push = (u) => {
      if (out.length >= max) return;
      if (typeof u === "string"){
        const v = u.trim();
        if (v && v !== main && !out.includes(v)) out.push(v);
      }
    };
    const arrays = [p.photo_urls, p.photos, p.gallery, p.gallery_urls, p.extra_photos, p.images, p.image_urls];
    for (const arr of arrays){
      if (Array.isArray(arr)){
        for (const item of arr){
          if (typeof item === "string") push(item);
          else if (item && typeof item === "object") push(item.url || item.src || item.photo_url);
        }
      }
    }
    [p.photo_2_url, p.photo_3_url, p.second_photo_url, p.third_photo_url].forEach(push);
    return out.slice(0, max);
  }

  // Recoge TODAS las fotos de un anuncio (principal + adicionales) en orden,
  // tolerando los distintos nombres de campo del backend.
  function collectAllPhotoUrls(p){
    const out = [];
    const push = (u) => {
      if (typeof u === "string"){
        const v = u.trim();
        if (v && !out.includes(v)) out.push(v);
      } else if (u && typeof u === "object"){
        push(u.url || u.src || u.photo_url);
      }
    };
    push(p && p.main_photo_url);
    const arrays = [p.photo_urls, p.photos, p.gallery, p.gallery_urls, p.extra_photos, p.images, p.image_urls];
    for (const arr of arrays){ if (Array.isArray(arr)) arr.forEach(push); }
    [p.photo_2_url, p.photo_3_url, p.second_photo_url, p.third_photo_url].forEach(push);
    return out;
  }

  // Guarda las fotos de cada anuncio para que la ficha (listing.html) pueda
  // mostrarlas aunque la vista de detalle del backend no las devuelva. Se
  // conserva entre navegaciones en la misma pestaña (sessionStorage).
  function storeListingPhotos(rows){
    try {
      const store = {};
      (rows || []).forEach((p) => {
        const id = String((p && p.listing_id) || "");
        if (!id) return;
        const urls = collectAllPhotoUrls(p);
        if (urls.length) store[id] = urls;
      });
      if (!Object.keys(store).length) return;
      let prev = {};
      try { prev = JSON.parse(sessionStorage.getItem("homyo_listing_photos") || "{}"); } catch {}
      sessionStorage.setItem("homyo_listing_photos", JSON.stringify({ ...prev, ...store }));
    } catch {}
  }

  // Enriquece las filas del RPC con TODAS sus fotos/planos desde
  // public.listing_media (el RPC del mapa solo devuelve main_photo_url). Una
  // sola consulta por lote con filtro IN sobre listing_id; rellena p.photo_urls
  // y p.floorplan_urls para que el listado, las tarjetas y el traspaso a la
  // ficha muestren la galería completa. Orden: sort_order asc, created_at asc.
  async function attachListingMedia(rows){
    try {
      const list = (rows || []).filter((p) => p && p.listing_id);
      if (!list.length) return;
      const ids = [...new Set(list.map((p) => String(p.listing_id)))];

      const byId = new Map();
      const CHUNK = 100;
      for (let i = 0; i < ids.length; i += CHUNK){
        const slice = ids.slice(i, i + CHUNK);
        const params = new URLSearchParams();
        params.set("select", "listing_id,media_type,url,sort_order,created_at");
        params.set("listing_id", "in.(" + slice.join(",") + ")");
        params.set("order", "sort_order.asc,created_at.asc");
        const url = `${SUPABASE_URL}/rest/v1/listing_media?${params.toString()}`;
        const res = await fetch(url, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
        });
        if (!res.ok) continue;
        const data = await res.json();
        for (const m of (data || [])){
          if (!m || !m.url) continue;
          const id = String(m.listing_id);
          let entry = byId.get(id);
          if (!entry){ entry = { photos: [], floorplans: [] }; byId.set(id, entry); }
          if (m.media_type === "floorplan") entry.floorplans.push(m.url);
          else entry.photos.push(m.url);
        }
      }

      list.forEach((p) => {
        const entry = byId.get(String(p.listing_id));
        if (!entry) return;
        if (entry.photos.length) p.photo_urls = entry.photos;
        if (entry.floorplans.length) p.floorplan_urls = entry.floorplans;
      });
    } catch (e) {
      console.warn("No se pudieron cargar medios de listing_media:", e);
    }
  }

  // El RPC del mapa no devuelve el año de construcción ni la superficie
  // construida total. Los traemos por lote desde listing_detail_public para que
  // la tarjeta de selección los pueda mostrar. Igual patrón que attachListingMedia.
  async function attachListingDetail(rows){
    try {
      const list = (rows || []).filter((p) => p && p.listing_id);
      if (!list.length) return;
      const ids = [...new Set(list.map((p) => String(p.listing_id)))];

      const byId = new Map();
      const CHUNK = 100;
      for (let i = 0; i < ids.length; i += CHUNK){
        const slice = ids.slice(i, i + CHUNK);
        const params = new URLSearchParams();
        params.set("select", "listing_id,built_year,built_area_m2");
        params.set("listing_id", "in.(" + slice.join(",") + ")");
        const url = `${SUPABASE_URL}/rest/v1/listing_detail_public?${params.toString()}`;
        const res = await fetch(url, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
        });
        if (!res.ok) continue;
        const data = await res.json();
        for (const d of (data || [])){
          if (!d) continue;
          byId.set(String(d.listing_id), d);
        }
      }

      list.forEach((p) => {
        const entry = byId.get(String(p.listing_id));
        if (!entry) return;
        if (entry.built_year != null) p.built_year = entry.built_year;
        if (entry.built_area_m2 != null) p.built_area_m2 = entry.built_area_m2;
      });
    } catch (e) {
      console.warn("No se pudo cargar detalle de listing_detail_public:", e);
    }
  }

  function createListMediaWrap(p, img, ph){
    const mediaWrap = document.createElement("div");
    mediaWrap.className = "listMediaWrap";

    // Todas las fotos del anuncio (principal + adicionales), en orden.
    const photos = collectAllPhotoUrls(p);
    const n = photos.length;

    // Índice de la foto principal mostrada. El carrusel rota alrededor de él.
    let idx = 0;

    // --- Hero: foto principal con flechas de navegación -------------------
    const hero = document.createElement("div");
    hero.className = "listHero";

    const makeThumbPh = () => {
      const tph = document.createElement("div");
      tph.className = "listThumbPh";
      tph.textContent = "Foto";
      return tph;
    };

    let mainEl;
    if (n > 0){
      mainEl = document.createElement("img");
      mainEl.className = "listImg";
      mainEl.alt = "";
      // Eager: la foto principal del anuncio debe verse siempre, sin depender
      // de que la tarjeta entre en el viewport (el lazy fallaba en listas
      // largas / contenedores con scroll y dejaba el hero en blanco).
      mainEl.loading = "eager";
      mainEl.decoding = "async";
      mainEl.fetchPriority = "high";
      mainEl.onerror = () => {
        const mph = document.createElement("div");
        mph.className = "listImgPh";
        mph.textContent = "Foto";
        mainEl.replaceWith(mph);
      };
    } else {
      mainEl = ph; // placeholder existente
    }
    hero.appendChild(mainEl);

    const badge = createListBadge(p);
    if (badge) hero.appendChild(badge);

    let counterEl = null;
    let prevBtn = null;
    let nextBtn = null;
    if (n > 1){
      counterEl = document.createElement("div");
      counterEl.className = "listHeroCount";
      hero.appendChild(counterEl);

      const chevron = (d) =>
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

      prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "listNav listNavPrev";
      prevBtn.setAttribute("aria-label", "Foto anterior");
      prevBtn.innerHTML = chevron("M15 18l-6-6 6-6");

      nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "listNav listNavNext";
      nextBtn.setAttribute("aria-label", "Foto siguiente");
      nextBtn.innerHTML = chevron("M9 6l6 6-6 6");

      hero.appendChild(prevBtn);
      hero.appendChild(nextBtn);
    }

    mediaWrap.appendChild(hero);

    // --- Miniaturas: tira de las demás fotos del anuncio ------------------
    // Se renderizan SOLO las fotos que existen de verdad: nunca dibujamos
    // huecos "Foto" vacíos. En producción cada anuncio trae 5+ fotos, así que
    // siempre habrá tira; durante la beta (1 foto) la tira queda vacía y se
    // retira del DOM para que el hero ocupe todo, sin espacios muertos.
    const thumbs = document.createElement("div");
    thumbs.className = "listThumbs";

    // Actualiza foto principal, contador y miniaturas según el índice actual.
    function render(){
      if (n > 0) mainEl.src = photos[idx];
      if (counterEl) counterEl.textContent = `${idx + 1}/${n}`;

      // Las dos siguientes fotos distintas (rotando alrededor de la principal).
      const upcoming = [];
      for (let k = 1; k < n; k++) upcoming.push({ url: photos[(idx + k) % n], i: (idx + k) % n });
      const show = upcoming.slice(0, 2);

      thumbs.innerHTML = "";
      show.forEach((data) => {
        const el = document.createElement("img");
        el.className = "listThumb";
        el.src = data.url;
        el.alt = "";
        el.loading = "lazy";
        el.decoding = "async";
        el.title = "Ver esta foto";
        el.onerror = () => { el.replaceWith(makeThumbPh()); };
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          idx = data.i;
          render();
        });
        thumbs.appendChild(el);
      });

      // Sin fotos adicionales: retiramos la tira para que no deje hueco.
      if (show.length === 0){
        if (thumbs.parentNode) thumbs.remove();
      } else if (!thumbs.parentNode){
        mediaWrap.appendChild(thumbs);
      }
    }

    if (prevBtn) prevBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      idx = (idx - 1 + n) % n;
      render();
    });
    if (nextBtn) nextBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      idx = (idx + 1) % n;
      render();
    });

    render();

    return mediaWrap;
  }

  let map = L.map("map", {
    zoomSnap: 0.25,   // permite niveles fraccionarios (13.25, 13.5, ...)
    zoomDelta: 0.75,  // cada clic en +/- mueve 0.75 niveles (entre medio y entero)
  }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  window.__bhMap = map;

  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap &copy; CARTO"
  }).addTo(map);

  let markersLayer = L.layerGroup().addTo(map);
  let activeMarker = null;

  // Relación listing_id -> marcador (para hover/selección)
  const markerById = new Map();

  function deselectActiveMarker(){
    if (activeMarker && activeMarker._icon) {
      const dot = activeMarker._icon.querySelector(".dot");
      dot?.classList.remove("active");
      // Si era visto, se queda en modo visto
      const id = activeMarker.options?.__listingId;
      if (id && seenSet.has(String(id))) dot?.classList.add("seen");
    }
    activeMarker = null;
  }

  function clearMarkers() {
    markersLayer.clearLayers();
    markerById.clear();
    activeMarker = null;
  }

  function addPoint(p) {
    if (p.lat == null || p.lng == null) return;

    const el = document.createElement("div");
    el.className = "dot";

    const idStr = String(p.listing_id || "");
    if (idStr && seenSet.has(idStr)) el.classList.add("seen");

    const icon = L.divIcon({
      className: "",
      html: el,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const m = L.marker([p.lat, p.lng], { icon }).addTo(markersLayer);
    m.options.__listingId = idStr;

    if (idStr) markerById.set(idStr, m);

    m.on("click", () => {
      if (areaState.isDrawing) return;

      // Selección visual
      deselectActiveMarker();
      activeMarker = m;

      const dot = m._icon?.querySelector(".dot");
      dot?.classList.add("active");
      dot?.classList.remove("seen"); // activo manda

      openCardForPoint(p);
    });
  }

  function getCurrentBounds() {
    const b = map.getBounds();
    return {
      south: b.getSouthWest().lat,
      west: b.getSouthWest().lng,
      north: b.getNorthEast().lat,
      east: b.getNorthEast().lng
    };
  }

  async function rpcSearchMapPoints(bounds, filters) {
    const body = {
      p_south: bounds.south,
      p_west: bounds.west,
      p_north: bounds.north,
      p_east: bounds.east,

      p_mode: (filters.mode && filters.mode !== "all") ? filters.mode : null,

      p_price_min: filters.priceMin,
      p_price_max: filters.priceMax,

      p_listed_since_days: filters.listedSinceDays,
      p_availability: filters.availability,

      p_useful_min: filters.usefulMin,
      p_useful_max: filters.usefulMax,

      p_built_min: filters.builtMin,
      p_built_max: filters.builtMax,

      p_bedrooms_min: filters.bedroomsMin,
      p_bathrooms_min: filters.bathroomsMin,

      p_outdoor_type: filters.outdoorType,
      p_orientations: filters.orientations,

      p_energy_choice: filters.energyChoice,

      p_build_periods: filters.buildPeriods,

      p_parking_types: filters.parkingTypes,
      p_storage_types: filters.storageTypes,

      p_accessibility: filters.accessibility
    };

    const url = `${SUPABASE_URL}/rest/v1/rpc/search_map_points_filtered`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt);
    }

    return await res.json();
  }

  let debounceTimer = null;

  const MAX_AREAS = 5;

  const areaState = {
    pointsActive: false,
    freehandActive: false,

    drawingMode: null,
    isDrawing: false,

    isFreehandActive: false,
    points: [],
    tempLine: null,
    tempFirstMarker: null,
    tempVertexMarkers: [],
    tempLivePoly: null,

    polys: [],
    nextId: 1,

    btnPointsEl: null,
    btnFreeEl: null,
    btnPlusPointsEl: null,
    btnPlusFreeEl: null,

    refreshAreasUI: null,

    sunBtnForceOff: null,
    lastHint: ""
  };

  const areasLayer = L.layerGroup().addTo(map);

  function setAreaHintVisible(visible, text){
    areaHintEl.style.display = visible ? "block" : "none";
    areaHintEl.setAttribute("aria-hidden", visible ? "false" : "true");
    if (typeof text === "string") {
      areaHintTextEl.textContent = text;
      areaState.lastHint = text;
    }
  }

  function setMarkersVisible(visible){
    const has = map.hasLayer(markersLayer);
    if (visible && !has) markersLayer.addTo(map);
    if (!visible && has) map.removeLayer(markersLayer);
  }

  function clearTempDrawing(){
    if (areaState.tempLine) { areasLayer.removeLayer(areaState.tempLine); areaState.tempLine = null; }
    if (areaState.tempLivePoly) { areasLayer.removeLayer(areaState.tempLivePoly); areaState.tempLivePoly = null; }

    if (areaState.tempFirstMarker) {
      areasLayer.removeLayer(areaState.tempFirstMarker);
      areaState.tempFirstMarker = null;
    }

    areaState.tempVertexMarkers.forEach(m => areasLayer.removeLayer(m));
    areaState.tempVertexMarkers = [];
    areaState.points = [];
  }

  function cancelCurrentDrawing(){
    if (!areaState.isDrawing) return;
    areaState.isDrawing = false;
    areaState.isFreehandActive = false;
    areaState.drawingMode = null;
    disableDrawLock();
    clearTempDrawing();
    setMarkersVisible(true);
    setAreaHintVisible(false, "");
  }

  function latlngsToSimple(latlngs){
    return latlngs.map(ll => ({ lat: ll.lat, lng: ll.lng }));
  }

  function pointInPoly(lat, lng, poly){
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].lng, yi = poly[i].lat;
      const xj = poly[j].lng, yj = poly[j].lat;

      const intersect = ((yi > lat) !== (yj > lat)) &&
        (lng < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi);

      if (intersect) inside = !inside;
    }
    return inside;
  }

  function isInsideAnyArea(p){
    if (!areaState.polys.length) return true;
    if (p.lat == null || p.lng == null) return false;
    const lat = p.lat, lng = p.lng;
    for (const a of areaState.polys) {
      if (pointInPoly(lat, lng, a.latlngs)) return true;
    }
    return false;
  }

  function northwestVertex(latlngs){
    let best = null;
    for (const ll of latlngs) {
      if (!best) { best = ll; continue; }
      if (ll.lat > best.lat) best = ll;
      else if (ll.lat === best.lat && ll.lng < best.lng) best = ll;
    }
    return best || latlngs[0];
  }

  function makeDelMarker(latlng, areaId){
    const el = document.createElement("div");
    el.className = "areaDel";
    const s = document.createElement("span");
    s.textContent = "×";
    el.appendChild(s);

    const icon = L.divIcon({
      className: "",
      html: el,
      iconSize: [22,22],
      iconAnchor: [11,11]
    });

    const m = L.marker(latlng, { icon, interactive: true, keyboard: false });

    m.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      removeAreaById(areaId);
    });

    return m;
  }

  function removeAreaById(id, opts){
    const options = opts || {};
    const idx = areaState.polys.findIndex(x => x.id === id);
    if (idx < 0) return;

    const removed = areaState.polys[idx];

    if (removed.poly) areasLayer.removeLayer(removed.poly);
    if (removed.delMarker) areasLayer.removeLayer(removed.delMarker);

    areaState.polys.splice(idx, 1);

    if (removed && removed.type) {
      const stillAny = areaState.polys.some(a => a.type === removed.type);
      if (!stillAny) {
        if (removed.type === "points") {
          areaState.pointsActive = false;
          if (areaState.isDrawing && areaState.drawingMode === "points") cancelCurrentDrawing();
        }
        if (removed.type === "freehand") {
          areaState.freehandActive = false;
          if (areaState.isDrawing && areaState.drawingMode === "freehand") cancelCurrentDrawing();
        }
      }
    }

    if (!options.silentUI && areaState.refreshAreasUI) {
      areaState.refreshAreasUI();
    }

    scheduleReload();
  }

  function removeAreasByType(type){
    const ids = areaState.polys.filter(a => a.type === type).map(a => a.id);
    ids.forEach(id => removeAreaById(id, { silentUI: true }));
    if (areaState.refreshAreasUI) areaState.refreshAreasUI();
    scheduleReload();
  }

  function addAreaPolygon(latlngs, type){
    if (!latlngs || latlngs.length < 3) return false;
    if (areaState.polys.length >= MAX_AREAS) return false;

    const t = (type === "freehand") ? "freehand" : "points";

    const id = areaState.nextId++;
    const poly = L.polygon(latlngs, {
      color: "rgba(26,115,232,0.80)",
      weight: 3,
      opacity: 1,
      fillColor: "rgba(26,115,232,0.20)",
      fillOpacity: 0.18
    }).addTo(areasLayer);

    const nw = northwestVertex(latlngs);
    const delMarker = makeDelMarker(nw, id).addTo(areasLayer);

    areaState.polys.push({
      id,
      type: t,
      latlngs: latlngsToSimple(latlngs),
      poly,
      delMarker
    });

    if (areaState.refreshAreasUI) areaState.refreshAreasUI();
    return true;
  }

  function startNewAreaDrawing(mode){
    if (areaState.polys.length >= MAX_AREAS) return;
    if (mode !== "points" && mode !== "freehand") return;

    if (areaState.sunBtnForceOff) areaState.sunBtnForceOff();

    closeCard();
    clearTempDrawing();

    areaState.isDrawing = true;
    areaState.drawingMode = mode;
    setMarkersVisible(false);

    if (mode === "points") {
      setAreaHintVisible(true, "Haz clic punto a punto para dibujar el área");
      areaState.points = [];
      areaState.tempLine = L.polyline([], {
        color: "rgba(26,115,232,0.88)",
        weight: 3,
        opacity: 1
      }).addTo(areasLayer);
    }

    if (mode === "freehand") {
      setAreaHintVisible(true, "Mantén pulsado y dibuja el área");
      areaState.points = [];
      areaState.isFreehandActive = false;
      enableDrawLock();
    }
  }

  function finishDrawingPoints(){
    const pts = areaState.points.slice();
    if (pts.length < 3) {
      cancelCurrentDrawing();
      scheduleReload();
      return;
    }

    addAreaPolygon(pts, "points");

    cancelCurrentDrawing();
    scheduleReload();
  }

  function addPointVertex(latlng){
    areaState.points.push(latlng);

    if (areaState.tempLine) {
      areaState.tempLine.addLatLng(latlng);
    }

    const isFirst = areaState.points.length === 1;

    const circle = L.circleMarker(latlng, {
      radius: isFirst ? 7 : 6,
      color: "rgba(255,255,255,0.95)",
      weight: 3,
      fillColor: "rgba(26,115,232,0.90)",
      fillOpacity: 1
    }).addTo(areasLayer);

    if (isFirst) {
      areaState.tempFirstMarker = circle;
      circle.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        if (!areaState.isDrawing || areaState.drawingMode !== "points") return;
        finishDrawingPoints();
      });
    } else {
      areaState.tempVertexMarkers.push(circle);
    }
  }

  function maybeCloseFirst(latlng){
    if (!areaState.tempFirstMarker) return false;
    const first = areaState.points[0];
    if (!first) return false;
    const d = map.distance(first, latlng);
    return d <= 12;
  }

  function simplifyRDP(points, epsilonPx){
    if (!points || points.length < 3) return points || [];
    const sqEps = epsilonPx * epsilonPx;

    function sqSegDist(p, a, b){
      let x = a.x, y = a.y;
      let dx = b.x - x;
      let dy = b.y - y;

      if (dx !== 0 || dy !== 0) {
        const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx*dx + dy*dy);
        if (t > 1) { x = b.x; y = b.y; }
        else if (t > 0) { x += dx * t; y += dy * t; }
      }

      dx = p.x - x;
      dy = p.y - y;
      return dx*dx + dy*dy;
    }

    function rdp(pts, first, last, out){
      let maxSqDist = sqEps;
      let index = -1;

      for (let i = first + 1; i < last; i++) {
        const sqD = sqSegDist(pts[i], pts[first], pts[last]);
        if (sqD > maxSqDist) {
          index = i;
          maxSqDist = sqD;
        }
      }

      if (index !== -1) {
        if (index - first > 1) rdp(pts, first, index, out);
        out.push(pts[index]);
        if (last - index > 1) rdp(pts, index, last, out);
      }
    }

    const out = [points[0]];
    rdp(points, 0, points.length - 1, out);
    out.push(points[points.length - 1]);
    return out;
  }

  function latlngsFromFreehand(rawLatLngs){
    if (!rawLatLngs || rawLatLngs.length < 3) return [];
    const zoom = map.getZoom();
    const proj = rawLatLngs.map(ll => {
      const p = map.project(ll, zoom);
      return { x: p.x, y: p.y, ll };
    });

    const simplified = simplifyRDP(proj, 3.0);
    const out = simplified.map(p => p.ll);

    if (out.length >= 3) {
      const first = out[0];
      const last = out[out.length - 1];
      const d = map.distance(first, last);
      if (d > 5) out.push(first);
    }

    const uniq = [];
    for (const ll of out) {
      const prev = uniq[uniq.length - 1];
      if (!prev) { uniq.push(ll); continue; }
      const dd = map.distance(prev, ll);
      if (dd >= 1) uniq.push(ll);
    }
    return uniq.length >= 3 ? uniq : [];
  }

  let freehandLastSample = null;
  let freehandBound = false;

  // Convierte un evento de ratón O táctil en latlng del mapa.
  function drawLatLngFromEvent(ev){
    let src = ev;
    if (ev.touches && ev.touches.length) src = ev.touches[0];
    else if (ev.changedTouches && ev.changedTouches.length) src = ev.changedTouches[0];
    if (!src || src.clientX == null) return null;
    try { return map.mouseEventToLatLng(src); } catch (err) { return null; }
  }

  // Bloquea el arrastre/zoom del mapa mientras el modo "dibujo libre" está activo.
  // En pantallas táctiles esto es lo que evita que el dedo mueva o haga zoom al
  // mapa: en su lugar el dedo dibuja el área.
  function enableDrawLock(){
    if (areaState._drawLocked) return;
    areaState._drawLocked = true;
    try { map.dragging.disable(); } catch (e) {}
    try { map.touchZoom.disable(); } catch (e) {}
    try { map.doubleClickZoom.disable(); } catch (e) {}
    try { map.boxZoom.disable(); } catch (e) {}
    if (map.tap) { try { map.tap.disable(); } catch (e) {} }
    map.getContainer().classList.add("bh-drawing");
  }

  function disableDrawLock(){
    if (!areaState._drawLocked) return;
    areaState._drawLocked = false;
    try { map.dragging.enable(); } catch (e) {}
    try { map.touchZoom.enable(); } catch (e) {}
    try { map.doubleClickZoom.enable(); } catch (e) {}
    try { map.boxZoom.enable(); } catch (e) {}
    if (map.tap) { try { map.tap.enable(); } catch (e) {} }
    map.getContainer().classList.remove("bh-drawing");
  }

  function freehandStart(ev){
    if (!areaState.isDrawing || areaState.drawingMode !== "freehand") return;
    if (areaState.isFreehandActive) return;

    const startLL = drawLatLngFromEvent(ev);
    if (!startLL) return;

    // Impide que el navegador haga scroll / pan / zoom al arrastrar el dedo.
    if (ev.cancelable) ev.preventDefault();

    areaState.isFreehandActive = true;
    areaState.points = [startLL];
    freehandLastSample = { ll: startLL, t: Date.now() };

    if (areaState.tempLine) { areasLayer.removeLayer(areaState.tempLine); areaState.tempLine = null; }
    if (areaState.tempLivePoly) { areasLayer.removeLayer(areaState.tempLivePoly); areaState.tempLivePoly = null; }

    areaState.tempLine = L.polyline([startLL], {
      color: "rgba(26,115,232,0.88)",
      weight: 3,
      opacity: 1
    }).addTo(areasLayer);
  }

  function freehandMove(ev){
    if (!areaState.isFreehandActive) return;
    // Mientras dibujamos, bloqueamos el gesto nativo en cada movimiento.
    if (ev.cancelable) ev.preventDefault();

    const ll = drawLatLngFromEvent(ev);
    if (!ll) return;

    const now = Date.now();
    const prev = freehandLastSample?.ll;

    let ok = true;
    if (freehandLastSample) {
      const dt = now - freehandLastSample.t;
      const dist = prev ? map.distance(prev, ll) : 999;
      ok = (dt >= 18) && (dist >= 2.0);
    }

    if (!ok) return;

    areaState.points.push(ll);
    freehandLastSample = { ll, t: now };
    if (areaState.tempLine) areaState.tempLine.addLatLng(ll);
  }

  function freehandEnd(ev){
    if (!areaState.isFreehandActive) return;
    if (ev && ev.cancelable) ev.preventDefault();
    finishFreehand();
  }

  // Listeners DOM nativos sobre el contenedor del mapa. Se enlazan una sola vez;
  // sólo actúan cuando estamos en modo "dibujo libre" (las funciones comprueban
  // el estado). Usar listeners nativos con { passive: false } nos permite llamar
  // a preventDefault() y así evitar el desplazamiento táctil de la página.
  function bindFreehandListeners(){
    if (freehandBound) return;
    freehandBound = true;
    const c = map.getContainer();
    c.addEventListener("mousedown", freehandStart);
    window.addEventListener("mousemove", freehandMove);
    window.addEventListener("mouseup", freehandEnd);
    c.addEventListener("touchstart", freehandStart, { passive: false });
    c.addEventListener("touchmove", freehandMove, { passive: false });
    c.addEventListener("touchend", freehandEnd, { passive: false });
    c.addEventListener("touchcancel", freehandEnd, { passive: false });
  }

  function finishFreehand(){
    if (!areaState.isDrawing || areaState.drawingMode !== "freehand") return;

    if (areaState.tempLine) { areasLayer.removeLayer(areaState.tempLine); areaState.tempLine = null; }

    const raw = areaState.points.slice();
    areaState.isFreehandActive = false;

    const simplifiedLL = latlngsFromFreehand(raw);

    const totalLen = (() => {
      let sum = 0;
      for (let i = 1; i < raw.length; i++) sum += map.distance(raw[i-1], raw[i]);
      return sum;
    })();

    if (!simplifiedLL || simplifiedLL.length < 3 || totalLen < 20) {
      cancelCurrentDrawing();
      scheduleReload();
      return;
    }

    addAreaPolygon(simplifiedLL, "freehand");

    cancelCurrentDrawing();
    scheduleReload();
  }

  function handleMapClickForAreas(e){
    if (!areaState.isDrawing) return false;

    if (areaState.drawingMode === "points") {
      const ll = e.latlng;
      if (!ll) return true;

      if (areaState.points.length >= 3 && maybeCloseFirst(ll)) {
        finishDrawingPoints();
        return true;
      }

      addPointVertex(ll);
      return true;
    }

    return true;
  }

  // Enlaza los listeners de dibujo libre (ratón + táctil) una sola vez.
  bindFreehandListeners();

  // Estado de resultados actuales (para listado)
  let currentRows = [];
  // Último conjunto de anuncios traído del servidor (sin filtrar por áreas),
  // para poder re-filtrar al vuelo cuando cambia el área de transporte.
  let lastFetchedRows = [];
  let lastViewInfo = { z: 0, mode: "" };

  function getListOrder(){
    return window.__bhListOrder || "date_desc";
  }

  function sortRows(rows){
    const order = getListOrder();
    const arr = rows.slice();

    function dateVal(r){
      const d = r.listed_at ? new Date(r.listed_at) : null;
      const t = d && !isNaN(d.getTime()) ? d.getTime() : 0;
      return t;
    }
    function sizeVal(r){
      const n = (r.useful_area_m2 != null) ? Number(r.useful_area_m2) : 0;
      return Number.isFinite(n) ? n : 0;
    }

    if (order === "size_asc") arr.sort((a,b)=> sizeVal(a) - sizeVal(b));
    else if (order === "size_desc") arr.sort((a,b)=> sizeVal(b) - sizeVal(a));
    else arr.sort((a,b)=> dateVal(b) - dateVal(a)); // date_desc por defecto

    return arr;
  }

  function renderList(){
    if (!listItemsEl) return;

    const rows = sortRows(currentRows);

    const frag = document.createDocumentFragment();
    listItemsEl.innerHTML = "";

    rows.forEach((p) => {
      const id = String(p.listing_id || "");

      const img = (p.main_photo_url)
        ? (() => {
            const i = document.createElement("img");
            i.className = "listImg";
            i.src = p.main_photo_url;
            i.alt = "";
            i.onerror = () => {
              i.replaceWith(ph);
            };
            return i;
          })()
        : null;

      const ph = document.createElement("div");
      ph.className = "listImgPh";
      ph.textContent = "Foto";

      const left = createListMediaWrap(p, img, ph);

      const title = document.createElement("div");
      title.className = "listTitle";
      title.textContent = buildAddressTop(p);

      const sub = document.createElement("div");
      sub.className = "listSub";
      sub.textContent = buildAddressBottom(p);

      const price = document.createElement("div");
      price.className = "listPrice";
      price.textContent = (p.price_eur != null) ? euro(p.price_eur) : "—";

      const meta = document.createElement("div");
      meta.className = "listMeta";
      const m2 = (p.useful_area_m2 != null) ? `${p.useful_area_m2} m²` : "— m²";
      const beds = (p.bedrooms != null) ? `${p.bedrooms}` : "—";
      const baths = (p.bathrooms != null) ? `${p.bathrooms}` : "—";
      meta.innerHTML = `<span class="listFact">${iconArea()}${m2}</span><span class="listFact">${iconBed()}${beds}</span><span class="listFact">${iconBath()}${baths}</span>`;

      const agency = document.createElement("div");
      agency.className = "listAgency";
      agency.textContent = p.agency_name || "—";

      const right = document.createElement("div");
      right.className = "listBody";
      right.appendChild(title);
      right.appendChild(sub);
      right.appendChild(price);
      right.appendChild(meta);
      right.appendChild(agency);

      const card = document.createElement("div");
      card.className = "listCard";
      card.appendChild(left);
      card.appendChild(right);

      // Hover: resalta marcador sin hacer click (pedido)
      card.addEventListener("mouseenter", () => {
        const m = markerById.get(id);
        if (m && m._icon) {
          const dot = m._icon.querySelector(".dot");
          dot?.classList.add("hover");
        }
      });
      card.addEventListener("mouseleave", () => {
        const m = markerById.get(id);
        if (m && m._icon) {
          const dot = m._icon.querySelector(".dot");
          dot?.classList.remove("hover");
        }
      });

      // Click: abrir ficha directamente (pedido)
      card.addEventListener("click", () => {
        markSeen(id);
        window.location.href = `listing.html?id=${encodeURIComponent(id)}`;
      });

      frag.appendChild(card);
    });

    listItemsEl.appendChild(frag);
  }

  async function loadPointsForCurrentView() {
    const b = getCurrentBounds();
    const z = map.getZoom();
    const f = getParams();

    if (areaState.isDrawing) {
      setStatus(areaState.lastHint || "Dibujando área...");
      return;
    }

    setStatus(`Cargando...`);
    const rows = await rpcSearchMapPoints(b, f);
    lastFetchedRows = rows;
    await attachListingMedia(rows);
    await attachListingDetail(rows);
    storeListingPhotos(rows);
    lastViewInfo = { z, mode: f.mode };
    applyAreaFilterAndRender();
  }

  // Aplica TODOS los filtros geográficos (áreas dibujadas + área de transporte)
  // sobre el último conjunto de anuncios traído del servidor y vuelve a pintar
  // mapa + listado. Se puede invocar sin volver a consultar al servidor (p. ej.
  // al mover el punto de transporte o el slider de minutos).
  function applyAreaFilterAndRender() {
    const filtered = lastFetchedRows.filter(
      (p) => isInsideAnyArea(p) && isInsideTransportArea(p)
    );

    currentRows = filtered;

    clearMarkers();
    filtered.forEach(addPoint);

    renderList();

    const z = lastViewInfo.z, mode = lastViewInfo.mode;
    setStatus(`Anuncios: ${filtered.length} | zoom ${z} | modo=${mode}`);
  }

  function isMapHidden() {
    const g = document.querySelector(".grid3");
    return !!(g && g.classList.contains("hideMap"));
  }

  function scheduleReload() {
    // Si el mapa está oculto (listado extendido) su contenedor mide 0×0 y
    // getBounds() devuelve un área degenerada: refetch -> 0 resultados ->
    // se vaciaría el listado. Mantenemos los resultados actuales.
    if (isMapHidden()) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      try {
        await loadNewInSearchIds();
      await loadPointsForCurrentView();
      } catch (e) {
        const msg = (e && e.message) ? e.message : String(e);
        setStatus(`Error: ${msg}`);
        console.error(e);
      }
    }, 300);
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  async function geocodeCity(city) {
    const normalized = normalizeSearchText(city);

    // Evita que Nominatim resuelva "Murcia" como zona periférica o punto turístico.
    // Centro urbano de Murcia.
    if (normalized === "murcia") {
      return [37.9922, -1.1307];
    }

    const structuredUrl =
      `https://nominatim.openstreetmap.org/search?format=json&city=${encodeURIComponent(city)}&country=España&countrycodes=es&limit=5`;

    try {
      const structuredRes = await fetch(structuredUrl, { headers: { "Accept": "application/json" } });
      if (structuredRes.ok) {
        const structuredData = await structuredRes.json();
        const bestStructured = (structuredData || []).find((item) => {
          const type = String(item.type || "").toLowerCase();
          const cls = String(item.class || "").toLowerCase();
          return cls === "boundary" || type === "city" || type === "town" || type === "municipality" || type === "administrative";
        }) || structuredData?.[0];

        if (bestStructured) {
          return [parseFloat(bestStructured.lat), parseFloat(bestStructured.lon)];
        }
      }
    } catch {}

    const fallbackUrl =
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city + ", España")}&countrycodes=es&limit=5`;

    const res = await fetch(fallbackUrl, { headers: { "Accept": "application/json" } });
    if (!res.ok) return null;

    const data = await res.json();
    const best = (data || []).find((item) => {
      const type = String(item.type || "").toLowerCase();
      const cls = String(item.class || "").toLowerCase();
      return cls === "boundary" || type === "city" || type === "town" || type === "municipality" || type === "administrative";
    }) || data?.[0];

    if (!best) return null;
    return [parseFloat(best.lat), parseFloat(best.lon)];
  }

  async function goToCity(city) {
    setStatus("Buscando ciudad...");
    const center = await geocodeCity(city);
    if (center) map.setView(center, 13);
    scheduleReload();
  }

  function wireHeaderMiniSearch(){
    const form = document.getElementById("miniSearchForm");
    const input = document.getElementById("miniQ");
    if (!form || !input) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const city = (input.value || "").trim();
      if (!city) return;

      const u = new URL(window.location.href);
      u.searchParams.set("city", city);
      history.replaceState(null, "", u.toString());

      await goToCity(city);
    });
  }

  function wireHeaderNav(){
    const fav = document.getElementById("navFavoritos");
    const login = document.getElementById("navLogin");

    if (fav) fav.addEventListener("click", (e) => {
      e.preventDefault();
      alert("MVP: Favoritos (requiere registro).");
    });

    if (login) login.addEventListener("click", (e) => {
      e.preventDefault();
      alert("MVP: Iniciar sesión.");
    });
  }

  map.on("moveend", scheduleReload);
  map.on("zoomend", scheduleReload);

  map.on("click", (e) => {
    const consumed = handleMapClickForAreas(e);
    if (consumed) return;
    closeCard();
  });

  window.addEventListener("bh:filters-changed", () => {
    // cerrar tarjeta al cambiar filtros para evitar incoherencias visuales
    closeCard();
    scheduleReload();
  });

  // Si cambia el orden del listado: re-render (sin refetch)
  window.addEventListener("bh:list-order-changed", () => {
    renderList();
  });

  // Sol (tu implementación original, casi intacta)
  const ZOOM_SOL_MIN = 13;
  let sunEnabled = false;
  const sunState = { dateISO: null, minutes: null, sunriseMin: null, sunsetMin: null };

  function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  }

  function nowMinutes() {
    const d = new Date();
    return d.getHours()*60 + d.getMinutes();
  }

  function minutesToHHMM(mins) {
    const h = Math.floor(mins/60);
    const m = mins % 60;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  }

  function rad2deg(r){ return r * 180 / Math.PI; }

  function sunBearingAndAltDeg(lat, lng, dateObj){
    const pos = SunCalc.getPosition(dateObj, lat, lng);
    const azDeg = rad2deg(pos.azimuth);
    const bearingDeg = (180 + azDeg + 360) % 360;
    const altDeg = rad2deg(pos.altitude);
    return { bearingDeg, altDeg };
  }

  function bearingToCardinal(deg){
    const dirs = ["N","NE","E","SE","S","SO","O","NO"];
    const idx = Math.round(deg / 45) % 8;
    return dirs[idx];
  }

  function buildDateObj(iso, minutes) {
    const [y,m,d] = iso.split("-").map(x => parseInt(x,10));
    const hh = Math.floor(minutes/60);
    const mm = minutes % 60;
    return new Date(y, (m-1), d, hh, mm, 0, 0);
  }

  function addDaysISO(iso, deltaDays){
    const [y,m,d] = iso.split("-").map(x => parseInt(x,10));
    const dt = new Date(y, m-1, d, 12, 0, 0, 0);
    dt.setDate(dt.getDate() + deltaDays);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth()+1).padStart(2,"0");
    const dd = String(dt.getDate()).padStart(2,"0");
    return `${yy}-${mm}-${dd}`;
  }

  function svgClear(el){ while (el.firstChild) el.removeChild(el.firstChild); }
  function svgEl(name, attrs){
    const el = document.createElementNS("http://www.w3.org/2000/svg", name);
    if (attrs) for (const [k,v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
  }

  function polarXY(cx, cy, R, bearingDeg, altDeg){
    const a = Math.max(0, Math.min(90, Math.abs(altDeg)));
    const r = ((90 - a) / 90) * R;
    const t = bearingDeg * Math.PI / 180;
    const x = cx + r * Math.sin(t);
    const y = cy - r * Math.cos(t);
    return { x, y };
  }

  function arcPath(cx, cy, r, a0Deg, a1Deg){
    const a0 = (a0Deg - 90) * Math.PI/180;
    const a1 = (a1Deg - 90) * Math.PI/180;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    let da = ((a1Deg - a0Deg) % 360 + 360) % 360;
    const large = da > 180 ? 1 : 0;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }

  function drawSunPolar(svg, centerLatLng, dateISO, minutes){
    const V = 1120;
    const cx = V/2;
    const cy = V/2;
    const R = 450;

    svg.setAttribute("viewBox", `0 0 ${V} ${V}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svgClear(svg);

    svg.appendChild(svgEl("circle", {
      cx, cy, r: R,
      fill: "rgba(255,255,255,0.00)",
      stroke: "rgba(0,0,0,0.35)",
      "stroke-width": "3"
    }));

    const axes = [
      { a:0,   label:"N", x: cx,          y: cy - R - 22, anchor:"middle" },
      { a:90,  label:"E", x: cx + R + 22, y: cy + 12,     anchor:"start"  },
      { a:180, label:"S", x: cx,          y: cy + R + 42, anchor:"middle" },
      { a:270, label:"O", x: cx - R - 22, y: cy + 12,     anchor:"end"    },
    ];

    [0,90,180,270].forEach(a=>{
      const p = polarXY(cx, cy, R, a, 0);
      svg.appendChild(svgEl("line", {
        x1: cx, y1: cy, x2: p.x, y2: p.y,
        stroke: "rgba(0,0,0,0.20)",
        "stroke-width": "2"
      }));
    });

    axes.forEach(o=>{
      const t = svgEl("text", {
        x: o.x,
        y: o.y,
        "text-anchor": o.anchor,
        "font-size": "34",
        fill: "rgba(0,0,0,0.45)",
        "data-axis": o.label
      });
      t.textContent = o.label;
      svg.appendChild(t);
    });

    const dayNoon = buildDateObj(dateISO, 12*60);
    const times = SunCalc.getTimes(dayNoon, centerLatLng.lat, centerLatLng.lng);
    const sunrise = times.sunrise;
    const sunset = times.sunset;

    let haveSunTimes = false;

    if (sunrise instanceof Date && !isNaN(sunrise.getTime()) && sunset instanceof Date && !isNaN(sunset.getTime())) {
      const sr = sunBearingAndAltDeg(centerLatLng.lat, centerLatLng.lng, sunrise);
      const ss = sunBearingAndAltDeg(centerLatLng.lat, centerLatLng.lng, sunset);

      haveSunTimes = true;

      const d1 = arcPath(cx, cy, R, sr.bearingDeg, ss.bearingDeg);

      svg.appendChild(svgEl("path", {
        d: `${d1} L ${cx} ${cy} Z`,
        fill: "rgba(255, 196, 50, 0.14)",
        stroke: "none"
      }));

      svg.appendChild(svgEl("path", {
        d: d1,
        fill: "none",
        stroke: "rgba(255, 140, 0, 0.65)",
        "stroke-width": "6",
        "stroke-linecap": "round"
      }));
    }

    const curDate = buildDateObj(dateISO, minutes);
    const cur = sunBearingAndAltDeg(centerLatLng.lat, centerLatLng.lng, curDate);
    const meta = { isDay: cur.altDeg > 0, bearingDeg: cur.bearingDeg, altDeg: cur.altDeg };

    const sunR = Math.round(18 * 1.15);
    const sunStroke = Math.round(6 * 1.15);

    const sunRingYellow = "rgba(255, 196, 50, 0.98)";
    const sunLineYellow = "rgba(255, 196, 50, 0.86)";

    if (meta.isDay) {
      if (haveSunTimes) {
        const pts = [];
        const stepMin = 6;
        const start = sunrise.getTime();
        const end = sunset.getTime();
        for (let tt = start; tt <= end; tt += stepMin*60*1000) {
          const d = new Date(tt);
          const pa = sunBearingAndAltDeg(centerLatLng.lat, centerLatLng.lng, d);
          if (pa.altDeg >= 0) pts.push(polarXY(cx, cy, R, pa.bearingDeg, pa.altDeg));
        }
        if (pts.length >= 2) {
          const dAttr = pts.map((p,i)=> `${i===0?"M":"L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
          svg.appendChild(svgEl("path", {
            d: dAttr,
            fill: "none",
            stroke: "rgba(255, 140, 0, 0.88)",
            "stroke-width": "8",
            "stroke-linecap": "round",
            "stroke-linejoin": "round"
          }));
        }
      }

      const p = polarXY(cx, cy, R, cur.bearingDeg, cur.altDeg);

      svg.appendChild(svgEl("line", {
        x1: cx, y1: cy, x2: p.x, y2: p.y,
        stroke: sunLineYellow,
        "stroke-width": "8",
        "stroke-linecap": "round"
      }));

      svg.appendChild(svgEl("circle", {
        cx: p.x, cy: p.y, r: sunR,
        fill: "rgba(255, 120, 60, 0.95)",
        stroke: sunRingYellow,
        "stroke-width": String(sunStroke)
      }));
    } else {
      const p = polarXY(cx, cy, R, cur.bearingDeg, cur.altDeg);

      svg.appendChild(svgEl("circle", {
        cx: p.x, cy: p.y, r: sunR,
        fill: "rgba(165,165,165,0.86)",
        stroke: sunRingYellow,
        "stroke-width": String(sunStroke)
      }));
    }

    return meta;
  }

  function minutesOfDate(d){
    if (!(d instanceof Date) || isNaN(d.getTime())) return null;
    return d.getHours() * 60 + d.getMinutes();
  }

  function updateDaylightBand(){
    const c = map.getCenter();
    const iso = sunState.dateISO || todayISO();
    const noon = buildDateObj(iso, 12*60);
    const times = SunCalc.getTimes(noon, c.lat, c.lng);

    const sr = minutesOfDate(times.sunrise);
    const ss = minutesOfDate(times.sunset);

    sunState.sunriseMin = sr;
    sunState.sunsetMin = ss;

    const srPct = (sr == null) ? 0 : Math.max(0, Math.min(100, (sr / 1439) * 100));
    const ssPct = (ss == null) ? 0 : Math.max(0, Math.min(100, (ss / 1439) * 100));

    sunTrackEl.style.setProperty("--sr", `${srPct.toFixed(3)}%`);
    sunTrackEl.style.setProperty("--ss", `${ssPct.toFixed(3)}%`);
  }

  function sizeSunOverlayMobile(){
    // El tamaño (y la posición vertical) del diagrama solar lo determina el
    // espacio disponible entre las dos tarjetas:
    //  · MÓVIL: borde SUPERIOR de la "N" a 5px por debajo de la tarjeta de la
    //    fecha, y borde INFERIOR de la "S" a 5px por encima de la barra de horas.
    //  · WEB (escritorio): borde SUPERIOR de la "N" justo en la horizontal del
    //    borde INFERIOR del campo de calendario (0px), y borde INFERIOR de la "S"
    //    a 5px por encima de la barra de horas.
    // Medimos las cajas reales de las letras (getBBox, en unidades del viewBox)
    // para que el ajuste sea exacto independientemente de la tipografía.
    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    const nText = sunPolarOverlaySvg.querySelector('[data-axis="N"]');
    const sText = sunPolarOverlaySvg.querySelector('[data-axis="S"]');
    if (!nText || !sText) return;

    let nBB, sBB;
    try { nBB = nText.getBBox(); sBB = sText.getBBox(); } catch (e) { return; }

    const V = 1120; // ancho/alto del viewBox del SVG
    const nTopUnit = nBB.y;                  // borde superior de la N (uds. SVG)
    const sBottomUnit = sBB.y + sBB.height;  // borde inferior de la S (uds. SVG)
    const spanUnit = sBottomUnit - nTopUnit;
    if (!(spanUnit > 0)) return;

    const parent = sunOverlayEl.offsetParent || sunOverlayEl.parentElement;
    if (!parent) return;
    const pRect = parent.getBoundingClientRect();
    const dockRect = sunDateDockEl.getBoundingClientRect();
    const barRect = sunTimebarEl.getBoundingClientRect();

    // En web la N arranca justo en el borde inferior del calendario (sin hueco);
    // en móvil queda a 5px por debajo de la tarjeta de la fecha.
    const GAP_TOP = isMobile ? 5 : 0;
    const GAP_BOTTOM = 5;
    const topTargetPx = (dockRect.bottom - pRect.top) + GAP_TOP;  // borde sup. de la N
    const bottomTargetPx = (barRect.top - pRect.top) - GAP_BOTTOM; // borde inf. de la S
    const availPx = bottomTargetPx - topTargetPx;
    if (!(availPx > 0)) return;

    // Caja cuadrada con viewBox cuadrado => sin letterbox: px = unidad * (box/V).
    const scale = availPx / spanUnit;       // px por unidad SVG
    const boxPx = V * scale;
    const boxTopPx = topTargetPx - nTopUnit * scale;

    sunOverlayEl.style.width = boxPx + "px";
    sunOverlayEl.style.height = boxPx + "px";
    sunOverlayEl.style.top = boxTopPx + "px";
    sunOverlayEl.style.transform = "translateX(-50%)";
  }

  function updateSunOverlay(){
    const ok = sunEnabled && map.getZoom() >= ZOOM_SOL_MIN;

    sunOverlayEl.style.display = ok ? "block" : "none";
    sunTimebarEl.style.display = ok ? "block" : "none";
    sunDateDockEl.style.display = ok ? "block" : "none";
    if (sunNowDockEl) sunNowDockEl.style.display = ok ? "block" : "none";
    document.body.classList.toggle("sunActive", !!ok);

    if (!ok) return;

    const c = map.getCenter();
    const iso = sunState.dateISO || todayISO();
    const mins = (sunState.minutes != null) ? sunState.minutes : nowMinutes();

    updateDaylightBand();

    const meta = drawSunPolar(sunPolarOverlaySvg, c, iso, mins);

    // El diagrama ya está dibujado (existen las letras N/S): ahora lo medimos y
    // lo dimensionamos/posicionamos respecto a las dos tarjetas en móvil.
    sizeSunOverlayMobile();

    const card = bearingToCardinal(meta.bearingDeg);
    if (meta.isDay) {
      sunOverlayLabelEl.textContent = `${minutesToHHMM(mins)} · ${card} · ${Math.round(meta.bearingDeg)}° · alt ${Math.round(meta.altDeg)}°`;
    } else {
      sunOverlayLabelEl.textContent = `${minutesToHHMM(mins)} · noche · ${card} · ${Math.round(meta.bearingDeg)}° · alt ${Math.round(meta.altDeg)}°`;
    }
  }

  function setSunEnabled(next){
    sunEnabled = next;
    updateSunOverlay();
    updateZoomShift();
  }

  // Sube los botones +/- del zoom (esquina inferior derecha en escritorio) cuando
  // alguna barra/overlay inferior está activa, para que no se solapen. Mismo
  // comportamiento que ya tenía la barra de Transporte (.tpPicking), ahora
  // compartido por Sol, Área por puntos y Área de dibujo libre.
  function updateZoomShift(){
    if (!map) return;
    const areaActive = !!(areaState && (areaState.pointsActive || areaState.freehandActive));
    const barShift = !!sunEnabled || !!transportEnabled;
    const cont = map.getContainer();
    // Con un área activa (por puntos / dibujo libre) los botones +/- del zoom se
    // colocan en la misma vertical que la cartela explicativa (.areaHint), con la
    // base del "−" a 8px de su borde superior → clase específica .bhAreaShift.
    // Para Sol / Transporte se mantiene el desplazamiento general (.bhBottomShift).
    // NOTA: no desplazamos los botones +/- del zoom al activar un área. La
    // cartela (.areaHint) va centrada y no se solapa con el zoom (derecha), así
    // que los botones deben mantener su posición fija.
    cont.classList.toggle("bhAreaShift", false);
    // Sol: los botones +/- suben justo encima de la barra de horario del sol
    // (la base del "−" a 8px de la cara superior de la barra) → clase propia.
    const sunShift = !!sunEnabled && !areaActive;
    cont.classList.toggle("bhSunShift", sunShift);
    // Transporte (u otras barras inferiores) usan el desplazamiento general,
    // salvo cuando manda el Sol (que tiene su propio cálculo).
    cont.classList.toggle("bhBottomShift", barShift && !areaActive && !sunShift);
    updateTransportStacked();
  }

  // En escritorio, si el mapa es demasiado estrecho para que la barra de
  // transporte quepa en una sola fila (iconos a la izquierda, tiempo a la
  // derecha), apilamos el bloque del tiempo DEBAJO de los iconos. Se decide
  // midiendo el ancho disponible del mapa frente al ancho natural de los
  // iconos + el bloque de tiempo.
  function updateTransportStacked(){
    if (!transportBarEl) return;
    const wrap = document.getElementById("mapWrap");
    const inner = transportBarEl.querySelector(".transportBarInner");
    const modes = transportBarEl.querySelector(".tpModes");
    if (!wrap || !inner || !modes) return;

    const desktop = window.matchMedia("(min-width: 769px)").matches;
    const visible = transportEnabled && transportBarEl.style.display !== "none";
    if (!desktop || !visible){
      transportBarEl.classList.remove("tpStacked");
      return;
    }

    // Los iconos ahora se estiran a igual ancho (flex), así que su scrollWidth ya
    // no refleja el ancho "natural". Decidimos apilar por un umbral fijo: ancho
    // mínimo cómodo para que la fila completa (iconos con texto + bloque de
    // tiempo) quepa sin apretarse.
    const MIN_ROW_WIDTH = 620;  // ~4 iconos con etiqueta + tiempo + huecos
    // En fila (no apilado) el cartel ya no llega hasta el borde derecho del mapa:
    // su lado derecho se queda a 8px del lado izquierdo de los botones de zoom
    // (que están en su posición estándar). Margen izquierdo 14px + 64px a la
    // derecha (56px hasta el zoom + 8px de hueco) = 78px de margen total.
    const BAR_MARGIN = 78;
    const available = wrap.clientWidth - BAR_MARGIN;
    const stacked = available < MIN_ROW_WIDTH;
    transportBarEl.classList.toggle("tpStacked", stacked);

    // Publicamos la altura real del cartel (cuando está apilado) para que los
    // botones +/- del zoom se posicionen con la base del "−" a 8px de su cara
    // superior (ver regla en bh-map.css que usa --tpbar-h).
    if (stacked){
      const h = Math.round(transportBarEl.getBoundingClientRect().height);
      if (h > 0) document.documentElement.style.setProperty("--tpbar-h", h + "px");
    }
  }

  function initHoursRow(){
    const frag = document.createDocumentFragment();
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    for (let h = 0; h < 24; h++) {
      const s = document.createElement("span");
      s.textContent = isMobile ? String(h) : String(h).padStart(2,"0");
      frag.appendChild(s);
    }
    sunHoursRowEl.innerHTML = "";
    sunHoursRowEl.appendChild(frag);
  }

  function preventMapDragOn(el){
    el.addEventListener("mousedown", (e) => e.stopPropagation());
    el.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });
    el.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true });
    el.addEventListener("click", (e) => e.stopPropagation());
  }

  initHoursRow();
  preventMapDragOn(sunTimebarEl);
  preventMapDragOn(sunDateDockEl);
  if (sunNowDockEl) preventMapDragOn(sunNowDockEl);

  sunState.dateISO = todayISO();
  sunState.minutes = nowMinutes();

  sunDateEl.value = sunState.dateISO;
  sunRangeEl.value = String(sunState.minutes);

  sunRangeEl.addEventListener("input", () => {
    sunState.minutes = parseInt(sunRangeEl.value, 10);
    updateSunOverlay();
  });

  sunDateEl.addEventListener("change", () => {
    sunState.dateISO = sunDateEl.value || todayISO();
    updateSunOverlay();
  });

  sunNowBtn.addEventListener("click", () => {
    sunState.dateISO = todayISO();
    sunState.minutes = nowMinutes();
    sunDateEl.value = sunState.dateISO;
    sunRangeEl.value = String(sunState.minutes);
    updateSunOverlay();
  });

  // NUEVO: botón geolocalización (encima del sol)
  const LocateControl = L.Control.extend({
    options: { position: "topright" },
    onAdd: function() {
      const container = L.DomUtil.create("div", "quickCol");
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      const btn = L.DomUtil.create("div", "qBtn", container);
      btn.title = "Mi ubicación";
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 19s5.5-5 5.5-10A5.5 5.5 0 1 0 6.5 9c0 5 5.5 10 5.5 10z"></path>
          <circle cx="12" cy="9" r="2.1"></circle>
          <path d="M8 21.5h8"></path>
        </svg>
      `;

      btn.addEventListener("click", () => {
        if (!navigator.geolocation) {
          alert("Tu navegador no permite geolocalización.");
          return;
        }
        setStatus("Obteniendo ubicación...");
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            map.setView([lat, lng], 14);
            setStatus("Ubicación encontrada");
            scheduleReload();
          },
          (err) => {
            setStatus("No se pudo obtener la ubicación");
            console.error(err);
            alert("No se pudo obtener la ubicación. Revisa permisos del navegador.");
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });

      return container;
    }
  });

  map.addControl(new LocateControl());

  // NUEVO: botón de transporte (placeholder funcional, mismo lenguaje visual
  // que el resto de los controles laterales y a juego con el botón "Vehículo"
  // del index).
  const TransportControl = L.Control.extend({
    options: { position: "topright" },
    onAdd: function() {
      const container = L.DomUtil.create("div", "quickCol");
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      const btn = L.DomUtil.create("div", "qBtn", container);
      btn.id = "transportBtn";
      btn.title = "Transporte";
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="8"></circle>
          <circle cx="12" cy="12" r="2.2"></circle>
          <path d="M12 14.2V20"></path>
          <path d="M9.9 11l-6.8-2.4"></path>
          <path d="M14.1 11l6.8-2.4"></path>
        </svg>
      `;

      btn.addEventListener("click", () => {
        const next = !btn.classList.contains("active");
        btn.classList.toggle("active", next);
        try {
          window.dispatchEvent(new CustomEvent("bh:transport-toggle", { detail: { active: next } }));
        } catch {}
      });

      return container;
    }
  });

  map.addControl(new TransportControl());

  // ====== TRANSPORTE — área alcanzable (isócrona simulada) ======
  // Estima hasta dónde se llega en X minutos desde un punto, según el modo.
  // Sin API de rutas: radio = velocidad media · tiempo · factor de desvío real,
  // con un contorno orgánico (no un círculo perfecto) para que parezca creíble.
  const transportLayer = L.layerGroup().addTo(map);
  const transportBarEl = document.getElementById("transportBar");
  const tpRangeEl = document.getElementById("tpRange");
  const tpMinsValEl = document.getElementById("tpMinsVal");
  const tpMinsUnitEl = document.getElementById("tpMinsUnit");
  const tpHintEl = document.getElementById("tpHint");
  const tpModeBtns = transportBarEl
    ? Array.from(transportBarEl.querySelectorAll(".tpMode"))
    : [];

  const TP_MINUTES = [5, 10, 15, 30, 45, 60];
  // Velocidades urbanas medias (km/h) puerta a puerta.
  const TP_MODES = {
    walk:    { label: "andando",   speed: 4.8 },
    transit: { label: "en público", speed: 18 },
    car:     { label: "en coche",  speed: 30 },
    bike:    { label: "en bici",   speed: 15 },
  };
  // Factor de desvío: las calles no van en línea recta, así que el alcance
  // real es menor que el radio teórico. El transporte público suma espera.
  const TP_DETOUR = { walk: 0.80, transit: 0.62, car: 0.74, bike: 0.78 };
  // Fracción del lado corto del mapa que debe ocupar el DIÁMETRO del área al
  // encuadrar/ajustar el zoom automáticamente.
  const TP_FIT_FRACTION = 0.75;

  let transportEnabled = false;
  let transportMode = "walk";
  let transportMinsIdx = 4; // 45 min
  let transportOrigin = null;
  let transportPin = null;
  // Anillo (polígono) del área alcanzable actual, como [{lat,lng}], usado para
  // filtrar los anuncios igual que las áreas dibujadas a mano.
  let transportRing = null;

  // ¿El anuncio cae dentro del área de transporte? Si el transporte está
  // apagado o aún no hay anillo, no filtra (deja pasar todo).
  function isInsideTransportArea(p){
    if (!transportEnabled || !transportRing || transportRing.length < 3) return true;
    if (p.lat == null || p.lng == null) return false;
    return pointInPoly(p.lat, p.lng, transportRing);
  }

  // Re-filtra (sin reconsultar al servidor) los anuncios ya cargados cuando
  // cambia el área de transporte. Pequeño debounce para arrastres del punto y
  // del slider de minutos.
  let transportRefilterTimer = null;
  function scheduleTransportRefilter(){
    if (transportRefilterTimer) clearTimeout(transportRefilterTimer);
    transportRefilterTimer = setTimeout(() => {
      transportRefilterTimer = null;
      if (typeof applyAreaFilterAndRender === "function") applyAreaFilterAndRender();
    }, 90);
  }

  function tpHash(str){
    let h = 2166136261;
    for (let i = 0; i < str.length; i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967295; // 0..1
  }

  function tpReachMeters(mode, mins){
    const v = TP_MODES[mode].speed;          // km/h
    const km = v * (mins / 60);               // distancia teórica
    return km * 1000 * (TP_DETOUR[mode] || 0.75);
  }

  // Zoom (fraccionario, alineado a 0.25) para que un círculo de radio `radiusM`
  // alrededor de `lat` tenga un diámetro = `fraction` del lado corto del mapa.
  function tpZoomForRadius(lat, radiusM, fraction){
    let sz = null;
    try { sz = map.getSize(); } catch {}
    let minDim = sz ? Math.min(sz.x || 0, sz.y || 0) : 0;
    if (!minDim) minDim = Math.min(window.innerWidth || 800, window.innerHeight || 600);
    const targetPx = (fraction || TP_FIT_FRACTION) * minDim; // diámetro objetivo (px)
    const metersPerPixel = (2 * radiusM) / targetPx;
    const zRaw = Math.log2(
      (156543.03392 * Math.cos(lat * Math.PI / 180)) / metersPerPixel
    );
    return Math.max(9, Math.min(16, Math.round(zRaw * 4) / 4));
  }

  // Reajusta el zoom del mapa para mantener el área de transporte actual
  // ocupando ~TP_FIT_FRACTION del lado corto, centrada en el punto de salida.
  function tpFitZoomToArea(){
    if (!transportEnabled || !transportOrigin) return;
    const mins = TP_MINUTES[transportMinsIdx];
    const radiusM = tpReachMeters(transportMode, mins);
    const z = tpZoomForRadius(transportOrigin.lat, radiusM, TP_FIT_FRACTION);
    map.setView(transportOrigin, z, { animate: true });
  }

  // Contorno orgánico determinista: misma forma para un modo dado, solo escala
  // con los minutos. Así no "salta" al mover el slider.
  function tpIsoRing(origin, radiusM, mode){
    const N = 80;
    const latRad = origin.lat * Math.PI / 180;
    const mPerDegLat = 111320;
    const mPerDegLng = 111320 * Math.cos(latRad);
    const s = tpHash(mode) * 6.283;
    const pts = [];
    for (let i = 0; i < N; i++){
      const a = (i / N) * Math.PI * 2;
      const n = 0.90
        + 0.10 * Math.sin(a * 3 + s)
        + 0.06 * Math.sin(a * 5 + s * 1.7)
        + 0.05 * Math.sin(a * 2 + s * 0.6);
      const r = radiusM * n;
      const dLat = (r * Math.cos(a)) / mPerDegLat;
      const dLng = (r * Math.sin(a)) / mPerDegLng;
      pts.push([origin.lat + dLat, origin.lng + dLng]);
    }
    return pts;
  }

  function tpDrawIso(){
    transportLayer.clearLayers();
    if (!transportEnabled || !transportOrigin) {
      transportRing = null;
      scheduleTransportRefilter();
      return;
    }
    const mins = TP_MINUTES[transportMinsIdx];
    const radiusM = tpReachMeters(transportMode, mins);
    const ring = tpIsoRing(transportOrigin, radiusM, transportMode);

    // Guarda el anillo como [{lat,lng}] para filtrar los anuncios.
    transportRing = ring.map((pt) => ({ lat: pt[0], lng: pt[1] }));
    scheduleTransportRefilter();

    // Halo exterior suave + relleno + borde nítido.
    L.polygon(ring, {
      className: "tpIso",
      color: "#8C1F2D",
      weight: 2,
      opacity: 0.85,
      fillColor: "#8C1F2D",
      fillOpacity: 0.12,
      smoothFactor: 1.2,
      interactive: false,
    }).addTo(transportLayer);
  }

  function tpEnsurePin(){
    if (transportPin) return;
    const icon = L.divIcon({
      className: "tpPin",
      html: "<span></span>",
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    transportPin = L.marker(transportOrigin, {
      icon,
      draggable: true,
      zIndexOffset: 1200,
      keyboard: false,
    });
    const onMove = () => {
      transportOrigin = transportPin.getLatLng();
      tpDrawIso();
    };
    transportPin.on("drag", onMove);
    transportPin.on("dragend", onMove);
    transportPin.addTo(map);
  }

  function tpRemovePin(){
    if (transportPin){
      map.removeLayer(transportPin);
      transportPin = null;
    }
  }

  function tpUpdateBar(){
    const tpMins = TP_MINUTES[transportMinsIdx];
    if (tpMinsValEl) tpMinsValEl.textContent = tpMins >= 60 ? String(tpMins / 60) : String(tpMins);
    if (tpMinsUnitEl) tpMinsUnitEl.textContent = tpMins >= 60 ? "h" : "min";
    tpModeBtns.forEach((b) => {
      const on = b.dataset.mode === transportMode;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (tpHintEl){
      tpHintEl.textContent = "";
    }
  }

  function setTransportEnabled(next){
    transportEnabled = !!next;
    if (transportBarEl){
      transportBarEl.style.display = transportEnabled ? "block" : "none";
      transportBarEl.setAttribute("aria-hidden", transportEnabled ? "false" : "true");
    }
    const cont = map.getContainer();
    if (transportEnabled){
      // Exclusión mutua con el Sol (comparten zona inferior).
      if (areaState && typeof areaState.sunBtnForceOff === "function") areaState.sunBtnForceOff();
      if (areaState && typeof areaState.areasForceOff === "function") areaState.areasForceOff();
      if (!transportOrigin) transportOrigin = map.getCenter();
      tpEnsurePin();
      tpUpdateBar();
      tpDrawIso();
      cont.classList.add("tpPicking");
    } else {
      tpRemovePin();
      transportLayer.clearLayers();
      transportRing = null;
      scheduleTransportRefilter();
      cont.classList.remove("tpPicking");
    }
    updateZoomShift();
  }

  // Permite que el Sol apague el transporte al activarse.
  areaState.transportForceOff = function(){
    if (!transportEnabled) return;
    const b = document.getElementById("transportBtn");
    if (b) b.classList.remove("active");
    setTransportEnabled(false);
  };

  if (transportBarEl){
    preventMapDragOn(transportBarEl);
    tpModeBtns.forEach((b) => {
      b.addEventListener("click", () => {
        transportMode = b.dataset.mode || "walk";
        tpUpdateBar();
        tpDrawIso();
        tpFitZoomToArea();
      });
    });
    if (tpRangeEl){
      tpRangeEl.addEventListener("input", () => {
        transportMinsIdx = Math.max(0, Math.min(TP_MINUTES.length - 1, parseInt(tpRangeEl.value, 10) || 0));
        tpUpdateBar();
        tpDrawIso();
        tpFitZoomToArea();
      });
    }
  }

  // Clic en el mapa => fija el punto de salida (si no estamos dibujando un área).
  map.on("click", (e) => {
    if (!transportEnabled) return;
    if (areaState && (areaState.isDrawing || areaState.pointsActive || areaState.freehandActive)) return;
    transportOrigin = e.latlng;
    if (transportPin) transportPin.setLatLng(transportOrigin);
    tpDrawIso();
  });

  window.addEventListener("bh:transport-toggle", (e) => {
    setTransportEnabled(!!(e.detail && e.detail.active));
  });

  const SunControl = L.Control.extend({
    options: { position: "topright" },
    onAdd: function() {
      const container = L.DomUtil.create("div", "quickCol");
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      const btn = L.DomUtil.create("div", "qBtn", container);
      btn.id = "sunBtn";
      btn.title = "Sol";
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2.5 20h19"></path>
          <path d="M6 20a6 6 0 0 1 12 0"></path>
          <path d="M12 3v3"></path>
          <path d="M4 9l1.8 1.8"></path>
          <path d="M20 9l-1.8 1.8"></path>
        </svg>
      `;

      function setBtnEnabled() {
        const ok = map.getZoom() >= ZOOM_SOL_MIN;
        btn.classList.toggle("disabled", !ok);
        btn.title = ok ? "Sol" : `Acércate para activar (zoom ${ZOOM_SOL_MIN}+)`;
        if (!ok && sunEnabled) {
          btn.classList.remove("active");
          setSunEnabled(false);
        } else {
          updateSunOverlay();
        }
      }

      function forceOff(){
        if (sunEnabled) {
          sunEnabled = false;
          btn.classList.remove("active");
          updateSunOverlay();
        }
      }

      btn.addEventListener("click", () => {
        const ok = map.getZoom() >= ZOOM_SOL_MIN;
        if (!ok) return;

        if (areaState.isDrawing) cancelCurrentDrawing();

        const next = !sunEnabled;
        if (next && typeof areaState.transportForceOff === "function") areaState.transportForceOff();
        if (next && typeof areaState.areasForceOff === "function") areaState.areasForceOff();
        btn.classList.toggle("active", next);
        setSunEnabled(next);
      });

      map.on("zoomend", setBtnEnabled);
      setBtnEnabled();

      areaState.sunBtnForceOff = forceOff;

      return container;
    }
  });

  map.addControl(new SunControl());

  map.on("moveend", () => { if (sunEnabled) updateSunOverlay(); });
  map.on("zoomend", () => { if (sunEnabled) updateSunOverlay(); });
  window.addEventListener("resize", () => {
    initHoursRow();
    if (sunEnabled) updateSunOverlay();
    updateTransportStacked();
  });

  // Cuando cambia layout (ocultar/mostrar columnas) Leaflet necesita invalidateSize
  function safeInvalidate(){
    // No invalidamos un mapa oculto: su contenedor mide 0×0 y disparar
    // invalidateSize provoca un moveend que recargaría el listado en vacío.
    if (isMapHidden()) return;
    // Guardamos el centro antes de redimensionar: invalidateSize ancla la
    // esquina superior-izquierda, así que al ensanchar/estrechar el mapa
    // (ocultar/mostrar filtros o listado) el centro visible se desplazaría.
    let prevCenter = null;
    try { prevCenter = map.getCenter(); } catch {}
    try { map.invalidateSize({ pan: false, animate: false }); } catch {}
    if (prevCenter) {
      try { map.setView(prevCenter, map.getZoom(), { animate: false }); } catch {}
    }
    if (sunEnabled) {
      try { updateSunOverlay(); } catch {}
    }
  }

  window.addEventListener("bh:layout-resize", () => {
    requestAnimationFrame(() => {
      safeInvalidate();
      updateTransportStacked();
      setTimeout(() => safeInvalidate(), 120);
      setTimeout(() => safeInvalidate(), 260);
    });
  });

  const AreasControl = L.Control.extend({
    options: { position: "topright" },
    onAdd: function() {
      const container = L.DomUtil.create("div", "quickCol");
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      const wrapPoints = L.DomUtil.create("div", "areaBtnWrap", container);

      const plusPoints = L.DomUtil.create("div", "qBtnSmall", wrapPoints);
      plusPoints.title = "Añadir área (punto a punto)";
      plusPoints.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14"></path><path d="M5 12h14"></path>
        </svg>
      `;

      const btnPoints = L.DomUtil.create("div", "qBtn", wrapPoints);
      btnPoints.title = "Área por puntos";
      btnPoints.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 8l6-4 8 5-3 8-9-1z"></path>
          <circle cx="5" cy="8" r="1.3"></circle>
          <circle cx="11" cy="4" r="1.3"></circle>
          <circle cx="19" cy="9" r="1.3"></circle>
          <circle cx="16" cy="17" r="1.3"></circle>
          <circle cx="7" cy="16" r="1.3"></circle>
        </svg>
      `;

      const wrapFree = L.DomUtil.create("div", "areaBtnWrap", container);

      const plusFree = L.DomUtil.create("div", "qBtnSmall", wrapFree);
      plusFree.title = "Añadir área (dibujo libre)";
      plusFree.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14"></path><path d="M5 12h14"></path>
        </svg>
      `;

      const btnFree = L.DomUtil.create("div", "qBtn", wrapFree);
      btnFree.title = "Área dibujo libre";
      btnFree.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 19l1.5-4L16 5.5l3 3L9.5 18z"></path>
          <path d="M14 7.5l3 3"></path>
        </svg>
      `;

      areaState.btnPointsEl = btnPoints;
      areaState.btnFreeEl = btnFree;
      areaState.btnPlusPointsEl = plusPoints;
      areaState.btnPlusFreeEl = plusFree;

      function hasAreasOfType(t){
        return areaState.polys.some(a => a.type === t);
      }

      function refreshPlusVisibility(){
        const full = areaState.polys.length >= MAX_AREAS;

        plusPoints.classList.toggle("disabled", full);
        plusFree.classList.toggle("disabled", full);

        plusPoints.style.display = (areaState.pointsActive && hasAreasOfType("points")) ? "grid" : "none";
        plusFree.style.display = (areaState.freehandActive && hasAreasOfType("freehand")) ? "grid" : "none";
      }

      function refreshButtons(){
        btnPoints.classList.toggle("active", areaState.pointsActive);
        btnFree.classList.toggle("active", areaState.freehandActive);
        refreshPlusVisibility();
        updateZoomShift();
      }

      areaState.refreshAreasUI = refreshButtons;

      // Apaga cualquier área activa (puntos o dibujo libre). Lo usan el Sol y el
      // Transporte para que solo una herramienta del mapa esté activa a la vez.
      function areasForceOff(){
        let changed = false;
        if (areaState.pointsActive){
          areaState.pointsActive = false;
          if (areaState.isDrawing && areaState.drawingMode === "points") cancelCurrentDrawing();
          removeAreasByType("points");
          changed = true;
        }
        if (areaState.freehandActive){
          areaState.freehandActive = false;
          if (areaState.isDrawing && areaState.drawingMode === "freehand") cancelCurrentDrawing();
          removeAreasByType("freehand");
          changed = true;
        }
        if (changed) refreshButtons();
      }
      areaState.areasForceOff = areasForceOff;

      function startPointsArea(){
        if (areaState.polys.length >= MAX_AREAS) return;
        if (!areaState.pointsActive) return;
        if (areaState.isDrawing) cancelCurrentDrawing();
        startNewAreaDrawing("points");
      }

      function startFreeArea(){
        if (areaState.polys.length >= MAX_AREAS) return;
        if (!areaState.freehandActive) return;
        if (areaState.isDrawing) cancelCurrentDrawing();
        startNewAreaDrawing("freehand");
      }

      function togglePoints(){
        const willOn = !areaState.pointsActive;
        areaState.pointsActive = willOn;

        if (!willOn) {
          if (areaState.isDrawing && areaState.drawingMode === "points") cancelCurrentDrawing();
          removeAreasByType("points");
          refreshButtons();
          return;
        }

        // Exclusión mutua con las otras herramientas del mapa (Sol/Transporte).
        if (typeof areaState.transportForceOff === "function") areaState.transportForceOff();
        if (typeof areaState.sunBtnForceOff === "function") areaState.sunBtnForceOff();

        areaState.freehandActive = false;
        if (areaState.isDrawing && areaState.drawingMode === "freehand") cancelCurrentDrawing();

        refreshButtons();
        startPointsArea();
      }

      function toggleFree(){
        const willOn = !areaState.freehandActive;
        areaState.freehandActive = willOn;

        if (!willOn) {
          if (areaState.isDrawing && areaState.drawingMode === "freehand") cancelCurrentDrawing();
          removeAreasByType("freehand");
          refreshButtons();
          return;
        }

        // Exclusión mutua con las otras herramientas del mapa (Sol/Transporte).
        if (typeof areaState.transportForceOff === "function") areaState.transportForceOff();
        if (typeof areaState.sunBtnForceOff === "function") areaState.sunBtnForceOff();

        areaState.pointsActive = false;
        if (areaState.isDrawing && areaState.drawingMode === "points") cancelCurrentDrawing();

        refreshButtons();
        startFreeArea();
      }

      btnPoints.addEventListener("click", togglePoints);
      btnFree.addEventListener("click", toggleFree);

      plusPoints.addEventListener("click", () => {
        if (plusPoints.classList.contains("disabled")) return;
        startPointsArea();
      });

      plusFree.addEventListener("click", () => {
        if (plusFree.classList.contains("disabled")) return;
        startFreeArea();
      });

      refreshButtons();
      return container;
    }
  });

  map.addControl(new AreasControl());

  // Etiqueta dinámica “Comunidad / Ciudad / Zona” según centro del mapa
  // (cache + throttle para no spamear Nominatim)
  const placeCache = new Map();
  let placeTimer = null;

  function formatPlace(address){
    const comunidad = address.state || address.region || address.county || "—";
    const ciudad = address.city || address.town || address.village || address.municipality || "—";
    return `${comunidad} / ${ciudad}`;
  }

  async function reverseGeocode(lat, lng){
    const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    if (placeCache.has(key)) return placeCache.get(key);

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=14&addressdetails=1`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    const txt = data && data.address ? formatPlace(data.address) : null;
    if (txt) placeCache.set(key, txt);
    return txt;
  }

  function schedulePlaceUpdate(){
    if (!placeLabelEl) return;
    if (placeTimer) clearTimeout(placeTimer);
    placeTimer = setTimeout(async () => {
      try{
        const c = map.getCenter();
        const txt = await reverseGeocode(c.lat, c.lng);
        if (txt) placeLabelEl.textContent = txt;
      } catch (e){
        // si falla, no rompemos nada
        console.warn("reverse geocode error", e);
      }
    }, 650);
  }

  map.on("moveend", schedulePlaceUpdate);
  map.on("zoomend", schedulePlaceUpdate);

  // Activa la herramienta que el usuario dejó seleccionada en el index
  // (Área / Trazo / Sol / Distancia) leyendo el parámetro ?quick=…
  function activateQuickToolFromUrl(){
    try {
      const quick = (new URL(window.location.href)).searchParams.get("quick");
      if (!quick) return;
      if (quick === "vehicle" || quick === "transport"){
        const b = document.getElementById("transportBtn");
        if (b && !b.classList.contains("active")) b.click();
      } else if (quick === "sun"){
        const b = document.getElementById("sunBtn");
        if (!b) return;
        // El Sol necesita un zoom mínimo: nos acercamos si hace falta.
        if (map.getZoom() < ZOOM_SOL_MIN) map.setZoom(ZOOM_SOL_MIN, { animate: false });
        if (!b.classList.contains("active")) b.click();
      } else if (quick === "area"){
        const b = areaState && areaState.btnPointsEl;
        if (b && !b.classList.contains("active")) b.click();
      } else if (quick === "trace"){
        const b = areaState && areaState.btnFreeEl;
        if (b && !b.classList.contains("active")) b.click();
      }
      // quick === "location" lo gestiona el propio index (geolocaliza y centra).
    } catch {}
  }

  (async function init(){
    try {
      wireHeaderMiniSearch();
      wireHeaderNav();

      let initialCityCenter = null;

      // Coordenadas exactas si llegan desde una sugerencia del autocompletado del index.
      const _u = new URL(window.location.href);
      const _lat = parseFloat(_u.searchParams.get("lat"));
      const _lng = parseFloat(_u.searchParams.get("lng"));
      const _zoom = parseInt(_u.searchParams.get("zoom"), 10);
      let initialZoom = Number.isFinite(_zoom) ? Math.min(Math.max(_zoom, 6), 17) : 13;

      // Si el usuario llega con la herramienta "Sol" seleccionada desde el index
      // (móvil o web), abrimos la búsqueda con el zoom MÍNIMO al que el Sol
      // funciona (ZOOM_SOL_MIN). Así la vista es lo más amplia posible sin que
      // el diagrama solar se desactive, y las re-centrados posteriores
      // (setView con initialZoom) no lo vuelven a romper.
      const _quickTool = _u.searchParams.get("quick");
      if (_quickTool === "sun") initialZoom = ZOOM_SOL_MIN;

      // Si el usuario llega con "Distancia" (transporte) seleccionado desde el
      // index, encuadramos el mapa con un zoom calculado para que el área de
      // 45 min (modo por defecto: andando) ocupe ~75% del lado corto del mapa.
      // Así la isócrona no se ve minúscula al abrir la búsqueda.
      if (_quickTool === "vehicle" || _quickTool === "transport") {
        const latForZoom = Number.isFinite(_lat) ? _lat : 40.4168;
        const radius45 = tpReachMeters("walk", 45); // metros, radio a 45 min andando
        initialZoom = tpZoomForRadius(latForZoom, radius45, TP_FIT_FRACTION);
      }

      if (Number.isFinite(_lat) && Number.isFinite(_lng)) {
        initialCityCenter = [_lat, _lng];
        map.setView(initialCityCenter, initialZoom, { animate: false });
      } else if (initialParams.city) {
        initialCityCenter = await geocodeCity(initialParams.city);
        if (initialCityCenter) {
          map.setView(initialCityCenter, initialZoom, { animate: false });
        }
      }

      safeInvalidate();

      if (initialCityCenter) {
        map.setView(initialCityCenter, initialZoom, { animate: false });
      }

      await loadPointsForCurrentView();

      // etiqueta inicial
      schedulePlaceUpdate();

      // Herramienta seleccionada en el index (Área / Trazo / Sol / Distancia)
      activateQuickToolFromUrl();

      // Segunda pasada por si el layout termina de ajustar, sin permitir desplazamientos automáticos
      setTimeout(() => {
        safeInvalidate();
        if (initialCityCenter) map.setView(initialCityCenter, initialZoom, { animate: false });
      }, 250);

      setTimeout(() => {
        safeInvalidate();
        if (initialCityCenter) map.setView(initialCityCenter, initialZoom, { animate: false });
      }, 600);
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      setStatus(`Error: ${msg}`);
      console.error(e);
    }
  })();
}
