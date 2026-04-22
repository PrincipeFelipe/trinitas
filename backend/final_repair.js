const fs = require('fs');
const pool = require('./db/connection');

const TYPES = [
    'Arroyo', 'Avenida', 'Barriada', 'Barrio', 'Acuartelamiento', 'Conjunto', 
    'Camino', 'Colonia', 'Carretera', 'Cuesta', 'Escalera', 'Grupo', 
    'Glorieta', 'Jardín', 'Loma', 'Monte', 'Muelle', 'Playa', 'Puente', 
    'Polígono', 'Pasaje', 'Transversal', 'Urbanización', 'Calle', 'Plaza', 
    'Paseo', 'Lugar', 'Patio', 'Zona', 'Falda'
];

async function finalRepair() {
    try {
        const buf = fs.readFileSync('e:/Proyectos/Trinitas/Documentos de trabajo/callejero.csv');
        let text = buf.toString('utf8');
        if (text.includes('\uFFFD')) text = buf.toString('latin1');
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        const pristineList = [];
        
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

        for(let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(';');
            if (cols.length < 5) continue;
            const sigla = cols[3].trim().toUpperCase();
            const nombre = cols[4].trim().toUpperCase();
            const type = TYPE_MAP[sigla] || 'Calle';
            pristineList.push({ type, nombre, full: `${type} ${nombre}`.toUpperCase() });
        }

        const [streets] = await pool.query('SELECT id, name FROM Streets');
        
        for (const st of streets) {
            const name = st.name.toUpperCase();
            // Check if name is broken OR looks like it's missing the type prefix
            const hasBad = name.includes('\uFFFD') || name.includes('Ã') || TYPES.every(t => !name.startsWith(t.toUpperCase()));
            
            if (hasBad) {
                // Try to find the inner base name
                let innerName = name;
                for (const t of TYPES) {
                    if (name.startsWith(t.toUpperCase())) {
                        innerName = name.substring(t.length).trim();
                        break;
                    }
                }
                
                // Fuzzy inner name (wildcard diamonds)
                const fuzzyBase = innerName.replace(/[\uFFFDÃ]/g, '.');
                const regex = new RegExp('^' + fuzzyBase + '$', 'i');
                
                const match = pristineList.find(p => regex.test(p.nombre));
                
                if (match) {
                    const correctFull = match.full;
                    console.log(`Fixing: ${name} -> ${correctFull}`);
                    
                    const [exists] = await pool.query('SELECT id FROM Streets WHERE name = ?', [correctFull]);
                    if (exists.length > 0) {
                        const cid = exists[0].id;
                        await pool.query('UPDATE IGNORE Demarcations SET street_id = ? WHERE street_id = ?', [cid, st.id]);
                        await pool.query('UPDATE IGNORE Notifications SET street_id = ? WHERE street_id = ?', [cid, st.id]);
                        await pool.query('DELETE FROM Streets WHERE id = ?', [st.id]);
                    } else {
                        await pool.query('UPDATE Streets SET name = ? WHERE id = ?', [correctFull, st.id]);
                    }
                }
            }
        }
        process.exit(0);
    } catch(e) { console.error(e); process.exit(1); }
}

finalRepair();
