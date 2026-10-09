const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const tasksController = require('../controllers/tasksController');
const authenticate = require('../middleware/auth');
const validateId = require('../middleware/validateId');
const loginLimiter = require('../middleware/loginLimiter');

const limiter = loginLimiter();
router.post('/auth/register', limiter, authController.register);
router.post('/auth/login', limiter, authController.login);

router.get('/auth/me', authenticate, authController.me);

router.get('/tasks', authenticate, tasksController.list);
// has to come before /:id, otherwise "summary" becomes an id
router.get('/tasks/summary', authenticate, tasksController.summary);
router.get('/tasks/:id', authenticate, validateId, tasksController.getById);
router.post('/tasks', authenticate, tasksController.create);
router.put('/tasks/:id', authenticate, validateId, tasksController.update);
router.delete('/tasks/:id', authenticate, validateId, tasksController.remove);

module.exports = router;
