const pool = require('../../config/database');

// every route here goes through authenticate, so req.user always exists

const PRIORITIES = ['low', 'medium', 'high'];
const TITLE_MAX = 200;

// the user only picks a key from here, their text never goes into ORDER BY.
// priority uses CASE because alphabetically 'high' would come before 'medium'
const SORTS = {
  recent: 'created_at DESC',
  oldest: 'created_at ASC',
  priority: "CASE priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC, created_at DESC",
  title: 'title ASC',
};

// returns the error message or null. On PUT (partial) the fields are optional
function validateTask(body, partial) {
  const { title, description, completed, priority } = body;

  if (!partial || title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) {
      return 'Task title is required';
    }
    if (title.trim().length > TITLE_MAX) {
      return `Title must have at most ${TITLE_MAX} characters`;
    }
  }
  if (description !== undefined && description !== null && typeof description !== 'string') {
    return 'Description must be text';
  }
  if (completed !== undefined && typeof completed !== 'boolean') {
    return 'completed must be true or false';
  }
  if (priority !== undefined && !PRIORITIES.includes(priority)) {
    return 'Priority must be: low, medium or high';
  }
  return null;
}

// GET /tasks?completed=false&priority=high&search=study&sort=priority&page=1&limit=20
async function list(req, res) {
  const { completed, priority, sort, search } = req.query;

  if (completed !== undefined && !['true', 'false'].includes(completed)) {
    return res.status(400).json({ error: 'completed filter must be true or false' });
  }
  if (priority !== undefined && !PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: 'Priority must be: low, medium or high' });
  }
  // ?search=a&search=b becomes an array in Express
  if (search !== undefined && typeof search !== 'string') {
    return res.status(400).json({ error: 'search must be a single text' });
  }
  if (sort !== undefined && !SORTS[sort]) {
    return res.status(400).json({ error: `sort must be: ${Object.keys(SORTS).join(', ')}` });
  }

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  let filters = 'WHERE user_id = $1';
  const params = [req.user.id];

  if (completed !== undefined) {
    params.push(completed === 'true');
    filters += ` AND completed = $${params.length}`;
  }

  if (priority) {
    params.push(priority);
    filters += ` AND priority = $${params.length}`;
  }

  if (search) {
    // % and _ are wildcards in ILIKE: without escaping, searching "100%" returned any task with "100"
    const literal = search.replace(/[\\%_]/g, '\\$&');
    params.push(`%${literal}%`);
    filters += ` AND (title ILIKE $${params.length} OR description ILIKE $${params.length})`;
  }

  try {
    // COUNT(*) OVER () brings the total along, so pagination doesn't need another query
    const result = await pool.query(
      `SELECT *, COUNT(*) OVER () AS filtered_total
       FROM tasks ${filters}
       ORDER BY ${SORTS[sort] || SORTS.recent}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit]
    );

    const total = result.rows.length ? Number(result.rows[0].filtered_total) : 0;
    const tasks = result.rows.map(({ filtered_total, ...task }) => task);

    return res.json({
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
      tasks,
    });
  } catch (err) {
    console.error('Error listing tasks:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /tasks/summary
async function summary(req, res) {
  try {
    const result = await pool.query(
      `SELECT
         COUNT(*)                                          AS total,
         COUNT(*) FILTER (WHERE completed)                 AS completed,
         COUNT(*) FILTER (WHERE NOT completed)             AS pending,
         COUNT(*) FILTER (WHERE NOT completed AND priority = 'high') AS pending_high
       FROM tasks WHERE user_id = $1`,
      [req.user.id]
    );

    // pg returns COUNT as a string
    const row = result.rows[0];
    const data = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v)]));
    return res.json(data);
  } catch (err) {
    console.error('Error building summary:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /tasks/:id
async function getById(req, res) {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Error getting task:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /tasks
async function create(req, res) {
  const error = validateTask(req.body, false);
  if (error) {
    return res.status(400).json({ error });
  }

  const { title, description, priority } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO tasks (title, description, priority, user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [title.trim(), description || null, priority || 'medium', req.user.id]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating task:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// PUT /tasks/:id (only the fields sent)
async function update(req, res) {
  const { id } = req.params;

  const error = validateTask(req.body, true);
  if (error) {
    return res.status(400).json({ error });
  }

  const { title, description, completed, priority } = req.body;

  try {
    // COALESCE keeps the current value when the field wasn't sent.
    // description is separate because you can clear it by sending null
    const result = await pool.query(
      `UPDATE tasks
       SET title       = COALESCE($1, title),
           description = CASE WHEN $2 THEN $3 ELSE description END,
           completed   = COALESCE($4, completed),
           priority    = COALESCE($5, priority)
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [
        title !== undefined ? title.trim() : null,
        description !== undefined,
        description ?? null,
        completed ?? null,
        priority ?? null,
        id,
        req.user.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating task:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// DELETE /tasks/:id
async function remove(req, res) {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    return res.status(204).send();
  } catch (err) {
    console.error('Error deleting task:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { list, summary, getById, create, update, remove };
