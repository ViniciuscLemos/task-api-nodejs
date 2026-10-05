const dotenv = require('dotenv');

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

// Sem JWT_SECRET, qualquer login falharia com erro 500 — melhor avisar já na partida
if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET não definido. Copie .env.example para .env e preencha os valores.');
  process.exit(1);
}

const app = require('./app');
const pool = require('../config/database');

const PORT = process.env.PORT || 3000;

const servidor = app.listen(PORT, async () => {
  console.log(`\n🚀 Servidor rodando em http://localhost:${PORT}`);

  // Testa a conexão com o banco ao iniciar
  try {
    await pool.query('SELECT 1');
    console.log('🐘 Conectado ao PostgreSQL com sucesso!');
  } catch (err) {
    console.error('⚠️  Não foi possível conectar ao PostgreSQL:', err.message);
  }

  console.log(`📋 Rotas disponíveis:`);
  console.log(`   POST   /api/auth/registro`);
  console.log(`   POST   /api/auth/login`);
  console.log(`   GET    /api/auth/me`);
  console.log(`   GET    /api/tarefas`);
  console.log(`   GET    /api/tarefas/resumo`);
  console.log(`   GET    /api/tarefas/:id`);
  console.log(`   POST   /api/tarefas`);
  console.log(`   PUT    /api/tarefas/:id`);
  console.log(`   DELETE /api/tarefas/:id\n`);
});

// Encerramento gracioso: termina as requisições em andamento e fecha o pool
function encerrar() {
  console.log('\nEncerrando servidor...');
  servidor.close(() => pool.end().then(() => process.exit(0)));
}
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
