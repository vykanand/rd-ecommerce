const express = require('express');
const router = express.Router();
const dataManager = require('../lib/data-manager');

// List all collections (for Admin/Docs)
router.get('/', (req, res) => {
    res.json(dataManager.listCollections());
});

// Get Schema for a collection
router.get('/:collection/schema', (req, res) => {
    const { collection } = req.params;
    const schema = dataManager.getSchema(collection);
    if (!schema) {
        return res.status(404).json({ error: 'Collection not found' });
    }
    res.json(schema);
});

// Generic CRUD Routes

// GET All
router.get('/:collection', (req, res) => {
    const { collection } = req.params;
    // Check if collection exists in schema
    if (!dataManager.getSchema(collection)) {
        return res.status(404).json({ error: 'Collection not found' });
    }
    const items = dataManager.getAll(collection);
    res.json(items);
});

// GET One
router.get('/:collection/:id', (req, res) => {
    const { collection, id } = req.params;
    if (!dataManager.getSchema(collection)) {
        return res.status(404).json({ error: 'Collection not found' });
    }
    const item = dataManager.getById(collection, id);
    if (!item) {
        return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
});

// POST Create
router.post('/:collection', (req, res) => {
    const { collection } = req.params;
    if (!dataManager.getSchema(collection)) {
        return res.status(404).json({ error: 'Collection not found' });
    }
    const newItem = dataManager.create(collection, req.body);
    res.status(201).json(newItem);
});

// PUT Update
router.put('/:collection/:id', (req, res) => {
    const { collection, id } = req.params;
    if (!dataManager.getSchema(collection)) {
        return res.status(404).json({ error: 'Collection not found' });
    }
    const updatedItem = dataManager.update(collection, id, req.body);
    if (!updatedItem) {
        return res.status(404).json({ error: 'Item not found' });
    }
    res.json(updatedItem);
});

// DELETE
router.delete('/:collection/:id', (req, res) => {
    const { collection, id } = req.params;
    if (!dataManager.getSchema(collection)) {
        return res.status(404).json({ error: 'Collection not found' });
    }
    const success = dataManager.delete(collection, id);
    if (!success) {
        return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ success: true });
});

module.exports = router;
