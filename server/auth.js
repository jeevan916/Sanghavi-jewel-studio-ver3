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
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // We attach user info to req. 
        // We'll trust the token's validity to avoid DB hits on every request unless strictly needed
        req.user = decoded; 
        
        if (decoded.role !== 'admin' && decoded.role !== 'contributor') {
            return res.status(403).json({ error: "Forbidden: Insufficient permissions" });
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
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; 
        
        if (decoded.role !== 'admin') {
            return res.status(403).json({ error: "Forbidden: Admin access required" });
        }
        
        next();
    } catch (e) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
    }
};
