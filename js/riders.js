/* ============================================================
   RIDERS.JS — moteur d'affichage des coureurs
   Lit data/riders.json et génère :
     1. la liste des cartes (page coureurs.html)
     2. la fiche complète d'un coureur, style FirstCycling
        (page profil.html?id=...)
   ============================================================ */

const RIDERS_JSON_PATH = "data/riders.json";

let currentRider = null;
let profileState = { tab: "results", year: null, category: "Tous" };

async function loadRiders() {
    const res = await fetch(RIDERS_JSON_PATH);
    if (!res.ok) {
        throw new Error("Impossible de charger data/riders.json (code " + res.status + ")");
    }
    const data = await res.json();
    return data.riders;
}

function getInitials(name) {
    return name
        .split(" ")
        .filter(Boolean)
        .map(w => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

function buildAvatar(imagePath, name) {
    const img = document.createElement("img");
    img.src = imagePath;
    img.alt = name;
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

        if (!riders || riders.length === 0) {
            container.innerHTML = '<p class="empty-state">Aucun coureur pour le moment.</p>';
            return;
        }

        container.innerHTML = "";
        container.className = "card-grid";

        riders.forEach(rider => {
            const card = document.createElement("div");
            card.className = "card";

            const avatar = buildAvatar(rider.image, rider.name);
            card.appendChild(avatar);

            const h3 = document.createElement("h3");
            h3.textContent = rider.name;
            card.appendChild(h3);

            const meta = document.createElement("p");
            meta.className = "meta";
            meta.innerHTML = `<span class="flag">${rider.flag || ""}</span>${rider.team || ""}`;
            card.appendChild(meta);

            const link = document.createElement("a");
            link.className = "btn";
            link.href = `profil.html?id=${encodeURIComponent(rider.id)}`;
            link.textContent = "Voir le profil";
            card.appendChild(link);

            container.appendChild(card);
        });
    } catch (err) {
        container.innerHTML = `<p class="empty-state">Erreur de chargement : ${err.message}</p>`;
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
            container.innerHTML = `
                <section>
                    <p class="empty-state">Coureur introuvable : "${riderId}".</p>
                    <p><a class="btn" href="coureurs.html">← Retour aux coureurs</a></p>
                </section>`;
            return;
        }

        document.title = `${rider.name} — Cycle League RP`;
        currentRider = rider;

        const years = [...new Set((rider.results || []).map(r => r.year))].sort((a, b) => b - a);
        profileState = { tab: "results", year: years[0] || null, category: "Tous" };

        renderProfileView(container);
    } catch (err) {
        container.innerHTML = `<section><p class="empty-state">Erreur de chargement : ${err.message}</p></section>`;
    }
}

function renderProfileView(container) {
    container.innerHTML = buildProfileHTML(currentRider, profileState);

    const avatarSlot = container.querySelector("[data-avatar-slot]");
    if (avatarSlot) avatarSlot.appendChild(buildAvatar(currentRider.image, currentRider.name));

    container.querySelectorAll(".fc-tab").forEach(btn => {
        btn.addEventListener("click", () => {
            profileState.tab = btn.dataset.tab;
            renderProfileView(container);
        });
    });
    container.querySelectorAll(".fc-year-tab").forEach(btn => {
        btn.addEventListener("click", () => {
            profileState.year = Number(btn.dataset.year);
            renderProfileView(container);
        });
    });
    container.querySelectorAll(".fc-category-tab").forEach(btn => {
        btn.addEventListener("click", () => {
            profileState.category = btn.dataset.category;
            renderProfileView(container);
        });
    });
}

function jerseyIconHTML(jersey) {
    return `<span class="jersey-icon ${jersey || "none"}"></span>`;
}

function buildProfileHTML(rider, state) {
    const results = rider.results || [];
    const years = [...new Set(results.map(r => r.year))].sort((a, b) => b - a);
    const categories = ["Tous", "Plat", "Vallonné", "Montagne", "Contre-la-montre"];

    const specialtiesHTML = (rider.specialties || []).map(s => `
        <div class="specialty-row">
            <span class="specialty-label">${s.label}</span>
            <span class="specialty-track"><span class="specialty-fill" style="width:${s.value}%;"></span></span>
            <span class="specialty-value">${s.value}</span>
        </div>
    `).join("");

    const tabsHTML = `
        <div class="fc-tabs">
            <button type="button" class="fc-tab ${state.tab === "results" ? "active" : ""}" data-tab="results">Résultats</button>
            <button type="button" class="fc-tab ${state.tab === "palmares" ? "active" : ""}" data-tab="palmares">Palmarès</button>
            <button type="button" class="fc-tab ${state.tab === "classement" ? "active" : ""}" data-tab="classement">Classement</button>
            <button type="button" class="fc-tab ${state.tab === "specialties" ? "active" : ""}" data-tab="specialties">Spécialités</button>
            <button type="button" class="fc-tab ${state.tab === "equipes" ? "active" : ""}" data-tab="equipes">Équipes</button>
        </div>
    `;

    let panelHTML = "";

    if (state.tab === "results") {
        const yearTabsHTML = years.length ? `
            <div class="fc-year-tabs">
                ${years.map(y => `<button type="button" class="fc-year-tab ${y === state.year ? "active" : ""}" data-year="${y}">${y}</button>`).join("")}
            </div>` : "";

        const
