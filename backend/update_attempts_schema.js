require('dotenv').config();
const pool = require('./db/connection');

async function migrate() {
    try {
        console.log("Actualizando delivery_attempts...");
        await pool.query("SET FOREIGN_KEY_CHECKS = 0;");
        
        // Add company column if it doesn't exist
        try {
            await pool.query("ALTER TABLE delivery_attempts ADD COLUMN company VARCHAR(50);");
        } catch(e) { console.log("Columna company ya existe o error menor."); }
        
        // Populate company based on notifications (if any exist)
        await pool.query(`
            UPDATE delivery_attempts da 
            JOIN notifications n ON da.notification_id = n.id 
            SET da.company = n.company 
            WHERE da.company IS NULL
        `);
        
        // Make it NOT NULL
        await pool.query("ALTER TABLE delivery_attempts MODIFY company VARCHAR(50) NOT NULL;");

        // Update Foreign Key
        try {
            await pool.query("ALTER TABLE delivery_attempts DROP FOREIGN KEY delivery_attempts_ibfk_1;");
        } catch(e) { console.log("No se pudo borrar FK antigua o no existe."); }
        
        await pool.query(`
            ALTER TABLE delivery_attempts 
            ADD CONSTRAINT delivery_attempts_ibfk_1 
            FOREIGN KEY (notification_id, company) 
            REFERENCES notifications (id, company) 
            ON DELETE CASCADE;
        `);
        
        await pool.query("SET FOREIGN_KEY_CHECKS = 1;");
        console.log("Tabla delivery_attempts actualizada correctamente.");
    } catch(e) {
        console.error("Error en la migración:", e);
    } finally {
        process.exit(0);
    }
}
migrate();
