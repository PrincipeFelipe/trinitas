const pool = require('../db/connection');
const bcrypt = require('bcryptjs');

const getAllUsers = async (req, res, next) => {
    try {
        const [rows] = await pool.query('SELECT id, name, username, role FROM Users ORDER BY id DESC');
        res.json({ success: true, data: rows });
    } catch (error) {
        next(error);
    }
};

const createUser = async (req, res, next) => {
    try {
        const { name, username, password, role } = req.body;
        if (!name || !username || !password) {
            return res.status(400).json({ success: false, error: 'Campos requeridos' });
        }
        
        const salt = await bcrypt.genSalt(10);
        // Replace with $2b$ to make it bcryptjs compliant if environment deviates
        const hash = await bcrypt.hash(password, salt);
        const compatHash = hash.replace(/^\$2a\$/, "$2b$");

        const [result] = await pool.query(
            'INSERT INTO Users (name, username, password_hash, role) VALUES (?, ?, ?, ?)',
            [name, username, compatHash, role || 'REPARTIDOR']
        );
        res.json({ success: true, data: { id: result.insertId, name, username, role } });
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
        const [result] = await pool.query('DELETE FROM Users WHERE id = ?', [id]);
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
        const { name, role } = req.body; // Solo updateamos metadata para no liar la passwd
        const [result] = await pool.query('UPDATE Users SET name = ?, role = ? WHERE id = ?', [name, role, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        }
        res.json({ success: true, message: 'Usuario actualizado' });
    } catch (error) {
        next(error);
    }
};

module.exports = { getAllUsers, createUser, deleteUser, updateUser };
