const jwt = require('jsonwebtoken');

function autenticar(req, res, next) {
  // Authorization: Bearer <token>
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ erro: 'Token não fornecido' });
  }

  const [tipo, token] = authHeader.split(' ');

  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ erro: 'Formato de token inválido. Use: Bearer <token>' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    req.usuario = { id: payload.id, email: payload.email };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ erro: 'Token expirado. Faça login novamente.' });
    }
    return res.status(401).json({ erro: 'Token inválido' });
  }
}

module.exports = autenticar;
