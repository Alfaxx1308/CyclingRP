/* ============================================================
   RIDERS.JS — moteur d'affichage des coureurs
   Lit data/riders.json et génère :
     1. la liste des cartes (page coureurs.html)
     2. la fiche complète d'un coureur, style FirstCycling
        (page profil.html?id=...)

   Si un bug survient, le message d'erreur s'affiche directement
   sur la page (pas besoin d'ouvrir la console).
   ============================================================ */

const RIDERS_JSON_PATH = "data/riders.json";

let currentRider = null;
let profileState = { tab: "results", year: null, category: "Tous" };

/* ---- Affiche une erreur visible sur la page, sans console ---- */
function showPageError(message) {
    const targets = [
        document.getElementById("riders-list"),
        document.getElementById("rider-profile")
    ];
    targets.forEach(el => {
        if (el) {
            el.innerHTML =
                '<p class="empty-state" style="color:#ff4d5e;">Erreur : ' +
                escapeHTML(message) +
                "</p>";
        }
    });
}

function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
}

/* Filet de sécurité global : si une erreur JS survient n'importe où
   dans ce fichier, elle s'affiche sur la page au lieu de rester
   bloqué silencieusement sur "Chargement..." */
window.addEventListener("error", event => {
    showPageError(event.message + " (ligne " + event.lineno + ")");
});

async function loadRiders() {
    const res = await fetch(RIDERS_JSON_PATH);
    if (!res.ok) {
        throw new Error("Impossible de charger data/riders.json (code " + res.status + ")");
    }
    const data = await res.json();
    if (!data || !Array.isArray(data.riders)) {
        throw new Error("data/riders.json ne contient pas de clé \"riders\" valide.");
    }
    return data.riders;
}

