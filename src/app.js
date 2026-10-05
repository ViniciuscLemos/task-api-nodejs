const express = require('express');
const cors = require('cors');

const rotas = require('./routes/index');

// o listen fica no server.js, assim os testes usam o app sem abrir porta
const app = express();

app.use(cors());

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', mensagem: 'API de Tarefas funcionando!' });
});

app.use('/api', rotas);

app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição' });
  }
  console.error('Erro inesperado:', err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

module.exports = app;
