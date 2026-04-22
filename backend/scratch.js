const pool = require('./db/connection');

async function addCol() {
    try {
        await pool.query('ALTER TABLE Notifications ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;');
        console.log("Success");
    } catch(err) {
        console.log("Already added or error: ", err.message);
    }
    process.exit();
}
addCol();
