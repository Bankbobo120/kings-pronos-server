const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

function detectProno(analyse, domicile, exterieur) {
    const text = analyse.toLowerCase();
    const extMots = exterieur.toLowerCase().split(' ');

    if (text.includes('match nul') || text.includes('nul') || 
        text.includes('partage') || text.includes('egalite')) {
        return 'N';
    }

    const extGagne = (
        text.includes('extérieur') || text.includes('exterieur') ||
        text.includes('deplacement') || text.includes('déplacement') ||
        text.includes('visiteur')
    ) && extMots.some(mot => mot.length > 3 && text.includes(mot));

    if (extGagne) return '2';
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
```

Ensuite dans le terminal :
```
git add .
git commit -m "suppression puppeteer"
git push
