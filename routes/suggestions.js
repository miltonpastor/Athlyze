const express = require('express');
const db = require('../db/database');

const router = express.Router();

// Middleware para verificar autenticación
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

// Listar todas las sugerencias
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const tipo = req.query.tipo || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE user_id = $1';
        let params = [userId];
        let paramCount = 1;

        if (tipo) {
            paramCount++;
            whereClause += ` AND tipo = $${paramCount}`;
            params.push(tipo);
        }

        // Obtener total de sugerencias
        const countResult = await db.query(
            `SELECT COUNT(*) FROM suggestions ${whereClause}`,
            params
        );
        const totalSuggestions = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalSuggestions / limit);

        // Obtener sugerencias paginadas
        const suggestionsResult = await db.query(`
            SELECT id, texto, fecha, tipo, leida
            FROM suggestions ${whereClause}
            ORDER BY fecha DESC
            LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `, [...params, limit, offset]);

        // Marcar como leídas las sugerencias mostradas
        if (suggestionsResult.rows.length > 0) {
            const suggestionIds = suggestionsResult.rows.map(s => s.id);
            await db.query(
                'UPDATE suggestions SET leida = true WHERE id = ANY($1)',
                [suggestionIds]
            );
        }

        // Obtener estadísticas de sugerencias
        const statsResult = await db.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN leida = false THEN 1 END) as no_leidas,
                COUNT(CASE WHEN tipo = 'ejercicio' THEN 1 END) as ejercicio,
                COUNT(CASE WHEN tipo = 'nutricion' THEN 1 END) as nutricion,
                COUNT(CASE WHEN tipo = 'medidas' THEN 1 END) as medidas,
                COUNT(CASE WHEN tipo = 'general' THEN 1 END) as general
            FROM suggestions 
            WHERE user_id = $1
        `, [userId]);

        res.render('suggestions/index', {
            title: 'Consejos y Sugerencias - Athlyze',
            suggestions: suggestionsResult.rows.map(s => ({ ...s, leida: true })), // Marcar como leídas para la vista
            stats: statsResult.rows[0],
            currentPage: page,
            totalPages,
            totalSuggestions,
            filters: { tipo },
            user: req.session.user
        });
    } catch (error) {
        console.error('Error al obtener sugerencias:', error);
        res.status(500).render('500', {
            title: 'Error del servidor',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

// Generar nueva sugerencia personalizada
router.post('/generate', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;

        // Analizar patrones recientes del usuario
        const recentActivitiesResult = await db.query(`
            SELECT tipo, descripcion, fecha, calorias, medidas
            FROM activities 
            WHERE user_id = $1 AND fecha >= CURRENT_DATE - INTERVAL '14 days'
            ORDER BY fecha DESC
        `, [userId]);

        const activities = recentActivitiesResult.rows;

        if (activities.length === 0) {
            await db.query(
                'INSERT INTO suggestions (user_id, texto, tipo) VALUES ($1, $2, $3)',
                [userId, 'Comienza registrando algunas actividades para recibir consejos personalizados basados en tus patrones de ejercicio y alimentación.', 'general']
            );
        } else {
            const suggestions = await analyzeAndGenerateSuggestions(activities);

            // Insertar nuevas sugerencias
            for (const suggestion of suggestions) {
                await db.query(
                    'INSERT INTO suggestions (user_id, texto, tipo) VALUES ($1, $2, $3)',
                    [userId, suggestion.text, suggestion.type]
                );
            }
        }

        req.session.message = 'Nuevos consejos generados exitosamente';
        res.redirect('/suggestions');
    } catch (error) {
        console.error('Error al generar sugerencias:', error);
        req.session.error = 'Error al generar nuevos consejos';
        res.redirect('/suggestions');
    }
});

// Marcar sugerencia como no leída
router.post('/:id/unread', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const suggestionId = req.params.id;

        await db.query(
            'UPDATE suggestions SET leida = false WHERE id = $1 AND user_id = $2',
            [suggestionId, userId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error al marcar sugerencia como no leída:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Eliminar sugerencia
router.post('/:id/delete', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const suggestionId = req.params.id;

        const result = await db.query(
            'DELETE FROM suggestions WHERE id = $1 AND user_id = $2',
            [suggestionId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Sugerencia no encontrada' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error al eliminar sugerencia:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Función para analizar actividades y generar sugerencias inteligentes
async function analyzeAndGenerateSuggestions(activities) {
    const suggestions = [];

    // Análizar frecuencia de ejercicios
    const exerciseActivities = activities.filter(a => a.tipo === 'ejercicio');
    const nutritionActivities = activities.filter(a => a.tipo === 'alimentacion');
    const measurementActivities = activities.filter(a => a.tipo === 'medidas');

    // Sugerencias de ejercicio
    if (exerciseActivities.length === 0) {
        suggestions.push({
            text: 'No has registrado ejercicios en las últimas 2 semanas. ¡Es hora de mover el cuerpo! Comienza con 20-30 minutos de caminata diaria.',
            type: 'ejercicio'
        });
    } else if (exerciseActivities.length < 3) {
        suggestions.push({
            text: 'Has hecho ejercicio pocas veces en las últimas 2 semanas. Trata de ejercitarte al menos 3 veces por semana para mejores resultados.',
            type: 'ejercicio'
        });
    } else {
        // Analizar variedad de ejercicios
        const uniqueExercises = new Set(exerciseActivities.map(a => a.descripcion.toLowerCase()));
        if (uniqueExercises.size === 1) {
            suggestions.push({
                text: 'Excelente constancia con el ejercicio. Para mejores resultados, intenta variar tu rutina incluyendo diferentes tipos de ejercicios.',
                type: 'ejercicio'
            });
        } else {
            suggestions.push({
                text: '¡Fantástico! Mantienes una rutina de ejercicio variada y consistente. Recuerda incluir días de descanso para la recuperación.',
                type: 'ejercicio'
            });
        }
    }

    // Sugerencias nutricionales
    if (nutritionActivities.length === 0) {
        suggestions.push({
            text: 'No has registrado comidas recientemente. Llevar un registro de tu alimentación te ayudará a identificar patrones y mejorar tu nutrición.',
            type: 'nutricion'
        });
    } else {
        const totalCalories = nutritionActivities
            .filter(a => a.calorias)
            .reduce((sum, a) => sum + a.calorias, 0);
        const avgDailyCalories = totalCalories / 14; // promedio diario

        if (avgDailyCalories > 2500) {
            suggestions.push({
                text: 'Tu consumo calórico promedio es alto. Considera incluir más verduras y proteínas magras, y reducir alimentos procesados.',
                type: 'nutricion'
            });
        } else if (avgDailyCalories < 1200 && avgDailyCalories > 0) {
            suggestions.push({
                text: 'Tu consumo calórico parece bajo. Asegúrate de comer lo suficiente para mantener tu energía y salud. Consulta con un nutricionista si tienes dudas.',
                type: 'nutricion'
            });
        } else if (avgDailyCalories > 0) {
            suggestions.push({
                text: 'Buen trabajo registrando tus comidas. Mantén un equilibrio entre proteínas, carbohidratos y grasas saludables.',
                type: 'nutricion'
            });
        }
    }

    // Sugerencias de medidas
    if (measurementActivities.length === 0) {
        suggestions.push({
            text: 'Registrar tus medidas corporales regularmente te ayudará a monitorear tu progreso más efectivamente que solo el peso.',
            type: 'medidas'
        });
    } else {
        suggestions.push({
            text: '¡Excelente! Estás monitoreando tus medidas. Recuerda que los cambios corporales toman tiempo, sé consistente y paciente.',
            type: 'medidas'
        });
    }

    // Sugerencia general basada en actividad total
    const totalActivities = activities.length;
    if (totalActivities >= 20) {
        suggestions.push({
            text: '¡Increíble compromiso! Has registrado muchas actividades. Mantén esta constancia y verás resultados sorprendentes.',
            type: 'general'
        });
    } else if (totalActivities >= 10) {
        suggestions.push({
            text: 'Vas por buen camino con tu registro de actividades. La constancia es clave para alcanzar tus objetivos de salud.',
            type: 'general'
        });
    }

    return suggestions;
}

module.exports = router;
