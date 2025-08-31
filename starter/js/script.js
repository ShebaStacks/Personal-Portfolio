(() => {
  "use strict";

  // ---------------- Config ----------------
  const DATA = {
    about: "data/aboutMeData.json",
    projects: "data/projectsData.json",
  };

  const PLACEHOLDERS = {
    headshot: "images/spotlight_placeholder_bg.webp",
    cardBg: "images/card_placeholder_bg.webp",
    spotlightBg: "images/spotlight_placeholder_bg.webp",
  };

  const REGEX = {
    ILLEGAL: /[^a-zA-Z0-9@._-]/,
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  };

  // ---------------- State -----------------
  let aboutData = null;
  let projectsData = [];
  let selectedProjectId = null;

  // --------------- Utilities --------------
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const el = (tag, opts = {}) => {
    const node = document.createElement(tag);
    if (opts.className) node.className = opts.className;
    if (opts.id) node.id = opts.id;
    if (opts.text != null) node.textContent = opts.text;
    if (opts.attrs) Object.entries(opts.attrs).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
  };
  const safe = (v, fallback) => (v == null || v === "" ? fallback : v);

  function normalizeAssetPath(input, fallback) {
    if (!input || typeof input !== "string") return fallback;
    let s = input.trim();
    if (s === "#" || /^(null|undefined)$/i.test(s)) return fallback;
    if (s.startsWith("./")) s = s.slice(2);
    if (s.startsWith("/")) s = s.slice(1);
    if (!/^images\//.test(s) && /\.(png|jpe?g|webp|gif|svg)$/i.test(s)) s = "images/" + s;
    try { return new URL(s, window.location.href).toString(); } catch { return fallback; }
  }

  function setBg(node, rawUrl, rawFallback) {
    if (!node) return;
    node.style.backgroundSize = "cover";
    node.style.backgroundPosition = "center";
    node.style.backgroundRepeat = "no-repeat";
    if (!node.style.minHeight) node.style.minHeight = "200px";

    const url = normalizeAssetPath(rawUrl, rawFallback);
    const fallbackUrl = normalizeAssetPath(rawFallback, rawFallback);

    const apply = (u) => { node.style.backgroundImage = `url("${u}")`; };

    const img = new Image();
    img.onload = () => apply(url);
    img.onerror = () => {
      console.warn("[Image load failed]", url, "→ fallback", fallbackUrl);
      apply(fallbackUrl);
    };
    img.src = url;
  }

  async function getJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Failed to fetch ${url} (${r.status})`);
    return r.json();
  }

  // ------------ About Me build ------------
  function buildAboutSection(data) {
    const container = $("#aboutMe");
    if (!container) return;

    container.innerHTML = "";

    const p = el("p", { text: safe(data?.about, "Hello! 👋") });
    const headshotContainer = el("div", { className: "headshotContainer" });
    const headshotUrl = safe(data?.headshot, PLACEHOLDERS.headshot);
    setBg(headshotContainer, headshotUrl, PLACEHOLDERS.headshot);

    const frag = document.createDocumentFragment();
    frag.appendChild(p);
    frag.appendChild(headshotContainer);
    container.appendChild(frag);
  }

  // -------- Projects: cards + spotlight ----
  function buildProjectCards(projects) {
    // YOUR HTML uses #projectList (a <sidebar>)
    const list = $("#projectList");
    if (!list) return;

    list.innerHTML = "";

    const frag = document.createDocumentFragment();

    projects.forEach((proj) => {
      const card = el("div", { className: "projectCard" });
      // “each <div> should have an id attribute equal to the project_id”
      if (proj?.project_id != null) card.id = String(proj.project_id);
      card.dataset.projectId = String(proj?.project_id ?? "");

      const cardUrl = safe(proj?.card_image, PLACEHOLDERS.cardBg);
      setBg(card, cardUrl, PLACEHOLDERS.cardBg);

      const h4 = el("h4", { text: safe(proj?.project_name, "Untitled Project") });
      const p = el("p", { text: safe(proj?.short_description, "No description provided.") });

      card.appendChild(h4);
      card.appendChild(p);
      frag.appendChild(card);
    });

    list.appendChild(frag);

    // click → update spotlight
    list.addEventListener("click", (e) => {
      const card = e.target.closest(".projectCard");
      if (!card) return;
      const pid = card.dataset.projectId;
      const proj = projectsData.find((p) => String(p.project_id) === String(pid));
      if (!proj) return;
      selectedProjectId = proj.project_id;
      updateSpotlight(proj);
    }, { passive: true });
  }

  function updateSpotlight(project) {
    const spotlight = $("#projectSpotlight");
    if (!spotlight) return;

    // YOUR HTML has a DIV #spotlightTitles inside #projectSpotlight
    const titlesWrapper = $("#spotlightTitles", spotlight) || el("div", { id: "spotlightTitles" });

    // Clear and rebuild the titles wrapper as:
    // <h3>title</h3><p>long desc</p><a>link</a>
    titlesWrapper.innerHTML = "";

    const h3 = el("h3", { text: safe(project?.project_name, "Untitled Project") });
    const p = el("p", { text: safe(project?.long_description, "No details available yet.") });
    const a = el("a", { text: "Click here to see more..." });
    a.href = safe(project?.url, "#");
    a.target = "_blank";
    a.rel = "noopener noreferrer";

    titlesWrapper.appendChild(h3);
    titlesWrapper.appendChild(p);
    titlesWrapper.appendChild(a);

    if (!titlesWrapper.parentNode) spotlight.appendChild(titlesWrapper);

    // Set spotlight background on the #projectSpotlight element
    const spotUrl = safe(project?.spotlight_image, PLACEHOLDERS.spotlightBg);
    setBg(spotlight, spotUrl, PLACEHOLDERS.spotlightBg);
  }

  function initSpotlightDefault() {
    if (projectsData.length > 0) {
      selectedProjectId = projectsData[0].project_id;
      updateSpotlight(projectsData[0]);
    }
  }

  // ------------- Arrow scrolling -----------
  function wireProjectScroll() {
    const container = $("#projectList"); // match your HTML
    const arrowsWrap = $("#projectNavArrows");
    if (!container || !arrowsWrap) return;

    // Your HTML uses <span class="arrow-left/right">
    const left = $(".arrow-left", arrowsWrap);
    const right = $(".arrow-right", arrowsWrap);

    const isDesktop = () => window.matchMedia("(min-width: 1024px)").matches;
    const step = 300;

    const scrollByStep = (dir) => {
      const opts = { left: 0, top: 0, behavior: "smooth" };
      if (isDesktop()) opts.top = dir * step;     // vertical on desktop
      else opts.left = dir * step;                // horizontal on mobile
      container.scrollBy(opts);
    };

    if (left)  left.addEventListener("click", () => scrollByStep(-1));
    if (right) right.addEventListener("click", () => scrollByStep(1));
  }

  // ------------- Form validation -----------
  function wireFormValidation() {
    // Your HTML uses #formSection, #contactEmail, #contactMessage, #charactersLeft
    const form = $("#formSection");
    if (!form) return;

    const emailInput = $("#contactEmail", form);
    const messageInput = $("#contactMessage", form);
    const emailError = $("#emailError");
    const messageError = $("#messageError");
    const counter = $("#charactersLeft");

    if (messageInput && counter) {
      const updateCount = () => {
        const used = messageInput.value.length;
        const left = 300 - used;
        counter.textContent = `Characters: ${Math.min(used, 300)}/300`;
        counter.classList.toggle("error", left < 0);
      };
      messageInput.addEventListener("input", updateCount);
      updateCount();
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const emailVal = emailInput?.value.trim() || "";
      const msgVal = messageInput?.value || "";

      let emailMsg = "";
      let msgMsg = "";

      if (!emailVal) emailMsg = "Email is required.";
      else if (REGEX.ILLEGAL.test(emailVal)) emailMsg = "Email contains illegal characters.";
      else if (!REGEX.EMAIL.test(emailVal)) emailMsg = "Please enter a valid email address.";

      if (!msgVal) msgMsg = "Message is required.";
      else if (REGEX.ILLEGAL.test(msgVal)) msgMsg = "Message contains illegal characters.";
      else if (msgVal.length > 300) msgMsg = "Message must be 300 characters or fewer.";

      if (emailError) emailError.textContent = emailMsg;
      if (messageError) messageError.textContent = msgMsg;

      if (!emailMsg && !msgMsg) {
        alert("Form submitted successfully! ✅");
      }
    });
  }

  // ----------------- Init ------------------
  async function init() {
    try {
      const [about, projects] = await Promise.all([
        getJSON(DATA.about),
        getJSON(DATA.projects),
      ]);
      aboutData = about;
      projectsData = Array.isArray(projects) ? projects : [];

      buildAboutSection(aboutData);
      buildProjectCards(projectsData);
      initSpotlightDefault();
      wireProjectScroll();
      wireFormValidation();
    } catch (err) {
      console.error(err);
      // Render placeholders if fetch fails (so the page isn't blank)
      buildAboutSection({ about: "Welcome!", headshot: PLACEHOLDERS.headshot });
      buildProjectCards([]);
      wireProjectScroll();
      wireFormValidation();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
