/* ============================================================
   ADMIN.JS — ajout / édition / suppression de coureurs
   directement depuis le navigateur, via l'API GitHub.
   ============================================================ */

const GITHUB_OWNER = "alfaxx1308";
const GITHUB_REPO = "CyclingRP";
const GITHUB_BRANCH = "main";
const RIDERS_FILE_PATH = "data/riders.json";


/* ============================================================
   TOKEN GITHUB
   ============================================================ */

function getToken() {
    let token = localStorage.getItem("gh_token");

    if (!token) {
        token = window.prompt(
            "Colle ton token GitHub (Settings → Developer settings → Personal access tokens) :"
        );

        if (token) {
            localStorage.setItem("gh_token", token.trim());
        }
    }

    return token;
}

function forgetToken() {
    localStorage.removeItem("gh_token");
    showToast(
        "Token oublié — il sera redemandé au prochain ajout/édition."
    );
}


/* ============================================================
   ENCODAGE UTF-8 / BASE64
   ============================================================ */

function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

function base64ToUtf8(str) {
    return decodeURIComponent(escape(atob(str.replace(/\n/g, ""))));
}


/* ============================================================
   ÉCHAPPEMENT HTML
   ============================================================ */

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* ============================================================
   API GITHUB
   ============================================================ */

async function githubApiFetch(path, options = {}) {

    const token = getToken();

    if (!token) {
        throw new Error(
            "Un token GitHub est requis pour enregistrer."
        );
    }

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

        throw new Error(
            "Token invalide ou expiré. Relance l'action pour en saisir un nouveau."
        );
    }

    if (res.status === 403) {
        throw new Error(
            "GitHub refuse l'accès. Vérifie les permissions de ton token."
        );
    }

    if (res.status === 404) {
        throw new Error(
            "Dépôt ou fichier introuvable sur GitHub. Vérifie le nom du dépôt."
        );
    }

    return res;
}


/* ============================================================
   LECTURE DE riders.json
   ============================================================ */

async function fetchRidersFile() {

    const res = await githubApiFetch(
        `${RIDERS_FILE_PATH}?ref=${GITHUB_BRANCH}`
    );

    if (!res.ok) {
        throw new Error(
            "Impossible de lire riders.json sur GitHub (" +
            res.status +
            ")"
        );
    }

    const data = await res.json();

    const parsed = JSON.parse(
        base64ToUtf8(data.content)
    );

    if (!parsed || !Array.isArray(parsed.riders)) {
        throw new Error(
            "data/riders.json ne contient pas une liste de coureurs valide."
        );
    }

    return {
        riders: parsed.riders,
        sha: data.sha
    };
}


/* ============================================================
   SAUVEGARDE DE riders.json
   ============================================================ */

async function saveRidersFile(
    ridersArray,
    sha,
    commitMessage
) {

    const body = {

        message: commitMessage,

        content: utf8ToBase64(
            JSON.stringify(
                {
                    riders: ridersArray
                },
                null,
                2
            )
        ),

        branch: GITHUB_BRANCH,

        sha: sha
    };

    const res = await githubApiFetch(
        RIDERS_FILE_PATH,
        {
            method: "PUT",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(body)
        }
    );

    if (!res.ok) {

        const err = await res
            .json()
            .catch(() => ({}));

        throw new Error(
            err.message ||
            "Échec de l'enregistrement (" +
            res.status +
            ")"
        );
    }

    return res.json();
}


/* ============================================================
   NOTIFICATIONS
   ============================================================ */

function showToast(
    message,
    type = "success"
) {

    const toast = document.createElement("div");

    toast.className =
        `toast toast-${type}`;

    toast.textContent = message;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    setTimeout(() => {

        toast.classList.remove("show");

        setTimeout(() => {
            toast.remove();
        }, 300);

    }, 4000);
}


/* ============================================================
   CRÉATION D'UN ID / SLUG
   ============================================================ */

function slugify(str) {

    return String(str)

        .toLowerCase()

        .normalize("NFD")

        .replace(/[\u0300-\u036f]/g, "")

        .replace(/[^a-z0-9]+/g, "-")

        .replace(/(^-|-$)/g, "");
}


/* ============================================================
   GESTIONNAIRE DE LISTES DYNAMIQUES
   ============================================================ */

