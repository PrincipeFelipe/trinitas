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
    // Defaults for what's already full
    'CALLE': 'Calle',
    'PLAZA': 'Plaza',
    'PASEO': 'Paseo',
    'LUGAR': 'Lugar',
    'PATIO': 'Patio',
    'ZONA': 'Zona',
    'FALDA': 'Falda'
};

async function sync() {
    try {
        console.log('--- Iniciando sincronización del Callejero CSV ---');
        
        // 1. Process CSV to get unique normalized street names
        const buf = fs.readFileSync('e:/Proyectos/Trinitas/Documentos de trabajo/callejero.csv');
        let csvText = buf.toString('utf8');
        if (csvText.includes('\uFFFD')) {
            csvText = buf.toString('latin1');
        }
        const lines = csvText.split(/\r?\n/).filter(l => l.trim());
        
        const csvStreets = new Set();
        
        // Skip header index 0
        for(let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(';');
            if (cols.length < 5) continue;
            
            const sigla = cols[3].trim().toUpperCase();
            let nombre = cols[4].trim().toUpperCase();
            
            // Apply naming convention map
            let type = TYPE_MAP[sigla] || (sigla.charAt(0).toUpperCase() + sigla.slice(1).toLowerCase());
            
            // Special cleanup for names with trailing "(DE)", etc. (Optional, keeping format standard)
            // Example: "AFRICA (DE)" -> "AFRICA (DE)"
            let finalName = `${type} ${nombre}`.trim().toUpperCase();
            
            csvStreets.add(finalName);
        }
        
        const incomingList = Array.from(csvStreets);
        console.log(`Calles únicas detectadas en CSV: ${incomingList.length}`);

        // 2. Fetch existing streets from Database
        const [existing] = await pool.query('SELECT id, name FROM Streets');
        console.log(`Calles actualmente en la Base de Datos: ${existing.length}`);
        
        let updatedCount = 0;
        let deletedCount = 0;
        let insertedCount = 0;
        
        // 3. Smart Merge & Update Data to resolve conceptual duplicate formatting
        // We will transform existing DB names like 'AFRICA' into 'AVENIDA AFRICA (DE)' if they match directly.
        for (let dbStreet of existing) {
            const dbName = dbStreet.name.toUpperCase();
            
            // Check for direct exact match
            if (csvStreets.has(dbName)) {
                continue; // It's already perfect
            }
            
            // Attempt to find a conceptual match where CSV name partially includes DB name or vice-versa
            // e.g., DB="AFRICA", CSV="AVENIDA AFRICA (DE)"
            const candidateList = incomingList.filter(csv => csv.includes(dbName) || dbName.includes(csv));
            
            if (candidateList.length === 1) {
                // Safe 1-to-1 Mapping found. Upgrade the name to the CSV formal style.
                const newName = candidateList[0];
                try {
                    await pool.query('UPDATE Streets SET name = ? WHERE id = ?', [newName, dbStreet.id]);
                    updatedCount++;
                    dbStreet.name = newName; // update local pointer 
                } catch(e) {
                    if (e.code === 'ER_DUP_ENTRY') {
                        // The unified name is already taken by another DB row! This means the DB had two identical streets! 
                        // e.g DB had ID 5 "AFRICA" and ID 10 "AVENIDA AFRICA (DE)".
                        // In this case, we need to merge their references and delete the duplicate.
                        const [existingDuplicate] = await pool.query('SELECT id FROM Streets WHERE name = ?', [newName]);
                        if (existingDuplicate.length > 0) {
                            const correctId = existingDuplicate[0].id;
                            // Migrate references from the duplicate to the correct one
                            // Example: Demarcations. Demarcations have UNIQUE(user_id, street_id)
                            await pool.query('UPDATE IGNORE Demarcations SET street_id = ? WHERE street_id = ?', [correctId, dbStreet.id]);
                            await pool.query('UPDATE IGNORE Notifications SET street_id = ? WHERE street_id = ?', [correctId, dbStreet.id]);
                            
                            // Delete the lingering duplicate street
                            await pool.query('DELETE FROM Demarcations WHERE street_id = ?', [dbStreet.id]);
                            await pool.query('DELETE FROM Streets WHERE id = ?', [dbStreet.id]);
                            deletedCount++;
                        }
                    } else {
                        console.error(`Error updating ${dbName} to ${newName}`, e);
                    }
                }
            } else if (candidateList.length > 1) {
                // Ambiguous match, keeping it as is to be safe
            } else if (candidateList.length === 0) {
                // DB street does not match ANY of the incoming CSV streets. 
                // Maybe it was deleted from official records or generated wrongly from PDF.
                // It is kept unless we decide to strictly prune. The prompt says "Eliminar duplicidades", not "Eliminar obsoletos".
            }
        }
        
        // 4. Refresh existing names state after updates
        const [refreshedDB] = await pool.query('SELECT name FROM Streets');
        const refreshedSet = new Set(refreshedDB.map(s => s.name.toUpperCase()));
        
        // 5. Insert missing streets
        for (let newStreet of incomingList) {
            if (!refreshedSet.has(newStreet.toUpperCase())) {
                try {
                    await pool.query('INSERT INTO Streets (name) VALUES (?)', [newStreet]);
                    insertedCount++;
                } catch(e) {
                    console.error('Error insertando la calle:', newStreet, e);
                }
            }
        }

        console.log('--- Proceso Completado ---');
        console.log(`Calles Normalizadas/Actualizadas: ${updatedCount}`);
        console.log(`Duplicidades Eliminadas (Merge): ${deletedCount}`);
        console.log(`Nuevas Calles Añadidas: ${insertedCount}`);
        process.exit(0);
        
    } catch (e) {
        console.error('Fatal error', e);
        process.exit(1);
    }
}

sync();
