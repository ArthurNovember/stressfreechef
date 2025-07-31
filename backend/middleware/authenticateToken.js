const jwt = require('jsonwebtoken');
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']; // např. "Bearer abc.def.ghi"
  const token = authHeader && authHeader.split(' ')[1]; // vezme část za "Bearer"
  if (!token) {
    return res.status(401).json({ error: 'Přístup odepřen – chybí token.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // přidáš uživatele do req.user pro další použití
    next(); // pustíš dál na další middleware nebo route
  } catch (err) {
    return res.status(403).json({ error: 'Neplatný nebo expirovaný token.' });
  }
}
module.exports = authenticateToken;
