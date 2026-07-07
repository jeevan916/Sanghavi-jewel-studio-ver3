import jwt from 'jsonwebtoken';

export const requireStaff = async (req, res, next) => {
    let token = req.headers['x-auth-token'];
    const authHeader = req.headers['authorization'];
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }
    if (!token) {
        return res.status(401).json({ error: "Unauthorized: Missing credentials" });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        
        if (req.app.locals.pool) {
            const [rows] = await req.app.locals.pool.query('SELECT role, isActive FROM staff WHERE id = ?', [decoded.id]);
            const dbUser = rows[0];
            if (!dbUser || !dbUser.isActive) {
                return res.status(401).json({ error: "Unauthorized: Account disabled or deleted" });
            }
            if (dbUser.role !== 'admin' && dbUser.role !== 'contributor' && dbUser.role !== 'staff') {
                return res.status(403).json({ error: "Forbidden: Insufficient permissions" });
            }
            req.user = { id: decoded.id, role: dbUser.role };
        } else {
            req.user = decoded;
            if (decoded.role !== 'admin' && decoded.role !== 'contributor' && decoded.role !== 'staff') {
                return res.status(403).json({ error: "Forbidden: Insufficient permissions" });
            }
        }
        
        next();
    } catch (e) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
    }
};

export const requireAdmin = async (req, res, next) => {
    let token = req.headers['x-auth-token'];
    const authHeader = req.headers['authorization'];
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }
    if (!token) {
        return res.status(401).json({ error: "Unauthorized: Missing credentials" });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        
        if (req.app.locals.pool) {
            const [rows] = await req.app.locals.pool.query('SELECT role, isActive FROM staff WHERE id = ?', [decoded.id]);
            const dbUser = rows[0];
            if (!dbUser || !dbUser.isActive) {
                return res.status(401).json({ error: "Unauthorized: Account disabled or deleted" });
            }
            if (dbUser.role !== 'admin') {
                return res.status(403).json({ error: "Forbidden: Admin access required" });
            }
            req.user = { id: decoded.id, role: dbUser.role };
        } else {
            req.user = decoded;
            if (decoded.role !== 'admin') {
                return res.status(403).json({ error: "Forbidden: Admin access required" });
            }
        }
        
        next();
    } catch (e) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
    }
};
