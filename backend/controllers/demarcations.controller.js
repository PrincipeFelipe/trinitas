const pool = require('../db/connection');

const getAllAssignments = async (req, res, next) => {
    try {
        const query = `
            SELECT d.id, d.user_id, u.name as user_name, d.street_id, s.name as street_name 
            FROM demarcations d
            JOIN users u ON d.user_id = u.id
            JOIN streets s ON d.street_id = s.id
        `;
        const [rows] = await pool.query(query);
        res.json({ success: true, data: rows });
    } catch (error) {
        next(error);
    }
};

const assignStreetToUser = async (req, res, next) => {
    try {
        const { user_id, street_id } = req.body;
        if (!user_id || !street_id) {
            return res.status(400).json({ success: false, error: 'user_id and street_id are required' });
        }

        const [result] = await pool.query(
            'INSERT INTO demarcations (user_id, street_id) VALUES (?, ?)',
            [user_id, street_id]
        );
        res.status(201).json({ success: true, data: { id: result.insertId, user_id, street_id } });
    } catch (error) {
        if(error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, error: 'Assignment already exists' });
        }
        next(error);
    }
};

const removeAssignment = async (req, res, next) => {
    try {
        const [result] = await pool.query('DELETE FROM demarcations WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Assignment not found' });

        res.json({ success: true, message: 'Assignment removed' });
    } catch (error) {
        next(error);
    }
};

const getUserStreets = async (req, res, next) => {
    try {
        const userId = req.params.userId;
        // Verify token user is requesting their own streets, or is admin
        if (req.user.role !== 'ADMIN' && req.user.id !== parseInt(userId)) {
            return res.status(403).json({ success: false, error: 'Unauthorized to view these streets' });
        }

        const query = `
            SELECT d.id, d.street_id, s.name as street_name 
            FROM demarcations d
            JOIN streets s ON d.street_id = s.id
            WHERE d.user_id = ?
        `;
        const [rows] = await pool.query(query, [userId]);
        res.json({ success: true, data: rows });
    } catch (error) {
        next(error);
    }
};

module.exports = { getAllAssignments, assignStreetToUser, removeAssignment, getUserStreets };
