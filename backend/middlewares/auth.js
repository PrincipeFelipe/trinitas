const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    let token = null;
    const authHeader = req.headers['authorization'];
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
        token = req.query.token;
    }

    if (!token) return res.status(401).json({ success: false, error: 'No token provided' });

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ success: false, error: 'Failed to authenticate token' });
        
        req.user = decoded;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (req.user && (req.user.role === 'ADMINISTRADOR' || req.user.role === 'ADMIN')) {
        next();
    } else {
        res.status(403).json({ success: false, error: 'Requires admin privileges' });
    }
};

const requirePermission = (moduleNameOrNames) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        if (req.user.role === 'ADMINISTRADOR' || req.user.role === 'ADMIN') {
            return next();
        }
        
        const required = Array.isArray(moduleNameOrNames) ? moduleNameOrNames : [moduleNameOrNames];
        if (req.user.permissions && required.some(p => req.user.permissions.includes(p))) {
            return next();
        }
        res.status(403).json({ success: false, error: `Forbidden: requires one of permissions: ${required.join(', ')}` });
    };
};


module.exports = { verifyToken, requireAdmin, requirePermission };
