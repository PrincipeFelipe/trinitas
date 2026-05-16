require('dotenv').config();
const pool = require('./db/connection');
async function show() {
    const [rows] = await pool.query("SHOW CREATE TABLE notifications");
    console.log(rows[0]['Create Table']);
    process.exit(0);
}
show();
