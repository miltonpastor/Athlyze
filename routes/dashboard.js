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

// Dashboard principal
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;

        // Obtener estadísticas generales
        const statsResult = await db.query(`
            SELECT 
                COUNT(*) as total_actividades,
                COUNT(CASE WHEN tipo = 'ejercicio' THEN 1 END) as ejercicios,
                COUNT(CASE WHEN tipo = 'alimentacion' THEN 1 END) as comidas,
                COUNT(CASE WHEN tipo = 'medidas' THEN 1 END) as medidas,
                COUNT(CASE WHEN fecha >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as esta_semana
            FROM activities 
            WHERE user_id = $1
        `, [userId]);

        // Obtener actividades recientes
        const recentActivitiesResult = await db.query(`
            SELECT id, tipo, descripcion, fecha, calorias 
            FROM activities 
            WHERE user_id = $1 
            ORDER BY fecha DESC, fecha_registro DESC 
            LIMIT 5
        `, [userId]);

        // Obtener sugerencias no leídas
        const suggestionsResult = await db.query(`
            SELECT id, texto, fecha, tipo
            FROM suggestions 
            WHERE user_id = $1 AND leida = false 
            ORDER BY fecha DESC 
            LIMIT 3
        `, [userId]);

        // Obtener datos para gráfico de actividades por día (últimos 7 días)
        const chartDataResult = await db.query(`
            SELECT 
                fecha,
                COUNT(*) as total_actividades,
                COUNT(CASE WHEN tipo = 'ejercicio' THEN 1 END) as ejercicios,
                SUM(CASE WHEN calorias IS NOT NULL THEN calorias ELSE 0 END) as total_calorias
            FROM activities 
            WHERE user_id = $1 AND fecha >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY fecha 
            ORDER BY fecha ASC
        `, [userId]);

        const stats = statsResult.rows[0];
        const recentActivities = recentActivitiesResult.rows;
        const suggestions = suggestionsResult.rows;
        const chartData = chartDataResult.rows;

        res.render('dashboard/index', {
            title: 'Dashboard - Athlyze',
            stats,
            recentActivities,
            suggestions,
            chartData: JSON.stringify(chartData),
            user: req.session.user
        });
    } catch (error) {
        console.error('Error en dashboard:', error);
        res.status(500).render('500', {
            title: 'Error del servidor',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

module.exports = router;
