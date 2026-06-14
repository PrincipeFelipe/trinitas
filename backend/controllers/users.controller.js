const pool = require('../db/connection');
const bcrypt = require('bcryptjs');

const getAllUsers = async (req, res, next) => {
    try {
        const [users] = await pool.query('SELECT id, name, username, role FROM users ORDER BY id DESC');
        const [permissions] = await pool.query('SELECT user_id, module FROM user_permissions');
        
        // Group permissions by user_id
        const permMap = {};
        permissions.forEach(p => {
            if (!permMap[p.user_id]) permMap[p.user_id] = [];
            permMap[p.user_id].push(p.module);
        });

        const data = users.map(u => ({
            ...u,
            permissions: permMap[u.id] || []
        }));

        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

const createUser = async (req, res, next) => {
    try {
        const { name, username, password, role, permissions } = req.body;
        if (!name || !username || !password) {
            return res.status(400).json({ success: false, error: 'Campos requeridos' });
        }
        
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        const compatHash = hash.replace(/^\$2a\$/, "$2b$");

        const [result] = await pool.query(
            'INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)',
            [name, username, compatHash, role || 'EMPLEADO']
        );

        const userId = result.insertId;

        // If the role is ADMINISTRADOR, we don't strictly need permissions rows or we can store all
        if (permissions && Array.isArray(permissions) && permissions.length > 0) {
            const insertValues = permissions.map(p => [userId, p]);
            await pool.query('INSERT INTO user_permissions (user_id, module) VALUES ?', [insertValues]);
        }

        res.json({ success: true, data: { id: userId, name, username, role, permissions: permissions || [] } });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, error: 'El nombre de usuario ya existe' });
        }
        next(error);
    }
};

const deleteUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        }
        res.json({ success: true, message: 'Usuario eliminado' });
    } catch (error) {
        next(error);
    }
};

const updateUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, role, permissions } = req.body;
        const [result] = await pool.query('UPDATE users SET name = ?, role = ? WHERE id = ?', [name, role, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        }

        // Sync permissions
        await pool.query('DELETE FROM user_permissions WHERE user_id = ?', [id]);
        if (permissions && Array.isArray(permissions) && permissions.length > 0) {
            const insertValues = permissions.map(p => [id, p]);
            await pool.query('INSERT INTO user_permissions (user_id, module) VALUES ?', [insertValues]);
        }

        res.json({ success: true, message: 'Usuario actualizado' });
    } catch (error) {
        next(error);
    }
};

module.exports = { getAllUsers, createUser, deleteUser, updateUser };
