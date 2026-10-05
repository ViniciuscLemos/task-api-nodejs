const express = require('express');
const cors = require('cors');

const rotas = require('./routes/index');

// O app fica separado do app.listen() (em server.js) para que os testes
// possam importar a aplicação sem abrir uma porta de verdade.
const app = express();

// Permite que front-ends em outros domínios (ex: React em localhost:5173) chamem a API
app.use(cors());

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
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // JSON malformado no corpo da requisição
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição' });
  }
  console.error('Erro inesperado:', err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

module.exports = app;
