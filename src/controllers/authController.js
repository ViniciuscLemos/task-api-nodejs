const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../config/database');

// Controller de autenticação
// Controllers contêm a lógica de negócio de cada rota

// POST /auth/registro
async function registro(req, res) {
  const { nome, email, senha } = req.body;

  // Validação básica dos campos
  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
  }

  if (senha.length < 6) {
    return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres' });
  }

  try {
    // Verifica se o email já está cadastrado
    const usuarioExiste = await pool.query(
      'SELECT id FROM usuarios WHERE email = $1',
      [email]
    );

    if (usuarioExiste.rows.length > 0) {
      return res.status(409).json({ erro: 'Email já cadastrado' });
    }

    // Gera o hash da senha — NUNCA salve senhas em texto puro!
    // O número 10 é o "salt rounds": quanto maior, mais seguro e mais lento
    const senhaHash = await bcrypt.hash(senha, 10);

    // Insere o usuário e retorna os dados (exceto a senha)
    const resultado = await pool.query(
      'INSERT INTO usuarios (nome, email, senha) VALUES ($1, $2, $3) RETURNING id, nome, email, criado_em',
      [nome, email, senhaHash]
    );

    const usuario = resultado.rows[0];

    // Gera o JWT com os dados do usuário
    const token = jwt.sign(
      { id: usuario.id, email: usuario.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.status(201).json({ usuario, token });
  } catch (err) {
    console.error('Erro no registro:', err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

// POST /auth/login
async function login(req, res) {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
  }

  try {
    const resultado = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1',
      [email]
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

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.json({
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
      token,
    });
  } catch (err) {
    console.error('Erro no login:', err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { registro, login };
