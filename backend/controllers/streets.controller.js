const pool = require('../db/connection');

const getAllStreets = async (req, res, next) => {
    try {
        const [rows] = await pool.query('SELECT * FROM streets ORDER BY name ASC');
        res.json({ success: true, data: rows });
    } catch (error) {
        next(error);
    }
};

const getStreetById = async (req, res, next) => {
    try {
        const [rows] = await pool.query('SELECT * FROM streets WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Street not found' });
        }
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        next(error);
    }
};

const createStreet = async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Street name required' });

        const [result] = await pool.query('INSERT INTO streets (name) VALUES (?)', [name]);
        res.status(201).json({ success: true, data: { id: result.insertId, name } });
    } catch (error) {
        if(error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, error: 'Street name already exists' });
        }
        next(error);
    }
};

const updateStreet = async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Street name required' });

        const [result] = await pool.query('UPDATE streets SET name = ? WHERE id = ?', [name, req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Street not found' });

        res.json({ success: true, data: { id: req.params.id, name } });
    } catch (error) {
        if(error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, error: 'Street name already exists' });
        }
        next(error);
    }
};

const deleteStreet = async (req, res, next) => {
    try {
        const [result] = await pool.query('DELETE FROM streets WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Street not found' });

        res.json({ success: true, message: 'Street deleted' });
    } catch (error) {
        next(error);
    }
};

module.exports = { getAllStreets, getStreetById, createStreet, updateStreet, deleteStreet };
