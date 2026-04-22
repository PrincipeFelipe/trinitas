const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ success: false, error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: 'Malformed token' });

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ success: false, error: 'Failed to authenticate token' });
        
        req.user = decoded;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'ADMIN') {
        next();
    } else {
        res.status(403).json({ success: false, error: 'Requires admin privileges' });
    }
};

module.exports = { verifyToken, requireAdmin };