function createDynamicList(
    container,
    fields
) {

    function addRow(values = {}) {

        const row =
            document.createElement("div");

        row.className =
            "dynamic-list-row";

        fields.forEach(f => {

            let input;

            if (f.type === "select") {

                input =
                    document.createElement("select");

                input.name = f.name;

                (f.options || []).forEach(opt => {

                    const option =
                        document.createElement("option");

                    option.value =
                        opt.value;

                    option.textContent =
                        opt.label;

                    if (
                        values[f.name] ===
                        opt.value
                    ) {
                        option.selected = true;
                    }

                    input.appendChild(option);
                });

            } else {

                input =
                    document.createElement("input");

                input.name =
                    f.name;

                input.type =
                    f.type || "text";

                input.placeholder =
                    f.placeholder ||
                    f.name;

                if (
                    f.type === "checkbox"
                ) {

                    input.checked =
                        !!values[f.name];

                } else {

                    input.value =
                        values[f.name] ?? "";
                }
            }

            row.appendChild(input);
        });


        const removeBtn =
            document.createElement("button");

        removeBtn.type = "button";

        removeBtn.className =
            "remove-row-btn";

        removeBtn.textContent = "×";

        removeBtn.title =
            "Supprimer cette ligne";

        removeBtn.onclick = () => {
            row.remove();
        };

        row.appendChild(removeBtn);

        container.appendChild(row);
    }


    function getValues() {

        return Array.from(
            container.querySelectorAll(
                ".dynamic-list-row"
            )
        )

            .map(row => {

                const obj = {};

                fields.forEach(f => {

                    const input =
                        row.querySelector(
                            `[name="${f.name}"]`
                        );

                    if (!input) return;

                    if (
                        f.type === "checkbox"
                    ) {

                        obj[f.name] =
                            input.checked;

                    } else if (
                        f.type === "number"
                    ) {

                        obj[f.name] =
                            Number(input.value) || 0;

                    } else {

                        obj[f.name] =
                            input.value.trim();
                    }
                });

                return obj;
            })

            .filter(obj =>
                Object.entries(obj).some(
                    ([key, value]) => {

                        if (
                            typeof value ===
                            "string"
                        ) {
                            return value !== "";
                        }

                        if (
                            typeof value ===
                            "number"
                        ) {
                            return value !== 0;
                        }

                        return value === true;
                    }
                )
            );
    }


    return {
        addRow,
        getValues
    };
}


/* ============================================================
   FORMULAIRE AJOUT / ÉDITION
   ============================================================ */