function getInitials(name) {
    return String(name)
        .split(" ")
        .filter(Boolean)
        .map(w => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

function buildAvatar(imagePath, name) {
    const img = document.createElement("img");
    img.src = imagePath || "";
    img.alt = name || "";
    img.loading = "lazy";
    img.onerror = () => {
        const fallback = document.createElement("div");
        fallback.className = "img-fallback";
        fallback.textContent = getInitials(name);
        img.replaceWith(fallback);
    };
    return img;
}

/* ============================================================
   PAGE LISTE — coureurs.html
   ============================================================ */
async function renderRidersList() {
    const container = document.getElementById("riders-list");
    if (!container) return;

    container.innerHTML = '<p class="empty-state">Chargement des coureurs…</p>';

    try {
        const riders = await loadRiders();

        if (!riders.length) {
            container.innerHTML = '<p class="empty-state">Aucun coureur pour le moment.</p>';
            return;
        }

        container.innerHTML = "";
        container.className = "card-grid";

        riders.forEach(rider => {
            const card = document.createElement("div");
            card.className = "card";
            card.appendChild(buildAvatar(rider.image, rider.name));

            const h3 = document.createElement("h3");
            h3.textContent = rider.name || "(sans nom)";
            card.appendChild(h3);

            const meta = document.createElement("p");
            meta.className = "meta";
            meta.textContent = (rider.flag || "") + " " + (rider.team || "");
            card.appendChild(meta);

            const link = document.createElement("a");
            link.className = "btn";
            link.href = "profil.html?id=" + encodeURIComponent(rider.id || "");
            link.textContent = "Voir le profil";
            card.appendChild(link);

            container.appendChild(card);
        });
    } catch (err) {
        container.innerHTML = '<p class="empty-state">Erreur de chargement : ' + escapeHTML(err.message) + "</p>";
    }
}

/* ============================================================
   PAGE PROFIL — profil.html?id=egan-bernal
   ============================================================ */
async function renderRiderProfile() {
    const container = document.getElementById("rider-profile");
    if (!container) return;

    const params = new URLSearchParams(window.location.search);
    const riderId = params.get("id");

    if (!riderId) {
        container.innerHTML = '<section><p class="empty-state">Aucun coureur spécifié dans l\'URL.</p></section>';
        return;
    }

    try {
        const riders = await loadRiders();
        const rider = riders.find(r => r.id === riderId);

        if (!rider) {
            container.innerHTML =
                '<section><p class="empty-state">Coureur introuvable : "' + escapeHTML(riderId) + '".</p>' +
                '<p><a class="btn" href="coureurs.html">← Retour aux coureurs</a></p></section>';
            return;
        }

        document.title = rider.name + " — Cycle League RP";
        currentRider = rider;

        const results = rider.results || [];
        const years = [...new Set(results.map(r => r.year))].sort((a, b) => b - a);
        profileState = { tab: "results", year: years[0] || null, category: "Tous" };

        renderProfileView(container);
    } catch (err) {
        container.innerHTML = '<section><p class="empty-state">Erreur de chargement : ' + escapeHTML(err.message) + "</p></section>";
    }
}

function renderProfileView(container) {
    container.innerHTML = buildProfileHTML(currentRider, profileState);

    const avatarSlot = container.querySelector("[data-avatar-slot]");
    if (avatarSlot) avatarSlot.appendChild(buildAvatar(currentRider.image, currentRider.name));

    container.querySelectorAll(".fc-tab").forEach(btn => {
        btn.addEventListener("click", () => {
            profileState.tab = btn.getAttribute("data-tab");
            renderProfileView(container);
        });
    });
    container.querySelectorAll(".fc-year-tab").forEach(btn => {
        btn.addEventListener("click", () => {
            profileState.year = Number(btn.getAttribute("data-year"));
            renderProfileView(container);
        });
    });
    container.querySelectorAll(".fc-category-tab").forEach(btn => {
        btn.addEventListener("click", () => {
            profileState.category = btn.getAttribute("data-category");
            renderProfileView(container);
        });
    });
}

function jerseyIconHTML(jersey) {
    return '<span class="jersey-icon ' + (jersey || "none") + '"></span>';
}

/* ---- Onglet RÉSULTATS ---- */
function buildResultsPanel(rider, state) {
    const results = rider.results || [];
    const years = [...new Set(results.map(r => r.year))].sort((a, b) => b - a);
    const categories = ["Tous", "Plat", "Vallonné", "Montagne", "Contre-la-montre"];

    let yearTabsHTML = "";
    if (years.length) {
        const yearButtons = years.map(y =>
            '<button type="button" class="fc-year-tab ' + (y === state.year ? "active" : "") +
            '" data-year="' + y + '">' + y + "</button>"
        );
        yearTabsHTML = '<div class="fc-year-tabs">' + yearButtons.join("") + "</div>";
    }

    const categoryButtons = categories.map(c =>
        '<span class="fc-category-tab ' + (c === state.category ? "active" : "") +
        '" data-category="' + c + '">' + c + "</span>"
    );
    const categoryTabsHTML = '<div class="fc-category-tabs">' + categoryButtons.join("") + "</div>";

    const filtered = results.filter(r =>
        (state.year ? r.year === state.year : true) &&
        (state.category === "Tous" ? true : r.category === state.category)
    );

    let rowsHTML;
    if (filtered.length) {
        rowsHTML = filtered.map(r => {
            const tagHTML = r.tag ? '<span class="fc-tag">' + escapeHTML(r.tag) + "</span>" : "";
            return (
                "<tr>" +
                '<td class="fc-date">' + escapeHTML(r.date || "") + "</td>" +
                '<td class="fc-pos">' + escapeHTML(r.pos || "") + "</td>" +
                "<td>" + jerseyIconHTML(r.jersey) + "</td>" +
                '<td class="fc-race">' + escapeHTML(r.race || "") + tagHTML + "</td>" +
                "</tr>"
            );
        }).join("");
    } else {
        rowsHTML = '<tr><td colspan="4" class="fc-empty">Aucun résultat pour ces filtres.</td></tr>';
    }

    return yearTabsHTML + categoryTabsHTML + '<table class="fc-results-table"><tbody>' + rowsHTML + "</tbody></table>";
}

/* ---- Onglet PALMARÈS ---- */
function buildPalmaresPanel(rider) {
    const wins = (rider.results || []).filter(r => r.win);
    if (!wins.length) {
        return '<p class="fc-empty">Aucune victoire enregistrée pour le moment.</p>';
    }

    const grouped = {};
    wins.forEach(r => {
        if (!grouped[r.year]) grouped[r.year] = [];
        grouped[r.year].push(r);
    });
    const sortedYears = Object.keys(grouped).sort((a, b) => b - a);

    const blocksHTML = sortedYears.map(y => {
        const itemsHTML = grouped[y].map(r => {
            const tagHTML = r.tag ? ' <span class="stage" style="color:#888;">(' + escapeHTML(r.tag) + ")</span>" : "";
            return (
                '<li class="win" style="background:#f5f5f5;border-left-color:#000;">' +
                '<span class="result-pos" style="color:#111;">' + escapeHTML(r.pos || "") + "</span>" +
                '<span class="result-race" style="color:#222;">' + escapeHTML(r.race || "") + tagHTML + "</span>" +
                "</li>"
            );
        }).join("");
        return (
            '<div class="palmares-year">' +
            '<span class="year-label" style="color:#111;">' + y + "</span>" +
            "<ul>" + itemsHTML + "</ul>" +
            "</div>"
        );
    }).join("");

    return '<div class="fc-panel"><div class="palmares">' + blocksHTML + "</div></div>";
}

/* ---- Onglet CLASSEMENT ---- */
function buildClassementPanel(rider) {
    const rank = rider.gcRank !== undefined && rider.gcRank !== null && rider.gcRank !== "" ? rider.gcRank : "—";
    return (
        '<div class="fc-panel"><div class="fc-classement-box">' +
        '<span class="fc-classement-label">Classement général RP</span>' +
        '<span class="fc-classement-value">N°' + escapeHTML(rank) + "</span>" +
        "</div></div>"
    );
}

/* ---- Onglet SPÉCIALITÉS ---- */
function buildSpecialtiesPanel(rider) {
    const specialties = rider.specialties || [];
    if (!specialties.length) {
        return '<div class="fc-panel"><p class="fc-empty">Aucune spécialité renseignée.</p></div>';
    }
    const rowsHTML = specialties.map(s =>
        '<div class="specialty-row">' +
        '<span class="specialty-label">' + escapeHTML(s.label || "") + "</span>" +
        '<span class="specialty-track"><span class="specialty-fill" style="width:' + (Number(s.value) || 0) + '%;"></span></span>' +
        '<span class="specialty-value">' + escapeHTML(s.value ?? "") + "</span>" +
        "</div>"
    ).join("");
    return '<div class="fc-panel"><div class="specialty-list">' + rowsHTML + "</div></div>";
}

/* ---- Assemble la fiche complète ---- */
function buildProfileHTML(rider, state) {
    const results = rider.results || [];

    const tabsHTML =
        '<div class="fc-tabs">' +
        '<button type="button" class="fc-tab ' + (state.tab === "results" ? "active" : "") + '" data-tab="results">Résultats</button>' +
        '<button type="button" class="fc-tab ' + (state.tab === "palmares" ? "active" : "") + '" data-tab="palmares">Palmarès</button>' +
        '<button type="button" class="fc-tab ' + (state.tab === "classement" ? "active" : "") + '" data-tab="classement">Classement</button>' +
        '<button type="button" class="fc-tab ' + (state.tab === "specialties" ? "active" : "") + '" data-tab="specialties">Spécialités</button>' +
        "</div>";

    let panelHTML = "";
    if (state.tab === "results") panelHTML = buildResultsPanel(rider, state);
    else if (state.tab === "palmares") panelHTML = buildPalmaresPanel(rider);
    else if (state.tab === "classement") panelHTML = buildClassementPanel(rider);
    else if (state.tab === "specialties") panelHTML = buildSpecialtiesPanel(rider);

    const winCount = results.filter(r => r.win).length;

    return (
        '<div class="fc-profile">' +
        '<div class="fc-header">' +
        "<span data-avatar-slot></span>" +
        '<div class="fc-header-info">' +
        "<h1>" + escapeHTML(rider.name || "") + "</h1>" +
        "<p>" + escapeHTML(rider.team || "") +
        (rider.age ? ", " + escapeHTML(rider.age) : "") +
        (rider.dob ? " (" + escapeHTML(rider.dob) + ")" : "") +
        "</p>" +
        "</div>" +
        "</div>" +
        '<div class="fc-stats-row">' +
        "<span>🚲 " + escapeHTML(rider.bike || "—") + "</span>" +
        "<span>📋 " + results.length + "</span>" +
        "<span>🏆 " + winCount + "</span>" +
        "<span>" + escapeHTML(rider.flag || "") + " " + escapeHTML(rider.nationality || "") + "</span>" +
        "</div>" +
        tabsHTML +
        panelHTML +
        "</div>"
    );
}

/* ---- Lance le bon rendu selon la page où le script est chargé ---- */
document.addEventListener("DOMContentLoaded", () => {
    renderRidersList();
    renderRiderProfile();
});
