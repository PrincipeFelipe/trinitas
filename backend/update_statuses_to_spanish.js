require('dotenv').config();
const pool = require('./db/connection');

async function updateStatuses() {
    try {
        console.log("Actualizando estados a español en la base de datos...");
        
        // 1. Ampliar el ENUM para aceptar tanto inglés como español temporalmente
        console.log("Ampliando ENUM...");
        await pool.query(`
            ALTER TABLE notifications MODIFY COLUMN status ENUM(
                'PENDING', 'ATTEMPT_1', 'DELIVERED', 'RETURNED', 'FAILED',
                'PENDIENTE', '1ER_INTENTO', 'ENTREGADA', 'DEVUELTA', 'FALLIDA', 'AUSENTE', 'REHUSADO', 'DESCONOCIDO'
            ) DEFAULT 'PENDIENTE'
        `);

        // 2. Migrar datos existentes
        console.log("Migrando datos existentes...");
        await pool.query("UPDATE notifications SET status = 'PENDIENTE' WHERE status = 'PENDING'");
        await pool.query("UPDATE notifications SET status = '1ER_INTENTO' WHERE status = 'ATTEMPT_1'");
        await pool.query("UPDATE notifications SET status = 'ENTREGADA' WHERE status = 'DELIVERED'");
        await pool.query("UPDATE notifications SET status = 'DEVUELTA' WHERE status = 'RETURNED'");
        await pool.query("UPDATE notifications SET status = 'FALLIDA' WHERE status = 'FAILED'");

        // 3. Dejar solo el ENUM en español (y con los nuevos estados)
        console.log("Consolidando ENUM en español...");
        await pool.query(`
            ALTER TABLE notifications MODIFY COLUMN status ENUM(
                'PENDIENTE', '1ER_INTENTO', 'ENTREGADA', 'DEVUELTA', 'FALLIDA', 'AUSENTE', 'REHUSADO', 'DESCONOCIDO'
            ) DEFAULT 'PENDIENTE'
        `);

        // 4. Repetir para delivery_attempts si tuviera el ENUM (normalmente es varchar o similar, pero por si acaso)
        // Revisando el esquema de delivery_attempts... 
        // En este proyecto solemos usar status_result en delivery_attempts.
        
        console.log("✅ Estados actualizados con éxito.");
    } catch (error) {
        console.error("❌ Error al actualizar estados:", error);
    } finally {
        process.exit(0);
    }
}

updateStatuses();
