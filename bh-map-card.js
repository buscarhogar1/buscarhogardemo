// bh-map-card.js
(function () {
  window.BHMap = window.BHMap || {};
  const BHMap = window.BHMap;

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

  function euro(n) {
    try {
      return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
    } catch {
      return `${n} EUR`;
    }
  }

  function open() { cardEl.classList.add("visible"); }
  function close() { cardEl.classList.remove("visible"); }

  cardCloseBtn.addEventListener("click", close);

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

  function openForPoint(p) {
    cardAddrTopEl.textContent = buildAddressTop(p);
    cardAddrBottomEl.textContent = buildAddressBottom(p);

    cardAddrTopEl.href = `listing.html?id=${encodeURIComponent(p.listing_id)}`;

    cardPriceEl.textContent = (p.price_eur != null) ? euro(p.price_eur) : "—";

    setPhoto(p.main_photo_url || null);

    badgeNewEl.style.display = isRecent(p.listed_at, 14) ? "inline-flex" : "none";

    const m2 = (p.useful_area_m2 != null) ? `${p.useful_area_m2} m²` : "— m²";
    const beds = (p.bedrooms != null) ? `${p.bedrooms}` : "—";
    const baths = (p.bathrooms != null) ? `${p.bathrooms}` : "—";

    cardFactsEl.innerHTML = `
      <div class="fact">${iconArea()}<span>${m2} útiles</span></div>
      <div class="fact">${iconBed()}<span>${beds}</span></div>
      <div class="fact">${iconBath()}<span>${baths}</span></div>
    `;

    cardAgencyEl.textContent = p.agency_name || "—";
    open();
  }

  BHMap.card = {
    openForPoint,
    close
  };
})();
