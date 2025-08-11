const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');

const router = express.Router();

// Middleware para verificar si el usuario está autenticado
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

// Middleware para redirigir usuarios autenticados
const requireGuest = (req, res, next) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    next();
};

// Mostrar página de registro
router.get('/register', requireGuest, (req, res) => {
    res.render('auth/register', {
        title: 'Registro - Athlyze',
        errors: [],
        oldInput: {}
    });
});

// Procesar registro
router.post('/register', requireGuest, [
    body('nombre')
        .trim()
        .isLength({ min: 2 })
        .withMessage('El nombre debe tener al menos 2 caracteres'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Ingresa un email válido'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Las contraseñas no coinciden');
            }
            return true;
        }),
    body('plan').notEmpty().withMessage('Debes seleccionar un plan.')
], async (req, res) => {
    const errors = validationResult(req);
    const { nombre, email, password, plan } = req.body;

    if (!errors.isEmpty()) {
        return res.render('auth/register', {
            title: 'Registro - Athlyze',
            errors: errors.array(),
            oldInput: { nombre, email, plan }
        });
    }

    try {
        const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.render('auth/register', {
                title: 'Registro - Athlyze',
                errors: [{ msg: 'Este email ya está registrado' }],
                oldInput: { nombre, email, plan }
            });
        }

        // Si el plan es de pago, redirigir a la página de pago simulado
        if (plan === 'smart' || plan === 'pro') {
            return res.render('auth/payment', {
                title: 'Finalizar Compra',
                nombre,
                email,
                password, // Se pasa la contraseña para el siguiente paso
                plan
            });
        }

        // Si es el plan 'starter', registrar directamente
        const hashedPassword = await bcrypt.hash(password, 12);
        const result = await db.query(
            'INSERT INTO users (nombre, email, password, plan) VALUES ($1, $2, $3, $4) RETURNING id, nombre, email, plan',
            [nombre, email, hashedPassword, plan]
        );
        const newUser = result.rows[0];
        req.session.user = newUser;

        await db.query(
            'INSERT INTO suggestions (user_id, texto, tipo) VALUES ($1, $2, $3)',
            [newUser.id, `¡Bienvenido a Athlyze, ${nombre}! Comienza registrando tu primera actividad.`, 'general']
        );

        res.redirect('/dashboard');
    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).render('500');
    }
});

// Procesar el pago simulado y completar el registro
router.post('/register/payment', requireGuest, async (req, res) => {
    const { nombre, email, password, plan } = req.body;

    // Aquí no hay validación de pago porque es simulado

    try {
        const hashedPassword = await bcrypt.hash(password, 12);
        const result = await db.query(
            'INSERT INTO users (nombre, email, password, plan) VALUES ($1, $2, $3, $4) RETURNING id, nombre, email, plan',
            [nombre, email, hashedPassword, plan]
        );
        const newUser = result.rows[0];
        
        // No se inicia sesión aquí, se redirige al login para que el flujo sea más realista
        // Opcional: podrías iniciar sesión directamente si lo prefieres
        // req.session.user = newUser;

        await db.query(
            'INSERT INTO suggestions (user_id, texto, tipo) VALUES ($1, $2, $3)',
            [newUser.id, `¡Bienvenido al plan ${plan}, ${nombre}! Explora tus nuevas funcionalidades.`, 'general']
        );

        // Redirigir a login con un mensaje de éxito
        res.redirect('/login?status=registered');

    } catch (error) {
        console.error('Error en el registro post-pago:', error);
        res.status(500).render('500');
    }
});


// Mostrar página de login
router.get('/login', requireGuest, (req, res) => {
    res.render('auth/login', {
        title: 'Iniciar Sesión - Athlyze',
        errors: [],
        oldInput: {},
        status: req.query.status
    });
});

// Procesar login
router.post('/login', requireGuest, [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Ingresa un email válido'),
    body('password')
        .notEmpty()
        .withMessage('La contraseña es requerida')
], async (req, res) => {
    const errors = validationResult(req);
    const { email, password } = req.body;

    if (!errors.isEmpty()) {
        return res.render('auth/login', {
            title: 'Iniciar Sesión - Athlyze',
            errors: errors.array(),
            oldInput: { email }
        });
    }

    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1 AND activo = true', [email]);
        if (result.rows.length === 0) {
            return res.render('auth/login', {
                title: 'Iniciar Sesión - Athlyze',
                errors: [{ msg: 'Email o contraseña incorrectos' }],
                oldInput: { email }
            });
        }

        const user = result.rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.render('auth/login', {
                title: 'Iniciar Sesión - Athlyze',
                errors: [{ msg: 'Email o contraseña incorrectos' }],
                oldInput: { email }
            });
        }

        req.session.user = {
            id: user.id,
            nombre: user.nombre,
            email: user.email,
            plan: user.plan
        };

        res.redirect('/dashboard');
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).render('500');
    }
});

// Cerrar sesión
router.post('/logout', requireAuth, (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error al cerrar sesión:', err);
        }
        res.redirect('/');
    });
});

module.exports = router;