const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');

const router = express.Router();

// Middleware para verificar autenticación
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

// Listar todas las actividades
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;
        const tipo = req.query.tipo || '';
        const fechaDesde = req.query.fechaDesde || '';
        const fechaHasta = req.query.fechaHasta || '';

        // Construir query con filtros
        let whereClause = 'WHERE user_id = $1';
        let params = [userId];
        let paramCount = 1;

        if (tipo) {
            paramCount++;
            whereClause += ` AND tipo = $${paramCount}`;
            params.push(tipo);
        }

        if (fechaDesde) {
            paramCount++;
            whereClause += ` AND fecha >= $${paramCount}`;
            params.push(fechaDesde);
        }

        if (fechaHasta) {
            paramCount++;
            whereClause += ` AND fecha <= $${paramCount}`;
            params.push(fechaHasta);
        }

        // Obtener total de actividades
        const countResult = await db.query(
            `SELECT COUNT(*) FROM activities ${whereClause}`,
            params
        );
        const totalActivities = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalActivities / limit);

        // Obtener actividades paginadas
        const activitiesResult = await db.query(
            `SELECT id, tipo, descripcion, fecha, calorias, medidas, fecha_registro
             FROM activities ${whereClause}
             ORDER BY fecha DESC, fecha_registro DESC
             LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
            [...params, limit, offset]
        );

        res.render('activities/index', {
            title: 'Actividades - Athlyze',
            activities: activitiesResult.rows,
            currentPage: page,
            totalPages,
            totalActivities,
            filters: { tipo, fechaDesde, fechaHasta },
            user: req.session.user
        });
    } catch (error) {
        console.error('Error al listar actividades:', error);
        res.status(500).render('500', {
            title: 'Error del servidor',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

// Mostrar formulario de nueva actividad
router.get('/new', requireAuth, (req, res) => {
    res.render('activities/new', {
        title: 'Nueva Actividad - Athlyze',
        errors: [],
        oldInput: {},
        user: req.session.user
    });
});

// Crear nueva actividad
router.post('/', requireAuth, [
    body('tipo')
        .isIn(['ejercicio', 'alimentacion', 'medidas'])
        .withMessage('Tipo de actividad inválido'),
    body('descripcion')
        .trim()
        .isLength({ min: 3 })
        .withMessage('La descripción debe tener al menos 3 caracteres'),
    body('fecha')
        .isDate()
        .withMessage('Fecha inválida'),
    body('calorias')
        .optional({ checkFalsy: true })
        .isInt({ min: 0, max: 5000 })
        .withMessage('Las calorías deben ser un número entre 0 y 5000')
], async (req, res) => {
    const errors = validationResult(req);
    const { tipo, descripcion, fecha, calorias } = req.body;
    const userId = req.session.user.id;

    // Procesar medidas adicionales según el tipo
    let medidas = {};
    if (tipo === 'ejercicio') {
        if (req.body.duracion) medidas.duracion = req.body.duracion;
        if (req.body.distancia) medidas.distancia = req.body.distancia;
        if (req.body.intensidad) medidas.intensidad = req.body.intensidad;
    } else if (tipo === 'medidas') {
        if (req.body.peso) medidas.peso = req.body.peso;
        if (req.body.altura) medidas.altura = req.body.altura;
        if (req.body.grasa_corporal) medidas.grasa_corporal = req.body.grasa_corporal;
        if (req.body.musculo) medidas.musculo = req.body.musculo;
    } else if (tipo === 'alimentacion') {
        if (req.body.proteinas) medidas.proteinas = req.body.proteinas;
        if (req.body.carbohidratos) medidas.carbohidratos = req.body.carbohidratos;
        if (req.body.grasas) medidas.grasas = req.body.grasas;
    }

    if (!errors.isEmpty()) {
        return res.render('activities/new', {
            title: 'Nueva Actividad - Athlyze',
            errors: errors.array(),
            oldInput: { tipo, descripcion, fecha, calorias, ...req.body },
            user: req.session.user
        });
    }

    try {
        // Insertar actividad
        await db.query(
            'INSERT INTO activities (user_id, tipo, descripcion, fecha, calorias, medidas) VALUES ($1, $2, $3, $4, $5, $6)',
            [userId, tipo, descripcion, fecha, calorias || null, JSON.stringify(medidas)]
        );

        // Generar sugerencia automática basada en patrones
        await generateSuggestion(userId, tipo, descripcion, calorias);

        req.session.message = 'Actividad registrada exitosamente';
        res.redirect('/activities');
    } catch (error) {
        console.error('Error al crear actividad:', error);
        res.render('activities/new', {
            title: 'Nueva Actividad - Athlyze',
            errors: [{ msg: 'Error interno del servidor' }],
            oldInput: { tipo, descripcion, fecha, calorias, ...req.body },
            user: req.session.user
        });
    }
});

// Ver detalle de actividad
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const activityId = req.params.id;

        const result = await db.query(
            'SELECT * FROM activities WHERE id = $1 AND user_id = $2',
            [activityId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).render('404', { title: 'Actividad no encontrada' });
        }

        const activity = result.rows[0];

        res.render('activities/detail', {
            title: 'Detalle de Actividad - Athlyze',
            activity,
            user: req.session.user
        });
    } catch (error) {
        console.error('Error al obtener actividad:', error);
        res.status(500).render('500', {
            title: 'Error del servidor',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

// Eliminar actividad
router.post('/:id/delete', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const activityId = req.params.id;

        const result = await db.query(
            'DELETE FROM activities WHERE id = $1 AND user_id = $2',
            [activityId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).render('404', { title: 'Actividad no encontrada' });
        }

        req.session.message = 'Actividad eliminada exitosamente';
        res.redirect('/activities');
    } catch (error) {
        console.error('Error al eliminar actividad:', error);
        req.session.error = 'Error al eliminar la actividad';
        res.redirect('/activities');
    }
});

// Función para generar sugerencias automáticas
async function generateSuggestion(userId, tipo, descripcion, calorias) {
    try {
        // Obtener datos recientes del usuario para análisis
        const recentActivities = await db.query(
            'SELECT tipo, calorias, fecha FROM activities WHERE user_id = $1 AND fecha >= CURRENT_DATE - INTERVAL \'7 days\' ORDER BY fecha DESC',
            [userId]
        );

        const activities = recentActivities.rows;
        let suggestionText = '';
        let suggestionType = 'general';

        if (tipo === 'ejercicio') {
            const exerciseCount = activities.filter(a => a.tipo === 'ejercicio').length;
            suggestionType = 'ejercicio';

            if (exerciseCount === 1) {
                suggestionText = '¡Excelente! Has registrado tu primer ejercicio de la semana. Trata de mantener la constancia ejercitándote al menos 3 veces por semana.';
            } else if (exerciseCount >= 3) {
                suggestionText = '¡Fantástico! Estás manteniendo una rutina de ejercicio consistente. Recuerda incluir días de descanso para la recuperación muscular.';
            } else {
                suggestionText = 'Buen trabajo con el ejercicio. Intenta agregar más variedad a tu rutina incluyendo ejercicios de cardio y fuerza.';
            }
        } else if (tipo === 'alimentacion') {
            const mealCount = activities.filter(a => a.tipo === 'alimentacion').length;
            suggestionType = 'nutricion';

            if (calorias && calorias > 500) {
                suggestionText = 'Registraste una comida alta en calorías. Considera balancearla con opciones más ligeras en las próximas comidas.';
            } else if (mealCount >= 3) {
                suggestionText = 'Estás llevando un buen registro de tu alimentación. Asegúrate de incluir variedad de nutrientes en cada comida.';
            } else {
                suggestionText = 'Mantén un registro consistente de tus comidas para obtener mejores consejos nutricionales personalizados.';
            }
        } else if (tipo === 'medidas') {
            suggestionType = 'medidas';
            suggestionText = 'Excelente trabajo registrando tus medidas. El seguimiento regular te ayudará a monitorear tu progreso a lo largo del tiempo.';
        }

        if (suggestionText) {
            await db.query(
                'INSERT INTO suggestions (user_id, texto, tipo) VALUES ($1, $2, $3)',
                [userId, suggestionText, suggestionType]
            );
        }
    } catch (error) {
        console.error('Error al generar sugerencia:', error);
        // No lanzar error para no afectar el flujo principal
    }
}

module.exports = router;
