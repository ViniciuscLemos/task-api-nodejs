// Middleware que valida o :id da URL
// Sem ele, GET /tarefas/abc chegaria ao PostgreSQL e viraria um erro 500
function validarId(req, res, next) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ erro: 'ID inválido: deve ser um número inteiro positivo' });
  }

  req.params.id = id;
  next();
}

module.exports = validarId;
