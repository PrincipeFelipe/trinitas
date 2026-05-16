require('dotenv').config();
const pool = require('./db/connection');

async function migrate() {
    try {
        console.log("Adding company column...");
        await pool.query("ALTER TABLE notifications ADD COLUMN company VARCHAR(50) DEFAULT NULL;");
        console.log("Success!");
    } catch(e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log("Column already exists.");
        } else {
            console.error(e);
        }
    } finally {
        process.exit(0);
    }
}
migrate();