function openRiderForm(
    existingRider = null
) {

    const isEdit =
        !!existingRider;


    const overlay =
        document.createElement("div");

    overlay.className =
        "modal-overlay";


    overlay.innerHTML = `

        <div class="modal">

            <div class="modal-header">

                <h2>
                    ${
                        isEdit
                            ? "Éditer " +
                              escapeHTML(
                                  existingRider.name
                              )
                            : "Ajouter un coureur"
                    }
                </h2>

                <button
                    type="button"
                    class="modal-close"
                    aria-label="Fermer"
                >
                    &times;
                </button>

            </div>


            <form class="rider-form">

                <div class="form-grid">

                    <label>
                        Nom complet

                        <input
                            required
                            name="name"
                            value="${
                                isEdit
                                    ? escapeHTML(
                                        existingRider.name
                                      )
                                    : ""
                            }"
                        >
                    </label>


                    <label>
                        Drapeau (emoji)

                        <input
                            name="flag"
                            value="${
                                isEdit
                                    ? escapeHTML(
                                        existingRider.flag || ""
                                      )
                                    : ""
                            }"
                            placeholder="🇫🇷"
                        >
                    </label>


                    <label>
                        Nationalité

                        <input
                            name="nationality"
                            value="${
                                isEdit
                                    ? escapeHTML(
                                        existingRider.nationality || ""
                                      )
                                    : ""
                            }"
                        >
                    </label>


                    <label>
                        Équipe

                        <input
                            name="team"
                            value="${
                                isEdit
                                    ? escapeHTML(
                                        existingRider.team || ""
                                      )
                                    : ""
                            }"
                        >
                    </label>


                    <label>
                        Âge

                        <input
                            type="number"
                            name="age"
                            value="${
                                isEdit
                                    ? escapeHTML(
                                        existingRider.age ?? ""
                                      )
                                    : ""
                            }"
                        >
                    </label>


                    <label>
                        Date de naissance

                        <input
                            name="dob"
                            value="${
                                isEdit
                                    ? escapeHTML(
                                        existingRider.dob || ""
                                      )
                                    : ""
                            }"
                            placeholder="13 Jan 1997"
                        >
                    </label>


                    <label>
                        Poids

                        <input
                            name="weight"
                            value="${
                                isEdit
                                    ? escapeHTML(
                                        existingRider.weight || ""
                                      )
                                    : ""
                            }"
                            placeholder="60 kg"
                        >
                    </label>


                    <label>
                        Taille

                        <input
                            name="height"
                            value="${
                                isEdit
                                    ? escapeHTML(
                                        existingRider.height || ""
                                      )
                                    : ""
                            }"
                            placeholder="1,75 m"
                        >
                    </label>


                    <label>
                        Vélo (marque)

                        <input
                            name="bike"
                            value="${
                                isEdit
                                    ? escapeHTML(
                                        existingRider.bike || ""
                                      )
                                    : ""
                            }"
                            placeholder="Pinarello"
                        >
                    </label>


                    <label>
                        Classement général RP (N°)

                        <input
                            name="gcRank"
                            value="${
                                isEdit
                                    ? escapeHTML(
                                        existingRider.gcRank ?? ""
                                      )
                                    : ""
                            }"
                        >
                    </label>


                    <label class="span-2">
                        URL de la photo

                        <input
                            name="image"
                            value="${
                                isEdit
                                    ? escapeHTML(
                                        existingRider.image || ""
                                      )
                                    : ""
                            }"
                            placeholder="images/coureurs/nom.jpg"
                        >
                    </label>

                </div>


                <h3>Spécialités</h3>

                <div
                    class="dynamic-list"
                    data-list="specialties"
                ></div>

                <button
                    type="button"
                    class="btn btn-outline"
                    data-add="specialties"
                >
                    + Ajouter une spécialité
                </button>


                <h3>Résultats</h3>

                <div
                    class="dynamic-list"
                    data-list="results"
                ></div>

                <button
                    type="button"
                    class="btn btn-outline"
                    data-add="results"
                >
                    + Ajouter un résultat
                </button>


                <h3>Liens</h3>

                <div
                    class="dynamic-list"
                    data-list="links"
                ></div>

                <button
                    type="button"
                    class="btn btn-outline"
                    data-add="links"
                >
                    + Ajouter un lien
                </button>


                <div class="form-actions">

                    ${
                        isEdit
                            ? `
                                <button
                                    type="button"
                                    class="btn btn-outline btn-danger"
                                    data-delete
                                >
                                    Supprimer ce coureur
                                </button>
                              `
                            : "<span></span>"
                    }


                    <button
                        type="submit"
                        class="btn"
                    >
                        ${
                            isEdit
                                ? "Enregistrer"
                                : "Créer le coureur"
                        }
                    </button>

                </div>


                <p class="form-status"></p>

            </form>

        </div>
    `;


    document.body.appendChild(
        overlay
    );


    /* Fermeture */

    const closeModal = () => {
        overlay.remove();
    };


    overlay.addEventListener(
        "click",
        e => {

            if (
                e.target === overlay
            ) {
                closeModal();
            }

        }
    );


    overlay
        .querySelector(".modal-close")
        .addEventListener(
            "click",
            closeModal
        );


    /* ========================================================
       SPÉCIALITÉS
       ======================================================== */

    const specialtiesMgr =
        createDynamicList(
            overlay.querySelector(
                '[data-list="specialties"]'
            ),

            [
                {
                    name: "label",
                    placeholder: "Grimpeur"
                },

                {
                    name: "value",
                    type: "number",
                    placeholder: "0-100"
                }
            ]
        );


    /* ========================================================
       OPTIONS RÉSULTATS
       ======================================================== */

    const CATEGORY_OPTIONS = [

        {
            value: "Plat",
            label: "Plat"
        },

        {
            value: "Vallonné",
            label: "Vallonné"
        },

        {
            value: "Montagne",
            label: "Montagne"
        },

        {
            value: "Contre-la-montre",
            label: "Contre-la-montre"
        }
    ];


    const JERSEY_OPTIONS = [

        {
            value: "none",
            label: "Aucun"
        },

        {
            value: "yellow",
            label: "Jaune (leader/général)"
        },

        {
            value: "green",
            label: "Vert (points)"
        },

        {
            value: "polka",
            label: "Pois (montagne)"
        },

        {
            value: "rainbow",
            label: "Arc-en-ciel (champion du monde)"
        },

        {
            value: "plain",
            label: "Neutre (étape)"
        }
    ];


    /* ========================================================
       RÉSULTATS
       ======================================================== */

    const resultsMgr =
        createDynamicList(

            overlay.querySelector(
                '[data-list="results"]'
            ),

            [

                {
                    name: "year",
                    type: "number",
                    placeholder: "Année"
                },

                {
                    name: "date",
                    placeholder: "26.07"
                },

                {
                    name: "pos",
                    placeholder: "Position"
                },

                {
                    name: "win",
                    type: "checkbox"
                },

                {
                    name: "category",
                    type: "select",
                    options:
                        CATEGORY_OPTIONS
                },

                {
                    name: "jersey",
                    type: "select",
                    options:
                        JERSEY_OPTIONS
                },

                {
                    name: "race",
                    placeholder:
                        "Nom de la course"
                },

                {
                    name: "tag",
                    placeholder:
                        "Étiquette (ex: 8e étape, Général)"
                }
            ]
        );


    /* ========================================================
       LIENS
       ======================================================== */

    const linksMgr =
        createDynamicList(

            overlay.querySelector(
                '[data-list="links"]'
            ),

            [

                {
                    name: "label",
                    placeholder: "Instagram"
                },

                {
                    name: "url",
                    placeholder:
                        "https://..."
                }
            ]
        );


    /* ========================================================
       BOUTONS + DES LISTES
       ======================================================== */

    overlay
        .querySelector(
            '[data-add="specialties"]'
        )
        .onclick = () => {

            specialtiesMgr.addRow();

        };


    overlay
        .querySelector(
            '[data-add="results"]'
        )
        .onclick = () => {

            resultsMgr.addRow();

        };


    overlay
        .querySelector(
            '[data-add="links"]'
        )
        .onclick = () => {

            linksMgr.addRow();

        };


    /* ========================================================
       REMPLISSAGE EN MODE ÉDITION
       ======================================================== */

    if (isEdit) {

        (
            existingRider.specialties ||
            []
        ).forEach(s => {

            specialtiesMgr.addRow(s);

        });


        (
            existingRider.results ||
            []
        ).forEach(r => {

            resultsMgr.addRow(r);

        });


        (
            existingRider.links ||
            []
        ).forEach(l => {

            linksMgr.addRow(l);

        });

    } else {

        specialtiesMgr.addRow();

        resultsMgr.addRow();

        linksMgr.addRow();

    }


    /* ========================================================
       SUPPRESSION
       ======================================================== */

    const deleteBtn =
        overlay.querySelector(
            "[data-delete]"
        );


    if (deleteBtn) {

        deleteBtn.onclick =
            async () => {

                if (
                    !confirm(
                        `Supprimer définitivement ${existingRider.name} ?`
                    )
                ) {
                    return;
                }


                try {

                    const {
                        riders,
                        sha
                    } =
                        await fetchRidersFile();


                    const filtered =
                        riders.filter(
                            r =>
                                r.id !==
                                existingRider.id
                        );


                    await saveRidersFile(

                        filtered,

                        sha,

                        `Suppression de ${existingRider.name}`
                    );


                    showToast(
                        "Coureur supprimé"
                    );


                    setTimeout(() => {

                        window.location.href =
                            "coureurs.html";

                    }, 800);


                } catch (err) {

                    showToast(
                        "Erreur : " +
                        err.message,
                        "error"
                    );
                }

            };
    }


    /* ========================================================
       ENREGISTREMENT DU FORMULAIRE
       ======================================================== */

    const form =
        overlay.querySelector(
            "form"
        );


    const statusEl =
        overlay.querySelector(
            ".form-status"
        );


    form.addEventListener(
        "submit",
        async e => {

            e.preventDefault();


            const fd =
                new FormData(form);


            const name =
                String(
                    fd.get("name") || ""
                ).trim();


            if (!name) {
                return;
            }


            statusEl.textContent =
                "Enregistrement en cours…";

            statusEl.className =
                "form-status";


            /* En édition, on conserve l'ancien ID.
               En création, on génère le slug. */

            const id =
                isEdit
                    ? existingRider.id
                    : slugify(name);


            if (!id) {

                statusEl.textContent =
                    "Impossible de créer un identifiant pour ce coureur.";

                statusEl.className =
                    "form-status form-status-error";

                return;
            }


            /* =================================================
               DONNÉES DU COUREUR
               ================================================= */

            const riderData = {

                id: id,

                name: name,

                flag:
                    String(
                        fd.get("flag") || ""
                    ).trim(),

                nationality:
                    String(
                        fd.get("nationality") || ""
                    ).trim(),

                team:
                    String(
                        fd.get("team") || ""
                    ).trim(),

                age:
                    Number(
                        fd.get("age")
                    ) || null,

                dob:
                    String(
                        fd.get("dob") || ""
                    ).trim(),

                weight:
                    String(
                        fd.get("weight") || ""
                    ).trim(),

                height:
                    String(
                        fd.get("height") || ""
                    ).trim(),

                bike:
                    String(
                        fd.get("bike") || ""
                    ).trim(),

                gcRank:
                    String(
                        fd.get("gcRank") || ""
                    ).trim(),

                image:
                    String(
                        fd.get("image") || ""
                    ).trim() ||
                    `images/coureurs/${id}.jpg`,

                specialties:
                    specialtiesMgr.getValues(),

                links:
                    linksMgr.getValues(),

                results:
                    resultsMgr
                        .getValues()
                        .map(r => ({
                            ...r,
                            year:
                                Number(r.year) ||
                                null
                        }))
            };


            /* =================================================
               GITHUB
               ================================================= */

            try {

                const {
                    riders,
                    sha
                } =
                    await fetchRidersFile();


                const index =
                    riders.findIndex(
                        r =>
                            r.id === id
                    );


                if (index >= 0) {

                    /* Modification */

                    riders[index] =
                        riderData;

                } else {

                    /* Création */

                    riders.push(
                        riderData
                    );
                }


                await saveRidersFile(

                    riders,

                    sha,

                    isEdit
                        ? `Édition de ${name}`
                        : `Ajout de ${name}`
                );


                statusEl.textContent =
                    "Enregistré ! Le site sera à jour dans 30 à 60 secondes.";

                statusEl.className =
                    "form-status form-status-success";


                showToast(
                    isEdit
                        ? "Coureur mis à jour"
                        : "Coureur ajouté"
                );


                setTimeout(() => {

                    closeModal();


                    if (isEdit) {

                        window.location.reload();

                    } else if (
                        typeof renderRidersList ===
                        "function"
                    ) {

                        renderRidersList();

                    }

                }, 1200);


            } catch (err) {

                statusEl.textContent =
                    "Erreur : " +
                    err.message;

                statusEl.className =
                    "form-status form-status-error";


                showToast(
                    "Échec de l'enregistrement",
                    "error"
                );
            }

        }
    );


    /* ========================================================
       TOUCHE ÉCHAP
       ======================================================== */

    document.addEventListener(
        "keydown",
        function escHandler(e) {

            if (
                e.key === "Escape"
            ) {

                closeModal();

                document.removeEventListener(
                    "keydown",
                    escHandler
                );
            }
        }
    );
}


/* ============================================================
   INITIALISATION DES BOUTONS
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        /* Bouton + de coureurs.html */

        const addBtn =
            document.getElementById(
                "add-rider-btn"
            );


        if (addBtn) {

            addBtn.addEventListener(
                "click",
                () => {

                    openRiderForm();

                }
            );
        }


        /* Bouton éventuel "Oublier le token" */

        const forgetBtn =
            document.getElementById(
                "forget-token-btn"
            );


        if (forgetBtn) {

            forgetBtn.addEventListener(
                "click",
                forgetToken
            );
        }

    }
);
```
