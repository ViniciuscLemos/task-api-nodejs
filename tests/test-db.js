// starts a temporary Postgres for the tests (or uses the CI one if TEST_DB_HOST is set)
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

async function startDatabase() {
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.LOGIN_ATTEMPT_LIMIT = '10000';

  let stopDatabase = async () => {};

  if (process.env.TEST_DB_HOST) {
    process.env.DB_HOST = process.env.TEST_DB_HOST;
    process.env.DB_PORT = process.env.TEST_DB_PORT || '5432';
    process.env.DB_NAME = process.env.TEST_DB_NAME || 'tasks_test';
    process.env.DB_USER = process.env.TEST_DB_USER || 'postgres';
    process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD || 'postgres';
  } else {
    const EmbeddedPostgres = require('embedded-postgres').default;
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'task-api-pg-'));
    const port = await freePort();

    const pg = new EmbeddedPostgres({
      databaseDir: folder,
      user: 'postgres',
      password: 'postgres',
      port,
      persistent: false,
      onLog: () => {},
    });
    await pg.initialise();
    await pg.start();
    await pg.createDatabase('tasks_test');

    Object.assign(process.env, {
      DB_HOST: 'localhost',
      DB_PORT: String(port),
      DB_NAME: 'tasks_test',
      DB_USER: 'postgres',
      DB_PASSWORD: 'postgres',
    });
    stopDatabase = () => pg.stop();
  }

  // only imported now, after setting the variables
  const pool = require('../config/database');
  const schema = fs.readFileSync(path.join(__dirname, '..', 'config', 'schema.sql'), 'utf8');
  await pool.query(schema);
  // runs twice to make sure the schema can run again
  await pool.query(schema);

  return {
    pool,
    async clear() {
      await pool.query('TRUNCATE tasks, users RESTART IDENTITY CASCADE');
    },
    async stop() {
      await pool.end();
      await stopDatabase();
    },
  };
}

module.exports = { startDatabase };
