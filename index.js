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

// Détecte le pronostic depuis la colonne "1 N 2" et l'analyse texte
function detectProno(pronoCol, analyse, domicile, exterieur) {
    // 1. Lire directement la colonne pronostic si elle contient 1, N ou 2 seul
    const p = pronoCol.trim();
    if (p === '1') return '1';
    if (p === 'N' || p === 'X') return 'N';
    if (p === '2') return '2';

    // 2. Sinon analyser le texte
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
        'favori', 'favoris', 'largement', 'solide'
    ];

    let positionVictoire = Infinity;
    motsCleVictoire.forEach(mot => {
        const pos = text.indexOf(mot);
        if (pos !== -1 && pos < positionVictoire) positionVictoire = pos;
    });

    if (positionVictoire !== Infinity) {
        const textAvant = text.substring(0, positionVictoire + 30);
        const extMots = ext.split(' ').filter(m => m.length > 2);
        const domMots = dom.split(' ').filter(m => m.length > 2);
        const extMentionne = extMots.some(m => textAvant.includes(m));
        const domMentionne = domMots.some(m => textAvant.includes(m));
        if (extMentionne && !domMentionne) return '2';
        if (domMentionne && !extMentionne) return '1';
    }

    if (text.includes('à domicile') || text.includes('a domicile')) return '1';

    // Détecter quelle équipe est "en crise" ou "en difficulté"
    const extMots = ext.split(' ').filter(m => m.length > 2);
    if ((text.includes('en crise') || text.includes('en difficulté') || text.includes('en difficulte')) &&
        extMots.some(m => text.includes(m))) return '1';

    return '1';
}

app.get('/pronos', async (req, res) => {
    try {
        const { data } = await axios.get('https://www.maxiprono.com/analyselotofoot15.php', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const $ = cheerio.load(data);
        const matchs = [];

        $('table tr').each((i, row) => {
            const cols = $(row).find('td');
            if (cols.length >= 4) {
                const numero    = $(cols[0]).text().trim();
                const domicile  = $(cols[1]).text().trim();
                const exterieur = $(cols[2]).text().trim();
                const pronoCol  = $(cols[3]).text().trim(); // "1 N 2"
                const analyse   = cols.length >= 5 ? $(cols[4]).text().trim() : '';

                // Ignorer les lignes vides ou sans équipes valides
                if (!domicile || !exterieur || !numero) return;

                const prono = detectProno(pronoCol, analyse, domicile, exterieur);
                matchs.push({ numero, domicile, exterieur, prono, analyse });
            }
        });

        // ═══════════════════════════════════════════════════════
        // PAS DE MATCH → message promo 1XBET avec code VS75
        // ═══════════════════════════════════════════════════════
        if (matchs.length === 0) {
            return res.json({
                matchs: [],
                disponible: false,
                message: {
                    titre: "⏳ Aucune grille active",
                    texte: "Les prochains matchs seront disponibles dans quelques semaines. Profitez de ce temps pour vous inscrire sur 1XBET et préparer vos mises !",
                    promo: {
                        code: "VS75",
                        lien: "https://reffpa.com/L?tag=d_3359543m_10702c_&site=3359543&ad=10702",
                        label: "🎁 Bonus de bienvenue — Code : VS75",
                        description: "Inscrivez-vous maintenant et bénéficiez d'un bonus exclusif pour être prêt dès la prochaine grille !"
                    }
                }
            });
        }

        res.json({ matchs, disponible: true });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = app;
