const express = require('express');
const router = express.Router();
const dataManager = require('../lib/data-manager');

// In a real low-code platform, actions would be defined in a DB/file with logic.
// For this MVP, we'll support a few hardcoded "universal" actions or simple data manipulations
// that can be defined via a JSON config in the future.
// Currently, we'll implement a generic "create_related" action as a proof of concept.

// Example Action Definition (Conceptual):
// {
//   "action": "create_order",
//   "collection": "orders",
//   "fields": ["item_id", "qty", "user_id"]
// }

router.post('/:action', (req, res) => {
    const { action } = req.params;
    const payload = req.body;

    // 1. Look up action definition (Mocked for now)
    // In a full version, we would read from `actions.json`
    
    console.log(`Executing action: ${action} with payload:`, payload);

    // Simple pass-through logic for demonstration
    // If action matches a collection name, we treat it as a create
    if (dataManager.getSchema(action)) {
         const newItem = dataManager.create(action, payload);
         return res.status(201).json({ success: true, result: newItem });
    }

    // Custom Logic Hooks (Hardcoded for demo purposes if needed, or just return success)
    res.json({ success: true, message: `Action ${action} executed`, data: payload });
});

module.exports = router;
