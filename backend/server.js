const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Basic health check route
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Server is running' });
});

// Import routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/streets', require('./routes/streets.routes'));
app.use('/api/demarcations', require('./routes/demarcations.routes'));
app.use('/api/notifications', require('./routes/notifications.routes'));
app.use('/api/deliveries', require('./routes/deliveries.routes'));
app.use('/api/receipts', require('./routes/receipts.routes'));
app.use('/api/users', require('./routes/users.routes'));
app.use('/api/stats', require('./routes/stats.routes'));

// Global error handler
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
};
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
