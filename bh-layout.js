// Layout común: header + footer + modal auth
// Uso: initLayout({ showMiniSearch: true|false })

function getSiteRoot() {
  return "./";
}

function getBaseUrlFromRoot(root) {
  const base = new URL(root || "./", window.location.href);
  return base.href;
}

function renderHeader({ showMiniSearch, root }) {
  const mini = showMiniSearch ? `
    <form class="miniSearch" id="miniSearchForm" autocomplete="off" aria-label="Búsqueda rápida">
      <input id="miniQ" placeholder="Buscar..." aria-label="Buscar rápido" />
      <button type="submit" title="Buscar" aria-label="Buscar">
        <svg class="miniIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7"></circle>
          <path d="M21 21l-4.3-4.3"></path>
        </svg>
      </button>
    </form>
  ` : "";

  return `
    <header class="topbar">
      <div class="topbarInner">
        <div class="leftGroup">
          <button type="button" class="menuBtn" id="navMenuBtn" aria-label="Más opciones">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true">
              <path d="M4 7h16"></path>
              <path d="M4 12h16"></path>
              <path d="M4 17h16"></path>
            </svg>
          </button>
        </div>

        <div class="bhSideOverlay" id="bhSideOverlay"></div>

        <aside class="bhSideMenu" id="bhSideMenu" aria-hidden="true">
          <div class="bhSideMenuTop">
            <div class="bhSideMenuBrand">H<span class="brandO">O</span>MY<span class="brandO">O</span></div>

            <button type="button" class="bhSideClose" id="bhSideClose" aria-label="Cerrar menú">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"></path></svg>
            </button>
          </div>

          <nav class="bhSideNav">
            <div class="bhAccounts">
              <!-- Particular -->
              <div class="bhAccCard">
                <div class="bhAccHead">
                  <span class="bhAccIcon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"></circle><path d="M4.5 19.5c2.1-3.7 12.9-3.7 15 0"></path></svg>
                  </span>
                  <span class="bhAccTitleWrap">
                    <span class="bhAccTitle">Soy particular</span>
                    <span class="bhAccDesc">Busca, guarda y contacta viviendas</span>
                  </span>
                </div>
                <div class="bhAccActions bhSideAnonOnly">
                  <a href="#" class="bhBtn bhBtnPrimary" data-bh-open-auth="login">Iniciar sesión</a>
                  <a href="#" class="bhBtn bhBtnGhost" data-bh-open-auth="register">Crear cuenta</a>
                </div>
                <div class="bhAccActions bhSideAuthOnly">
                  <a href="./account.html" class="bhBtn bhBtnPrimary">Mi cuenta</a>
                </div>
                <div class="bhAccFoot">
                  <a href="./contacto.html?tipo=usuario">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    ¿Necesitas ayuda? Contacta
                  </a>
                </div>
              </div>

              <!-- Profesional -->
              <div class="bhAccCard pro">
                <div class="bhAccHead">
                  <span class="bhAccIcon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M3 12h18"></path></svg>
                  </span>
                  <span class="bhAccTitleWrap">
                    <span class="bhAccTitle">Soy profesional</span>
                    <span class="bhAccDesc">Publica y gestiona tus viviendas</span>
                  </span>
                  <span class="bhAccTag">Inmobiliaria</span>
                </div>
                <div class="bhAccActions bhSideAnonOnly">
                  <a href="./cuenta-inmobiliaria.html" class="bhBtn bhBtnPrimary">Acceder</a>
                  <a href="./registro-profesional.html" class="bhBtn bhBtnGhost">Registrar</a>
                </div>
                <div class="bhAccActions bhSideAuthOnly">
                  <a href="./cuenta-inmobiliaria.html" class="bhBtn bhBtnPrimary">Mi cuenta</a>
                </div>
                <div class="bhAccFoot">
                  <a href="./contacto.html?tipo=inmobiliaria">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    Hablar con el equipo comercial
                  </a>
                </div>
              </div>
            </div>

          </nav>

          <div class="bhSideFooter">
            <div class="bhLegal">
              <a href="./terminos.html">Términos de uso</a>
              <a href="./privacidad.html">Privacidad</a>
              <a href="./cookies.html">Cookies</a>
            </div>
            <div class="bhCopy">© 2026 Homyo</div>
          </div>
        </aside>

        <a class="brand" href="${root}" aria-label="Ir a inicio">
          <span class="brandText">H<span class="brandO">O</span>MY<span class="brandO">O</span></span>
        </a>

        ${mini}

        <div class="rightGroup" aria-label="Acciones">
          <a href="#" id="navLogin" class="navActionLink">
            <span class="navActionIcon navActionIconSvg" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="8" r="4"></circle>
                <path d="M4.5 19.5c2.1-3.7 12.9-3.7 15 0"></path>
                <circle cx="18.1" cy="18.1" r="3.1"></circle>
                <path d="M16.9 16.9l2.4 2.4"></path>
              </svg>
            </span>
            <span class="navActionText">Cuenta</span>
          </a>

          <div id="navUserArea" class="navUserArea bh-hidden" aria-label="Usuario conectado">
            <button type="button" id="navAccountBtn" class="navUserBtn">
              <span id="navUserAvatar" class="navAvatar navAvatarSvg" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="4"></circle>
                  <path d="M4.5 19.5c2.1-3.7 12.9-3.7 15 0"></path>
                </svg>
              </span>
              <span id="navUserLabel" class="navUserLabel">Cuenta</span>
            </button>

            <button type="button" id="navLogoutBtn" class="navLogoutBtn">Cerrar sesión</button>
          </div>
        </div>
      </div>
    </header>
  `;
}

