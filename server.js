// Global error handlers to catch silent crashes
process.on('uncaughtException', (error) => {
    console.error('UNCAUGHT EXCEPTION:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
    process.exit(1);
});

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Logging Middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Routes - wrapped in try-catch to catch loading errors
try {
    const apiRoutes = require('./routes/api');
    app.use('/api', apiRoutes);
} catch (err) {
    console.error('Error loading API routes:', err);
    throw err;
}

try {
    const actionsRoutes = require('./routes/actions');
    app.use('/actions', actionsRoutes);
} catch (err) {
    console.error('Error loading actions routes:', err);
    throw err;
}

try {
    const pagesRoutes = require('./routes/pages');
    app.use('/pages', pagesRoutes);
} catch (err) {
    console.error('Error loading pages routes:', err);
    throw err;
}

try {
    const adminRoutes = require('./routes/admin');
    app.use('/admin-api', adminRoutes);
} catch (err) {
    console.error('Error loading admin routes:', err);
    throw err;
}

// Default route
app.get('/', (req, res) => {
    res.send('Universal App Builder Engine Running');
});

// Error handling middleware (must be last)
app.use((err, req, res, next) => {
    console.error('Express error handler:', err);
    res.status(500).json({ 
        error: 'Internal server error', 
        message: err.message 
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
}).on('error', (err) => {
    console.error('Server failed to start:', err);
    process.exit(1);
});
