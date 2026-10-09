const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../config/database');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// used on login when the email doesn't exist (explained further down)
const FAKE_HASH = bcrypt.hashSync('a-password-nobody-uses', 10);

function createToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /auth/register
async function register(req, res) {
  const { name, email, password } = req.body;

  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string'
      || !name.trim() || !email.trim() || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must have at least 6 characters' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    // email is UNIQUE, so a repeated email lands in the catch with code 23505.
    // (doing a SELECT first would let two simultaneous requests create the same account)
    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name.trim(), normalizedEmail, passwordHash]
    );

    const user = result.rows[0];
    return res.status(201).json({ user, token: createToken(user) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error('Error on register:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /auth/login
async function login(req, res) {
  const { email, password } = req.body;

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    );

    const user = result.rows[0];

    // Compares against a fake hash even with no user. Otherwise the response for an email
    // that doesn't exist comes back much faster, and you can tell who has an account by the timing.
    const passwordOk = await bcrypt.compare(password, user ? user.password : FAKE_HASH);

    if (!user || !passwordOk) {
      // same message for both cases, so it doesn't reveal whether the email exists
      return res.status(401).json({ error: 'Wrong email or password' });
    }

    return res.json({
      user: { id: user.id, name: user.name, email: user.email },
      token: createToken(user),
    });
  } catch (err) {
    console.error('Error on login:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /auth/me
async function me(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      // valid token but the account was deleted
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Error getting user:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { register, login, me };
