const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const { pool, testDbConnection } = require('./config/db');
const memberRoutes = require('./routes/memberRoutes');
const borrowRoutes = require('./routes/borrowRoutes');

const app = express();
const PORT = process.env.PORT || 8002;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Health check endpoint
app.get('/health', async (req, res) => {
  let dbStatus = 'healthy';
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    dbStatus = `unhealthy: ${err.message}`;
  }

  res.json({
    service: 'member-borrow-service',
    status: dbStatus === 'healthy' ? 'up' : 'degraded',
    database: {
      type: 'MySQL',
      host: process.env.DB_HOST || 'mysql-db',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      status: dbStatus
    }
  });
});

// API Routes
app.use('/members', memberRoutes);
app.use('/borrowings', borrowRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', message: `Route ${req.originalUrl} does not exist.` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// Start Server after ensuring DB readiness
async function startServer() {
  await testDbConnection(12, 3000);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Member & Borrowing Microservice running on port ${PORT}`);
  });
}

startServer();
