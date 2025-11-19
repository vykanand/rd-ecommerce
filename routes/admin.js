const express = require('express');
const router = express.Router();
const dataManager = require('../lib/data-manager');

// Get all schemas
router.get('/schemas', (req, res) => {
    res.json(dataManager.schemas);
});

// Create/Update Schema (Collection)
router.post('/schemas', (req, res) => {
    const { name, schema } = req.body;
    
    if (!name) return res.status(400).json({ error: 'Collection name required' });
    
    // Default schema if none provided
    const newSchema = schema || {
        "name": "text"
    };

    try {
        // If collection exists, we are updating it (adding fields etc.)
        // For now, simple overwrite or create
        dataManager.schemas[name] = newSchema;
        dataManager.saveSchemas(dataManager.schemas);
        
        // Ensure data file exists
        if (!dataManager.getCollectionData(name)) {
            dataManager.saveCollectionData(name, []);
        }
        
        res.json({ success: true, schema: newSchema });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
