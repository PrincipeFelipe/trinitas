const fs = require('fs');
const path = require('path');
const pool = require('./db/connection');

const DATA_FILE = path.join(__dirname, 'users_streets_data.json');

async function exportData() {
    console.log('=== INICIANDO EXPORTACIÓN DE USUARIOS Y CALLEJERO (DEV) ===');
    
    // 1. Exportar Usuarios (excluyendo el administrador por seguridad de producción)
    console.log('Obteniendo usuarios de la base de datos...');
    const [users] = await pool.query(
        "SELECT name, username, password_hash, role FROM Users WHERE username != 'admin'"
    );
    console.log(`- Se encontraron ${users.length} usuarios (excluyendo 'admin').`);

    // 2. Exportar Calles
    console.log('Obteniendo calles de la base de datos...');
    const [streets] = await pool.query("SELECT name FROM Streets");
    const streetNames = streets.map(s => s.name);
    console.log(`- Se encontraron ${streetNames.length} calles.`);

    // 3. Exportar Demarcaciones asociando por nombres en lugar de IDs
    console.log('Obteniendo demarcaciones y resolviendo relaciones por nombre/usuario...');
    const [demarcations] = await pool.query(`
        SELECT u.username, s.name as street_name 
        FROM Demarcations d
        JOIN Users u ON d.user_id = u.id
        JOIN Streets s ON d.street_id = s.id
        WHERE u.username != 'admin'
    `);
    console.log(`- Se encontraron ${demarcations.length} vinculaciones de demarcación.`);

    const exportPayload = {
        exported_at: new Date().toISOString(),
        users,
        streets: streetNames,
        demarcations
    };

    fs.writeFileSync(DATA_FILE, JSON.stringify(exportPayload, null, 2), 'utf8');
    console.log(`\n✅ Datos exportados exitosamente en: ${DATA_FILE}`);
    console.log('¡Ahora puedes hacer git commit y push de este archivo, y luego importarlo en producción!');
}

async function importData() {
    console.log('=== INICIANDO IMPORTACIÓN DE USUARIOS Y CALLEJERO (PROD) ===');
    
    if (!fs.existsSync(DATA_FILE)) {
        console.error(`❌ Error: No se encontró el archivo de datos en: ${DATA_FILE}`);
        console.error('Por favor, ejecuta primero la exportación en desarrollo.');
        process.exit(1);
    }

    const payload = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    console.log(`Cargados datos exportados el: ${payload.exported_at}`);

    // Connection check
    const [dbCheck] = await pool.query("SELECT DATABASE() as db");
    console.log(`Conectado a la base de datos de producción: ${dbCheck[0].db}`);

    // 1. Importar Usuarios
    console.log('\n--- 1. Importando Usuarios ---');
    let usersInserted = 0;
    for (const u of payload.users) {
        // Verificar si el usuario ya existe para no duplicarlo ni alterar contraseñas
        const [exist] = await pool.query("SELECT id FROM Users WHERE username = ?", [u.username]);
        if (exist.length === 0) {
            await pool.query(
                "INSERT INTO Users (name, username, password_hash, role) VALUES (?, ?, ?, ?)",
                [u.name, u.username, u.password_hash, u.role]
            );
            usersInserted++;
            console.log(`   + Usuario creado: ${u.username} (${u.role})`);
        } else {
            console.log(`   = Usuario ya existente (omitido): ${u.username}`);
        }
    }
    console.log(`✅ ${usersInserted} nuevos usuarios creados.`);

    // 2. Importar Calles
    console.log('\n--- 2. Importando Calles ---');
    let streetsInserted = 0;
    for (const streetName of payload.streets) {
        const [res] = await pool.query("INSERT IGNORE INTO Streets (name) VALUES (?)", [streetName]);
        if (res.affectedRows > 0) {
            streetsInserted++;
        }
    }
    console.log(`✅ ${streetsInserted} nuevas calles añadidas.`);

    // 3. Importar Demarcaciones (Vinculando por nombre y usuario)
    console.log('\n--- 3. Importando Demarcaciones ---');
    let demarcationsInserted = 0;
    
    // Obtener mapas actualizados de usuarios y calles en producción para mapear IDs rápidamente
    const [currentUsers] = await pool.query("SELECT id, username FROM Users");
    const userMap = new Map(currentUsers.map(u => [u.username, u.id]));

    const [currentStreets] = await pool.query("SELECT id, name FROM Streets");
    const streetMap = new Map(currentStreets.map(s => [s.name, s.id]));

    for (const d of payload.demarcations) {
        const userId = userMap.get(d.username);
        const streetId = streetMap.get(d.street_name);

        if (!userId) {
            console.warn(`   ⚠️ Advertencia: No se encontró al usuario '${d.username}' en producción. Omitiendo demarcación.`);
            continue;
        }
        if (!streetId) {
            console.warn(`   ⚠️ Advertencia: No se encontró la calle '${d.street_name}' en producción. Omitiendo demarcación.`);
            continue;
        }

        const [res] = await pool.query(
            "INSERT IGNORE INTO Demarcations (user_id, street_id) VALUES (?, ?)",
            [userId, streetId]
        );
        if (res.affectedRows > 0) {
            demarcationsInserted++;
        }
    }
    console.log(`✅ ${demarcationsInserted} nuevas demarcaciones vinculadas.`);
    console.log('\n=== IMPORTACIÓN COMPLETADA CON ÉXITO ===');
}

async function main() {
    const args = process.argv.slice(2);
    const mode = args[0];

    if (mode === '--export') {
        await exportData();
    } else if (mode === '--import') {
        await importData();
    } else {
        console.log('Uso del script de sincronización Trinitas:');
        console.log('  Exportar en Desarrollo:   node sync_users_streets.js --export');
        console.log('  Importar en Producción:   node sync_users_streets.js --import');
    }
    process.exit(0);
}

main().catch(err => {
    console.error('Error durante la sincronización:', err);
    process.exit(1);
});
