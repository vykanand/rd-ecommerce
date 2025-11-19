// Universal Client-Side Runtime
// This script can be included in templates to handle dynamic actions like "Add to Cart"

document.addEventListener('DOMContentLoaded', () => {
    console.log('Universal App Runtime Loaded');

    // Handle Forms with data-action attribute
    // <form data-action="create_order" data-redirect="/pages/thank-you">
    document.querySelectorAll('form[data-action]').forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const action = form.dataset.action;
            const redirect = form.dataset.redirect;
            
            // Collect form data
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            try {
                const res = await fetch(`/actions/${action}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await res.json();
                if (result.success) {
                    if (redirect) {
                        window.location.href = redirect;
                    } else {
                        alert('Action completed successfully');
                        form.reset();
                    }
                } else {
                    alert('Action failed: ' + (result.message || 'Unknown error'));
                }
            } catch (err) {
                console.error(err);
                alert('Error executing action');
            }
        });
    });
});