function renderFooter({ root }) {
  const year = new Date().getFullYear();

  return `
    <footer class="footer">
      <div class="footerInner">
        <div class="footerLine2">
          <span>© ${year} Buscar Hogar</span>
          <span class="footerSep">·</span>
          <a href="${root}terminos.html">Términos de uso</a>
          <span class="footerSep">·</span>
          <a href="${root}privacidad.html">Política de privacidad</a>
          <span class="footerSep">·</span>
          <a href="${root}cookies.html">Política de cookies</a>
        </div>
      </div>
    </footer>
  `;
}

function renderAuthModal({ root }) {
  return `
    <div id="authOverlay" class="overlay" aria-hidden="true">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="bhAuthTitle">
        <button class="close" id="closeAuth" aria-label="Cerrar">×</button>

        <div class="bh-brand"><span class="bh-brandMark">H<span class="o">O</span>MY<span class="o">O</span></span></div>
        <h2 id="bhAuthTitle" class="bh-title">Inicia sesión o regístrate</h2>
        <p class="bh-subtitle">Guarda búsquedas y contacta viviendas.</p>

        <div class="bh-actions">
          <div id="authStepStart">
            <button type="button" class="bh-btn gBtn" id="googleBtn">
              <svg class="gIcon" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continuar con Google
            </button>

            <button type="button" class="bh-btn appleBtn" id="appleBtn">
              <svg class="appleIcon" viewBox="0 0 384 512" aria-hidden="true">
                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
              </svg>
              Continuar con Apple
            </button>

            <div class="bh-divider"><span>o</span></div>

            <input id="emailInput" class="bh-input" type="email" autocomplete="email" placeholder="Email" />
            <button type="button" class="bh-btn bh-primary" id="emailContinueBtn">Continuar con email</button>

            <div class="bh-msg bh-hidden" id="authMsgStart" role="status" aria-live="polite"></div>
          </div>

          <div id="authStepPassword" class="bh-hidden">
            <div class="bh-msg" id="pwHeader"></div>
            <input id="pwInput" class="bh-input" type="password" autocomplete="current-password" placeholder="Contraseña" />
            <button type="button" class="bh-btn bh-primary" id="pwLoginBtn">Entrar</button>

            <div class="bh-msg bh-hidden" id="authMsgPw" role="status" aria-live="polite"></div>

            <div class="bh-msg bh-hidden" id="forgotPwRow" style="margin-top:8px;">
              <button type="button" class="bh-linkbtn" id="forgotPwBtn">¿Olvidaste la contraseña?</button>
            </div>

            <div class="bh-msg bh-hidden" id="forgotPwMsg" role="status" aria-live="polite"></div>

            <div class="bh-msg" style="margin-top:12px;">
              <button type="button" class="bh-linkbtn" id="goRegisterBtn">No tengo cuenta, registrarme</button>
              <span> · </span>
              <button type="button" class="bh-linkbtn" id="backStartFromPwBtn">Volver</button>
            </div>
          </div>

          <div id="authStepRegister" class="bh-hidden">
            <div class="bh-msg" id="regHeader"></div>

            <div id="regFormWrap">
              <input id="regName" class="bh-input" type="text" autocomplete="name" placeholder="Nombre" />
              <input id="regPassword" class="bh-input" type="password" autocomplete="new-password" placeholder="Contraseña (mín. 8)" />
              <button type="button" class="bh-btn bh-primary" id="regCreateBtn">Crear cuenta</button>
            </div>

            <div class="bh-msg bh-hidden" id="authMsgReg" role="status" aria-live="polite"></div>

            <div class="bh-msg" id="regBackRow" style="margin-top:12px;">
              <button type="button" class="bh-linkbtn" id="backStartFromRegBtn">Volver</button>
            </div>

            <div class="bh-msg bh-hidden" id="regLoginRow" style="margin-top:12px;">
              <button type="button" class="bh-linkbtn" id="regGoLoginBtn">Iniciar sesión</button>
            </div>
          </div>

          <div class="bh-probox">
            <div class="bh-proline"></div>
            <div class="bh-protext">
              Profesional inmobiliario:
              <a href="#">accede aquí</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initLayout(opts = {}) {
  const { showMiniSearch = false } = opts;

  const root = getSiteRoot();
  const headerMount = document.getElementById("bhHeader");
  const footerMount = document.getElementById("bhFooter");

  if (!headerMount) {
    throw new Error("Falta el contenedor bhHeader en la página.");
  }

  headerMount.innerHTML = renderHeader({ showMiniSearch, root });

  // El menú lateral y su fondo oscuro se renderizan dentro de .topbar, que crea
  // su propio contexto de apilamiento (position:relative; z-index:20). Eso los
  // dejaba "atrapados" por debajo de los paneles del mapa de Leaflet (z-index
  // 200–1000 en el contexto raíz). Los movemos al <body> para que su z-index
  // (9997/9998) se evalúe en el contexto raíz y cubran el mapa como el resto.
  ["bhSideOverlay", "bhSideMenu"].forEach((id) => {
    const el = headerMount.querySelector("#" + id);
    if (el) document.body.appendChild(el);
  });

  // El footer es opcional. En index.html se ha eliminado por decisión de diseño.
  if (footerMount) {
    footerMount.innerHTML = renderFooter({ root });
  }

  if (!document.getElementById("authOverlay")) {
    document.body.insertAdjacentHTML("beforeend", renderAuthModal({ root }));
  }

  const BASE_URL = getBaseUrlFromRoot(root);
  window.BH_SITE_ROOT = root;
  window.BH_BASE_URL = BASE_URL;
  window.BH_CALLBACK_URL = BASE_URL + "callback.html";


  const sideMenu = document.getElementById("bhSideMenu");
  const sideOverlay = document.getElementById("bhSideOverlay");
  const menuBtn = document.getElementById("navMenuBtn");
  const sideClose = document.getElementById("bhSideClose");

  function openSideMenu(){
    sideMenu?.classList.add("open");
    sideOverlay?.classList.add("open");
    document.body.classList.add("bhMenuOpen");
  }

  function closeSideMenu(){
    sideMenu?.classList.remove("open");
    sideOverlay?.classList.remove("open");
    document.body.classList.remove("bhMenuOpen");
  }

  menuBtn?.addEventListener("click", openSideMenu);
  sideClose?.addEventListener("click", closeSideMenu);
  sideOverlay?.addEventListener("click", closeSideMenu);

  // Auth-modal openers from inside the side menu (Iniciar sesión / Registrarse).
  sideMenu?.querySelectorAll("[data-bh-open-auth]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      closeSideMenu();
      const mode = el.getAttribute("data-bh-open-auth");
      const navLogin = document.getElementById("navLogin");
      navLogin?.click();
      if (mode === "register") {
        // Try to advance the auth modal into the register step if it exposes one.
        setTimeout(() => {
          const goRegister = document.getElementById("goRegisterBtn");
          goRegister?.click();
        }, 30);
      }
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape"){
      closeSideMenu();
    }
  });

  const miniSearchForm = document.getElementById("miniSearchForm");
  if (miniSearchForm) {
    miniSearchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const miniQ = document.getElementById("miniQ");
      const city = (miniQ?.value || "").trim();
      if (!city) return;

      if (typeof window.BH_goToMap === "function") {
        window.BH_goToMap(city);
        return;
      }

      const q = document.getElementById("q");
      if (q) q.value = city;
    });
  }
}


if (typeof window !== "undefined") window.initLayout = initLayout;
