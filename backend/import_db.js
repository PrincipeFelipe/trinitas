const fs = require('fs');
const path = require('path');
const pool = require('./db/connection');

const BACKUP_FILE = path.join(__dirname, 'backup.sql');

async function importDB() {
    console.log('=== INICIANDO RESTAURACIÓN COMPLETA DE BASE DE DATOS (PROD) ===');
    
    if (!fs.existsSync(BACKUP_FILE)) {
        console.error(`❌ Error: No se encontró el archivo backup.sql en: ${BACKUP_FILE}`);
        process.exit(1);
    }

    // Connection check
    const [dbCheck] = await pool.query("SELECT DATABASE() as db");
    const dbName = dbCheck[0].db;
    console.log(`Conectado a la base de datos de destino: ${dbName}`);
    console.log('⚠️ ADVERTENCIA: Se eliminarán todas las tablas existentes y se restaurará el estado de desarrollo.');

    const sqlContent = fs.readFileSync(BACKUP_FILE, 'utf8');

    // Separar consultas por punto y coma seguido de salto de línea para evitar romper campos de texto con punto y coma
    const queries = sqlContent
        .split(/;\r?\n/)
        .map(q => q.trim())
        .filter(q => q.length > 0 && !q.startsWith('--'));

    console.log(`Cargadas ${queries.length} sentencias SQL desde backup.sql.`);
    // Obtener una conexión dedicada del pool para mantener el estado de sesión (FOREIGN_KEY_CHECKS = 0)
    const connection = await pool.getConnection();
    try {
        console.log('Desactivando temporalmente comprobación de llaves foráneas...');
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');

        let executed = 0;
        for (let query of queries) {
            let sql = query;
            if (!sql.endsWith(';')) {
                sql += ';';
            }

            try {
                await connection.query(sql);
                executed++;
                if (executed % 50 === 0) {
                    console.log(`   * Ejecutadas ${executed} de ${queries.length} sentencias...`);
                }
            } catch (err) {
                console.error(`❌ Error ejecutando la sentencia SQL #${executed + 1}:`);
                console.error(sql.slice(0, 200) + (sql.length > 200 ? '...' : ''));
                throw err;
            }
        }

        // Reactivar comprobación de llaves foráneas
        console.log('Reactivando comprobación de llaves foráneas...');
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');

        console.log(`\n✅ RESTAURACIÓN COMPLETADA CON ÉXITO: ${executed} sentencias ejecutadas.`);
        console.log(`La base de datos '${dbName}' es ahora una copia idéntica a tu base de datos de desarrollo.`);
    } finally {
        connection.release();
    }
}

importDB().catch(err => {
    console.error('\n❌ Error durante la restauración:', err.message);
    process.exit(1);
});
