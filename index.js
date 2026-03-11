const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();
app.use(function(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});
function detectProno(analyse, domicile, exterieur) {
    const text = analyse.toLowerCase();
    const dom = domicile.toLowerCase();
    const ext = exterieur.toLowerCase();
    if (text.includes('match nul') || text.includes('nul') ||
        text.includes('partage') || text.includes('egalite')) {
        return 'N';
    }
    const motsCleVictoire = [
        "devrait l'emporter", "devrait dominer", "devrait s'imposer",
        'victoire', 'gagne', "l'emporter", 'dominer', "s'imposer",
        'favori', 'favoris'
    ];
    let positionVictoire = Infinity;
    motsCleVictoire.forEach(mot => {
        const pos = text.indexOf(mot);
        if (pos !== -1 && pos < positionVictoire) {
            positionVictoire = pos;
        }
    });
    if (positionVictoire === Infinity) {
        const posAvantage = text.indexOf('avantage');
        if (posAvantage !== -1) {
            const textApresAvantage = text.substring(posAvantage);
            const extMots = ext.split(' ').filter(m => m.length > 2);
            const domMots = dom.split(' ').filter(m => m.length > 2);
            if (extMots.some(m => textApresAvantage.includes(m))) return '2';
            if (domMots.some(m => textApresAvantage.includes(m))) return '1';
        }
        return '1';
    }
    const textAvantVictoire = text.substring(0, positionVictoire);
    const extMots = ext.split(' ').filter(m => m.length > 2);
    const domMots = dom.split(' ').filter(m => m.length > 2);
    const extMentionne = extMots.some(mot => textAvantVictoire.includes(mot));
    const domMentionne = domMots.some(mot => textAvantVictoire.includes(mot));
    if (extMentionne && !domMentionne) return '2';
    if (domMentionne && !extMentionne) return '1';
    if (text.includes('extérieur') || text.includes('exterieur') ||
        text.includes('déplacement') || text.includes('deplacement')) {
        if (text.includes("peine à l'extérieur") || text.includes("peine a l'exterieur")) {
            return '1';
        }
        return '2';
    }
    return '1';
}
app.get('/pronos', async (req, res) => {
    try {
        const { data } = await axios.get('https://www.maxiprono.com/analyselotofoot15.php');
        const $ = cheerio.load(data);
        const matchs = [];
        $('table tr').each((i, row) => {
            const cols = $(row).find('td');
            if (cols.length >= 4) {
                const domicile = $(cols[1]).text().trim();
                const exterieur = $(cols[2]).text().trim();
                const analyse = $(cols[4]).text().trim();
                const prono = detectProno(analyse, domicile, exterieur);
                matchs.push({
                    numero: $(cols[0]).text().trim(),
                    domicile,
                    exterieur,
                    prono,
                    analyse
                });
            }
        });
        res.json({ matchs });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
module.exports = app;
