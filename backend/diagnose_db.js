require('dotenv').config();
const pool = require('./db/connection');

async function diagnose() {
    console.log('=== INICIANDO DIAGNÓSTICO DE BASE DE DATOS ===');
    try {
        const [dbCheck] = await pool.query("SELECT DATABASE() as db");
        console.log(`Conectado a la base de datos: ${dbCheck[0].db}`);

        const [tables] = await pool.query("SHOW TABLES");
        console.log(`Se encontraron ${tables.length} tablas:`);
        
        for (const row of tables) {
            const tableName = Object.values(row)[0];
            console.log(`\n---------------------------------`);
            console.log(`Tabla: ${tableName}`);
            console.log(`---------------------------------`);
            
            try {
                const [columns] = await pool.query(`DESCRIBE \`${tableName}\``);
                console.table(columns.map(c => ({
                    Campo: c.Field,
                    Tipo: c.Type,
                    Nulo: c.Null,
                    Clave: c.Key,
                    Predeterminado: c.Default,
                    Extra: c.Extra
                })));
            } catch (err) {
                console.error(`Error al describir la tabla ${tableName}:`, err.message);
            }
        }
    } catch (e) {
        console.error('Error durante el diagnóstico:', e);
    } finally {
        process.exit(0);
    }
}

diagnose();
