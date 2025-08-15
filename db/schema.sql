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

-- Tabla de objetivos de entrenamiento (para Plan Smart/Pro)
CREATE TABLE user_goals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    fitness_level VARCHAR(20) CHECK (fitness_level IN ('principiante', 'intermedio', 'avanzado')),
    main_goal VARCHAR(30) CHECK (main_goal IN ('perder_peso', 'ganar_musculo', 'mejorar_resistencia', 'mantener_forma')),
    training_days_per_week INTEGER CHECK (training_days_per_week >= 1 AND training_days_per_week <= 7),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de perfiles nutricionales (para Plan Smart/Pro)
CREATE TABLE nutrition_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    goal VARCHAR(30) CHECK (goal IN ('perder_peso', 'ganar_musculo', 'mantener_forma')),
    daily_calories INTEGER CHECK (daily_calories >= 1000 AND daily_calories <= 4000),
    meals_per_day INTEGER CHECK (meals_per_day >= 3 AND meals_per_day <= 6),
    activity_level VARCHAR(20) CHECK (activity_level IN ('sedentario', 'ligero', 'moderado', 'intenso')),
    dietary_restrictions JSONB DEFAULT '[]',
    allergies JSONB DEFAULT '[]',
    preferred_foods JSONB DEFAULT '[]',
    disliked_foods JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de planes nutricionales generados
CREATE TABLE nutrition_plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plan_data JSONB NOT NULL,
    goal VARCHAR(30),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar el rendimiento
CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_activities_fecha ON activities(fecha);
CREATE INDEX idx_activities_tipo ON activities(tipo);
CREATE INDEX idx_suggestions_user_id ON suggestions(user_id);
CREATE INDEX idx_suggestions_leida ON suggestions(leida);
CREATE INDEX idx_user_goals_user_id ON user_goals(user_id);
CREATE INDEX idx_nutrition_profiles_user_id ON nutrition_profiles(user_id);
CREATE INDEX idx_nutrition_plans_user_id ON nutrition_plans(user_id);
CREATE INDEX idx_nutrition_plans_created_at ON nutrition_plans(created_at);

