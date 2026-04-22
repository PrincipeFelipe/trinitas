const fs = require('fs');
const pool = require('./db/connection');

async function importStreets() {
    try {
        const text = fs.readFileSync('streets.txt', 'utf8');
        const lines = text.split(/\r?\n/).map(l => l.trim());

        const siglas = new Set([
            'CALLE', 'AVDA', 'PLAZA', 'PSAJE', 'CTRA', 'LUGAR', 
            'CMNO', 'CJTO', 'GRUP', 'MUELL', 'POLIG', 'PASEO',
            'RNDA', 'GLTA', 'TRVSA', 'URB', 'MERC', 'BARDA'
        ]);

        const streetNames = new Set();

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (siglas.has(line)) {
                // The next valid line (skipping page break headers if they accidentally fall here, though unlikely between sigla and name)
                let nextIndex = i + 1;
                while (nextIndex < lines.length && (lines[nextIndex].includes('Page (') || lines[nextIndex] === 'CALLEJERO FISCAL DE LA CIUDAD AUTÓNOMA DE CEUTA' || lines[nextIndex].includes('APROBADO PLENO') || lines[nextIndex] === 'DISTRITO' || lines[nextIndex] === 'SECCION' || lines[nextIndex] === 'CLAVE' || lines[nextIndex] === 'BARRIADA' || lines[nextIndex] === 'SIGLA' || lines[nextIndex] === 'NOMBRE' || lines[nextIndex] === 'NUMERO' || lines[nextIndex] === 'CAT.FISCAL' || lines[nextIndex] === 'C.POSTAL' || lines[nextIndex].includes('----'))) {
                    nextIndex++;
                }

                if (nextIndex < lines.length) {
                    const name = lines[nextIndex];
                    if (name && name.length > 2 && name !== 'ENTERA' && !siglas.has(name)) {
                        streetNames.add(name);
                    }
                }
            }
        }

        const uniqueStreets = Array.from(streetNames);
        console.log(`Found ${uniqueStreets.length} unique streets.`);

        let insertedCount = 0;
        for (const name of uniqueStreets) {
            const [res] = await pool.query('INSERT IGNORE INTO Streets (name) VALUES (?)', [name]);
            if (res.affectedRows > 0) insertedCount++;
        }

        console.log(`Successfully inserted ${insertedCount} new streets into the database.`);

    } catch (error) {
        console.error('Error importing streets:', error);
    } finally {
        process.exit(0);
    }
}

importStreets();
