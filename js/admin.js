/* ============================================================
   ADMIN.JS — ajout / édition / suppression de coureurs
   directement depuis le navigateur, via l'API GitHub.
   ============================================================ */
const GITHUB_OWNER = "alfaxx1308";
const GITHUB_REPO = "CyclingRP-";
const GITHUB_BRANCH = "main";
const RIDERS_FILE_PATH = "data/riders.json";

function getToken() {
    let token = localStorage.getItem("gh_token");
    if (!token) {
        token = window.prompt(
            "Colle ton token GitHub (Settings → Developer settings → Personal access tokens) :"
        );
        if (token) localStorage.setItem("gh_token", token.trim());
    }
    return token;
}

function forgetToken() {
    localStorage.removeItem("gh_token");
    showToast("Token oublié — il sera redemandé au prochain ajout/édition.");
}

function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

function base64ToUtf8(str) {
    return decodeURIComponent(escape(atob(str.replace(/\n/g, ""))));
}

async function githubApiFetch(path, options = {}) {
    const token = getToken();
    if (!token) throw new Error("Un token GitHub est requis pour enregistrer.");
    const res = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`,
        {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                ...(options.headers || {})
            }
        }
    );
    if (res.status === 401) {
        localStorage.removeItem("gh_token");
        throw new Error("Token invalide ou expiré. Relance l'action pour en saisir un nouveau.");
    }
    return res;
}

async function fetchRidersFile() {
    const res = await githubApiFetch(`${RIDERS_FILE_PATH}?ref=${GITHUB_BRANCH}`);
    if (!res.ok) throw new Error("Impossible de lire riders.json sur GitHub (" + res.status + ")");
    const data = await res.json();
    const parsed = JSON.parse(base64ToUtf8(data.content));
    return { riders: parsed.riders, sha: data.sha };
}

async function saveRidersFile(ridersArray, sha, commitMessage) {
    const body = {
        message: commitMessage,
        content: utf8ToBase64(JSON.stringify({ riders: ridersArray }, null, 2)),
        branch: GITHUB_BRANCH,
        sha
    };
    const res = await githubApiFetch(RIDERS_FILE_PATH, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Échec de l'enregistrement (" + res.status + ")");
    }
    return res.json();
}

function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function slugify(str) {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

/* ---- Gestionnaire de listes dynamiques (résultats, spécialités, liens) ---- */
function createDynamicList(container, fields) {
    function addRow(values = {}) {
        const row = document.createElement("div");
        row.className = "dynamic-list-row";
        fields.forEach(f => {
            let input;
            if (f.type === "select") {
                input = document.createElement("select");
                input.name = f.name;
                (f.options || []).forEach(opt => {
                    const o = document.createElement("option");
                    o.value = opt.value;
                    o.textContent = opt.label;
                    if (values[f.name] === opt.value) o.selected = true;
                    input.appendChild(o);
                });
            } else {
                input = document.createElement("input");
                input.name = f.name;
                input.type = f.type || "text";
                input.placeholder = f.placeholder || f.name;
                if (f.type === "checkbox") input.checked = !!values[f.name];
                else input.value = values[f.name] ?? "";
            }
            row.appendChild(input);
        });
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "remove-row-btn";
        removeBtn.textContent = "×";
        removeBtn.title = "Supprimer cette ligne";
        removeBtn.onclick = () => row.remove();
        row.appendChild(removeBtn);
        container.appendChild(row);
    }

    function getValues() {
        return Array.from(container.querySelectorAll(".dynamic-list-row"))
            .map(row => {
                const obj = {};
                fields.forEach(f => {
                    const input = row.querySelector(`[name="${f.name}"]`);
                    if (f.type === "checkbox") obj[f.name] = input.checked;
                    else if (f.type === "number") obj[f.name] = Number(input.value) || 0;
                    else obj[f.name] = input.value.trim();
                });
                return obj;
            })
            .filter(obj =>
                Object.entries(obj).some(([k, v]) => typeof v === "string" ? v !== "" : false)
            );
    }

    return { addRow, getValues };
}

/* ---- Modale d'ajout / édition ---- */
function openRiderForm(existingRider = null) {
    const isEdit = !!existingRider;

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2>${isEdit ? "Éditer " + existingRider.name : "Ajouter un coureur"}</h2>
                <button type="button" class="modal-close" aria-label="Fermer">&times;</button>
            </div>
            <form class="rider-form">
                <div class="form-grid">
                    <label>Nom complet
                        <input required name="name" value="${isEdit ? existingRider.name : ""}">
                    </label>
                    <label>Drapeau (emoji)
                        <input name="flag" value="${isEdit ? existingRider.flag || "" : ""}" placeholder="🇫🇷">
                    </label>
                    <label>Nationalité
                        <input name="nationality" value="${isEdit ? existingRider.nationality || "" : ""}">
                    </label>
                    <label>Équipe
                        <input name="team" value="${isEdit ? existingRider.team || "" : ""}">
                    </label>
                    <label>Âge
                        <input type="number" name="age" value="${isEdit ? existingRider.age ?? "" : ""}">
                    </label>
                    <label>Date de naissance
                        <input name="dob" value="${isEdit ? existingRider.dob || "" : ""}" placeholder="13 Jan 1997">
                    </label>
                    <label>Poids
                        <input name="weight" value="${isEdit ? existingRider.weight || "" : ""}" placeholder="60 kg">
                    </label>
                    <label>Taille
                        <input name="height" value="${isEdit ? existingRider.height || "" : ""}" placeholder="1,75 m">
                    </label>
                    <label>Vélo (marque)
                        <input name="bike" value="${isEdit ? existingRider.bike || "" : ""}" placeholder="Pinarello">
                    </label>
                    <label>Classement général RP (N°)
                        <input name="gcRank" value="${isEdit ? existingRider.gcRank ?? "" : ""}">
                    </label>
                    <label class="span-2">URL de la photo
                        <input name="image" value="${isEdit ? existingRider.image || "" : ""}" placeholder="images/coureurs/nom.jpg">
                    </label>
                </div>

                <h3>Spécialités</h3>
                <div class="dynamic-list" data-list="specialties"></div>
                <button type="button" class="btn btn-outline" data-add="specialties">+ Ajouter une spécialité</button>

                <h3>Résultats</h3>
                <div class="dynamic-list" data-list="results"></div>
                <button type="button" class="btn btn-outline" data-add="results">+ Ajouter un résultat</button>

                <h3>Liens</h3>
                <div class="dynamic-list" data-list="links"></div>
                <button type="button" class="btn btn-outline" data-add="links">+ Ajouter un lien</button>

                <div class="form-actions">
                    ${isEdit ? '<button type="button" class="btn btn-outline btn-danger" data-delete>Supprimer ce coureur</button>' : "<span></span>"}
                    <button type="submit" class="btn">${isEdit ? "Enregistrer" : "Créer le coureur"}</button>
                </div>
                <p class="form-status"></p>
            </form>
        </div>
    `;
    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();
    overlay.addEventListener("click", e => { if (e.target === overlay) closeModal(); });
    overlay.querySelector(".modal-close").addEventListener("click", closeModal);

    const specialtiesMgr = createDynamicList(
        overlay.querySelector('[data-list="specialties"]'),
        [{ name: "label", placeholder: "Grimpeur" }, { name: "value", type: "number", placeholder: "0-100" }]
    );

    const CATEGORY_OPTIONS = [
        { value: "Plat", label: "Plat" },
        { value: "Vallonné", label: "Vallonné" },
        { value: "Montagne", label: "Montagne" },
        { value: "Contre-la-montre", label: "Contre-la-montre" }
    ];
    const JERSEY_OPTIONS = [
        { value: "none", label: "Aucun" },
        { value: "yellow", label: "Jaune (leader/général)" },
        { value: "green", label: "Vert (points)" },
        { value: "polka", label: "Pois (montagne)" },
        { value: "rainbow", label: "Arc-en-ciel (champion du monde)" },
        { value: "plain", label: "Neutre (étape)" }
    ];

    const resultsMgr = createDynamicList(
        overlay.querySelector('[data-list="results"]'),
        [
            { name: "year", type: "number", placeholder: "Année" },
            { name: "date", placeholder: "26.07" },
            { name: "pos", placeholder: "Position" },
            { name: "win", type: "checkbox" },
            { name: "category", type: "select", options: CATEGORY_OPTIONS },
            { name: "jersey", type: "select", options: JERSEY_OPTIONS },
            { name: "race", placeholder: "Nom de la course" },
            { name: "tag", placeholder: "Étiquette (ex: 8e étape, Général)" }
        ]
    );

    const linksMgr = createDynamicList(
        overlay.querySelector('[data-list="links"]'),
        [{ name: "label", placeholder: "Instagram" }, { name: "url", placeholder: "https://..." }]
    );

    overlay.querySelector('[data-add="specialties"]').onclick = () => specialtiesMgr.addRow();
    overlay.querySelector('[data-add="results"]').onclick = () => resultsMgr.addRow();
    overlay.querySelector('[data-add="links"]').onclick = () => linksMgr.addRow();

    if (isEdit) {
        (existingRider.specialties || []).forEach(s => specialtiesMgr.addRow(s));
        (existingRider.results || []).forEach(r => resultsMgr.addRow(r));
        (existingRider.links || []).forEach(l => linksMgr.addRow(l));
    } else {
        specialtiesMgr.addRow();
        resultsMgr.addRow();
        linksMgr.addRow();
    }

    const deleteBtn = overlay.querySelector("[data-delete]");
    if (deleteBtn) {
        deleteBtn.onclick = async () => {
            if (!confirm(`Supprimer définitivement ${existingRider.name} ?`)) return;
            try {
                const { riders, sha } = await fetchRidersFile();
                const filtered = riders.filter(r => r.id !== existingRider.id);
                await saveRidersFile(filtered, sha, `Suppression de ${existingRider.name}`);
                showToast("Coureur supprimé");
                window.location.href = "coureurs.html";
            } catch (err) {
                showToast("Erreur : " + err.message, "error");
            }
        };
    }

    const form = overlay.querySelector("form");
    const statusEl = overlay.querySelector(".form-status");

    form.addEventListener("submit", async e => {
        e.preventDefault();
        const fd = new FormData(form);
        const name = fd.get("name").trim();
        if (!name) return;

        statusEl.textContent = "Enregistrement en cours…";
        statusEl.className = "form-status";

        const id = isEdit ? existingRider.id : slugify(name);

        const riderData = {
            id,
            name,
            flag: fd.get("flag").trim(),
            nationality: fd.get("nationality").trim(),
            team: fd.get("team").trim(),
            age: Number(fd.get("age")) || null,
            dob: fd.get("dob").trim(),
            weight: fd.get("weight").trim(),
            height: fd.get("height").trim(),
            bike: fd.get("bike").trim(),
            gcRank: fd.get("gcRank").trim(),
            image: fd.get("image").trim() || `images/coureurs/${id}.jpg`,
            specialties: specialtiesMgr.getValues(),
            links: linksMgr.getValues(),
            results: resultsMgr.getValues().map(r => ({ ...r, year: Number(r.year) || null }))
        };

        try {
            const { riders, sha } = await fetchRidersFile();
            const index = riders.findIndex(r => r.id === id);
            if (index >= 0) riders[index] = riderData;
            else riders.push(riderData);

            await saveRidersFile(riders, sha, isEdit ? `Édition de ${name}` : `Ajout de ${name}`);

            statusEl.textContent = "Enregistré ! Le site sera à jour dans 30 à 60 secondes.";
            statusEl.className = "form-status form-status-success";
            showToast(isEdit ? "Coureur mis à jour" : "Coureur ajouté");

            setTimeout(() => {
                closeModal();
                if (isEdit) window.location.reload();
                else if (typeof renderRidersList === "function") renderRidersList();
            }, 1200);
        } catch (err) {
            statusEl.textContent = "Erreur : " + err.message;
            statusEl.className = "form-status form-status-error";
        }
    });

    document.addEventListener("keydown", function escHandler(e) {
        if (e.key === "Escape") {
            closeModal();
            document.removeEventListener("keydown", escHandler);
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const addBtn =
