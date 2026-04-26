const pool = require('./db/connection');

async function migrate() {
    try {
        console.log('Checking for notes column in delivery_attempts...');
        const [columns] = await pool.query('SHOW COLUMNS FROM delivery_attempts LIKE "notes"');
        
        if (columns.length === 0) {
            console.log('Column "notes" missing. Adding it...');
            await pool.query('ALTER TABLE delivery_attempts ADD COLUMN notes TEXT DEFAULT NULL');
            console.log('Column "notes" added successfully.');
        } else {
            console.log('Column "notes" already exists.');
        }
    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        process.exit();
    }
}

migrate();
