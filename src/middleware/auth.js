const jwt = require('jsonwebtoken');

// Middleware de autenticação JWT
// Middlewares no Express recebem (req, res, next)
// Se tudo estiver OK, chama next() para passar para o próximo handler
// Se não, responde com erro e interrompe a requisição
function autenticar(req, res, next) {
  // O token vem no header: Authorization: Bearer <token>
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ erro: 'Token não fornecido' });
  }

  // Separa "Bearer" do token em si
  const [, token] = authHeader.split(' ');

  if (!token) {
    return res.status(401).json({ erro: 'Formato de token inválido. Use: Bearer <token>' });
  }

  try {
    // jwt.verify lança um erro se o token for inválido ou expirado
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Adiciona os dados do usuário na requisição para usar nos controllers
    req.usuario = { id: payload.id, email: payload.email };

    next(); // Tudo certo, segue para o controller
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ erro: 'Token expirado. Faça login novamente.' });
    }
    return res.status(401).json({ erro: 'Token inválido' });
  }
}

module.exports = autenticar;
