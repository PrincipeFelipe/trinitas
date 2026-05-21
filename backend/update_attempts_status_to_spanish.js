require('dotenv').config();
const pool = require('./db/connection');

async function updateAttemptsStatus() {
    try {
        console.log("Iniciando actualización de columna status_result en delivery_attempts...");

        // 1. Ampliar el ENUM para aceptar tanto inglés como español temporalmente
        console.log("Ampliando ENUM de status_result...");
        await pool.query(`
            ALTER TABLE delivery_attempts MODIFY COLUMN status_result ENUM(
                'DELIVERED', 'ABSENT', 'REFUSED', 'UNKNOWN',
                'ENTREGADA', 'AUSENTE', 'REHUSADO', 'DESCONOCIDO'
            ) NOT NULL
        `);

        // 2. Migrar datos existentes de inglés a español
        console.log("Migrando datos de intentos existentes...");
        await pool.query("UPDATE delivery_attempts SET status_result = 'ENTREGADA' WHERE status_result = 'DELIVERED'");
        await pool.query("UPDATE delivery_attempts SET status_result = 'AUSENTE' WHERE status_result = 'ABSENT'");
        await pool.query("UPDATE delivery_attempts SET status_result = 'REHUSADO' WHERE status_result = 'REFUSED'");
        await pool.query("UPDATE delivery_attempts SET status_result = 'DESCONOCIDO' WHERE status_result = 'UNKNOWN'");

        // 3. Dejar solo el ENUM en español
        console.log("Consolidando ENUM en español para status_result...");
        await pool.query(`
            ALTER TABLE delivery_attempts MODIFY COLUMN status_result ENUM(
                'ENTREGADA', 'AUSENTE', 'REHUSADO', 'DESCONOCIDO'
            ) NOT NULL
        `);

        console.log("✅ Columna status_result de delivery_attempts actualizada correctamente a español.");
    } catch (error) {
        console.error("❌ Error al migrar status_result:", error);
    } finally {
        process.exit(0);
    }
}

updateAttemptsStatus();
