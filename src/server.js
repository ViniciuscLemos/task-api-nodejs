const dotenv = require('dotenv');

dotenv.config();

// without JWT_SECRET login would break, so stop right here
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Copy .env.example to .env and fill in the values.');
  process.exit(1);
}

const app = require('./app');
const pool = require('../config/database');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, async () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);

  try {
    await pool.query('SELECT 1');
    console.log('Connected to PostgreSQL');
  } catch (err) {
    console.error("Couldn't connect to PostgreSQL:", err.message);
  }

  console.log(`📋 Available routes:`);
  console.log(`   POST   /api/auth/register`);
  console.log(`   POST   /api/auth/login`);
  console.log(`   GET    /api/auth/me`);
  console.log(`   GET    /api/tasks`);
  console.log(`   GET    /api/tasks/summary`);
  console.log(`   GET    /api/tasks/:id`);
  console.log(`   POST   /api/tasks`);
  console.log(`   PUT    /api/tasks/:id`);
  console.log(`   DELETE /api/tasks/:id\n`);
});

// Ctrl+C: waits for the requests to finish and closes the pool
function shutdown() {
  console.log('\nShutting down server...');
  server.close(() => pool.end().then(() => process.exit(0)));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
