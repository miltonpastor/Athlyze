// Athlyze Custom JavaScript

document.addEventListener('DOMContentLoaded', function () {
    // Initialize tooltips
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Initialize popovers
    var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });

    // Auto-hide alerts after 5 seconds
    setTimeout(function () {
        const alerts = document.querySelectorAll('.alert-dismissible');
        alerts.forEach(function (alert) {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        });
    }, 5000);

    // Loading state for forms
    const forms = document.querySelectorAll('form');
    forms.forEach(function (form) {
        form.addEventListener('submit', function () {
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="spinner me-2"></span>Enviando...';
            }
        });
    });

    // Confirm delete actions
    const deleteButtons = document.querySelectorAll('[data-confirm-delete]');
    deleteButtons.forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            if (!confirm('¿Estás seguro de que quieres eliminar este elemento?')) {
                e.preventDefault();
            }
        });
    });

    // Activity type selector dynamic fields
    const activityTypeSelect = document.getElementById('tipo');
    if (activityTypeSelect) {
        activityTypeSelect.addEventListener('change', function () {
            showRelevantFields(this.value);
        });
    }

    function showRelevantFields(type) {
        // Hide all dynamic fields first
        const dynamicFields = document.querySelectorAll('.dynamic-field');
        dynamicFields.forEach(function (field) {
            field.style.display = 'none';
        });

        // Show relevant fields based on type
        const relevantFields = document.querySelectorAll('.dynamic-field.' + type);
        relevantFields.forEach(function (field) {
            field.style.display = 'block';
        });
    }

    // Chart color schemes
    window.chartColors = {
        primary: '#0d6efd',
        success: '#198754',
        warning: '#ffc107',
        danger: '#dc3545',
        info: '#0dcaf0',
        light: '#f8f9fa',
        dark: '#212529'
    };

    // Format numbers for display
    window.formatNumber = function (num) {
        return new Intl.NumberFormat('es-ES').format(num);
    };

    // Format date for display
    window.formatDate = function (dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // Calculate BMI
    window.calculateBMI = function (weight, height) {
        const heightInMeters = height / 100;
        return (weight / (heightInMeters * heightInMeters)).toFixed(1);
    };

    // Get BMI category
    window.getBMICategory = function (bmi) {
        if (bmi < 18.5) return { category: 'Bajo peso', class: 'text-info' };
        if (bmi < 25) return { category: 'Normal', class: 'text-success' };
        if (bmi < 30) return { category: 'Sobrepeso', class: 'text-warning' };
        return { category: 'Obesidad', class: 'text-danger' };
    };

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Copy to clipboard functionality
    window.copyToClipboard = function (text) {
        navigator.clipboard.writeText(text).then(function () {
            // Show toast or alert
            showToast('Copiado al portapapeles', 'success');
        });
    };

    // Show toast notification
    window.showToast = function (message, type = 'info') {
        const toastContainer = document.getElementById('toast-container') || createToastContainer();

        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type} border-0`;
        toast.setAttribute('role', 'alert');

        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;

        toastContainer.appendChild(toast);

        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();

        // Remove toast element after it's hidden
        toast.addEventListener('hidden.bs.toast', function () {
            toast.remove();
        });
    };

    function createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        container.style.zIndex = '1080';
        document.body.appendChild(container);
        return container;
    }

    // Local storage helpers
    window.storage = {
        set: function (key, value) {
            localStorage.setItem('athlyze_' + key, JSON.stringify(value));
        },
        get: function (key) {
            const item = localStorage.getItem('athlyze_' + key);
            return item ? JSON.parse(item) : null;
        },
        remove: function (key) {
            localStorage.removeItem('athlyze_' + key);
        }
    };

    // Theme toggle functionality (for future use)
    window.toggleTheme = function () {
        const currentTheme = document.documentElement.getAttribute('data-bs-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-bs-theme', newTheme);
        storage.set('theme', newTheme);
    };

    // Load saved theme
    const savedTheme = storage.get('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-bs-theme', savedTheme);
    }

    // Activity filter functionality
    const filterForm = document.getElementById('filter-form');
    if (filterForm) {
        filterForm.addEventListener('change', function () {
            this.submit();
        });
    }

    // Auto-resize textareas
    const textareas = document.querySelectorAll('textarea[data-auto-resize]');
    textareas.forEach(function (textarea) {
        textarea.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });
    });

    // Form validation improvements
    const forms2 = document.querySelectorAll('.needs-validation');
    forms2.forEach(function (form) {
        form.addEventListener('submit', function (event) {
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();

                // Focus on first invalid field
                const firstInvalid = form.querySelector(':invalid');
                if (firstInvalid) {
                    firstInvalid.focus();
                }
            }

            form.classList.add('was-validated');
        });
    });

    // Lazy loading for images
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver(function (entries, observer) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    imageObserver.unobserve(img);
                }
            });
        });

        document.querySelectorAll('img[data-src]').forEach(function (img) {
            imageObserver.observe(img);
        });
    }

    // Print functionality
    window.printReport = function () {
        window.print();
    };

    // Export functionality (CSV)
    window.exportToCSV = function (data, filename) {
        const csv = convertArrayOfObjectsToCSV(data);
        downloadCSV(csv, filename);
    };

    function convertArrayOfObjectsToCSV(data) {
        if (!data || !data.length) return '';

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => JSON.stringify(row[header] || '')).join(','))
        ].join('\n');

        return csvContent;
    }

    function downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');

        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    console.log('🏃‍♂️ Athlyze app initialized successfully!');
});
