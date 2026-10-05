const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const tarefasController = require('../controllers/tarefasController');
const autenticar = require('../middleware/auth');
const validarId = require('../middleware/validarId');

router.post('/auth/registro', authController.registro);
router.post('/auth/login', authController.login);

router.get('/auth/me', autenticar, authController.me);

router.get('/tarefas', autenticar, tarefasController.listar);
// tem que vir antes do /:id, senão "resumo" vira id
router.get('/tarefas/resumo', autenticar, tarefasController.resumo);
router.get('/tarefas/:id', autenticar, validarId, tarefasController.buscarPorId);
router.post('/tarefas', autenticar, tarefasController.criar);
router.put('/tarefas/:id', autenticar, validarId, tarefasController.atualizar);
router.delete('/tarefas/:id', autenticar, validarId, tarefasController.remover);

module.exports = router;
