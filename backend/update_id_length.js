require('dotenv').config();
const pool = require('./db/connection');

async function run() {
    try {
        console.log("Modificando columna id_notificacion a VARCHAR(100)...");
        await pool.query("ALTER TABLE notifications MODIFY COLUMN id_notificacion VARCHAR(100) NOT NULL;");
        console.log("✅ Columna modificada correctamente.");
    } catch (e) {
        console.error("❌ Error al modificar la columna:", e);
    } finally {
        process.exit(0);
    }
}
run();
