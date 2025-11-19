const express = require('express');
const router = express.Router();
const dataManager = require('../lib/data-manager');
const templateEngine = require('../lib/template-engine');
const path = require('path');
const fs = require('fs');

// Page Configuration Structure (stored in 'pages' collection):
// {
//   "id": "menu_list",
//   "template": "menu-list.html",
//   "dataSource": "menu_items", // Collection to fetch data from
//   "dataKey": "items", // Key to inject data into (e.g. {{#each items}})
//   "title": "Our Menu"
// }

router.get('/:pageId', (req, res) => {
    const { pageId } = req.params;
    
    // 1. Get Page Config
    // We assume there is a 'pages' collection. If not, we might need to bootstrap it.
    const pageConfig = dataManager.getById('pages', pageId);
    
    if (!pageConfig) {
        console.warn(`[Page] Page ID not found: ${pageId}`);
        return res.status(404).send('Page Configuration Not Found');
    }
    console.log(`[Page] Serving page: ${pageId}`, pageConfig);

    // 2. Fetch Data
    let context = { ...pageConfig }; // Start with config data (title, etc.)
    
    if (pageConfig.dataSource) {
        console.log(`[Page] Fetching data from source: ${pageConfig.dataSource}`);
        // Check if we need a specific item
        if (req.query.id) {
             const item = dataManager.getById(pageConfig.dataSource, req.query.id);
             if (item) {
                 console.log(`[Page] Found specific item: ${req.query.id}`);
                 // Merge item properties into context
                 Object.assign(context, item);
             } else {
                 console.warn(`[Page] Item not found: ${req.query.id} in ${pageConfig.dataSource}`);
             }
        } else {
            // Fetch all items
            const data = dataManager.getAll(pageConfig.dataSource);
            console.log(`[Page] Fetched ${data ? data.length : 0} items`);
            const key = pageConfig.dataKey || 'items';
            context[key] = data;
        }
    }

    // 3. Render Template
    try {
        let html;
        // Check for DB-stored template (by ID or direct content)
        if (pageConfig.templateId) {
            console.log(`[Page] Using template ID: ${pageConfig.templateId}`);
            const templateObj = dataManager.getById('templates', pageConfig.templateId);
            if (templateObj && templateObj.content) {
                html = templateEngine.renderString(templateObj.content, context);
            } else {
                console.error(`[Page] Template ID ${pageConfig.templateId} not found`);
                html = `Error: Template ID ${pageConfig.templateId} not found`;
            }
        } else if (pageConfig.templateContent) {
            console.log(`[Page] Using direct template content`);
            // Direct content in page config (useful for one-off pages)
            html = templateEngine.renderString(pageConfig.templateContent, context);
        } else {
            console.log(`[Page] Using file template: ${pageConfig.template}`);
            // Fallback to file-based template
            html = templateEngine.render(pageConfig.template, context);
        }
        res.send(html);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error rendering page');
    }
});

module.exports = router;
