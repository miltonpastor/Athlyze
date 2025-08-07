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

// Página principal de reportes
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const period = req.query.period || '30'; // días

        // Obtener estadísticas generales
        const statsResult = await db.query(`
            SELECT 
                COUNT(*) as total_actividades,
                COUNT(CASE WHEN tipo = 'ejercicio' THEN 1 END) as ejercicios,
                COUNT(CASE WHEN tipo = 'alimentacion' THEN 1 END) as comidas,
                COUNT(CASE WHEN tipo = 'medidas' THEN 1 END) as medidas,
                AVG(CASE WHEN tipo = 'ejercicio' AND calorias IS NOT NULL THEN calorias END) as promedio_calorias_ejercicio,
                SUM(CASE WHEN tipo = 'ejercicio' AND calorias IS NOT NULL THEN calorias ELSE 0 END) as total_calorias_quemadas,
                SUM(CASE WHEN tipo = 'alimentacion' AND calorias IS NOT NULL THEN calorias ELSE 0 END) as total_calorias_consumidas
            FROM activities 
            WHERE user_id = $1 AND fecha >= CURRENT_DATE - INTERVAL '${period} days'
        `, [userId]);

        // Datos para gráfico de actividades por día
        const dailyDataResult = await db.query(`
            SELECT 
                fecha,
                COUNT(*) as total_actividades,
                COUNT(CASE WHEN tipo = 'ejercicio' THEN 1 END) as ejercicios,
                COUNT(CASE WHEN tipo = 'alimentacion' THEN 1 END) as comidas,
                COUNT(CASE WHEN tipo = 'medidas' THEN 1 END) as medidas,
                SUM(CASE WHEN tipo = 'ejercicio' AND calorias IS NOT NULL THEN calorias ELSE 0 END) as calorias_quemadas,
                SUM(CASE WHEN tipo = 'alimentacion' AND calorias IS NOT NULL THEN calorias ELSE 0 END) as calorias_consumidas
            FROM activities 
            WHERE user_id = $1 AND fecha >= CURRENT_DATE - INTERVAL '${period} days'
            GROUP BY fecha 
            ORDER BY fecha ASC
        `, [userId]);

        // Datos para gráfico de distribución por tipo
        const typeDistributionResult = await db.query(`
            SELECT 
                tipo,
                COUNT(*) as cantidad,
                ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER()), 1) as porcentaje
            FROM activities 
            WHERE user_id = $1 AND fecha >= CURRENT_DATE - INTERVAL '${period} days'
            GROUP BY tipo
        `, [userId]);

        // Evolución del peso (si hay registros)
        const weightDataResult = await db.query(`
            SELECT 
                fecha,
                medidas->>'peso' as peso
            FROM activities 
            WHERE user_id = $1 
                AND tipo = 'medidas' 
                AND medidas->>'peso' IS NOT NULL
                AND fecha >= CURRENT_DATE - INTERVAL '${period} days'
            ORDER BY fecha ASC
        `, [userId]);

        // Top ejercicios más frecuentes
        const topExercisesResult = await db.query(`
            SELECT 
                descripcion,
                COUNT(*) as frecuencia,
                AVG(calorias) as promedio_calorias
            FROM activities 
            WHERE user_id = $1 
                AND tipo = 'ejercicio'
                AND fecha >= CURRENT_DATE - INTERVAL '${period} days'
            GROUP BY descripcion
            ORDER BY frecuencia DESC
            LIMIT 5
        `, [userId]);

        const stats = statsResult.rows[0];
        const dailyData = dailyDataResult.rows;
        const typeDistribution = typeDistributionResult.rows;
        const weightData = weightDataResult.rows.filter(row => row.peso && !isNaN(parseFloat(row.peso)));
        const topExercises = topExercisesResult.rows;

        res.render('reports/index', {
            title: 'Reportes - Athlyze',
            stats,
            dailyData: JSON.stringify(dailyData),
            typeDistribution: JSON.stringify(typeDistribution),
            weightData: JSON.stringify(weightData),
            topExercises,
            period,
            user: req.session.user
        });
    } catch (error) {
        console.error('Error al generar reportes:', error);
        res.status(500).render('500', {
            title: 'Error del servidor',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

// Reporte detallado de ejercicios
router.get('/exercises', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const period = req.query.period || '30';

        const exerciseDataResult = await db.query(`
            SELECT 
                descripcion,
                fecha,
                calorias,
                medidas,
                ROW_NUMBER() OVER (PARTITION BY descripcion ORDER BY fecha DESC) as rn
            FROM activities 
            WHERE user_id = $1 
                AND tipo = 'ejercicio'
                AND fecha >= CURRENT_DATE - INTERVAL '${period} days'
            ORDER BY fecha DESC
        `, [userId]);

        // Estadísticas por ejercicio
        const exerciseStatsResult = await db.query(`
            SELECT 
                descripcion,
                COUNT(*) as total_sesiones,
                AVG(calorias) as promedio_calorias,
                MAX(calorias) as max_calorias,
                MIN(fecha) as primera_fecha,
                MAX(fecha) as ultima_fecha
            FROM activities 
            WHERE user_id = $1 
                AND tipo = 'ejercicio'
                AND fecha >= CURRENT_DATE - INTERVAL '${period} days'
            GROUP BY descripcion
            ORDER BY total_sesiones DESC
        `, [userId]);

        res.render('reports/exercises', {
            title: 'Reporte de Ejercicios - Athlyze',
            exerciseData: exerciseDataResult.rows,
            exerciseStats: exerciseStatsResult.rows,
            period,
            user: req.session.user
        });
    } catch (error) {
        console.error('Error al generar reporte de ejercicios:', error);
        res.status(500).render('500', {
            title: 'Error del servidor',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

// Reporte de nutrición
router.get('/nutrition', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const period = req.query.period || '30';

        const nutritionDataResult = await db.query(`
            SELECT 
                fecha,
                descripcion,
                calorias,
                medidas
            FROM activities 
            WHERE user_id = $1 
                AND tipo = 'alimentacion'
                AND fecha >= CURRENT_DATE - INTERVAL '${period} days'
            ORDER BY fecha DESC
        `, [userId]);

        // Estadísticas nutricionales por día
        const dailyNutritionResult = await db.query(`
            SELECT 
                fecha,
                COUNT(*) as comidas_registradas,
                SUM(calorias) as total_calorias,
                AVG(calorias) as promedio_calorias
            FROM activities 
            WHERE user_id = $1 
                AND tipo = 'alimentacion'
                AND fecha >= CURRENT_DATE - INTERVAL '${period} days'
            GROUP BY fecha
            ORDER BY fecha DESC
        `, [userId]);

        res.render('reports/nutrition', {
            title: 'Reporte de Nutrición - Athlyze',
            nutritionData: nutritionDataResult.rows,
            dailyNutrition: JSON.stringify(dailyNutritionResult.rows),
            period,
            user: req.session.user
        });
    } catch (error) {
        console.error('Error al generar reporte de nutrición:', error);
        res.status(500).render('500', {
            title: 'Error del servidor',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

module.exports = router;
