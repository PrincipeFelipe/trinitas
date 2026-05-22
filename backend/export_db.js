const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function exportDB() {
    console.log('--- Iniciando exportación de base de datos ---');
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'trinitas_db'
    });

    const [tables] = await connection.query('SHOW TABLES');
    const dbName = process.env.DB_NAME || 'trinitas_db';
    
    // Ordenar tablas por dependencias para evitar errores errno: 150 durante la creación en MariaDB/MySQL
    const tableNames = tables.map(t => Object.values(t)[0]);
    const dependencyOrder = ['users', 'streets', 'demarcations', 'notifications', 'delivery_attempts'];
    const orderedTables = [
        ...dependencyOrder.filter(name => tableNames.includes(name)),
        ...tableNames.filter(name => !dependencyOrder.includes(name))
    ];

    let sqlDump = `-- Backup Trinitas\n-- Fecha: ${new Date().toISOString()}\n\n`;
    sqlDump += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

    for (let tableName of orderedTables) {
        console.log(`Exportando tabla: ${tableName}...`);

        sqlDump += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;

        // Create Table
        const [createTable] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
        sqlDump += `${createTable[0]['Create Table']};\n\n`;

        // Data
        const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``);
        if (rows.length > 0) {
            const keys = Object.keys(rows[0]);
            const columns = keys.map(k => `\`${k}\``).join(', ');
            
            for (let row of rows) {
                const values = keys.map(k => {
                    const val = row[k];
                    if (val === null) return 'NULL';
                    if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                    if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
                    return val;
                }).join(', ');
                sqlDump += `INSERT INTO \`${tableName}\` (${columns}) VALUES (${values});\n`;
            }
            sqlDump += '\n';
        }
    }

    sqlDump += `SET FOREIGN_KEY_CHECKS = 1;\n`;
    fs.writeFileSync('backup.sql', sqlDump);
    console.log('--- Exportación completada: backup.sql ---');
    await connection.end();
}

exportDB().catch(err => {
    console.error('Error durante la exportación:', err);
    process.exit(1);
});
