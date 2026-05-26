const { Pool } = require('pg');
require('dotenv').config();

// Pool de conexões com o PostgreSQL
// O Pool reutiliza conexões em vez de abrir uma nova a cada requisição
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Testa a conexão ao iniciar
pool.connect((err, client, release) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
    return;
  }
  console.log('Conectado ao PostgreSQL com sucesso!');
  release(); // Libera o cliente de volta ao pool
});

module.exports = pool;
