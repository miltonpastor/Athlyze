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
        })
], async (req, res) => {
    const errors = validationResult(req);
    const { nombre, email, password, plan = 'starter' } = req.body;

    if (!errors.isEmpty()) {
        return res.render('auth/register', {
            title: 'Registro - Athlyze',
            errors: errors.array(),
            oldInput: { nombre, email, plan }
        });
    }

    try {
        // Verificar si el email ya existe
        const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.render('auth/register', {
                title: 'Registro - Athlyze',
                errors: [{ msg: 'Este email ya está registrado' }],
                oldInput: { nombre, email, plan }
            });
        }

        // Hashear la contraseña
        const hashedPassword = await bcrypt.hash(password, 12);

        // Crear el usuario
        const result = await db.query(
            'INSERT INTO users (nombre, email, password, plan) VALUES ($1, $2, $3, $4) RETURNING id, nombre, email, plan',
            [nombre, email, hashedPassword, plan]
        );

        const newUser = result.rows[0];

        // Crear sesión
        req.session.user = newUser;

        // Generar sugerencia de bienvenida
        await db.query(
            'INSERT INTO suggestions (user_id, texto, tipo) VALUES ($1, $2, $3)',
            [newUser.id, `¡Bienvenido a Athlyze, ${nombre}! Comienza registrando tu primera actividad para obtener consejos personalizados.`, 'general']
        );

        res.redirect('/dashboard');
    } catch (error) {
        console.error('Error en registro:', error);
        res.render('auth/register', {
            title: 'Registro - Athlyze',
            errors: [{ msg: 'Error interno del servidor' }],
            oldInput: { nombre, email, plan }
        });
    }
});

// Mostrar página de login
router.get('/login', requireGuest, (req, res) => {
    res.render('auth/login', {
        title: 'Iniciar Sesión - Athlyze',
        errors: [],
        oldInput: {}
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
        // Buscar usuario
        const result = await db.query('SELECT * FROM users WHERE email = $1 AND activo = true', [email]);

        if (result.rows.length === 0) {
            return res.render('auth/login', {
                title: 'Iniciar Sesión - Athlyze',
                errors: [{ msg: 'Email o contraseña incorrectos' }],
                oldInput: { email }
            });
        }

        const user = result.rows[0];

        // Verificar contraseña
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.render('auth/login', {
                title: 'Iniciar Sesión - Athlyze',
                errors: [{ msg: 'Email o contraseña incorrectos' }],
                oldInput: { email }
            });
        }

        // Crear sesión
        req.session.user = {
            id: user.id,
            nombre: user.nombre,
            email: user.email,
            plan: user.plan
        };

        res.redirect('/dashboard');
    } catch (error) {
        console.error('Error en login:', error);
        res.render('auth/login', {
            title: 'Iniciar Sesión - Athlyze',
            errors: [{ msg: 'Error interno del servidor' }],
            oldInput: { email }
        });
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
