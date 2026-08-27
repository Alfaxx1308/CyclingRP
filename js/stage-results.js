// ============================================================
// CYCLE LEAGUE RP — STAGE RESULTS LOADER
// Charge et affiche les résultats d'une étape
// ============================================================

/**
 * Charge les résultats d'une étape depuis un fichier JSON
 * @param {string} stageId - ID de l'étape (ex: 'tdf2026-stage-1')
 */
async function loadStageResults(stageId) {
    try {
        // Construire le chemin du fichier JSON
        const jsonFile = `data/${stageId.replace('-stage', '-stage')}.json`;
        
        // Charger les données
        const response = await fetch(jsonFile);
        if (!response.ok) throw new Error(`Erreur: ${response.status}`);
        
        const data = await response.json();
        
        // Afficher les résultats
        displayStageInfo(data.stage);
        displayResults(data.results);
        
    } catch (error) {
        console.error('Erreur lors du chargement des résultats:', error);
        document.getElementById('results-container').innerHTML = 
            '<p class="error-state">Erreur lors du chargement des résultats.</p>';
    }
}

/**
 * Affiche les informations de l'étape
 */
function displayStageInfo(stage) {
    const infoContainer = document.getElementById('stage-info');
    if (!infoContainer) return;
    
    const html = `
        <div class="stage-info-header">
            <h2>Étape ${stage.number}</h2>
            <span class="stage-type-badge">${stage.type}</span>
        </div>
        
        <div class="stage-info-details">
            <div class="info-item">
                <span class="label">Date</span>
                <span class="value">${formatDate(stage.date)}</span>
            </div>
            <div class="info-item">
                <span class="label">Parcours</span>
                <span class="value">${stage.startCity} → ${stage.finishCity}</span>
            </div>
            <div class="info-item">
                <span class="label">Distance</span>
                <span class="value">${stage.distance}</span>
            </div>
            <div class="info-item">
                <span class="label">Dénivelé</span>
                <span class="value">${stage.elevation} m</span>
            </div>
            <div class="info-item">
                <span class="label">Difficulté</span>
                <span class="value difficulty-${stage.difficulty}">${getDifficultyLabel(stage.difficulty)}</span>
            </div>
        </div>
        
        <p class="stage-description">${stage.description}</p>
    `;
    
    infoContainer.innerHTML = html;
}

/**
 * Affiche les résultats dans un tableau
 */
function displayResults(results) {
    const container = document.getElementById('results-container');
    if (!container) return;
    
    // Créer le tableau
    let html = `
        <table class="results-table">
            <thead>
                <tr>
                    <th class="col-position">Pos.</th>
                    <th class="col-number">#</th>
                    <th class="col-name">Coureur</th>
                    <th class="col-country">Pays</th>
                    <th class="col-time">Temps</th>
                    <th class="col-gap">Écart</th>
                    <th class="col-points">Pts</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // Ajouter les lignes
    results.forEach((rider, index) => {
        const rowClass = index === 0 ? 'winner' : '';
        html += `
            <tr class="result-row ${rowClass}">
                <td class="col-position"><strong>${rider.position}</strong></td>
                <td class="col-number">${rider.position}</td>
                <td class="col-name">
                    <span class="rider-flag">${rider.country}</span>
                    <span class="rider-name">${rider.name}</span>
                </td>
                <td class="col-country">${rider.countryName}</td>
                <td class="col-time"><code>${rider.time}</code></td>
                <td class="col-gap">${rider.gap}</td>
                <td class="col-points"><strong>${rider.points}</strong></td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

/**
 * Formate une date au format français
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('fr-FR', options);
}

/**
 * Retourne le label de difficulté
 */
function getDifficultyLabel(difficulty) {
    const labels = {
        1: '⭐ Facile',
        2: '⭐⭐ Moyen',
        3: '⭐⭐⭐ Difficile',
        4: '⭐⭐⭐⭐ Très difficile',
        5: '⭐⭐⭐⭐⭐ Extrême'
    };
    return labels[difficulty] || 'Inconnu';
}

/**
 * Initialise la page (appelée au chargement)
 */
function initStagePage() {
    // Récupérer l'ID de l'étape depuis l'URL ou un attribut data
    const stageId = document.body.getAttribute('data-stage-id') || 'tdf2026-stage-1';
    
    // Charger les résultats
    loadStageResults(stageId);
}

// Charger au démarrage du DOM
document.addEventListener('DOMContentLoaded', initStagePage);
