const fs = require('fs');
const pool = require('./db/connection');

const STREET_TYPES = [
    'URBANIZACIÓN', 'URBANIZACION',
    'ACUARTELAMIENTO',
    'TRANSVERSAL',
    'CARRETERA',
    'BARRIADA',
    'GLORIETA',
    'POLÍGONO', 'POLIGONO',
    'CONJUNTO',
    'ESCALERA',
    'AVENIDA',
    'COLONIA',
    'CAMINO',
    'CUESTA',
    'MUELLE',
    'PASAJE',
    'BARRIO',
    'ARROYO',
    'JARDÍN', 'JARDIN',
    'GRUPO',
    'MONTE',
    'PASEO',
    'PLAYA',
    'PLAZA',
    'CALLE',
    'LUGAR',
    'PATIO',
    'PUENTE',
    'FALDA',
    'LOMA',
    'ZONA',
];

function extractStreetName(fullAddress) {
    let addr = fullAddress.trim().toUpperCase();
    
    // Fix encoding: ? is often Ñ in latin1 misread
    addr = addr.replace(/\?/g, 'Ñ');
    
    // 1. Find the street type
    let matchedType = null;
    let restAfterType = '';
    
    for (const type of STREET_TYPES) {
        if (addr.startsWith(type)) {
            matchedType = type;
            restAfterType = addr.substring(type.length).trim();
            break;
        }
    }
    
    if (!matchedType) {
        // Handle non-typed streets: take everything before first number or (
        const m = addr.match(/^([A-ZÁÉÍÓÚÑÜ\s.'-]+?)(?:\s+\d|\s*\(|\s+BLQ|\s+PTL|\s*$)/i);
        if (m) {
            let name = m[1].replace(/\s+/g, ' ').trim();
            if (name.length >= 3) return name;
        }
        return null;
    }
    
    // 2. Remove ALL parenthetical content (barriada, edificio, etc.)
    restAfterType = restAfterType.replace(/\s*\([^)]*\)/g, '').trim();
    // Also handle unmatched opening paren (truncated in fixed-width)
    restAfterType = restAfterType.replace(/\s*\([^)]*$/g, '').trim();
    
    // 3. Extract name: everything before the first number, or before apartment/building indicators
    // Stop at: digits, BLQ, PTL, BAJO, PISO, LOCAL, ESC + number, JTO, NAVE, F-, P-
    const stopPattern = /(?:\s+\d|\s+BLQ|\s+PTL|\s+BAJO|\s+PISO|\s+LOCAL|\s+ESC\d|\s+JTO|\s+NAVE|\s+F-|\s+P-|\s+CARRETERA\b|\s+PTA-)/i;
    
    const parts = restAfterType.split(stopPattern);
    let streetName = parts[0].replace(/\s+/g, ' ').trim();
    
    // Remove trailing single letters, prepositions, articles, or short fragments (BL, NA, PT, PAR, JUNT, etc.)
    streetName = streetName.replace(/\s+(DE|DEL|LA|EL|LOS|LAS|P|N|FR|A|BL|NA|PT|PAR|JUNT|ESC\d*|F-\d*|P-\d*)\s*$/i, '').trim();
    // Run again in case there's another trailing preposition after removing the fragment
    streetName = streetName.replace(/\s+(DE|DEL|LA|EL|LOS|LAS)\s*$/i, '').trim();
    
    // Fix double type: "GRUPO ALFAU" extracted as type GRUPO + rest "GRUPO ALFAU" -> needs fix
    // Actually with our extraction, restAfterType for "GRUPO GRUPO ALFAU" would be "GRUPO ALFAU"
    // So streetName becomes "GRUPO ALFAU", and we'd produce "GRUPO GRUPO ALFAU"
    // Fix: if streetName starts with the same type, remove it
    const typeUpper = matchedType.toUpperCase();
    if (streetName.startsWith(typeUpper + ' ')) {
        streetName = streetName.substring(typeUpper.length).trim();
    }
    
    if (!streetName || streetName.length < 2) return null;
    
    // Normalize the type
    let normalizedType = typeUpper
        .replace('URBANIZACION', 'URBANIZACIÓN')
        .replace('POLIGONO', 'POLÍGONO')
        .replace('JARDIN', 'JARDÍN');
    
    return `${normalizedType} ${streetName}`.replace(/\s+/g, ' ').trim();
}

async function processAndSync() {
    try {
        console.log('=== Extracción y Sincronización de Calles desde TXT ===\n');
        
        const buf = fs.readFileSync('e:/Proyectos/Trinitas/Documentos de trabajo/9999_6_31-03-2026-01.25.txt');
        let text = buf.toString('utf-8');
        if (text.includes('\uFFFD')) text = buf.toString('latin1');
        
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        
        const extractedStreets = new Set();
        
        for (const line of lines) {
            if (line.length < 45) continue;
            const fullAddress = line.substring(45).trim();
            if (!fullAddress) continue;
            
            const streetName = extractStreetName(fullAddress);
            if (streetName) extractedStreets.add(streetName);
        }
        
        const streetList = Array.from(extractedStreets).sort();
        console.log(`Calles únicas extraídas del TXT: ${streetList.length}`);
        console.log('\nListado:');
        streetList.forEach((s, i) => console.log(`  ${i+1}. ${s}`));
        
        // Truncate and re-insert
        console.log('\n--- Limpiando tablas ---');
        await pool.query('SET FOREIGN_KEY_CHECKS = 0');
        await pool.query('TRUNCATE TABLE Demarcations');
        await pool.query('TRUNCATE TABLE Streets');
        await pool.query('SET FOREIGN_KEY_CHECKS = 1');
        
        console.log('Insertando calles...');
        for (const name of streetList) {
            await pool.query('INSERT IGNORE INTO Streets (name) VALUES (?)', [name]);
        }
        
        const [count] = await pool.query('SELECT COUNT(*) as c FROM Streets');
        console.log(`\n=== FINALIZADO ===`);
        console.log(`Total calles en BD: ${count[0].c}`);
        
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}

processAndSync();
