const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
app.use(cors());

app.get('/pronos', async (req, res) => {
    let browser;
    try {
        browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto('https://www.maxiprono.com/analyselotofoot15.php', { waitUntil: 'networkidle2' });

        const matchs = await page.evaluate(() => {
            const rows = document.querySelectorAll('table tr');
            const results = [];

            rows.forEach(row => {
                const cols = row.querySelectorAll('td');
                if (cols.length >= 4) {
                    let prono = '';
                    const pronoCol = cols[3];
                    
                    // Chercher l'élément colorié en vert
                    const elements = pronoCol.querySelectorAll('*');
                    elements.forEach(el => {
                        const style = window.getComputedStyle(el);
                        const color = style.color;
                        const text = el.textContent.trim();
                        
                        // Vert = rgb(0, 128, 0) ou similaire
                        if ((text === '1' || text === '2' || text === 'N') &&
                            (color.includes('0, 128') || color.includes('0, 255') || 
                             color.includes('green') || el.style.color.includes('green') ||
                             el.style.color.includes('#0') || el.classList.contains('win'))) {
                            prono = text;
                        }
                    });

                    // Si pas trouvé chercher par background
                    if (!prono) {
                        elements.forEach(el => {
                            const bg = window.getComputedStyle(el).backgroundColor;
                            const text = el.textContent.trim();
                            if ((text === '1' || text === '2' || text === 'N') &&
                                bg.includes('0, 128')) {
                                prono = text;
                            }
                        });
                    }

                    if (!prono) prono = pronoCol.textContent.trim().replace(/\s+/g, ' ');

                    results.push({
                        numero: cols[0].textContent.trim(),
                        domicile: cols[1].textContent.trim(),
                        exterieur: cols[2].textContent.trim(),
                        prono: prono,
                        analyse: cols[4].textContent.trim()
                    });
                }
            });

            return results;
        });

        await browser.close();
        res.json({ matchs });

    } catch (error) {
        if (browser) await browser.close();
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => {
    console.log('Serveur démarré sur http://localhost:3000');
});
