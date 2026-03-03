const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

function detectProno(analyse, domicile, exterieur) {
    const text = analyse.toLowerCase();
    const dom = domicile.toLowerCase();
    const ext = exterieur.toLowerCase();

    // Match nul
    if (text.includes('match nul') || text.includes('nul') ||
        text.includes('partage') || text.includes('egalite')) {
        return 'N';
    }

    // Trouver quelle équipe est mentionnée en premier comme gagnante
    const motsCleVictoire = [
        'devrait l\'emporter', 'devrait dominer', 'devrait s\'imposer',
        'victoire', 'gagne', 'l\'emporter', 'dominer', 's\'imposer',
        'favori', 'favoris', 'avantage', 'meilleure forme'
    ];

    // Chercher la première occurrence d'un mot clé de victoire
    let positionVictoire = Infinity;
    motsCleVictoire.forEach(mot => {
        const pos = text.indexOf(mot);
        if (pos !== -1 && pos < positionVictoire) {
            positionVictoire = pos;
        }
    });

    if (positionVictoire === Infinity) return '1';

    // Chercher quelle équipe est mentionnée avant ce mot clé
    const textAvantVictoire = text.substring(0, positionVictoire);

    // Chercher les mots de l'équipe extérieure
    const extMots = ext.split(' ').filter(m => m.length > 3);
    const domMots = dom.split(' ').filter(m => m.length > 3);

    const extMentionne = extMots.some(mot => textAvantVictoire.includes(mot));
    const domMentionne = domMots.some(mot => textAvantVictoire.includes(mot));

    if (extMentionne && !domMentionne) return '2';
    if (domMentionne && !extMentionne) return '1';

    // Si victoire à l'extérieur mentionnée
    if (text.includes('extérieur') || text.includes('exterieur') ||
        text.includes('déplacement') || text.includes('deplacement')) {
        return '2';
    }

    return '1';
}
module.exports = app;
