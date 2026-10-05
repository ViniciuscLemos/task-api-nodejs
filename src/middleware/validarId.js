// sem isso, /tarefas/abc virava erro 500 lá no Postgres
function validarId(req, res, next) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ erro: 'ID inválido: deve ser um número inteiro positivo' });
  }

  req.params.id = id;
  next();
}

module.exports = validarId;
