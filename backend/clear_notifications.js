require('dotenv').config();
const pool = require('./db/connection');

async function clearNotifications() {
    try {
        console.log("⚠️ ATENCIÓN: Se van a eliminar TODAS las notificaciones y sus intentos de entrega.");
        
        await pool.query("SET FOREIGN_KEY_CHECKS = 0;");
        
        // Truncate delivery_attempts first if necessary, or let cascade work
        console.log("Vaciando tabla de intentos de entrega...");
        await pool.query("TRUNCATE TABLE delivery_attempts;");
        
        console.log("Vaciando tabla de notificaciones...");
        await pool.query("TRUNCATE TABLE notifications;");
        
        await pool.query("SET FOREIGN_KEY_CHECKS = 1;");
        
        console.log("✅ Tablas vaciadas correctamente.");
    } catch (error) {
        console.error("❌ Error al vaciar las tablas:", error);
    } finally {
        process.exit(0);
    }
}

clearNotifications();
