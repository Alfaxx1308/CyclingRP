/* ============================================================
   RIDERS.JS — moteur d'affichage des coureurs
   Lit data/riders.json et génère :
     1. la liste des cartes (page coureurs.html)
     2. la fiche complète d'un coureur (page profil.html?id=...)

   TU N'AS NORMALEMENT JAMAIS BESOIN DE MODIFIER CE FICHIER.
   Pour ajouter/éditer un coureur : va dans data/riders.json
   ============================================================ */

async function loadRiders() {
    const res = await fetch(RIDERS_JSON_PATH);
    if (!res.ok) {
        throw new Error("Impossible de charger data/riders.json (code " + res.status + ")");
    }
    const data = await res.json();
    return data.riders; // ← le tableau est maintenant sous la clé "riders"
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

async function renderRidersList() {
    const container = document.getElementById("riders-list");
    if (!container) return;

    container.innerHTML = '<p class="empty-state">Chargement des coureurs…</p>';

    try {
        const riders = await loadRiders();

        if (riders.length === 0) {
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
            meta.innerHTML = `<span class="flag">${rider.flag}</span>${rider.team}`;
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
        container.innerHTML = buildProfileHTML(rider);

        const avatarSlot = container.querySelector("[data-avatar-slot]");
        if (avatarSlot) {
            avatarSlot.appendChild(buildAvatar(rider.image, rider.name));
        }
    } catch (err) {
        container.innerHTML = `<section><p class="empty-state">Erreur de chargement : ${err.message}</p></section>`;
    }
}

function buildProfileHTML(rider) {
    const specialtiesHTML = (rider.specialties || []).map(s => `
        <div class="specialty-row">
            <span class="specialty-label">${s.label}</span>
            <span class="specialty-track"><span class="specialty-fill" style="width:${s.value}%;"></span></span>
            <span class="specialty-value">${s.value}</span>
        </div>
    `).join("");

    const linksHTML = (rider.links || []).map(l =>
        `<a href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`
    ).join("");

    const palmaresHTML = (rider.palmares || []).map(p => `
        <div class="palmares-year">
            <span class="year-label">${p.year}</span>
            <ul>
                ${p.results.map(r => `
                    <li class="${r.win ? "win" : ""}">
                        <span class="result-pos">${r.pos}</span>
                        <span class="result-race">${r.race}${r.note ? ` <span class="stage">(${r.note})</span>` : ""}</span>
                    </li>
                `).join("")}
            </ul>
        </div>
    `).join("");

    const resultsRowsHTML = (rider.recentResults || []).map(r => `
        <tr>
            <td>${r.race}</td>
            <td>${r.stage}</td>
            <td>${r.pos}</td>
            <td>${r.time}</td>
        </tr>
    `).join("");

    return `
        <section>
            <div class="rider-header">
                <span data-avatar-slot></span>
                <div class="rider-identity">
                    <h1>${rider.name}</h1>
                    <p class="rider-team">${rider.flag} ${rider.team}</p>
                    <span class="rider-rank">Classement RP : <strong>N°${rider.rpRank}</strong></span>
                </div>
            </div>

            <div class="rider-info-grid">
                <dl><dt>Date de naissance</dt><dd>${rider.dob}</dd></dl>
                <dl><dt>Nationalité</dt><dd>${rider.flag} ${rider.nationality}</dd></dl>
                <dl><dt>Poids</dt><dd>${rider.weight}</dd></dl>
                <dl><dt>Taille</dt><dd>${rider.height}</dd></dl>
                <dl><dt>Équipe</dt><dd>${rider.team}</dd></dl>
            </div>

            ${linksHTML ? `<div class="rider-links">${linksHTML}</div>` : ""}
        </section>

        ${specialtiesHTML ? `
        <section>
            <h2>Spécialités</h2>
            <div class="specialty-list">${specialtiesHTML}</div>
        </section>` : ""}

        ${palmaresHTML ? `
        <section>
            <h2>Palmarès RP</h2>
            <div class="palmares">${palmaresHTML}</div>
        </section>` : ""}

        ${resultsRowsHTML ? `
        <section>
            <h2>Résultats récents</h2>
            <table>
                <thead>
                    <tr><th>Course</th><th>Étape</th><th>Position</th><th>Temps</th></tr>
                </thead>
                <tbody>${resultsRowsHTML}</tbody>
            </table>
        </section>` : ""}
    `;
}

document.addEventListener("DOMContentLoaded", () => {
    renderRidersList();
    renderRiderProfile();
});
