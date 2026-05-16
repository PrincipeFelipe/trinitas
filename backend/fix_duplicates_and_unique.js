require('dotenv').config();
const pool = require('./db/connection');

async function migrate() {
    try {
        console.log("Aplicando restricciones de unicidad y limpieza de duplicados...");
        
        // 1. Eliminar duplicados accidentales antes de aplicar el índice UNIQUE
        // Nos quedamos con el registro más reciente (mayor ID) para cada intento
        await pool.query(`
            DELETE da FROM delivery_attempts da
            JOIN (
                SELECT MIN(id) as id_to_keep, notification_id, company, attempt_number
                FROM delivery_attempts
                GROUP BY notification_id, company, attempt_number
                HAVING COUNT(*) > 1
            ) as t ON da.notification_id = t.notification_id 
                   AND da.company = t.company 
                   AND da.attempt_number = t.attempt_number
            WHERE da.id != t.id_to_keep
        `);

        // 2. Añadir restricción UNIQUE para evitar que vuelva a pasar
        try {
            await pool.query(`
                ALTER TABLE delivery_attempts 
                ADD UNIQUE INDEX unq_notification_attempt (notification_id, company, attempt_number)
            `);
            console.log("Índice UNIQUE añadido correctamente.");
        } catch(e) {
            console.log("El índice UNIQUE ya existe o no se pudo aplicar:", e.message);
        }

        console.log("Migración completada.");
    } catch(e) {
        console.error("Error en la migración:", e);
    } finally {
        process.exit(0);
    }
}
migrate();
