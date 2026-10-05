const { Pool } = require('pg');
require('dotenv').config();

// Pool de conexões com o PostgreSQL
// O Pool reutiliza conexões em vez de abrir uma nova a cada requisição.
// A conexão só é aberta na primeira query (o teste de conexão fica em server.js).
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

module.exports = pool;
