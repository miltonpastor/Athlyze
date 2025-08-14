const express = require('express');
const router = express.Router();
const db = require('../db/database'); // Suponiendo que tienes un archivo para la conexión a la BD

// Middleware para proteger rutas (ejemplo, asegúrate de tener uno)
const isAuthenticated = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

// --- TAREAS DE LA HISTORIA DE USUARIO ---

// Tarea: Algoritmo de recomendación en backend (IA básica o heurística) - MEJORADO
const generateTrainingPlan = (goals) => {
    const { fitness_level, main_goal, training_days_per_week } = goals;

    // --- BASE DE DATOS DE EJERCICIOS DETALLADA ---
    const exercises = {
        cardio: {
            caminata_rapida: { name: "Caminata Rápida", description: "Paseo a un ritmo elevado para aumentar la frecuencia cardíaca.", video_url: "https://www.youtube.com/watch?v=8hJc_o3Gq-o", muscle_group: "Cardio", equipment_needed: "Ninguno", difficulty_level: "principiante" },
            trote_ligero: { name: "Trote Ligero", description: "Correr a un ritmo suave y constante.", video_url: "https://www.youtube.com/watch?v=5-31_z4nBvA", muscle_group: "Cardio", equipment_needed: "Ninguno", difficulty_level: "principiante" },
            carrera_intervalos: { name: "Carrera de Intervalos", description: "Alternar entre sprints de alta intensidad y periodos de recuperación.", video_url: "https://www.youtube.com/watch?v=cZc9d1gGj-c", muscle_group: "Cardio", equipment_needed: "Ninguno", difficulty_level: "intermedio" },
            ciclismo_moderado: { name: "Ciclismo Moderado", description: "Pedalear a un ritmo constante en una bicicleta estática o al aire libre.", video_url: "https://www.youtube.com/watch?v=4M_1p-n_Hrs", muscle_group: "Cardio", equipment_needed: "Bicicleta", difficulty_level: "intermedio" },
            eliptica: { name: "Elíptica", description: "Simula correr o caminar sin impacto en las articulaciones.", video_url: "https://www.youtube.com/watch?v=2w1d2P4vP94", muscle_group: "Cardio", equipment_needed: "Elíptica", difficulty_level: "principiante" },
            burpees: { name: "Burpees", description: "Ejercicio de cuerpo completo que combina una sentadilla, un push-up y un salto.", video_url: "https://www.youtube.com/watch?v=auBLPXO8Fww", muscle_group: "Cardio", equipment_needed: "Ninguno", difficulty_level: "avanzado" },
        },
        fuerza: {
            sentadillas: { name: "Sentadillas", description: "Flexiona las rodillas y caderas para bajar el torso. Mantén la espalda recta.", video_url: "https://www.youtube.com/watch?v=l7_B-mI4H44", muscle_group: "Piernas", equipment_needed: "Ninguno", difficulty_level: "principiante" },
            flexiones: { name: "Flexiones (Push-ups)", description: "Baja y levanta el cuerpo con los brazos. Se puede hacer sobre rodillas para menor dificultad.", video_url: "https://www.youtube.com/watch?v=F9FC_KBsLpY", muscle_group: "Pecho", equipment_needed: "Ninguno", difficulty_level: "principiante" },
            plancha: { name: "Plancha (Plank)", description: "Mantén una posición de flexión, con el cuerpo recto y el abdomen contraído.", video_url: "https://www.youtube.com/watch?v=3-G_s4vNU2c", muscle_group: "Core", equipment_needed: "Ninguno", difficulty_level: "principiante" },
            peso_muerto: { name: "Peso Muerto (Deadlift)", description: "Levanta una barra o pesas del suelo hasta la altura de la cadera. Técnica es crucial.", video_url: "https://www.youtube.com/watch?v=I5l4s_f4R2k", muscle_group: "Espalda", equipment_needed: "Barra", difficulty_level: "avanzado" },
            press_banca: { name: "Press de Banca", description: "Acostado sobre un banco, baja y levanta una barra sobre el pecho.", video_url: "https://www.youtube.com/watch?v=w_n8g-3e2yI", muscle_group: "Pecho", equipment_needed: "Barra y banco", difficulty_level: "intermedio" },
            remo_con_mancuerna: { name: "Remo con Mancuerna", description: "Inclina el torso y tira de una mancuerna hacia el costado del pecho.", video_url: "https://www.youtube.com/watch?v=p1yQj_L4K-E", muscle_group: "Espalda", equipment_needed: "Mancuerna", difficulty_level: "intermedio" },
            press_militar: { name: "Press Militar", description: "De pie o sentado, levanta una barra o mancuernas por encima de la cabeza.", video_url: "https://www.youtube.com/watch?v=6wZg9-3_1gA", muscle_group: "Hombros", equipment_needed: "Barra o mancuernas", difficulty_level: "intermedio" },
        },
        flexibilidad: {
            estiramiento_isquiotibiales: { name: "Estiramiento de Isquiotibiales", description: "Siéntate y estira las piernas, inclínate hacia adelante para tocar los pies.", video_url: "https://www.youtube.com/watch?v=7K4p-y_oT-E", muscle_group: "Piernas", equipment_needed: "Ninguno", difficulty_level: "principiante" },
            estiramiento_cuadriceps: { name: "Estiramiento de Cuádriceps", description: "De pie, lleva un talón hacia el glúteo y sostén el tobillo.", video_url: "https://www.youtube.com/watch?v=sC-2gS-A-Uw", muscle_group: "Piernas", equipment_needed: "Ninguno", difficulty_level: "principiante" },
            yoga_saludo_al_sol: { name: "Saludo al Sol (Yoga)", description: "Secuencia de posturas de yoga que estira y fortalece todo el cuerpo.", video_url: "https://www.youtube.com/watch?v=g-h_mf3j2oE", muscle_group: "Cuerpo Completo", equipment_needed: "Ninguno", difficulty_level: "principiante" },
        }
    };

    // --- DEFINICIÓN DE RUTINAS POR DÍA ---
    const routines = {
        perder_peso: {
            principiante: [
                { name: "Cardio de Baja Intensidad", duration: 40, description: "Enfocado en quemar calorías de forma sostenida.", exercises: [{ ...exercises.cardio.caminata_rapida, sets: 1, reps: "40 min", rest_period_seconds: 0 }] },
                { name: "Circuito de Cuerpo Completo", duration: 30, description: "Activa todos los grupos musculares principales.", exercises: [{ ...exercises.fuerza.sentadillas, sets: 3, reps: "15", rest_period_seconds: 60 }, { ...exercises.fuerza.flexiones, sets: 3, reps: "10 (o en rodillas)", rest_period_seconds: 60 }, { ...exercises.fuerza.plancha, sets: 3, reps: "30 seg", rest_period_seconds: 60 }] },
                { name: "Cardio y Flexibilidad", duration: 35, description: "Mejora la resistencia y la recuperación.", exercises: [{ ...exercises.cardio.trote_ligero, sets: 1, reps: "25 min", rest_period_seconds: 0 }, { ...exercises.flexibilidad.estiramiento_isquiotibiales, sets: 2, reps: "30 seg", rest_period_seconds: 30 }] },
            ],
            intermedio: [
                { name: "HIIT y Core", duration: 30, description: "Entrenamiento de intervalos de alta intensidad para maximizar la quema de grasa.", exercises: [{ ...exercises.cardio.carrera_intervalos, sets: 8, reps: "30 seg sprint, 60 seg trote", rest_period_seconds: 0 }, { ...exercises.fuerza.plancha, sets: 3, reps: "60 seg", rest_period_seconds: 60 }] },
                { name: "Fuerza Funcional", duration: 45, description: "Ejercicios compuestos para un alto gasto calórico.", exercises: [{ ...exercises.fuerza.peso_muerto, sets: 4, reps: "10", rest_period_seconds: 90 }, { ...exercises.fuerza.press_militar, sets: 3, reps: "12", rest_period_seconds: 60 }, { ...exercises.cardio.burpees, sets: 3, reps: "15", rest_period_seconds: 60 }] },
                { name: "Cardio Moderado", duration: 50, description: "Sesión más larga para construir una base aeróbica.", exercises: [{ ...exercises.cardio.ciclismo_moderado, sets: 1, reps: "50 min", rest_period_seconds: 0 }] },
            ],
            avanzado: [
                { name: "Entrenamiento Metabólico", duration: 40, description: "Rutina intensa con poco descanso para elevar el metabolismo.", exercises: [{ ...exercises.cardio.burpees, sets: 5, reps: "20", rest_period_seconds: 45 }, { ...exercises.fuerza.sentadillas, sets: 5, reps: "20", rest_period_seconds: 45 }, { ...exercises.fuerza.remo_con_mancuerna, sets: 4, reps: "15 por brazo", rest_period_seconds: 45 }] },
                { name: "Fuerza y Potencia", duration: 60, description: "Levantamientos pesados para construir músculo y quemar más calorías en reposo.", exercises: [{ ...exercises.fuerza.press_banca, sets: 5, reps: "8", rest_period_seconds: 90 }, { ...exercises.fuerza.peso_muerto, sets: 5, reps: "8", rest_period_seconds: 90 }, { ...exercises.fuerza.press_militar, sets: 4, reps: "10", rest_period_seconds: 60 }] },
                { name: "HIIT Extremo", duration: 25, description: "Intervalos muy cortos y explosivos.", exercises: [{ ...exercises.cardio.carrera_intervalos, sets: 10, reps: "20 seg sprint, 40 seg descanso", rest_period_seconds: 0 }] },
            ]
        },
        ganar_musculo: {
            principiante: [
                { name: "Full Body A", duration: 50, description: "Rutina de cuerpo completo para estimular el crecimiento.", exercises: [{ ...exercises.fuerza.sentadillas, sets: 3, reps: "10", rest_period_seconds: 60 }, { ...exercises.fuerza.press_banca, sets: 3, reps: "10", rest_period_seconds: 60 }, { ...exercises.fuerza.remo_con_mancuerna, sets: 3, reps: "10 por brazo", rest_period_seconds: 60 }] },
                { name: "Full Body B", duration: 50, description: "Variación para asegurar un estímulo completo.", exercises: [{ ...exercises.fuerza.peso_muerto, sets: 3, reps: "8", rest_period_seconds: 90 }, { ...exercises.fuerza.press_militar, sets: 3, reps: "10", rest_period_seconds: 60 }, { ...exercises.fuerza.flexiones, sets: 3, reps: "hasta el fallo", rest_period_seconds: 60 }] },
            ],
            intermedio: [
                { name: "Tren Superior (Empuje)", duration: 60, description: "Enfocado en pecho, hombros y tríceps.", exercises: [{ ...exercises.fuerza.press_banca, sets: 4, reps: "12", rest_period_seconds: 60 }, { ...exercises.fuerza.press_militar, sets: 4, reps: "12", rest_period_seconds: 60 }, { ...exercises.fuerza.flexiones, sets: 3, reps: "15", rest_period_seconds: 60 }] },
                { name: "Tren Inferior", duration: 60, description: "Enfocado en piernas y glúteos.", exercises: [{ ...exercises.fuerza.sentadillas, sets: 4, reps: "12", rest_period_seconds: 90 }, { ...exercises.fuerza.peso_muerto, sets: 3, reps: "10", rest_period_seconds: 90 }, { name: "Zancadas", description: "Paso adelante y flexión de rodilla.", sets: 3, reps: "12 por pierna", rest_period_seconds: 60 }] },
                { name: "Tren Superior (Tirón)", duration: 60, description: "Enfocado en espalda y bíceps.", exercises: [{ name: "Dominadas", description: "Colgado de una barra, levanta tu cuerpo.", sets: 4, reps: "hasta el fallo", rest_period_seconds: 60 }, { ...exercises.fuerza.remo_con_mancuerna, sets: 4, reps: "12 por brazo", rest_period_seconds: 60 }, { name: "Curl de Bíceps", description: "Flexiona el codo para levantar una pesa.", sets: 3, reps: "12 por brazo", rest_period_seconds: 60 }] },
            ],
            avanzado: [
                { name: "Día de Pecho y Tríceps", duration: 70, description: "Volumen alto para hipertrofia.", exercises: [{ ...exercises.fuerza.press_banca, sets: 5, reps: "10", rest_period_seconds: 90 }, { name: "Press Inclinado", description: "Press de banca en un banco inclinado.", sets: 4, reps: "12", rest_period_seconds: 60 }, { name: "Fondos en paralelas", description: "Baja y sube el cuerpo entre dos barras.", sets: 4, reps: "15", rest_period_seconds: 60 }] },
                { name: "Día de Espalda y Bíceps", duration: 70, description: "Construye una espalda ancha y brazos fuertes.", exercises: [{ ...exercises.fuerza.peso_muerto, sets: 5, reps: "5", rest_period_seconds: 90 }, { name: "Dominadas con lastre", description: "Dominadas con peso adicional.", sets: 4, reps: "8", rest_period_seconds: 60 }, { ...exercises.fuerza.remo_con_mancuerna, sets: 4, reps: "10 por brazo", rest_period_seconds: 60 }] },
                { name: "Día de Piernas y Hombros", duration: 70, description: "Rutina demandante para la máxima ganancia muscular.", exercises: [{ ...exercises.fuerza.sentadillas, sets: 5, reps: "10", rest_period_seconds: 90 }, { name: "Prensa de Piernas", description: "Empuja una plataforma con las piernas.", sets: 4, reps: "15", rest_period_seconds: 90 }, { ...exercises.fuerza.press_militar, sets: 5, reps: "10", rest_period_seconds: 60 }] },
            ]
        },
        // Las rutinas para 'mejorar_resistencia' y 'mantener_forma' seguirían una estructura similar.
        // Por brevedad, se omiten pero deberían ser implementadas.
    };

    // --- LÓGICA DE GENERACIÓN DEL PLAN ---
    let plan = {
        title: `Plan de Entrenamiento Personalizado`,
        description: `Basado en tu nivel ${fitness_level}, tu objetivo de ${main_goal.replace('_', ' ')} y ${training_days_per_week} días de entrenamiento.`,
        schedule: []
    };

    const selectedRoutines = routines[main_goal]?.[fitness_level];

    if (!selectedRoutines) {
        // Fallback por si no hay una rutina definida para esa combinación
        return {
            title: "Plan no disponible",
            description: "Actualmente no tenemos una rutina específica para tus selecciones. Por favor, intenta con otros objetivos.",
            schedule: []
        };
    }

    for (let i = 0; i < training_days_per_week; i++) {
        const routine = selectedRoutines[i % selectedRoutines.length]; // Cicla las rutinas si hay más días de entreno que rutinas definidas
        plan.schedule.push({
            day: `Día ${i + 1}`,
            routine: routine
        });
    }

    // Añadir días de descanso
    const total_days = 7;
    if (training_days_per_week < total_days) {
        const nonTrainingDays = Array.from({ length: total_days - training_days_per_week }, (_, i) => `Día ${training_days_per_week + i + 1}`);
        nonTrainingDays.forEach(day => {
            plan.schedule.push({
                day: day,
                routine: {
                    name: "Descanso",
                    description: "El descanso es crucial para la recuperación muscular y la prevención de lesiones. Puedes hacer estiramientos suaves o una caminata ligera.",
                    exercises: [{ ...exercises.flexibilidad.yoga_saludo_al_sol, sets: 1, reps: "15 min", rest_period_seconds: 0 }]
                }
            });
        });
    }
    
    // Ordenar el plan por día
    plan.schedule.sort((a, b) => parseInt(a.day.split(' ')[1]) - parseInt(b.day.split(' ')[1]));

    return plan;
};


