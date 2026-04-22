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

async function forceRepair() {
    try {
        console.log('--- REPARACIÓN DE EMERGENCIA ---');
        
        // 1. Load pristine names from CSV (assuming UTF8)
        const buf = fs.readFileSync('e:/Proyectos/Trinitas/Documentos de trabajo/callejero.csv');
        const text = buf.toString('utf8');
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        const pristineList = [];
        
        for(let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(';');
            if (cols.length < 5) continue;
            const sigla = cols[3].trim().toUpperCase();
            const nombre = cols[4].trim().toUpperCase();
            const type = TYPE_MAP[sigla] || (sigla.charAt(0).toUpperCase() + sigla.slice(1).toLowerCase());
            pristineList.push(`${type} ${nombre}`.trim().toUpperCase());
        }

        const pristineSet = new Set(pristineList);

        // 2. Clear known good ones from DB that are actually duplicates
        // Example: If we have "ESPAÑA" and "ESPAA", and "ESPAÑA" is in CSV.
        const [dbStreets] = await pool.query('SELECT id, name FROM Streets');
        
        for (const st of dbStreets) {
            const name = st.name;
            const hasBad = name.includes('\uFFFD') || name.includes('') || name.includes('Ã');
            
            if (hasBad) {
                // Find a match by fuzzy searching the pristine list
                // We'll replace the bad char with a regex wildcard
                const fuzzy = name.replace(/[\uFFFDÃ]/g, '.');
                const regex = new RegExp('^' + fuzzy + '$', 'i');
                const match = pristineList.find(p => regex.test(p));
                
                if (match) {
                    console.log(`Re-assigning: ${name} -> ${match}`);
                    const [exists] = await pool.query('SELECT id FROM Streets WHERE name = ?', [match]);
                    if (exists.length > 0) {
                        const cid = exists[0].id;
                        await pool.query('UPDATE IGNORE Demarcations SET street_id = ? WHERE street_id = ?', [cid, st.id]);
                        await pool.query('UPDATE IGNORE Notifications SET street_id = ? WHERE street_id = ?', [cid, st.id]);
                        await pool.query('DELETE FROM Streets WHERE id = ?', [st.id]);
                    } else {
                        await pool.query('UPDATE Streets SET name = ? WHERE id = ?', [match, st.id]);
                    }
                }
            }
        }
        
        console.log('Reparación terminada.');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

forceRepair();
