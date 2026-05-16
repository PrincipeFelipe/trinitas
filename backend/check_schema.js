require('dotenv').config();
const pool = require('./db/connection');

async function checkSchema() {
    try {
        const [rows] = await pool.query("SHOW CREATE TABLE notifications;");
        console.log(rows[0]['Create Table']);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
checkSchema();
