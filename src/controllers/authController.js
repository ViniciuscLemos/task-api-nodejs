const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../config/database');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// usado no login quando o e-mail não existe (explicação lá embaixo)
const HASH_FALSO = bcrypt.hashSync('senha-que-ninguem-usa', 10);

function gerarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, email: usuario.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /auth/registro
async function registro(req, res) {
  const { nome, email, senha } = req.body;

  if (typeof nome !== 'string' || typeof email !== 'string' || typeof senha !== 'string'
      || !nome.trim() || !email.trim() || !senha) {
    return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
  }

  const emailNormalizado = email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(emailNormalizado)) {
    return res.status(400).json({ erro: 'Email inválido' });
  }

  if (senha.length < 6) {
    return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres' });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10);

    // email é UNIQUE, então e-mail repetido cai no catch com código 23505.
    // (fazer um SELECT antes deixaria duas requisições ao mesmo tempo criarem a mesma conta)
    const resultado = await pool.query(
      'INSERT INTO usuarios (nome, email, senha) VALUES ($1, $2, $3) RETURNING id, nome, email, criado_em',
      [nome.trim(), emailNormalizado, senhaHash]
    );

    const usuario = resultado.rows[0];
    return res.status(201).json({ usuario, token: gerarToken(usuario) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Email já cadastrado' });
    }
    console.error('Erro no registro:', err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

// POST /auth/login
async function login(req, res) {
  const { email, senha } = req.body;

  if (typeof email !== 'string' || typeof senha !== 'string' || !email || !senha) {
    return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
  }

  try {
    const resultado = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1',
      [email.trim().toLowerCase()]
    );

    const usuario = resultado.rows[0];

    // Mesmo sem usuário compara com um hash falso. Senão a resposta pra e-mail
    // inexistente volta bem mais rápido, e dá pra descobrir quem tem conta pelo tempo.
    const senhaCorreta = await bcrypt.compare(senha, usuario ? usuario.senha : HASH_FALSO);

    if (!usuario || !senhaCorreta) {
      // mesma mensagem pros dois casos, pra não dizer se o e-mail existe
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    return res.json({
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
      token: gerarToken(usuario),
    });
  } catch (err) {
    console.error('Erro no login:', err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

// GET /auth/me
async function me(req, res) {
  try {
    const resultado = await pool.query(
      'SELECT id, nome, email, criado_em FROM usuarios WHERE id = $1',
      [req.usuario.id]
    );

    if (resultado.rows.length === 0) {
      // token válido mas a conta foi apagada
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    return res.json(resultado.rows[0]);
  } catch (err) {
    console.error('Erro ao buscar usuário:', err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { registro, login, me };
