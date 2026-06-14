require('dotenv').config();
const pool = require('./db/connection');

async function migrate() {
    try {
        console.log("Iniciando migración para sistema de roles y permisos...");
        
        await pool.query("SET FOREIGN_KEY_CHECKS = 0;");

        // 1. Modificar columna role en la tabla 'users' a VARCHAR(50)
        console.log("Modificando columna 'role' en tabla 'users'...");
        await pool.query("ALTER TABLE users MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'EMPLEADO';");

        // 2. Mapear roles antiguos a nuevos roles
        console.log("Actualizando roles antiguos de usuarios...");
        await pool.query("UPDATE users SET role = 'ADMINISTRADOR' WHERE role = 'ADMIN';");
        await pool.query("UPDATE users SET role = 'EMPLEADO' WHERE role = 'REPARTIDOR';");

        // 3. Crear tabla 'user_permissions'
        console.log("Creando tabla 'user_permissions'...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_permissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                module VARCHAR(50) NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unq_user_module (user_id, module)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `);

        await pool.query("SET FOREIGN_KEY_CHECKS = 1;");
        console.log("✅ Migración finalizada con éxito.");
    } catch (e) {
        console.error("❌ Error en la migración:", e);
    } finally {
        process.exit(0);
    }
}

migrate();
