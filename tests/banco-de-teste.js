// Sobe um PostgreSQL temporário para os testes, sem precisar instalar nada.
// Se TEST_DB_HOST estiver definido (ex: no GitHub Actions), usa aquele banco.
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');

function portaLivre() {
  return new Promise((resolve, reject) => {
    const servidor = net.createServer();
    servidor.listen(0, () => {
      const { port } = servidor.address();
      servidor.close(() => resolve(port));
    });
    servidor.on('error', reject);
  });
}

async function iniciarBanco() {
  process.env.JWT_SECRET = 'segredo-de-teste';
  process.env.JWT_EXPIRES_IN = '1h';

  let pararBanco = async () => {};

  if (process.env.TEST_DB_HOST) {
    process.env.DB_HOST = process.env.TEST_DB_HOST;
    process.env.DB_PORT = process.env.TEST_DB_PORT || '5432';
    process.env.DB_NAME = process.env.TEST_DB_NAME || 'tarefas_test';
    process.env.DB_USER = process.env.TEST_DB_USER || 'postgres';
    process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD || 'postgres';
  } else {
    const EmbeddedPostgres = require('embedded-postgres').default;
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'api-tarefas-pg-'));
    const porta = await portaLivre();

    const pg = new EmbeddedPostgres({
      databaseDir: pasta,
      user: 'postgres',
      password: 'postgres',
      port: porta,
      persistent: false,
      onLog: () => {},
    });
    await pg.initialise();
    await pg.start();
    await pg.createDatabase('tarefas_test');

    Object.assign(process.env, {
      DB_HOST: 'localhost',
      DB_PORT: String(porta),
      DB_NAME: 'tarefas_test',
      DB_USER: 'postgres',
      DB_PASSWORD: 'postgres',
    });
    pararBanco = () => pg.stop();
  }

  // Só agora o pool é criado, já com as variáveis de ambiente certas
  const pool = require('../config/database');
  const schema = fs.readFileSync(path.join(__dirname, '..', 'config', 'schema.sql'), 'utf8');
  await pool.query(schema);
  // Executa de novo para garantir que o script é idempotente
  await pool.query(schema);

  return {
    pool,
    async limpar() {
      await pool.query('TRUNCATE tarefas, usuarios RESTART IDENTITY CASCADE');
    },
    async parar() {
      await pool.end();
      await pararBanco();
    },
  };
}

module.exports = { iniciarBanco };
