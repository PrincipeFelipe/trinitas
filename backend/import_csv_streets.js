const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('./db/connection');

async function importCsvV2() {
    try {
        const csvPath = path.join(__dirname, '../Documentos de trabajo/callejero nuevo v2.csv');
        console.log(`Leyendo archivo CSV modificado desde: ${csvPath}`);
        
        if (!fs.existsSync(csvPath)) {
            console.error("El archivo CSV no existe en la ruta especificada.");
            process.exit(1);
        }

        // --- PASO 0: Vaciar las tablas existentes ---
        console.log("\n--- PASO 0: Limpieza de Base de Datos ---");
        console.log("Desactivando revisión de llaves foráneas...");
        await pool.query("SET FOREIGN_KEY_CHECKS = 0;");
        
        console.log("Limpiando tabla Demarcations...");
        await pool.query("TRUNCATE TABLE Demarcations;");
        
        console.log("Limpiando tabla Streets...");
        await pool.query("TRUNCATE TABLE Streets;");

        console.log("Eliminando repartidores previos (usuarios con rol REPARTIDOR)...");
        await pool.query("DELETE FROM users WHERE role = 'REPARTIDOR';");

        console.log("Reseteando relaciones en la tabla Notifications...");
        await pool.query("UPDATE notifications SET street_id = NULL, assigned_user_id = NULL;");
        
        console.log("Activando revisión de llaves foráneas...");
        await pool.query("SET FOREIGN_KEY_CHECKS = 1;");
        console.log("Base de datos limpia y lista.");

        // Leer el archivo en codificación 'latin1'
        const fileContent = fs.readFileSync(csvPath, 'latin1');
        const lines = fileContent.split(/\r?\n/).filter(line => line.trim().length > 0);
        
        console.log(`Total de líneas en el archivo (incluyendo cabecera): ${lines.length}`);
        
        const header = lines[0];
        console.log(`Cabecera detectada: ${header}`);
        
        const dataLines = lines.slice(1);
        
        const uniqueCouriers = new Set();
        const streetCourierPairs = []; 

        for (const line of dataLines) {
            const parts = line.split(';');
            if (parts.length < 2) continue;
            
            const streetName = parts[0].trim().toUpperCase().replace(/\s+/g, ' ');
            const courierName = parts[1].trim(); 
            
            if (!streetName || !courierName) continue;
            
            uniqueCouriers.add(courierName);
            streetCourierPairs.push({ streetName, courierName });
        }

        console.log(`\nDetectados ${uniqueCouriers.size} repartidores únicos en V2:`, Array.from(uniqueCouriers));
        console.log(`Detectadas ${streetCourierPairs.length} asignaciones de calles.`);

        // 1. Crear usuarios repartidores
        console.log("\n--- PASO 1: Creación de Usuarios ---");
        const courierUserMap = new Map(); 
        
        console.log("Generando hash de contraseña 'Temporal1'...");
        const salt = await bcrypt.genSalt(10);
        const rawHash = await bcrypt.hash('Temporal1', salt);
        const passwordHash = rawHash.replace(/^\$2a\$/, "$2b$"); 

        for (const courierName of uniqueCouriers) {
            const username = courierName.toLowerCase().trim().replace(/\s+/g, '');
            
            // Crear el nuevo usuario (sabemos que no existe porque acabamos de borrar los REPARTIDORES)
            const [result] = await pool.query(
                "INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, 'REPARTIDOR')",
                [courierName, username, passwordHash]
            );
            const userId = result.insertId;
            console.log(`[CREADO] Repartidor '${courierName}' registrado con éxito (ID: ${userId}, username: ${username}).`);
            courierUserMap.set(courierName, userId);
        }

        // 2. Crear calles y vincular demarcaciones
        console.log("\n--- PASO 2: Importación de Calles y Demarcaciones ---");
        let streetsCreated = 0;
        let demarcationsCreated = 0;

        for (const pair of streetCourierPairs) {
            const { streetName, courierName } = pair;
            const userId = courierUserMap.get(courierName);
            
            if (!userId) {
                console.warn(`No se encontró ID de usuario para el repartidor ${courierName}. Saltando calle ${streetName}.`);
                continue;
            }

            // A. Insertar calle si no existe
            const [existingStreet] = await pool.query("SELECT id FROM streets WHERE name = ?", [streetName]);
            
            let streetId;
            if (existingStreet.length > 0) {
                streetId = existingStreet[0].id;
            } else {
                const [result] = await pool.query("INSERT INTO streets (name) VALUES (?)", [streetName]);
                streetId = result.insertId;
                streetsCreated++;
            }

            // B. Vincular repartidor con su calle en la tabla Demarcations
            const [result] = await pool.query(
                "INSERT IGNORE INTO demarcations (user_id, street_id) VALUES (?, ?)",
                [userId, streetId]
            );
            if (result.affectedRows > 0) {
                demarcationsCreated++;
            }
        }

        console.log("\n--- RESUMEN DE IMPORTACIÓN V2 ---");
        console.log(`✔ Repartidores creados: ${uniqueCouriers.size}`);
        console.log(`✔ Calles nuevas creadas: ${streetsCreated}`);
        console.log(`✔ Nuevas demarcaciones vinculadas: ${demarcationsCreated}`);

    } catch (error) {
        console.error("Error durante la importación V2:", error);
    } finally {
        process.exit(0);
    }
}

importCsvV2();
