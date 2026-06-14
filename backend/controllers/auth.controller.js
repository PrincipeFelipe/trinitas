const pool = require('../db/connection');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const login = async (req, res, next) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Please provide username and password' });
        }

        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const user = rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Fetch user permissions
        const [permRows] = await pool.query('SELECT module FROM user_permissions WHERE user_id = ?', [user.id]);
        const permissions = permRows.map(row => row.module);

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, permissions },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            success: true,
            token,
            user: { id: user.id, username: user.username, name: user.name, role: user.role, permissions }
        });
    } catch (error) {
        next(error);
    }
};

const register = async (req, res, next) => {
    try {
        const { name, username, password, role } = req.body;
        if (!name || !username || !password) {
            return res.status(400).json({ success: false, error: 'Please provide all required fields' });
        }

        const userRole = role || 'EMPLEADO';
        
        // hash password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const [result] = await pool.query(
            'INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)',
            [name, username, password_hash, userRole]
        );

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: { id: result.insertId, name, username, role: userRole }
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, error: 'Username already exists' });
        }
        next(error);
    }
};

const getMe = async (req, res, next) => {
    try {
        const [rows] = await pool.query('SELECT id, name, username, role FROM users WHERE id = ?', [req.user.id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        const user = rows[0];

        // Fetch user permissions
        const [permRows] = await pool.query('SELECT module FROM user_permissions WHERE user_id = ?', [user.id]);
        const permissions = permRows.map(row => row.module);

        res.json({ success: true, user: { ...user, permissions } });
    } catch (error) {
        next(error);
    }
};

module.exports = { login, register, getMe };