// Tarea: Formulario de perfil de usuario y objetivos (GET)
router.get('/setup', isAuthenticated, async (req, res) => {
  try {
    const userGoalsResult = await db.query('SELECT * FROM user_goals WHERE user_id = $1', [req.session.user.id]);
    const userGoals = userGoalsResult.rows[0] || {};
    // Renderiza la vista con los datos del usuario si existen
    res.render('training/setup', { title: 'Configura tu Plan', userGoals });
  } catch (error) {
    console.error(error);
    res.render('500');
  }
});

// Tarea: API para recibir sugerencias personalizadas (POST)
router.post('/generate', isAuthenticated, async (req, res) => {
  const { fitness_level, main_goal, training_days_per_week } = req.body;
  const userId = req.session.user.id;

  try {
    // Guardar o actualizar los objetivos en la base de datos
    // Esta es una operación "UPSERT" (update or insert)
    await db.query(`
      INSERT INTO user_goals (user_id, fitness_level, main_goal, training_days_per_week, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        fitness_level = EXCLUDED.fitness_level,
        main_goal = EXCLUDED.main_goal,
        training_days_per_week = EXCLUDED.training_days_per_week,
        updated_at = NOW();
    `, [userId, fitness_level, main_goal, training_days_per_week]);

    // Generar el plan de entrenamiento
    const trainingPlan = generateTrainingPlan({ fitness_level, main_goal, training_days_per_week });

    // Tarea: Interfaz para mostrar la rutina sugerida
    res.render('training/plan', {
      title: 'Tu Plan de Entrenamiento Personalizado',
      plan: trainingPlan
    });

  } catch (error) {
    console.error('Error al generar el plan:', error);
    res.render('500');
  }
});


module.exports = router;
