/**
 * Nutrition Redirect Helper
 * Maneja la redirección inteligente del enlace de nutrición desde el frontend
 */

// Función para verificar si el usuario tiene un plan nutricional
async function checkNutritionPlan() {
    try {
        const response = await fetch('/api/nutrition/has-plan', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            return data.hasPlans;
        }

        return false;
    } catch (error) {
        console.error('Error checking nutrition plan:', error);
        return false;
    }
}

// Función para manejar el clic en el enlace de nutrición
async function handleNutritionClick(event) {
    event.preventDefault();

    const hasPlan = await checkNutritionPlan();

    if (hasPlan) {
        window.location.href = '/nutrition/plan';
    } else {
        window.location.href = '/nutrition/setup';
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function () {
    // Buscar todos los enlaces de nutrición
    const nutritionLinks = document.querySelectorAll('a[href="/nutrition"], a[href="/nutrition/"]');

    // Agregar el event listener a cada enlace
    nutritionLinks.forEach(link => {
        link.addEventListener('click', handleNutritionClick);
    });
});
