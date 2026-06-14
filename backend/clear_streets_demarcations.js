require('dotenv').config();
const pool = require('./db/connection');

async function clearStreetsAndDemarcations() {
    try {
        console.log("Desactivando revisión de llaves foráneas...");
        await pool.query("SET FOREIGN_KEY_CHECKS = 0;");
        
        console.log("Limpiando tabla demarcations (relaciones de repartidores con calles)...");
        await pool.query("TRUNCATE TABLE Demarcations;");
        
        console.log("Limpiando tabla streets (catálogo de calles)...");
        await pool.query("TRUNCATE TABLE Streets;");

        // También es prudente poner a NULL los street_id y assigned_user_id en notifications si queremos consistencia absoluta
        console.log("Reseteando relaciones en notifications...");
        await pool.query("UPDATE Notifications SET street_id = NULL, assigned_user_id = NULL;");
        
        console.log("Activando revisión de llaves foráneas...");
        await pool.query("SET FOREIGN_KEY_CHECKS = 1;");
        
        console.log("¡Tablas de calles y demarcaciones vaciadas con éxito!");
    } catch(e) {
        console.error("Error al vaciar calles y demarcaciones:", e);
    } finally {
        process.exit(0);
    }
}

clearStreetsAndDemarcations();
