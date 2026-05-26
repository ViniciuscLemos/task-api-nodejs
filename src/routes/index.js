const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const tarefasController = require('../controllers/tarefasController');
const autenticar = require('../middleware/auth');

// ========================
// Rotas de Autenticação
// ========================
// Rotas públicas — qualquer um pode acessar
router.post('/auth/registro', authController.registro);
router.post('/auth/login', authController.login);

// ========================
// Rotas de Tarefas
// ========================
// Todas as rotas abaixo passam pelo middleware `autenticar`
// Se o token for inválido, o middleware responde com 401 e a rota não é executada
router.get('/tarefas', autenticar, tarefasController.listar);
router.get('/tarefas/:id', autenticar, tarefasController.buscarPorId);
router.post('/tarefas', autenticar, tarefasController.criar);
router.put('/tarefas/:id', autenticar, tarefasController.atualizar);
router.delete('/tarefas/:id', autenticar, tarefasController.remover);

module.exports = router;
