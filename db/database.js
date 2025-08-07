const { Pool } = require('pg');

// Configuración de la conexión a PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER || 'odoo',
    host: process.env.DB_HOST || '127.0.0.1',
    database: process.env.DB_NAME || 'athlyze',
    password: process.env.DB_PASSWORD || '12345',
    port: process.env.DB_PORT || 5432,
});

// Función para ejecutar consultas
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log('Consulta ejecutada:', { text, duration, rows: res.rowCount });
        return res;
    } catch (error) {
        console.error('Error en la consulta:', { text, error: error.message });
        throw error;
    }
};

// Función para obtener un cliente del pool
const getClient = () => {
    return pool.connect();
};

module.exports = {
    query,
    getClient,
    pool
};
