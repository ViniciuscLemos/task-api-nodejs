const express = require('express');
const cors = require('cors');

const routes = require('./routes/index');

// listen lives in server.js, so the tests use the app without opening a port
const app = express();

app.use(cors());

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Task API is running!' });
});

app.use('/api', routes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in the request body' });
  }
  console.error('Unexpected error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
