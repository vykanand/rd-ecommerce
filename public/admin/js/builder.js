const API_URL = '/api';
let currentPageId = null;
let currentSchemaName = null;
let pages = [];
let collections = [];

document.addEventListener('DOMContentLoaded', () => {
    loadInitialData();
    
    // Auto-refresh preview on code change (debounced)
    let timeout;
    document.getElementById('code-textarea').addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            updatePreview(e.target.value);
        }, 1000);
    });
});

async function loadInitialData() {
    await Promise.all([loadPages(), loadCollections()]);
}

async function loadPages() {
    const res = await fetch(`${API_URL}/pages`); // Assuming we can fetch all pages from 'pages' collection
    // Wait, our generic API is /api/:collection. So /api/pages
    pages = await res.json();
    renderPagesList();
}

async function loadCollections() {
    const res = await fetch(`${API_URL}/`);
    collections = await res.json();
    renderCollectionsList();
    
    // Populate modal select
    const select = document.getElementById('newPageSource');
    select.innerHTML = '<option value="">No Data Source</option>';
    collections.forEach(c => {
        select.innerHTML += `<option value="${c}">${c}</option>`;
    });
}

function renderPagesList() {
    const list = document.getElementById('pages-list');
    list.innerHTML = '';
    pages.forEach(page => {
        const div = document.createElement('div');
        div.className = `list-item ${currentPageId === page.id ? 'active' : ''}`;
        div.textContent = page.title || page.id;
        div.onclick = () => selectPage(page);
        list.appendChild(div);
    });
}

function renderCollectionsList() {
    const list = document.getElementById('collections-list');
    list.innerHTML = '';
    collections.forEach(c => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.textContent = c;
        // div.onclick = () => selectCollection(c); // TODO: Implement Schema Editor
        list.appendChild(div);
    });
}

async function selectPage(page) {
    currentPageId = page.id;
    currentSchemaName = null;
    document.getElementById('active-resource-name').textContent = `Editing Page: ${page.title}`;
    renderPagesList(); // Update active state
    
    // Load Template Content
    // If page has templateContent, use it.
    // If page has templateId, fetch template.
    // If page has template (filename), we can't easily edit it unless we fetch it via a new API endpoint.
    // For this MVP, we'll assume we want to convert file-templates to DB-templates on first edit, 
    // OR we just fetch the rendered page source? No, we need the template source.
    
    // Let's try to fetch the page config again to be sure
    const res = await fetch(`${API_URL}/pages/${page.id}`);
    const pageConfig = await res.json();
    
    let content = '';
    if (pageConfig.templateContent) {
        content = pageConfig.templateContent;
    } else if (pageConfig.templateId) {
        const tRes = await fetch(`${API_URL}/templates/${pageConfig.templateId}`);
        const t = await tRes.json();
        content = t.content;
    } else {
        content = `<!-- This page uses a file-based template (${pageConfig.template}). \nSave to convert to an editable DB template. -->\n<h1>${page.title}</h1>`;
    }
    
    document.getElementById('code-textarea').value = content;
    updatePreview(content);
    
    // Update Preview Link
    document.getElementById('preview-link').href = `/pages/${page.id}`;
}

function updatePreview(content) {
    // We want to render the preview with actual data if possible.
    // But the preview iframe is just an iframe.
    // We can write to the iframe document.
    // However, the template tags {{}} won't be processed by the browser.
    // We need to simulate the server-side render or just show the raw template?
    // Ideally, we POST the content to a "render-preview" endpoint.
    // Let's try to implement a quick client-side render for preview if we have the data.
    
    // For now, just writing the raw HTML is better than nothing, but won't show data.
    // Let's try to be smarter: fetch the data for the page and do a client-side replace.
    
    const frame = document.getElementById('preview-frame');
    const doc = frame.contentDocument || frame.contentWindow.document;
    doc.open();
    doc.write(content); // Raw template for now
    doc.close();
}

async function saveCurrentWork() {
    if (!currentPageId) return alert('No page selected');
    
    const content = document.getElementById('code-textarea').value;
    
    // Update page config to have templateContent
    // We are moving away from file-based to DB-based "on the fly"
    
    const update = {
        templateContent: content,
        // If it was file-based, we override it now.
        // We should probably clear 'template' and 'templateId' to avoid confusion, 
        // but our router prioritizes templateContent.
    };
    
    try {
        const res = await fetch(`${API_URL}/pages/${currentPageId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(update)
        });
        
        if (res.ok) {
            alert('Saved successfully!');
            loadPages(); // Refresh
        } else {
            alert('Error saving');
        }
    } catch (e) {
        console.error(e);
        alert('Error saving');
    }
}

// Modals
function showAddPageModal() {
    document.getElementById('addPageModal').style.display = 'block';
}

function showAddCollectionModal() {
    document.getElementById('addCollectionModal').style.display = 'block';
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
}

async function createPage() {
    const id = document.getElementById('newPageId').value;
    const title = document.getElementById('newPageTitle').value;
    const source = document.getElementById('newPageSource').value;
    
    if (!id) return alert('ID required');
    
    const newPage = {
        id,
        title,
        dataSource: source,
        templateContent: `<h1>${title}</h1>\n<p>Start editing...</p>`
    };
    
    await fetch(`${API_URL}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPage)
    });
    
    closeModals();
    loadPages();
}

async function createCollection() {
    const name = document.getElementById('newCollectionName').value;
    if (!name) return alert('Name required');

    try {
        const res = await fetch('/admin-api/schemas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        
        if (res.ok) {
            alert('Collection created!');
            closeModals();
            loadCollections();
        } else {
            alert('Error creating collection');
        }
    } catch (e) {
        console.error(e);
        alert('Error creating collection');
    }
}

function insertPlaceholder() {
    insertAtCursor('{{variable}}');
}

function insertComponent(type) {
    let snippet = '';
    if (type === 'hero') {
        snippet = `
<div style="padding: 50px; background: #f4f4f4; text-align: center;">
    <h1>Hero Title</h1>
    <p>Welcome to our amazing website.</p>
    <button>Learn More</button>
</div>`;
    } else if (type === 'card') {
        snippet = `
<div class="card">
    <h3>Card Title</h3>
    <p>Some content here.</p>
</div>`;
    }
    insertAtCursor(snippet);
}

function insertAtCursor(text) {
    const textarea = document.getElementById('code-textarea');
    const cursor = textarea.selectionStart;
    const currentVal = textarea.value;
    const newText = currentVal.slice(0, cursor) + text + currentVal.slice(cursor);
    textarea.value = newText;
    updatePreview(newText);
}
