const fs = require('fs');
const pool = require('./db/connection');

const TYPE_MAP = {
    'ARRY': 'Arroyo',
    'AVDA': 'Avenida',
    'BARDA': 'Barriada',
    'BARRO': 'Barrio',
    'CITO': 'Acuartelamiento',
    'CJTO': 'Conjunto',
    'CMNO': 'Camino',
    'COL': 'Colonia',
    'CTRA': 'Carretera',
    'CUSTA': 'Cuesta',
    'ESCA': 'Escalera',
    'GRUP': 'Grupo',
    'GTA': 'Glorieta',
    'JDIN': 'Jardín',
    'LOMA': 'Loma',
    'MONTE': 'Monte',
    'MUELL': 'Muelle',
    'PLAYA': 'Playa',
    'PNTE': 'Puente',
    'POLIG': 'Polígono',
    'PSAJE': 'Pasaje',
    'TRVAL': 'Transversal',
    'URB': 'Urbanización',
    'CALLE': 'Calle',
    'PLAZA': 'Plaza',
    'PASEO': 'Paseo',
    'LUGAR': 'Lugar',
    'PATIO': 'Patio',
    'ZONA': 'Zona',
    'FALDA': 'Falda'
};

async function fix() {
    try {
        // Read file. Try UTF8. If it contains replacement character, fallback to latin1.
        const buf = fs.readFileSync('e:/Proyectos/Trinitas/Documentos de trabajo/callejero.csv');
        let text = buf.toString('utf8');
        if (text.includes('\uFFFD')) {
            text = buf.toString('latin1');
        }

        const lines = text.split(/\r?\n/).filter(l => l.trim());
        const pristineStreets = new Set();
        
        for(let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(';');
            if (cols.length < 5) continue;
            const sigla = cols[3].trim().toUpperCase();
            const nombre = cols[4].trim().toUpperCase();
            const type = TYPE_MAP[sigla] || (sigla.charAt(0).toUpperCase() + sigla.slice(1).toLowerCase());
            pristineStreets.add(`${type} ${nombre}`.trim().toUpperCase());
        }

        const pristineArray = Array.from(pristineStreets);
        
        // Fetch DB
        const [dbStreets] = await pool.query('SELECT id, name FROM Streets');
        let updated = 0;

        for (let row of dbStreets) {
            // Check if street has the broken character
            if (row.name.includes('\uFFFD') || row.name.includes('Ã')) {
                // To find the match, remove the broken character from row.name
                const pattern = row.name.replace(/[\uFFFDÃ±]/g, '').trim(); // e.g. "AGUSTIN MUOZ VAZQUEZ"
                
                // Find candidates in pristine array that match the pattern when its special characters are removed
                const match = pristineArray.find(p => p.replace(/[ÑÁÉÍÓÚ]/g, '').includes(pattern));
                
                if (match) {
                    try {
                        await pool.query('UPDATE IGNORE Streets SET name = ? WHERE id = ?', [match, row.id]);
                        updated++;
                    } catch(e) {}
                }
            }
        }
        
        console.log(`Pristine streets loaded: ${pristineArray.length}`);
        console.log(`Corrupted streets fixed: ${updated}`);
        process.exit(0);

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

fix();
