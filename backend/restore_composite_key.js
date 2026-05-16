require('dotenv').config();
const pool = require('./db/connection');

async function restoreCompositeKey() {
    try {
        console.log("Restaurando clave compuesta (id, company) para permitir IDs duplicados entre empresas...");
        await pool.query("SET FOREIGN_KEY_CHECKS = 0;");

        // 1. Eliminar las constraints actuales de delivery_attempts
        console.log("Eliminando constraints antiguas de delivery_attempts...");
        try { await pool.query("ALTER TABLE delivery_attempts DROP FOREIGN KEY delivery_attempts_ibfk_1"); } catch(e) {}
        try { await pool.query("ALTER TABLE delivery_attempts DROP INDEX unq_notification_attempt"); } catch(e) {}

        // 2. Cambiar la Primary Key de notifications
        console.log("Cambiando Primary Key de notifications a (id, company)...");
        await pool.query("ALTER TABLE notifications DROP PRIMARY KEY, ADD PRIMARY KEY (id, company)");

        // 3. Añadir columna company a delivery_attempts para la relación (si no existe)
        console.log("Asegurando columna company en delivery_attempts...");
        try {
            await pool.query("ALTER TABLE delivery_attempts ADD COLUMN company VARCHAR(50)");
        } catch(e) {
            // Ya existe
        }

        // 4. Sincronizar la columna company en delivery_attempts desde notifications
        console.log("Sincronizando datos de empresa en intentos de entrega...");
        await pool.query(`
            UPDATE delivery_attempts da
            JOIN notifications n ON da.notification_id = n.id
            SET da.company = n.company
            WHERE da.company IS NULL
        `);

        // 5. Re-crear las constraints usando la clave compuesta
        console.log("Re-creando constraints compuestas...");
        await pool.query(`
            ALTER TABLE delivery_attempts 
            ADD CONSTRAINT delivery_attempts_ibfk_1 
            FOREIGN KEY (notification_id, company) REFERENCES notifications (id, company) ON DELETE CASCADE
        `);

        await pool.query(`
            ALTER TABLE delivery_attempts 
            ADD UNIQUE INDEX unq_notification_attempt (notification_id, company, attempt_number)
        `);

        await pool.query("SET FOREIGN_KEY_CHECKS = 1;");
        console.log("✅ Clave compuesta restaurada con éxito.");
    } catch (error) {
        console.error("❌ Error en la restauración:", error);
    } finally {
        process.exit(0);
    }
}

restoreCompositeKey();