-- Tabla de objetivos y perfil del usuario para ejercicio
CREATE TABLE user_goals_exercise (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    fitness_level VARCHAR(50) NOT NULL CHECK (fitness_level IN ('principiante', 'intermedio', 'avanzado')),
    main_goal VARCHAR(50) NOT NULL CHECK (main_goal IN ('perder_peso', 'ganar_musculo', 'mejorar_resistencia', 'mantener_forma')),
    secondary_goals JSONB, -- Objetivos secundarios: ['mejorar_flexibilidad', 'reducir_estres']
    training_days_per_week INTEGER NOT NULL CHECK (training_days_per_week BETWEEN 1 AND 7),
    time_per_session INTEGER DEFAULT 45, -- Duración en minutos
    preferred_time VARCHAR(20) DEFAULT 'any' CHECK (preferred_time IN ('morning', 'afternoon', 'evening', 'any')),
    health_conditions JSONB, -- Almacena un array de strings: ['problemas_cardiacos', 'dolor_espalda']
    other_conditions TEXT, -- Campo de texto para otras consideraciones
    equipment JSONB, -- Almacena un array de strings: ['mancuernas', 'bandas_resistencia']
    experience_years INTEGER DEFAULT 0, -- Años de experiencia
    current_weight DECIMAL(5,2), -- Peso actual en kg
    target_weight DECIMAL(5,2), -- Peso objetivo en kg
    height INTEGER, -- Altura en cm
    age INTEGER, -- Edad
    gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other')),
    activity_level VARCHAR(50) DEFAULT 'sedentary' CHECK (activity_level IN ('sedentary', 'lightly_active', 'moderately_active', 'very_active')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de ejercicios mejorada
CREATE TABLE exercises (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('cardio', 'fuerza', 'flexibilidad', 'funcional')),
    muscle_groups JSONB NOT NULL, -- Array de grupos musculares: ['pecho', 'triceps']
    equipment_needed JSONB, -- Array de equipos: ['mancuernas', 'banco']
    difficulty_level VARCHAR(50) NOT NULL CHECK (difficulty_level IN ('principiante', 'intermedio', 'avanzado')),
    calories_per_minute DECIMAL(4,2), -- Calorías quemadas por minuto aproximadamente
    video_url VARCHAR(500),
    image_url VARCHAR(500),
    instructions JSONB, -- Instrucciones paso a paso
    contraindications JSONB, -- Contraindicaciones médicas
    variations JSONB, -- Variaciones del ejercicio para diferentes niveles
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Tabla de rutinas predefinidas
CREATE TABLE workout_routines (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    goal VARCHAR(50) NOT NULL CHECK (goal IN ('perder_peso', 'ganar_musculo', 'mejorar_resistencia', 'mantener_forma')),
    fitness_level VARCHAR(50) NOT NULL CHECK (fitness_level IN ('principiante', 'intermedio', 'avanzado')),
    duration_minutes INTEGER NOT NULL,
    exercises JSONB NOT NULL, -- Array de ejercicios con sets, reps, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Tabla de planes de entrenamiento generados
CREATE TABLE training_plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    goal VARCHAR(50) NOT NULL,
    fitness_level VARCHAR(50) NOT NULL,
    duration_weeks INTEGER DEFAULT 4,
    schedule JSONB NOT NULL, -- Plan completo serializado
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Tabla de progreso del usuario
CREATE TABLE user_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plan_id INTEGER REFERENCES training_plans(id) ON DELETE CASCADE,
    workout_date DATE NOT NULL,
    routine_name VARCHAR(150),
    exercises_completed JSONB, -- Ejercicios completados con detalles
    duration_minutes INTEGER,
    calories_burned INTEGER,
    difficulty_rating INTEGER CHECK (difficulty_rating BETWEEN 1 AND 5),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar el rendimiento
CREATE INDEX idx_user_goals_exercise_user_id ON user_goals_exercise(user_id);
CREATE INDEX idx_exercises_category ON exercises(category);
CREATE INDEX idx_exercises_difficulty ON exercises(difficulty_level);
CREATE INDEX idx_workout_routines_goal_level ON workout_routines(goal, fitness_level);
CREATE INDEX idx_training_plans_user_id ON training_plans(user_id);
CREATE INDEX idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX idx_user_progress_date ON user_progress(workout_date);

-- Insertar datos de ejemplo (opcional)
INSERT INTO users (nombre, email, password, plan) VALUES
('Usuario Demo', 'demo@athlyze.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'starter'); -- password: password

-- Insertar algunas actividades de ejemplo
INSERT INTO activities (user_id, tipo, descripcion, fecha, calorias, medidas) VALUES
(1, 'ejercicio', 'Carrera matutina - 30 minutos', '2024-01-15', 350, '{"distancia": "5km", "tiempo": "30min"}'),
(1, 'alimentacion', 'Desayuno: Avena con frutas', '2024-01-15', 280, '{"proteinas": "8g", "carbohidratos": "45g"}'),
(1, 'medidas', 'Peso corporal', '2024-01-15', NULL, '{"peso": "70kg", "altura": "175cm"}'),
(1, 'ejercicio', 'Entrenamiento de fuerza - Pecho y tríceps', '2024-01-16', 420, '{"series": 4, "repeticiones": "8-12"}'),
(1, 'alimentacion', 'Almuerzo: Pollo con ensalada', '2024-01-16', 450, '{"proteinas": "35g", "carbohidratos": "20g"}');

-- Insertar ejercicios de ejemplo en la base de datos
INSERT INTO exercises (name, description, category, muscle_groups, equipment_needed, difficulty_level, calories_per_minute, video_url, instructions, contraindications) VALUES
-- EJERCICIOS CARDIO
('Caminata Rápida', 'Paseo a un ritmo elevado para aumentar la frecuencia cardíaca y mejorar la resistencia cardiovascular.', 'cardio', '["cardio", "piernas"]', '["sin_equipo"]', 'principiante', 5.0, 'https://www.youtube.com/watch?v=8hJc_o3Gq-o', '["Mantén postura erguida", "Mueve los brazos naturalmente", "Respira de forma profunda y rítmica"]', '[]'),

('Trote Ligero', 'Correr a un ritmo suave y constante para desarrollar resistencia aeróbica.', 'cardio', '["cardio", "piernas", "core"]', '["sin_equipo"]', 'principiante', 8.0, 'https://www.youtube.com/watch?v=5-31_z4nBvA', '["Aterriza con la parte media del pie", "Mantén cadencia constante", "Respira cada 3-4 pasos"]', '["problemas_rodilla", "lesiones_tobillo"]'),

('Carrera de Intervalos', 'Alternar entre sprints de alta intensidad y períodos de recuperación activa.', 'cardio', '["cardio", "piernas", "core"]', '["sin_equipo"]', 'intermedio', 12.0, 'https://www.youtube.com/watch?v=cZc9d1gGj-c', '["Calentamiento de 10 min", "30 seg sprint + 90 seg trote", "Repetir 6-8 veces", "Enfriamiento de 10 min"]', '["problemas_cardiacos", "presion_alta", "problemas_rodilla"]'),

('Burpees', 'Ejercicio de cuerpo completo que combina una sentadilla, flexión y salto vertical.', 'cardio', '["cuerpo_completo", "core", "piernas", "pecho", "hombros"]', '["sin_equipo"]', 'avanzado', 15.0, 'https://www.youtube.com/watch?v=auBLPXO8Fww', '["Sentadilla profunda", "Salto hacia posición de plancha", "Flexión opcional", "Salto hacia arriba"]', '["problemas_cardiacos", "lesiones_hombro", "problemas_espalda"]'),

-- EJERCICIOS DE FUERZA
('Sentadillas', 'Flexiona las rodillas y caderas para bajar el torso manteniendo la espalda recta.', 'fuerza', '["piernas", "gluteos", "core"]', '["sin_equipo"]', 'principiante', 4.0, 'https://www.youtube.com/watch?v=l7_B-mI4H44', '["Pies separados al ancho de hombros", "Baja como si te sentaras", "Mantén peso en talones", "Espalda recta siempre"]', '["problemas_rodilla", "lesiones_espalda_baja"]'),

('Flexiones', 'Baja y levanta el cuerpo con los brazos. Variación en rodillas para principiantes.', 'fuerza', '["pecho", "triceps", "hombros", "core"]', '["sin_equipo"]', 'principiante', 3.5, 'https://www.youtube.com/watch?v=F9FC_KBsLpY', '["Manos al ancho de hombros", "Cuerpo en línea recta", "Baja hasta casi tocar el suelo", "Empuja con fuerza"]', '["lesiones_hombro", "problemas_muñeca"]'),

('Plancha', 'Mantén una posición isométrica con el cuerpo recto y el abdomen contraído.', 'fuerza', '["core", "hombros", "espalda"]', '["sin_equipo"]', 'principiante', 2.5, 'https://www.youtube.com/watch?v=3-G_s4vNU2c', '["Antebrazos en el suelo", "Cuerpo en línea recta", "Contrae el abdomen", "Respira normalmente"]', '["lesiones_hombro", "problemas_espalda"]'),

('Peso Muerto con Mancuernas', 'Levanta mancuernas del suelo hasta la altura de la cadera con técnica correcta.', 'fuerza', '["espalda_baja", "gluteos", "isquiotibiales", "trapecio"]', '["mancuernas"]', 'intermedio', 6.0, 'https://www.youtube.com/watch?v=I5l4s_f4R2k', '["Pies al ancho de caderas", "Flexiona cadera, no rodillas", "Espalda neutra", "Empuja caderas hacia adelante al subir"]', '["lesiones_espalda", "problemas_espalda_baja"]'),

('Press de Pecho con Mancuernas', 'Acostado en el suelo o banco, empuja mancuernas desde el pecho hacia arriba.', 'fuerza', '["pecho", "triceps", "hombros"]', '["mancuernas"]', 'intermedio', 4.5, 'https://www.youtube.com/watch?v=w_n8g-3e2yI', '["Acuéstate boca arriba", "Mancuernas a nivel del pecho", "Empuja hacia arriba y junta", "Baja controladamente"]', '["lesiones_hombro", "problemas_pecho"]'),

-- EJERCICIOS DE FLEXIBILIDAD
('Estiramiento de Isquiotibiales', 'Siéntate y estira las piernas, inclínate hacia adelante para tocar los pies.', 'flexibilidad', '["isquiotibiales", "espalda_baja"]', '["sin_equipo"]', 'principiante', 1.0, 'https://www.youtube.com/watch?v=7K4p-y_oT-E', '["Siéntate con piernas extendidas", "Inclínate lentamente hacia adelante", "Mantén espalda recta", "Respira profundamente"]', '["lesiones_isquiotibiales", "problemas_espalda"]'),

('Estiramiento de Cuádriceps', 'De pie, lleva un talón hacia el glúteo y sostén el tobillo.', 'flexibilidad', '["cuadriceps", "cadera"]', '["sin_equipo"]', 'principiante', 1.0, 'https://www.youtube.com/watch?v=sC-2gS-A-Uw', '["De pie, flexiona una pierna hacia atrás", "Agarra el tobillo", "Mantén rodillas juntas", "Usa apoyo si es necesario"]', '["problemas_rodilla", "lesiones_cuadriceps"]'),

('Yoga - Saludo al Sol', 'Secuencia de posturas de yoga que estira y fortalece todo el cuerpo.', 'flexibilidad', '["cuerpo_completo"]', '["sin_equipo"]', 'principiante', 3.0, 'https://www.youtube.com/watch?v=g-h_mf3j2oE', '["Secuencia fluida de movimientos", "Coordina respiración con movimiento", "Adapta según flexibilidad", "Mantén cada postura 3-5 respiraciones"]', '["lesiones_hombro", "problemas_espalda"]');

-- Insertar rutinas predefinidas
INSERT INTO workout_routines (name, description, goal, fitness_level, duration_minutes, exercises) VALUES
-- RUTINAS PARA PERDER PESO - PRINCIPIANTE
('Cardio Suave', 'Introducción al ejercicio cardiovascular para principiantes', 'perder_peso', 'principiante', 30, '[{"exercise_id": 1, "sets": 1, "reps": "30 min", "rest_seconds": 0, "intensity": "moderada"}]'),

('Circuito Básico', 'Ejercicios simples de cuerpo completo para quemar calorías', 'perder_peso', 'principiante', 25, '[{"exercise_id": 5, "sets": 3, "reps": "12", "rest_seconds": 60}, {"exercise_id": 6, "sets": 3, "reps": "8", "rest_seconds": 60}, {"exercise_id": 7, "sets": 3, "reps": "30 seg", "rest_seconds": 60}]'),

-- RUTINAS PARA GANAR MÚSCULO - INTERMEDIO
('Tren Superior', 'Enfoque en pecho, hombros y brazos', 'ganar_musculo', 'intermedio', 45, '[{"exercise_id": 9, "sets": 4, "reps": "10-12", "rest_seconds": 90}, {"exercise_id": 6, "sets": 4, "reps": "12-15", "rest_seconds": 60}, {"exercise_id": 7, "sets": 3, "reps": "45 seg", "rest_seconds": 60}]'),

('Tren Inferior', 'Enfoque en piernas y glúteos', 'ganar_musculo', 'intermedio', 50, '[{"exercise_id": 5, "sets": 4, "reps": "12-15", "rest_seconds": 90}, {"exercise_id": 8, "sets": 4, "reps": "10", "rest_seconds": 90}]');

-- AMPLIACIÓN DE BASE DE EJERCICIOS PARA ATHLYZE
-- Este archivo contiene una base de datos completa de ejercicios categorizados

-- LIMPIAR TABLA EXISTENTE SI ES NECESARIO
-- DELETE FROM exercises WHERE id > 0;

-- =====================================================
-- EJERCICIOS DE CARDIO POR NIVEL
-- =====================================================

-- CARDIO - PRINCIPIANTE
INSERT INTO exercises (name, description, category, muscle_groups, equipment_needed, difficulty_level, calories_per_minute, video_url, instructions, contraindications) VALUES

('Marcha en el Lugar', 'Caminar elevando las rodillas sin moverse del sitio.', 'cardio', '["cardio", "piernas"]', '["sin_equipo"]', 'principiante', 3.0, 'https://youtube.com/example1', '["Mantén la espalda recta", "Eleva las rodillas al menos 90 grados", "Balancear los brazos naturalmente", "Mantén ritmo constante"]', '[]'),

('Paso Lateral', 'Movimientos laterales para activar músculos de las caderas.', 'cardio', '["piernas", "gluteos", "cardio"]', '["sin_equipo"]', 'principiante', 4.0, 'https://youtube.com/example2', '["Da un paso amplio hacia un lado", "Lleva el otro pie para juntar", "Mantén las rodillas ligeramente flexionadas", "Alterna direcciones"]', '["problemas_rodilla"]'),

('Baile Libre', 'Movimientos de baile libres al ritmo de la música.', 'cardio', '["cuerpo_completo", "cardio"]', '["sin_equipo"]', 'principiante', 5.5, 'https://youtube.com/example3', '["Elige música motivadora", "Mueve todo el cuerpo", "Mantente hidratado", "Diviértete sin presión"]', '[]'),

-- CARDIO - INTERMEDIO  
('Saltos de Tijera', 'Saltar abriendo y cerrando piernas mientras mueves los brazos.', 'cardio', '["cuerpo_completo", "cardio"]', '["sin_equipo"]', 'intermedio', 8.0, 'https://youtube.com/example4', '["Salta abriendo piernas al ancho de hombros", "Simultáneamente levanta brazos sobre la cabeza", "Regresa a posición inicial", "Mantén ritmo constante"]', '["problemas_rodilla", "lesiones_tobillo"]'),

('Mountain Climbers', 'Simular escalada en posición de plancha.', 'cardio', '["core", "hombros", "piernas", "cardio"]', '["sin_equipo"]', 'intermedio', 10.0, 'https://youtube.com/example5', '["Posición de plancha alta", "Alterna llevando rodillas al pecho", "Mantén caderas estables", "Respiración rítmica"]', '["lesiones_hombro", "problemas_espalda"]'),

('Boxeo Shadowboxing', 'Técnicas de boxeo al aire para cardio intenso.', 'cardio', '["brazos", "core", "cardio"]', '["sin_equipo"]', 'intermedio', 9.0, 'https://youtube.com/example6', '["Mantén guardia alta", "Combina jabs, cruces y ganchos", "Mueve los pies constantemente", "Mantén abdomen contraído"]', '["lesiones_hombro", "problemas_muñeca"]'),

-- CARDIO - AVANZADO
('Burpees con Flexión', 'Burpee tradicional añadiendo una flexión completa.', 'cardio', '["cuerpo_completo"]', '["sin_equipo"]', 'avanzado', 16.0, 'https://youtube.com/example7', '["Sentadilla profunda", "Salto a plancha", "Flexión completa", "Regreso y salto vertical"]', '["problemas_cardiacos", "lesiones_hombro", "problemas_espalda"]'),

('Sprints en Escalones', 'Subir escalones a máxima velocidad.', 'cardio', '["piernas", "gluteos", "cardio"]', '["escalones"]', 'avanzado', 14.0, 'https://youtube.com/example8', '["Usa todo el pie al subir", "Brazos ayudan al impulso", "Baja controladamente", "Mantén postura erguida"]', '["problemas_rodilla", "problemas_cardiacos"]'),

('HIIT Tabata', 'Protocolo de intervalos de alta intensidad 20s trabajo, 10s descanso.', 'cardio', '["cuerpo_completo"]', '["sin_equipo"]', 'avanzado', 18.0, 'https://youtube.com/example9', '["20 segundos máxima intensidad", "10 segundos descanso completo", "Repetir 8 rondas", "Ejercicios variados cada ronda"]', '["problemas_cardiacos", "presion_alta"]'),

-- =====================================================
-- EJERCICIOS DE FUERZA POR GRUPOS MUSCULARES
-- =====================================================

-- PECHO - PRINCIPIANTE
('Flexiones en Pared', 'Flexiones de pie contra la pared para principiantes.', 'fuerza', '["pecho", "triceps", "hombros"]', '["sin_equipo"]', 'principiante', 2.0, 'https://youtube.com/example10', '["De pie frente a la pared", "Manos al nivel del pecho", "Inclínate y empuja", "Mantén cuerpo recto"]', '[]'),

('Flexiones en Rodillas', 'Flexiones modificadas apoyando las rodillas.', 'fuerza', '["pecho", "triceps", "hombros"]', '["sin_equipo"]', 'principiante', 3.0, 'https://youtube.com/example11', '["Rodillas en el suelo", "Manos separadas al ancho de hombros", "Baja el pecho casi al suelo", "Empuja hacia arriba"]', '["problemas_muñeca"]'),

-- PECHO - INTERMEDIO
('Flexiones Diamante', 'Flexiones con manos en forma de diamante.', 'fuerza', '["pecho", "triceps"]', '["sin_equipo"]', 'intermedio', 4.0, 'https://youtube.com/example12', '["Forma diamante con índices y pulgares", "Flexión enfocada en tríceps", "Mantén codo cerca del cuerpo", "Control en bajada y subida"]', '["lesiones_hombro", "problemas_muñeca"]'),

('Press con Mancuernas Plano', 'Press de pecho acostado con mancuernas.', 'fuerza', '["pecho", "triceps", "hombros"]', '["mancuernas", "banco"]', 'intermedio', 5.5, 'https://youtube.com/example13', '["Acostado en banco plano", "Mancuernas a nivel del pecho", "Empuja hacia arriba juntando", "Baja controladamente"]', '["lesiones_hombro"]'),

-- ESPALDA - PRINCIPIANTE
('Superman', 'Acostado boca abajo, levantar brazos y piernas.', 'fuerza', '["espalda_baja", "gluteos"]', '["sin_equipo"]', 'principiante', 2.5, 'https://youtube.com/example14', '["Acostado boca abajo", "Brazos extendidos hacia adelante", "Levanta brazos, pecho y piernas", "Mantén posición 2-3 segundos"]', '["problemas_espalda"]'),

('Remo Invertido', 'Usar mesa o barra baja para hacer remo.', 'fuerza', '["espalda", "biceps"]', '["mesa_o_barra"]', 'principiante', 3.5, 'https://youtube.com/example15', '["Bajo una mesa resistente", "Tira del cuerpo hacia la mesa", "Mantén cuerpo recto", "Baja controladamente"]', '["lesiones_hombro"]'),

-- PIERNAS - PRINCIPIANTE
('Sentadillas Asistidas', 'Sentadillas usando apoyo de silla.', 'fuerza', '["piernas", "gluteos"]', '["silla"]', 'principiante', 3.0, 'https://youtube.com/example16', '["Usa silla como apoyo", "Baja como sentándote", "Levántate usando piernas", "Control en el movimiento"]', '["problemas_rodilla"]'),

('Elevación de Talones', 'Pararse en puntas de pies para fortalecer pantorrillas.', 'fuerza', '["pantorrillas"]', '["sin_equipo"]', 'principiante', 2.0, 'https://youtube.com/example17', '["De pie con pies paralelos", "Elévate en puntas de pies", "Contrae pantorrillas arriba", "Baja lentamente"]', '["problemas_tobillo"]'),

-- PIERNAS - INTERMEDIO
('Zancadas Alternas', 'Paso largo adelante flexionando ambas rodillas.', 'fuerza', '["piernas", "gluteos", "core"]', '["sin_equipo"]', 'intermedio', 4.5, 'https://youtube.com/example18', '["Paso amplio hacia adelante", "Baja hasta rodilla trasera casi toque suelo", "Regresa a posición inicial", "Alterna piernas"]', '["problemas_rodilla", "problemas_tobillo"]'),

('Sentadillas Jump', 'Sentadilla explosiva con salto vertical.', 'fuerza', '["piernas", "gluteos", "cardio"]', '["sin_equipo"]', 'intermedio', 7.0, 'https://youtube.com/example19', '["Sentadilla profunda", "Explota hacia arriba saltando", "Aterriza suavemente", "Inmediatamente siguiente repetición"]', '["problemas_rodilla", "lesiones_tobillo"]'),

-- CORE - TODOS LOS NIVELES
('Plancha Lateral', 'Mantener el cuerpo recto de lado apoyado en antebrazo.', 'fuerza', '["core", "oblicuos"]', '["sin_equipo"]', 'intermedio', 3.0, 'https://youtube.com/example20', '["De lado apoyado en antebrazo", "Cuerpo en línea recta", "Contrae abdomen", "Respira normalmente"]', '["lesiones_hombro", "problemas_espalda"]'),

('Dead Bug', 'Coordinación core acostado boca arriba.', 'fuerza', '["core"]', '["sin_equipo"]', 'principiante', 2.5, 'https://youtube.com/example21', '["Acostado boca arriba", "Rodillas a 90 grados", "Extiende brazo y pierna opuestos", "Alterna lentamente"]', '["problemas_espalda"]'),

('Russian Twists', 'Rotaciones del torso sentado.', 'fuerza', '["core", "oblicuos"]', '["sin_equipo"]', 'intermedio', 4.0, 'https://youtube.com/example22', '["Sentado con rodillas flexionadas", "Inclínate ligeramente hacia atrás", "Rota el torso lado a lado", "Mantén pies elevados si puedes"]', '["problemas_espalda"]'),

-- =====================================================
-- EJERCICIOS DE FLEXIBILIDAD Y MOVILIDAD
-- =====================================================

('Estiramiento de Pecho en Puerta', 'Usar marco de puerta para estirar pectorales.', 'flexibilidad', '["pecho", "hombros"]', '["sin_equipo"]', 'principiante', 1.0, 'https://youtube.com/example23', '["Coloca antebrazo en marco de puerta", "Da paso hacia adelante", "Siente estiramiento en pecho", "Mantén 30 segundos cada lado"]', '["lesiones_hombro"]'),

('Gato-Vaca (Cat-Cow)', 'Movilidad de columna en cuatro puntos.', 'flexibilidad', '["espalda", "core"]', '["sin_equipo"]', 'principiante', 1.5, 'https://youtube.com/example24', '["En cuatro puntos", "Arquea la espalda mirando arriba", "Redondea la espalda mirando abajo", "Movimiento fluido"]', '[]'),

('Estiramiento de Cadera en 4', 'Estiramiento profundo de cadera y glúteo.', 'flexibilidad', '["caderas", "gluteos"]', '["sin_equipo"]', 'principiante', 1.0, 'https://youtube.com/example25', '["Sentado con tobillo sobre rodilla opuesta", "Inclínate hacia adelante suavemente", "Siente estiramiento en glúteo", "Mantén 30 segundos cada lado"]', '["problemas_rodilla"]'),

('Estiramiento de Psoas', 'Estiramiento del flexor de cadera.', 'flexibilidad', '["caderas", "psoas"]', '["sin_equipo"]', 'intermedio', 1.0, 'https://youtube.com/example26', '["Zancada profunda", "Rodilla trasera en el suelo", "Empuja cadera hacia adelante", "Mantén torso erguido"]', '["problemas_rodilla"]'),

-- =====================================================
-- EJERCICIOS FUNCIONALES
-- =====================================================

('Farmer Walk', 'Caminar cargando peso en ambas manos.', 'funcional', '["cuerpo_completo", "core", "antebrazos"]', '["mancuernas"]', 'intermedio', 4.0, 'https://youtube.com/example27', '["Carga peso en ambas manos", "Camina con postura erguida", "Mantén hombros hacia atrás", "Pasos controlados"]', '["problemas_espalda"]'),

('Turkish Get-Up Simplificado', 'Movimiento complejo de levantarse del suelo con peso.', 'funcional', '["cuerpo_completo"]', '["mancuernas"]', 'avanzado', 6.0, 'https://youtube.com/example28', '["Acostado con peso en una mano", "Levántate paso a paso", "Mantén peso siempre vertical", "Movimiento controlado"]', '["lesiones_hombro", "problemas_espalda"]'),

('Bear Crawl', 'Caminar en cuatro puntos como un oso.', 'funcional', '["cuerpo_completo", "core"]', '["sin_equipo"]', 'intermedio', 5.5, 'https://youtube.com/example29', '["Cuatro puntos con rodillas elevadas", "Camina manteniendo core contraído", "Rodillas a 2cm del suelo", "Movimientos pequeños y controlados"]', '["problemas_muñeca", "lesiones_hombro"]');

-- =====================================================
-- RUTINAS PREDISEÑADAS ADICIONALES
-- =====================================================

INSERT INTO workout_routines (name, description, goal, fitness_level, duration_minutes, exercises) VALUES

-- RUTINAS PERDER PESO
('HIIT Principiante', 'Entrenamiento de intervalos adaptado para principiantes', 'perder_peso', 'principiante', 20, '[{"exercise_id": 1, "sets": 3, "reps": "30 seg", "rest_seconds": 30}, {"exercise_id": 2, "sets": 3, "reps": "30 seg", "rest_seconds": 30}]'),

('Circuito Cardio-Fuerza', 'Combinación perfecta de cardio y fuerza', 'perder_peso', 'intermedio', 35, '[{"exercise_id": 4, "sets": 4, "reps": "45 seg", "rest_seconds": 15}, {"exercise_id": 5, "sets": 4, "reps": "45 seg", "rest_seconds": 15}]'),

-- RUTINAS GANAR MÚSCULO
('Push-Pull-Legs Básico', 'División clásica para principiantes', 'ganar_musculo', 'principiante', 40, '[{"exercise_id": 6, "sets": 3, "reps": "8-12", "rest_seconds": 60}, {"exercise_id": 7, "sets": 3, "reps": "30 seg", "rest_seconds": 60}]'),

('Hipertrofia Intermedio', 'Volumen moderado para crecimiento muscular', 'ganar_musculo', 'intermedio', 50, '[{"exercise_id": 9, "sets": 4, "reps": "8-12", "rest_seconds": 90}, {"exercise_id": 8, "sets": 4, "reps": "6-10", "rest_seconds": 90}]'),

-- RUTINAS RESISTENCIA
('Base Aeróbica', 'Construcción de base cardiovascular', 'mejorar_resistencia', 'principiante', 30, '[{"exercise_id": 1, "sets": 1, "reps": "20 min", "rest_seconds": 0}, {"exercise_id": 3, "sets": 1, "reps": "10 min", "rest_seconds": 0}]'),

('Resistencia Avanzada', 'Entrenamiento de resistencia de alta intensidad', 'mejorar_resistencia', 'avanzado', 45, '[{"exercise_id": 9, "sets": 6, "reps": "4 min", "rest_seconds": 60}, {"exercise_id": 4, "sets": 8, "reps": "20", "rest_seconds": 30}]'),

-- RUTINAS MANTENER FORMA
('Mantenimiento General', 'Rutina balanceada para mantener condición', 'mantener_forma', 'intermedio', 35, '[{"exercise_id": 2, "sets": 3, "reps": "15 min", "rest_seconds": 0}, {"exercise_id": 6, "sets": 3, "reps": "10", "rest_seconds": 45}]'),

('Movilidad y Fuerza', 'Combinación de flexibilidad y fortalecimiento', 'mantener_forma', 'principiante', 25, '[{"exercise_id": 10, "sets": 1, "reps": "10 min", "rest_seconds": 0}, {"exercise_id": 11, "sets": 1, "reps": "10 min", "rest_seconds": 0}]');