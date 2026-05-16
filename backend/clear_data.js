require('dotenv').config();
const pool = require('./db/connection');

async function clear() {
    try {
        console.log("Desactivando revisión de llaves foráneas...");
        await pool.query("SET FOREIGN_KEY_CHECKS = 0;");
        
        console.log("Limpiando delivery_attempts...");
        await pool.query("TRUNCATE TABLE delivery_attempts;");
        
        console.log("Limpiando notifications...");
        await pool.query("TRUNCATE TABLE notifications;");
        
        console.log("Activando revisión de llaves foráneas...");
        await pool.query("SET FOREIGN_KEY_CHECKS = 1;");
        
        console.log("Tablas de notificaciones e intentos vaciadas con éxito.");
    } catch(e) {
        console.error("Error al vaciar tablas:", e);
    } finally {
        process.exit(0);
    }
}
clear();
