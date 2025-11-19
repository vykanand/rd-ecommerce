const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const SCHEMAS_FILE = path.join(DATA_DIR, 'schemas.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize schemas file if not exists
if (!fs.existsSync(SCHEMAS_FILE)) {
    fs.writeFileSync(SCHEMAS_FILE, JSON.stringify({}, null, 2));
}

class DataManager {
    constructor() {
        this.schemas = this.loadSchemas();
    }

    loadSchemas() {
        try {
            const data = fs.readFileSync(SCHEMAS_FILE, 'utf8');
            return JSON.parse(data);
        } catch (err) {
            console.error("Error loading schemas:", err);
            return {};
        }
    }

    saveSchemas(schemas) {
        this.schemas = schemas;
        fs.writeFileSync(SCHEMAS_FILE, JSON.stringify(schemas, null, 2));
    }

    getCollectionPath(collectionName) {
        return path.join(DATA_DIR, `${collectionName}.json`);
    }

    getCollectionData(collectionName) {
        const filePath = this.getCollectionPath(collectionName);
        if (!fs.existsSync(filePath)) {
            return [];
        }
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        } catch (err) {
            console.error(`Error loading collection ${collectionName}:`, err);
            return [];
        }
    }

    saveCollectionData(collectionName, data) {
        const filePath = this.getCollectionPath(collectionName);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }

    // CRUD Operations

    getAll(collectionName) {
        return this.getCollectionData(collectionName);
    }

    getById(collectionName, id) {
        const items = this.getCollectionData(collectionName);
        return items.find(item => item.id === id);
    }

    create(collectionName, item) {
        const items = this.getCollectionData(collectionName);
        const newItem = { id: Date.now().toString(), ...item }; // Simple ID generation
        items.push(newItem);
        this.saveCollectionData(collectionName, items);
        return newItem;
    }

    update(collectionName, id, updates) {
        const items = this.getCollectionData(collectionName);
        const index = items.findIndex(item => item.id === id);
        if (index === -1) return null;
        
        items[index] = { ...items[index], ...updates };
        this.saveCollectionData(collectionName, items);
        return items[index];
    }

    delete(collectionName, id) {
        let items = this.getCollectionData(collectionName);
        const initialLength = items.length;
        items = items.filter(item => item.id !== id);
        if (items.length === initialLength) return false;
        
        this.saveCollectionData(collectionName, items);
        return true;
    }

    // Schema Management
    createCollection(name, schema) {
        if (this.schemas[name]) {
            throw new Error(`Collection ${name} already exists`);
        }
        this.schemas[name] = schema;
        this.saveSchemas(this.schemas);
        this.saveCollectionData(name, []); // Initialize empty data file
        return this.schemas[name];
    }
    
    getSchema(name) {
        return this.schemas[name];
    }
    
    listCollections() {
        return Object.keys(this.schemas);
    }
}

module.exports = new DataManager();
