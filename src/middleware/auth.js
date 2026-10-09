const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  // Authorization: Bearer <token>
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const [type, token] = authHeader.split(' ');

  if (type !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Invalid token format. Use: Bearer <token>' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    req.user = { id: payload.id, email: payload.email };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = authenticate;
