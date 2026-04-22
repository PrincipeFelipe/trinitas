const fs = require('fs');
const pool = require('./db/connection');

const TYPE_MAP = {
    'ARRY': 'Arroyo', 'AVDA': 'Avenida', 'BARDA': 'Barriada', 'BARRO': 'Barrio',
    'CITO': 'Acuartelamiento', 'CJTO': 'Conjunto', 'CMNO': 'Camino', 'COL': 'Colonia',
    'CTRA': 'Carretera', 'CUSTA': 'Cuesta', 'ESCA': 'Escalera', 'GRUP': 'Grupo',
    'GTA': 'Glorieta', 'JDIN': 'Jardín', 'LOMA': 'Loma', 'MONTE': 'Monte',
    'MUELL': 'Muelle', 'PLAYA': 'Playa', 'PNTE': 'Puente', 'POLIG': 'Polígono',
    'PSAJE': 'Pasaje', 'TRVAL': 'Transversal', 'URB': 'Urbanización',
    'CALLE': 'Calle', 'PLAZA': 'Plaza', 'PASEO': 'Paseo', 'LUGAR': 'Lugar',
    'PATIO': 'Patio', 'ZONA': 'Zona', 'FALDA': 'Falda'
};

function titleCase(str) {
    // Proper title case for Spanish street names
    const exceptions = ['DE', 'DEL', 'DE LA', 'DE LOS', 'DE LAS', 'Y', 'A', 'EL', 'LA', 'LOS', 'LAS', 'AL', 'EN'];
    return str.toLowerCase().split(' ').map((word, i) => {
        if (i > 0 && exceptions.includes(word.toUpperCase())) return word.toLowerCase();
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}

async function reimport() {
    try {
        console.log('=== Reimportación Completa del Callejero ===\n');

        // Read CSV with smart encoding
        const buf = fs.readFileSync('e:/Proyectos/Trinitas/Documentos de trabajo/callejero.csv');
        let text = buf.toString('utf8');
        if (text.includes('\uFFFD')) {
            console.log('Detectada codificación Latin1, convirtiendo...');
            text = buf.toString('latin1');
        } else {
            console.log('Codificación UTF-8 detectada correctamente.');
        }

        const lines = text.split(/\r?\n/).filter(l => l.trim());

        // Extract unique street names (combining SIGLA + NOMBRE)
        const csvStreetNames = new Set();
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(';');
            if (cols.length < 5) continue;
            const sigla = cols[3].trim().toUpperCase();
            const nombre = cols[4].trim();
            const type = TYPE_MAP[sigla];
            if (!type) continue; // Skip unknown types like LUGAR, ZONA etc unless in map

            const fullName = `${type} ${nombre.toUpperCase()}`.trim();
            csvStreetNames.add(fullName);
        }

        // Also add LUGAR, PATIO etc that aren't in the main list
        const TYPE_MAP_EXTENDED = { ...TYPE_MAP, 'LUGAR': 'Lugar', 'PATIO': 'Patio', 'ZONA': 'Zona', 'FALDA': 'Falda' };
        const csvStreetsAll = new Set();
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(';');
            if (cols.length < 5) continue;
            const sigla = cols[3].trim().toUpperCase();
            const nombre = cols[4].trim();
            const type = TYPE_MAP_EXTENDED[sigla] || sigla;
            const fullName = `${type} ${nombre.toUpperCase()}`.trim();
            csvStreetsAll.add(fullName);
        }

        const csvList = Array.from(csvStreetsAll).sort();
        console.log(`Calles únicas en CSV: ${csvList.length}`);

        // Get current DB state 
        const [dbRows] = await pool.query('SELECT id, name FROM Streets ORDER BY name');
        console.log(`Calles actuales en BD: ${dbRows.length}`);

        // === FULL REIMPORT ===
        // This is the safest approach: clear all streets (cascade will clean demarcations)
        // and re-insert from canonical source
        
        console.log('\nEliminando demarcaciones y calles existentes...');
        await pool.query('SET FOREIGN_KEY_CHECKS = 0');
        await pool.query('TRUNCATE TABLE Demarcations');
        await pool.query('TRUNCATE TABLE Streets');
        await pool.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('Tablas limpiadas.');

        // Batch insert all streets
        console.log('\nInsertando calles desde CSV...');
        let inserted = 0;
        const BATCH_SIZE = 50;
        const streetsArray = csvList;

        for (let i = 0; i < streetsArray.length; i += BATCH_SIZE) {
            const batch = streetsArray.slice(i, i + BATCH_SIZE);
            const placeholders = batch.map(() => '(?)').join(', ');
            await pool.query(`INSERT IGNORE INTO Streets (name) VALUES ${placeholders}`, batch);
            inserted += batch.length;
            process.stdout.write(`\rInsertadas: ${inserted}/${streetsArray.length}...`);
        }

        const [countRow] = await pool.query('SELECT COUNT(*) as c FROM Streets');
        console.log(`\n\n=== IMPORTACIÓN FINALIZADA ===`);
        console.log(`Total calles en BD ahora: ${countRow[0].c}`);
        
        // Verify no broken characters remain
        const [broken] = await pool.query(`SELECT COUNT(*) as c FROM Streets WHERE name LIKE '%\uFFFD%'`);
        console.log(`Calles con caracteres corruptos: ${broken[0].c}`);
        
        process.exit(0);
    } catch (e) {
        console.error('\nError fatal:', e.message);
        process.exit(1);
    }
}

reimport();
