require('dotenv').config();
const pool = require('./db/connection');

async function migrate() {
    try {
        console.log("Vaciando tabla para aplicar cambios estructurales...");
        await pool.query("SET FOREIGN_KEY_CHECKS = 0;");
        await pool.query("TRUNCATE TABLE delivery_attempts;");
        await pool.query("TRUNCATE TABLE notifications;");
        
        console.log("Cambiando columna company a NOT NULL...");
        await pool.query("ALTER TABLE notifications MODIFY company VARCHAR(50) NOT NULL;");
        
        console.log("Cambiando clave primaria a (id, company)...");
        await pool.query("ALTER TABLE notifications DROP PRIMARY KEY;");
        await pool.query("ALTER TABLE notifications ADD PRIMARY KEY (id, company);");
        
        await pool.query("SET FOREIGN_KEY_CHECKS = 1;");
        console.log("Cambios aplicados con éxito. Ahora se permiten IDs duplicados si pertenecen a empresas distintas.");
    } catch(e) {
        console.error("Error en la migración:", e);
    } finally {
        process.exit(0);
    }
}
migrate();
