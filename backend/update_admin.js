const pool = require('./db/connection');

async function updateAdmin() {
    try {
        const hash = '$2b$10$J0ptb.r/JTZtF4nS7FTK2uk0TFZLu.fBNzWWRHJlpubgYxGhPb4XO';
        const [result] = await pool.query('UPDATE Users SET password_hash = ? WHERE username = ?', [hash, 'admin']);
        console.log('Admin password updated, affected rows:', result.affectedRows);
    } catch (e) {
        console.error('Error updating admin password:', e);
    } finally {
        process.exit(0);
    }
}
updateAdmin();
