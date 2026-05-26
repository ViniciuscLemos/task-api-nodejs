const express = require('express');
const dotenv = require('dotenv');

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

const rotas = require('./routes/index');

const app = express();

// Middleware para o Express entender JSON no corpo das requisições
app.use(express.json());

// Rota de health check — útil para verificar se a API está rodando
app.get('/', (req, res) => {
  res.json({ status: 'ok', mensagem: 'API de Tarefas funcionando!' });
});

// Registra todas as rotas com o prefixo /api
app.use('/api', rotas);

// Middleware de tratamento de rotas não encontradas (404)
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

// Middleware de tratamento de erros globais
// Erros passados via next(err) chegam aqui
app.use((err, req, res, next) => {
  console.error('Erro inesperado:', err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📋 Rotas disponíveis:`);
  console.log(`   POST   /api/auth/registro`);
  console.log(`   POST   /api/auth/login`);
  console.log(`   GET    /api/tarefas`);
  console.log(`   GET    /api/tarefas/:id`);
  console.log(`   POST   /api/tarefas`);
  console.log(`   PUT    /api/tarefas/:id`);
  console.log(`   DELETE /api/tarefas/:id\n`);
});
