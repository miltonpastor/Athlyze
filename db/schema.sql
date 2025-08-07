-- Crear la base de datos (ejecutar como superusuario)
-- CREATE DATABASE athlyze;

-- Conectar a la base de datos athlyze
-- \c athlyze;

-- Crear extensión para UUID (opcional, para generar IDs únicos)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de usuarios
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    plan VARCHAR(20) DEFAULT 'starter' CHECK (plan IN ('starter', 'smart', 'pro')),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT true
);

-- Tabla de actividades
CREATE TABLE activities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('ejercicio', 'alimentacion', 'medidas')),
    descripcion TEXT NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    calorias INTEGER,
    medidas JSONB,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de sugerencias
CREATE TABLE suggestions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    leida BOOLEAN DEFAULT false,
    tipo VARCHAR(20) DEFAULT 'general' CHECK (tipo IN ('general', 'ejercicio', 'nutricion', 'medidas'))
);

-- Índices para mejorar el rendimiento
CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_activities_fecha ON activities(fecha);
CREATE INDEX idx_activities_tipo ON activities(tipo);
CREATE INDEX idx_suggestions_user_id ON suggestions(user_id);
CREATE INDEX idx_suggestions_leida ON suggestions(leida);

-- Insertar datos de ejemplo (opcional)
INSERT INTO users (nombre, email, password, plan) VALUES
('Usuario Demo', 'demo@athlyze.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'starter'); -- password: password

-- Insertar algunas actividades de ejemplo
INSERT INTO activities (user_id, tipo, descripcion, fecha, calorias, medidas) VALUES
(1, 'ejercicio', 'Carrera matutina - 30 minutos', '2024-01-15', 350, '{"distancia": "5km", "tiempo": "30min"}'),
(1, 'alimentacion', 'Desayuno: Avena con frutas', '2024-01-15', 280, '{"proteinas": "8g", "carbohidratos": "45g"}'),
(1, 'medidas', 'Peso corporal', '2024-01-15', NULL, '{"peso": "70kg", "altura": "175cm"}'),
(1, 'ejercicio', 'Entrenamiento de fuerza - Pecho y tríceps', '2024-01-16', 420, '{"series": 4, "repeticiones": "8-12"}'),
(1, 'alimentacion', 'Almuerzo: Pollo con ensalada', '2024-01-16', 450, '{"proteinas": "35g", "carbohidratos": "20g"}')
