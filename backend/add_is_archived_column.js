require('dotenv').config();
const pool = require('./db/connection');

async function migrate() {
    try {
        console.log("Iniciando migración para añadir columna 'is_archived'...");
        await pool.query("ALTER TABLE notifications ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0;");
        console.log("✅ Columna 'is_archived' añadida correctamente.");
        process.exit(0);
    } catch (e) {
        if (e.code === 'ER_DUP_COLUMN_NAME') {
            console.log("ℹ️ La columna 'is_archived' ya existe.");
            process.exit(0);
        }
        console.error("❌ Error en la migración:", e);
        process.exit(1);
    }
}

migrate();
