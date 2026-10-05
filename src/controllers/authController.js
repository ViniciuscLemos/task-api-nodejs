const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../config/database');

// Controller de autenticação
// Controllers contêm a lógica de negócio de cada rota

// Validação simples de formato de e-mail (algo@algo.algo)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  // Validação básica dos campos
  if (typeof nome !== 'string' || typeof email !== 'string' || typeof senha !== 'string'
      || !nome.trim() || !email.trim() || !senha) {
    return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
  }

  // E-mail é salvo em minúsculas: "Joao@Email.com" e "joao@email.com" são a mesma conta
  const emailNormalizado = email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(emailNormalizado)) {
    return res.status(400).json({ erro: 'Email inválido' });
  }

  if (senha.length < 6) {
    return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres' });
  }

  try {
    // Gera o hash da senha — NUNCA salve senhas em texto puro!
    // O número 10 é o "salt rounds": quanto maior, mais seguro e mais lento
    const senhaHash = await bcrypt.hash(senha, 10);

    // Insere o usuário e retorna os dados (exceto a senha).
    // A coluna email é UNIQUE: se já existir, o banco recusa (erro 23505).
    // Isso é mais seguro que fazer um SELECT antes, porque evita que duas
    // requisições simultâneas criem a mesma conta.
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

    if (!usuario) {
      // Mensagem genérica por segurança — não revelamos qual campo está errado
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    // bcrypt.compare compara a senha digitada com o hash salvo
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

    if (!senhaCorreta) {
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

// GET /auth/me — devolve o usuário do token (útil para o front-end)
async function me(req, res) {
  try {
    const resultado = await pool.query(
      'SELECT id, nome, email, criado_em FROM usuarios WHERE id = $1',
      [req.usuario.id]
    );

    if (resultado.rows.length === 0) {
      // Token válido, mas a conta foi apagada
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    return res.json(resultado.rows[0]);
  } catch (err) {
    console.error('Erro ao buscar usuário:', err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { registro, login, me };
