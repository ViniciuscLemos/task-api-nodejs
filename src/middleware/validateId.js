// without this, /tasks/abc turned into a 500 error down in Postgres
function validateId(req, res, next) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid ID: must be a positive integer' });
  }

  req.params.id = id;
  next();
}

module.exports = validateId;
