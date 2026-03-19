const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();

app.use(function(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
});

// Extrait le pronostic coloré en vert dans la cellule "1 N 2"
function extraireProno($, cell) {
    // Chercher un élément avec couleur verte (style, class, font color)
    let prono = null;

    // Cas 1 : <span style="color:green"> ou style="color:#...vert..."
    $(cell).find('[style]').each((i, el) => {
        const style = $(el).attr('style') || '';
        if (style.includes('green') || style.includes('#0') || style.includes('rgb(0') || style.includes('#2') || style.includes('#3')) {
            const txt = $(el).text().trim();
            if (txt === '1' || txt === 'N' || txt === 'X' || txt === '2') {
                prono = txt === 'X' ? 'N' : txt;
            }
        }
    });
    if (prono) return prono;

    // Cas 2 : <font color="green"> ou color="..."
    $(cell).find('font').each((i, el) => {
        const color = ($(el).attr('color') || '').toLowerCase();
        if (color.includes('green') || color === '#008000' || color === '#00ff00' || color.startsWith('#0a') || color.startsWith('#1') || color.startsWith('#2') || color.startsWith('#3')) {
            const txt = $(el).text().trim();
            if (txt === '1' || txt === 'N' || txt === 'X' || txt === '2') {
                prono = txt === 'X' ? 'N' : txt;
            }
        }
    });
    if (prono) return prono;

    // Cas 3 : classe CSS contenant "vert", "green", "win", "prono"
    $(cell).find('[class]').each((i, el) => {
        const cls = ($(el).attr('class') || '').toLowerCase();
        if (cls.includes('green') || cls.includes('vert') || cls.includes('win') || cls.includes('prono') || cls.includes('selected') || cls.includes('actif') || cls.includes('active')) {
            const txt = $(el).text().trim();
            if (txt === '1' || txt === 'N' || txt === 'X' || txt === '2') {
                prono = txt === 'X' ? 'N' : txt;
            }
        }
    });
    if (prono) return prono;

    // Cas 4 : <b> ou <strong> autour d'un chiffre isolé
    $(cell).find('b, strong').each((i, el) => {
        const txt = $(el).text().trim();
        if (txt === '1' || txt === 'N' || txt === 'X' || txt === '2') {
            prono = txt === 'X' ? 'N' : txt;
        }
    });
    if (prono) return prono;

    // Cas 5 : fallback — analyser le texte de l'analyse
    return null;
}

function detectPronoTexte(analyse, domicile, exterieur) {
    const text = analyse.toLowerCase();
    const ext = exterieur.toLowerCase();

    if (text.includes('match nul') || text.includes('nul') ||
        text.includes('partage') || text.includes('egalite') ||
        text.includes('se neutraliser') || text.includes('se valent')) {
        return 'N';
    }

    const motsCleVictoire = [
        "devrait l'emporter", "devrait dominer", "devrait s'imposer",
        'victoire', 'gagne', "l'emporter", 'dominer', "s'imposer",
        'favori', 'favoris', 'largement', 'solide', 'en forme'
    ];

    let posMin = Infinity;
    motsCleVictoire.forEach(mot => {
        const pos = text.indexOf(mot);
        if (pos !== -1 && pos < posMin) posMin = pos;
    });

    if (posMin !== Infinity) {
        const avant = text.substring(0, posMin + 40);
        const extMots = ext.split(' ').filter(m => m.length > 2);
        const domMots = domicile.toLowerCase().split(' ').filter(m => m.length > 2);
        if (extMots.some(m => avant.includes(m)) && !domMots.some(m => avant.includes(m))) return '2';
        if (domMots.some(m => avant.includes(m)) && !extMots.some(m => avant.includes(m))) return '1';
    }

    // Indices contextuels
    if (text.includes('à domicile') || text.includes('a domicile')) return '1';
    const extMots = ext.split(' ').filter(m => m.length > 2);
    if (extMots.some(m => text.includes(m)) &&
        (text.includes('en crise') || text.includes('en difficulté') || text.includes('en perte'))) return '1';

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
                const pronoCell = cols[3]; // cellule "1 N 2"
                const analyse   = cols.length >= 5 ? $(cols[4]).text().trim() : '';

                if (!domicile || !exterieur || !numero || isNaN(parseInt(numero))) return;

                // Essayer d'extraire le prono coloré en vert
                let prono = extraireProno($, pronoCell);

                // Fallback sur l'analyse texte
                if (!prono) prono = detectPronoTexte(analyse, domicile, exterieur);

                matchs.push({ numero, domicile, exterieur, prono, analyse });
            }
        });

        if (matchs.length === 0) {
            return res.json({
                matchs: [],
                disponible: false,
                message: {
                    titre: "👑 KING PRONOS",
                    texte: "🇫🇷 Inscrivez-vous avec le code promo VS75 sur 1xBet pour bénéficier des prochaines prédictions gratuites.

🇬🇧 Register with promo code VS75 on 1xBet to get the next free predictions.

🇸🇦 سجّل بالرمز الترويجي VS75 على 1xBet للاستفادة من التوقعات المجانية القادمة.",
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
