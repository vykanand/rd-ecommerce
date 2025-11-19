const fs = require('fs');
const path = require('path');

class TemplateEngine {
    constructor(templatesDir) {
        this.templatesDir = templatesDir;
    }

    render(templateName, data) {
        const templatePath = path.join(this.templatesDir, templateName);
        if (!fs.existsSync(templatePath)) {
            return `Error: Template ${templateName} not found`;
        }
        const template = fs.readFileSync(templatePath, 'utf8');
        return this.processTemplate(template, data);
    }

    renderString(templateContent, data) {
        return this.processTemplate(templateContent, data);
    }

    processTemplate(template, data) {

        // 1. Handle Loops: {{#each items}} ... {{/each}}
        // Regex to capture the content between {{#each key}} and {{/each}}
        const loopRegex = /{{#each\s+([a-zA-Z0-9_]+)}}([\s\S]*?){{\/each}}/g;
        
        template = template.replace(loopRegex, (match, key, content) => {
            const items = data[key];
            if (!Array.isArray(items)) return '';
            
            return items.map(item => {
                // Replace variables inside the loop
                let itemHtml = content;
                // Handle {{this}} for array of primitives
                if (typeof item !== 'object') {
                     itemHtml = itemHtml.replace(/{{this}}/g, item);
                } else {
                    // Handle {{field}} for array of objects
                    for (const prop in item) {
                        const val = item[prop] !== undefined ? item[prop] : '';
                        const propRegex = new RegExp(`{{${prop}}}`, 'g');
                        itemHtml = itemHtml.replace(propRegex, val);
                    }
                }
                return itemHtml;
            }).join('');
        });

        // 2. Handle Conditionals: {{#if field}} ... {{/if}}
        const ifRegex = /{{#if\s+([a-zA-Z0-9_]+)}}([\s\S]*?){{\/if}}/g;
        template = template.replace(ifRegex, (match, key, content) => {
            if (data[key]) {
                return content;
            }
            return '';
        });

        // 3. Handle Simple Variables: {{field}}
        // We do this last to avoid replacing variables inside loops before they are processed (though our loop logic handles its own scope)
        // But for top-level variables:
        for (const key in data) {
            if (typeof data[key] !== 'object') {
                const val = data[key] !== undefined ? data[key] : '';
                const varRegex = new RegExp(`{{${key}}}`, 'g');
                template = template.replace(varRegex, val);
            }
        }

        return template;
    }
}

module.exports = new TemplateEngine(path.join(__dirname, '../templates'));
