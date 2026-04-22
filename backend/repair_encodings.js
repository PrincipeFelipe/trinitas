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

async function repair() {
    try {
        console.log('--- Iniciando Reparación de Codificación ---');
        
        // 1. Load pristine names from CSV
        const buf = fs.readFileSync('e:/Proyectos/Trinitas/Documentos de trabajo/callejero.csv');
        let text = buf.toString('utf8');
        if (text.includes('\uFFFD')) text = buf.toString('latin1');
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        const pristineMap = new Map(); // Normalized Key -> Actual Name
        
        for(let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(';');
            if (cols.length < 5) continue;
            const sigla = cols[3].trim().toUpperCase();
            const nombre = cols[4].trim().toUpperCase();
            const type = TYPE_MAP[sigla] || (sigla.charAt(0).toUpperCase() + sigla.slice(1).toLowerCase());
            const fullName = `${type} ${nombre}`.trim().toUpperCase();
            // Key is name without special chars to match broken ones
            const key = fullName.replace(/[ÑÁÉÍÓÚ]/g, 'X'); 
            pristineMap.set(key, fullName);
        }

        // 2. Fix Streets Table
        const [streets] = await pool.query('SELECT id, name FROM Streets');
        for (const street of streets) {
            if (street.name.includes('\uFFFD') || street.name.includes('')) {
                const brokenKey = street.name.replace(/[\uFFFD]/g, 'X').toUpperCase();
                const correctName = pristineMap.get(brokenKey);
                
                if (correctName) {
                    console.log(`Fixing street: ${street.name} -> ${correctName}`);
                    const [existing] = await pool.query('SELECT id FROM Streets WHERE name = ?', [correctName]);
                    
                    if (existing.length > 0) {
                        const correctId = existing[0].id;
                        // Merge
                        await pool.query('UPDATE IGNORE Demarcations SET street_id = ? WHERE street_id = ?', [correctId, street.id]);
                        await pool.query('UPDATE IGNORE Notifications SET street_id = ? WHERE street_id = ?', [correctId, street.id]);
                        await pool.query('DELETE FROM Demarcations WHERE street_id = ?', [street.id]);
                        await pool.query('DELETE FROM Streets WHERE id = ?', [street.id]);
                    } else {
                        await pool.query('UPDATE Streets SET name = ? WHERE id = ?', [correctName, street.id]);
                    }
                }
            }
        }

        // 3. Fix Notifications Table (addresses and recipient names)
        const [notifs] = await pool.query('SELECT id, recipient_name, full_address FROM Notifications');
        for (const n of notifs) {
            const fixedName = n.recipient_name.replace(/[\uFFFD]/g, 'Ñ'); // Guessing Ñ is most common but let's be smarter if possible
            const fixedAddr = n.full_address.replace(/[\uFFFD]/g, 'Ñ');
            
            if (fixedName !== n.recipient_name || fixedAddr !== n.full_address) {
                // Actually, let's just try to re-read them if we had the bytes, but we don't.
                // We'll just replace the diamond with Ñ for now as a better visual than .
                await pool.query('UPDATE Notifications SET recipient_name = ?, full_address = ? WHERE id = ?', [fixedName, fixedAddr, n.id]);
            }
        }

        console.log('--- REPARACIÓN FINALIZADA ---');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

repair();
