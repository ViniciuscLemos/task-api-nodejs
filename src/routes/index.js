const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const tarefasController = require('../controllers/tarefasController');
const autenticar = require('../middleware/auth');
const validarId = require('../middleware/validarId');

// ========================
// Rotas de Autenticação
// ========================
// Rotas públicas — qualquer um pode acessar
router.post('/auth/registro', authController.registro);
router.post('/auth/login', authController.login);

// Rota protegida: dados do usuário dono do token
router.get('/auth/me', autenticar, authController.me);

// ========================
// Rotas de Tarefas
// ========================
// Todas as rotas abaixo passam pelo middleware `autenticar`
// Se o token for inválido, o middleware responde com 401 e a rota não é executada
router.get('/tarefas', autenticar, tarefasController.listar);
// /tarefas/resumo vem antes de /tarefas/:id, senão "resumo" seria tratado como um id
router.get('/tarefas/resumo', autenticar, tarefasController.resumo);
router.get('/tarefas/:id', autenticar, validarId, tarefasController.buscarPorId);
router.post('/tarefas', autenticar, tarefasController.criar);
router.put('/tarefas/:id', autenticar, validarId, tarefasController.atualizar);
router.delete('/tarefas/:id', autenticar, validarId, tarefasController.remover);

module.exports = router;
