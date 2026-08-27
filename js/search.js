/* ============================================================
   SEARCH.JS — recherche globale du site
   Cherche parmi les pages principales et tous les coureurs.
   Fonctionne sur n'importe quelle page indépendamment.
   ============================================================ */

const SITE_PAGES = [
    { label: "Accueil", url: "index.html" },
    { label: "Coureurs", url: "coureurs.html" },
    { label: "Équipes", url: "equipes.html" },
    { label: "Courses", url: "courses.html" },
    { label: "Classements", url: "classements.html" }
];

let searchRidersCache = null;

function normalizeText(str) {
    return String(str)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

async function getSearchableRiders() {
    if (searchRidersCache) return searchRidersCache;
    try {
        const res = await fetch("data/riders.json");
        if (!res.ok) return [];
        const data = await res.json();
        searchRidersCache = Array.isArray(data.riders) ? data.riders : [];
        return searchRidersCache;
    } catch (err) {
        return [];
    }
}

async function runSiteSearch(query) {
    const q = normalizeText(query.trim());
    if (!q) return [];

    const results = [];

    SITE_PAGES.forEach(page => {
        if (normalizeText(page.label).includes(q)) {
            results.push({ type: "Page", label: page.label, url: page.url });
        }
    });

    const riders = await getSearchableRiders();
    riders.forEach(rider => {
        const haystack = normalizeText((rider.name || "") + " " + (rider.team || ""));
        if (haystack.includes(q)) {
            results.push({
                type: "Coureur",
                label: rider.name,
                sub: rider.team || "",
                url: "profil.html?id=" + encodeURIComponent(rider.id)
            });
        }
    });

    return results.slice(0, 8);
}

function renderSearchResults(container, results) {
    if (!results.length) {
        container.innerHTML = '<div class="site-search-empty">Aucun résultat</div>';
        container.classList.add("open");
        return;
    }

    container.innerHTML = results.map(r => `
        <a href="${r.url}" class="site-search-result">
            <span>${r.label}${r.sub ? ` <span style="color:var(--text-muted);font-size:12px;">— ${r.sub}</span>` : ""}</span>
            <span class="result-type">${r.type}</span>
        </a>
    `).join("");
    container.classList.add("open");
}

document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("site-search-input");
    const resultsBox = document.getElementById("site-search-results");
    if (!input || !resultsBox) return;

    let debounceTimer = null;

    input.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        const query = input.value;

        if (!query.trim()) {
            resultsBox.classList.remove("open");
            resultsBox.innerHTML = "";
            return;
        }

        debounceTimer = setTimeout(async () => {
            const results = await runSiteSearch(query);
            renderSearchResults(resultsBox, results);
        }, 150);
    });

    input.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            const first = resultsBox.querySelector(".site-search-result");
            if (first) window.location.href = first.getAttribute("href");
        }
        if (e.key === "Escape") {
            resultsBox.classList.remove("open");
            input.blur();
        }
    });

    document.addEventListener("click", e => {
        if (!input.contains(e.target) && !resultsBox.contains(e.target)) {
            resultsBox.classList.remove("open");
        }
    });
});
