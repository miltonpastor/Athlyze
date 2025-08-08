const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');

// Importar rutas
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const activitiesRoutes = require('./routes/activities');
const reportsRoutes = require('./routes/reports');
const suggestionsRoutes = require('./routes/suggestions');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración del motor de plantillas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Configuración de sesiones
app.use(session({
    secret: 'athlyze-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // cambiar a true en producción con HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// Middleware para variables globales
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.isLoggedIn = !!req.session.user;
    next();
});

// Rutas
app.use('/', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/activities', activitiesRoutes);
app.use('/reports', reportsRoutes);
app.use('/suggestions', suggestionsRoutes);

// Ruta principal
app.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('index', { title: 'ForgeYou - Tu compañero fitness' });
});

// Middleware de manejo de errores 404
app.use((req, res) => {
    res.status(404).render('404', { title: 'Página no encontrada' });
});

// Middleware de manejo de errores
app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).render('500', {
        title: 'Error del servidor',
        error: process.env.NODE_ENV === 'development' ? error : null
    });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

module.exports = app;
