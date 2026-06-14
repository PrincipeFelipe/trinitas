require('dotenv').config();
const pool = require('./db/connection');

async function migrate() {
    try {
        console.log("Iniciando migración de la estructura de tablas de notificaciones...");
        
        await pool.query("SET FOREIGN_KEY_CHECKS = 0;");
        
        console.log("Eliminando tablas antiguas (notifications, delivery_attempts)...");
        await pool.query("DROP TABLE IF EXISTS delivery_attempts;");
        await pool.query("DROP TABLE IF EXISTS notifications;");
        
        console.log("Creando nueva tabla 'notifications'...");
        await pool.query(`
            CREATE TABLE notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                id_notificacion VARCHAR(10) NOT NULL,
                recipient_name VARCHAR(255) NOT NULL,
                full_address VARCHAR(255) NOT NULL,
                street_id INT,
                assigned_user_id INT,
                status ENUM('PENDIENTE', '1ER_INTENTO', 'ENTREGADA', 'DEVUELTA', 'FALLIDA') DEFAULT 'PENDIENTE',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                company VARCHAR(50) NOT NULL,
                FOREIGN KEY (street_id) REFERENCES streets(id) ON DELETE SET NULL,
                FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `);
        
        console.log("Creando nueva tabla 'delivery_attempts'...");
        await pool.query(`
            CREATE TABLE delivery_attempts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                notification_id INT NOT NULL,
                attempt_number INT NOT NULL CHECK (attempt_number IN (1, 2)),
                timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                status_result ENUM('ENTREGADA', 'AUSENTE', 'REHUSADO', 'DESCONOCIDO') NOT NULL,
                receiver_name VARCHAR(255) DEFAULT NULL,
                receiver_dni VARCHAR(20) DEFAULT NULL,
                signature_base64 LONGTEXT DEFAULT NULL,
                delivered_by INT NOT NULL,
                notes TEXT DEFAULT NULL,
                company VARCHAR(50) NOT NULL,
                UNIQUE KEY unq_notification_attempt (notification_id, attempt_number),
                FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
                FOREIGN KEY (delivered_by) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `);
        
        await pool.query("SET FOREIGN_KEY_CHECKS = 1;");
        console.log("✅ Migración de base de datos completada con éxito.");
    } catch (error) {
        console.error("❌ Error durante la migración de base de datos:", error);
    } finally {
        process.exit(0);
    }
}

migrate();
