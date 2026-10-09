// OpenAPI description of the API. It's served at /api/openapi.json and the
// Swagger UI at /docs reads it, so you can test every route from the browser.
// tests/api.test.js checks that every route in routes/index.js shows up here.

const error = (example) => ({
  description: example,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
      example: { error: example },
    },
  },
});

const json = (schema, description = 'OK') => ({
  description,
  content: { 'application/json': { schema } },
});

const unauthorized = error('No token provided');
const serverError = error('Internal server error');

const idParam = {
  name: 'id',
  in: 'path',
  required: true,
  description: 'Task ID',
  schema: { type: 'integer', minimum: 1 },
};

const taskFields = {
  title: { type: 'string', maxLength: 200, example: 'Study for the SQL exam' },
  description: { type: 'string', nullable: true, example: 'Chapters 3 and 4' },
  priority: { type: 'string', enum: ['low', 'medium', 'high'], example: 'high' },
};

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Task API',
    version: '1.2.0',
    description:
      'Task REST API with JWT authentication. Create an account in **POST /auth/register** '
      + '(or log in), copy the `token`, click **Authorize** and paste it. After that the task routes work.',
  },
  servers: [{ url: '/api' }],
  tags: [
    { name: 'Auth', description: 'Accounts and login' },
    { name: 'Tasks', description: 'Each user only sees their own tasks' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'Ana Souza' },
          email: { type: 'string', format: 'email', example: 'ana@example.com' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/User' },
          token: { type: 'string', description: 'JWT to send in the Authorization header' },
        },
      },
      Task: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 7 },
          ...taskFields,
          completed: { type: 'boolean', example: false },
          user_id: { type: 'integer', example: 1 },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      NewTask: {
        type: 'object',
        required: ['title'],
        properties: { ...taskFields, priority: { ...taskFields.priority, default: 'medium' } },
      },
      TaskChanges: {
        type: 'object',
        description: 'Only the fields sent are changed. `description: null` clears the description.',
        properties: { ...taskFields, completed: { type: 'boolean', example: true } },
      },
    },
  },
  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Create an account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string', example: 'Ana Souza' },
                  email: { type: 'string', format: 'email', example: 'ana@example.com' },
                  password: { type: 'string', minLength: 6, example: 'secret123' },
                },
              },
            },
          },
        },
        responses: {
          201: json({ $ref: '#/components/schemas/AuthResponse' }, 'Account created, already logged in'),
          400: error('Password must have at least 6 characters'),
          409: error('Email already registered'),
          429: error('Too many attempts. Wait a few minutes and try again.'),
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in',
        description: 'Limited to 10 attempts every 15 minutes per IP.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'ana@example.com' },
                  password: { type: 'string', example: 'secret123' },
                },
              },
            },
          },
        },
        responses: {
          200: json({ $ref: '#/components/schemas/AuthResponse' }),
          401: error('Wrong email or password'),
          429: error('Too many attempts. Wait a few minutes and try again.'),
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'The logged in user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: json({ $ref: '#/components/schemas/User' }),
          401: unauthorized,
          404: error('User not found'),
        },
      },
    },
    '/tasks': {
      get: {
        tags: ['Tasks'],
        summary: 'List tasks, with filters, search, sorting and pages',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'completed', in: 'query', schema: { type: 'boolean' } },
          { name: 'priority', in: 'query', schema: { type: 'string', enum: ['low', 'medium', 'high'] } },
          { name: 'search', in: 'query', description: 'Looks in the title and description', schema: { type: 'string' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['recent', 'oldest', 'priority', 'title'], default: 'recent' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        ],
        responses: {
          200: json({
            type: 'object',
            properties: {
              total: { type: 'integer', example: 42 },
              page: { type: 'integer', example: 1 },
              limit: { type: 'integer', example: 20 },
              total_pages: { type: 'integer', example: 3 },
              tasks: { type: 'array', items: { $ref: '#/components/schemas/Task' } },
            },
          }),
          400: error('sort must be: recent, oldest, priority, title'),
          401: unauthorized,
          500: serverError,
        },
      },
      post: {
        tags: ['Tasks'],
        summary: 'Create a task',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/NewTask' } } },
        },
        responses: {
          201: json({ $ref: '#/components/schemas/Task' }, 'Task created'),
          400: error('Task title is required'),
          401: unauthorized,
          500: serverError,
        },
      },
    },
    '/tasks/summary': {
      get: {
        tags: ['Tasks'],
        summary: 'Task counts',
        security: [{ bearerAuth: [] }],
        responses: {
          200: json({
            type: 'object',
            properties: {
              total: { type: 'integer', example: 12 },
              completed: { type: 'integer', example: 5 },
              pending: { type: 'integer', example: 7 },
              pending_high: { type: 'integer', example: 2 },
            },
          }),
          401: unauthorized,
          500: serverError,
        },
      },
    },
    '/tasks/{id}': {
      get: {
        tags: ['Tasks'],
        summary: 'Get a task',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        responses: {
          200: json({ $ref: '#/components/schemas/Task' }),
          400: error('Invalid ID: must be a positive integer'),
          401: unauthorized,
          404: error('Task not found'),
        },
      },
      put: {
        tags: ['Tasks'],
        summary: 'Change a task (only the fields sent)',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskChanges' } } },
        },
        responses: {
          200: json({ $ref: '#/components/schemas/Task' }),
          400: error('completed must be true or false'),
          401: unauthorized,
          404: error('Task not found'),
        },
      },
      delete: {
        tags: ['Tasks'],
        summary: 'Delete a task',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        responses: {
          204: { description: 'Deleted' },
          401: unauthorized,
          404: error('Task not found'),
        },
      },
    },
  },
};
