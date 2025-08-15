const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Middleware para proteger rutas
const isAuthenticated = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

// --- ALGORITMO AVANZADO DE RECOMENDACIÓN DE ENTRENAMIENTO ---
class TrainingRecommendationEngine {
    
    // Función principal para generar el plan personalizado
    static async generateTrainingPlan(userGoals, userId) {
        try {
            // 1. Obtener ejercicios de la base de datos
            const exercises = await this.getExercisesFromDB();
            
            // 2. Calcular BMI y otras métricas
            const userMetrics = this.calculateUserMetrics(userGoals);
            
            // 3. Filtrar ejercicios por condiciones médicas
            const safeExercises = this.filterExercisesByHealthConditions(exercises, userGoals.health_conditions);
            
            // 4. Filtrar por equipamiento disponible
            const availableExercises = this.filterExercisesByEquipment(safeExercises, userGoals.equipment);
            
            // 5. Generar rutinas específicas por objetivo
            const weeklyPlan = this.generateWeeklyRoutines(availableExercises, userGoals, userMetrics);
            
            // 6. Guardar el plan en la base de datos
            const savedPlan = await this.savePlanToDB(weeklyPlan, userId);
            
            return weeklyPlan;
            
        } catch (error) {
            console.error('Error generando plan:', error);
            return this.getFallbackPlan();
        }
    }
    
    // Obtener ejercicios de la base de datos
    static async getExercisesFromDB() {
        const result = await db.query('SELECT * FROM exercises WHERE is_active = true ORDER BY name');
        return result.rows;
    }
    
    // Calcular métricas del usuario
    static calculateUserMetrics(userGoals) {
        const height = userGoals.height / 100; // convertir a metros
        const weight = parseFloat(userGoals.current_weight);
        const bmi = weight / (height * height);
        
        let bmiCategory = 'normal';
        if (bmi < 18.5) bmiCategory = 'Peso bajo';
        else if (bmi >= 25 && bmi < 30) bmiCategory = 'Sobrepeso';
        else if (bmi >= 30) bmiCategory = 'Obesidad';
        
        // Calcular calorías objetivo aproximadas usando fórmula Mifflin-St Jeor
        const age = parseInt(userGoals.age);
        let bmr;
        if (userGoals.gender === 'male') {
            bmr = (10 * weight) + (6.25 * userGoals.height) - (5 * age) + 5;
        } else {
            bmr = (10 * weight) + (6.25 * userGoals.height) - (5 * age) - 161;
        }
        
        // Multiplicadores de actividad
        const activityMultipliers = {
            'sedentary': 1.2,
            'lightly_active': 1.375,
            'moderately_active': 1.55,
            'very_active': 1.725
        };
        
        const tdee = bmr * activityMultipliers[userGoals.activity_level];
        
        return {
            bmi,
            bmiCategory,
            bmr,
            tdee,
            recommendedCaloriesPerSession: Math.round(tdee * 0.15) // 15% de TDEE por sesión
        };
    }
    
    // Filtrar ejercicios por condiciones de salud
    static filterExercisesByHealthConditions(exercises, healthConditions) {
        if (!healthConditions || healthConditions.length === 0) {
            return exercises;
        }
        
        return exercises.filter(exercise => {
            const contraindications = exercise.contraindications || [];
            return !contraindications.some(condition => healthConditions.includes(condition));
        });
    }
    
    // Filtrar ejercicios por equipamiento disponible
    static filterExercisesByEquipment(exercises, availableEquipment) {
        if (!availableEquipment || availableEquipment.length === 0) {
            // Si no se especifica equipo, solo ejercicios sin equipo
            return exercises.filter(ex => 
                ex.equipment_needed && ex.equipment_needed.includes('sin_equipo')
            );
        }
        
        return exercises.filter(exercise => {
            const requiredEquipment = exercise.equipment_needed || [];
            return requiredEquipment.some(equipment => availableEquipment.includes(equipment));
        });
    }
    
    // Generar rutinas semanales MEJORADAS
    static generateWeeklyRoutines(exercises, userGoals, userMetrics) {
        const { main_goal, fitness_level, training_days_per_week, time_per_session, secondary_goals } = userGoals;
        
        // Estrategias de entrenamiento por objetivo (MEJORADAS)
        const trainingStrategies = {
            'perder_peso': {
                cardioRatio: userGoals.experience_years > 1 ? 0.7 : 0.6,
                fuerzaRatio: userGoals.experience_years > 1 ? 0.2 : 0.3,
                flexibilidadRatio: 0.1,
                intensityFactor: userMetrics.bmiCategory === 'Obesidad' ? 0.9 : 1.2
            },
            'ganar_musculo': {
                cardioRatio: 0.15,
                fuerzaRatio: 0.75,
                flexibilidadRatio: 0.1,
                intensityFactor: userGoals.experience_years > 2 ? 1.1 : 1.0
            },
            'mejorar_resistencia': {
                cardioRatio: 0.75,
                fuerzaRatio: 0.15,
                flexibilidadRatio: 0.1,
                intensityFactor: userGoals.age > 50 ? 0.9 : 1.1
            },
            'mantener_forma': {
                cardioRatio: 0.4,
                fuerzaRatio: 0.4,
                flexibilidadRatio: 0.2,
                intensityFactor: 0.9
            }
        };
        
        let strategy = trainingStrategies[main_goal];
        
        // Ajustar estrategia basada en objetivos secundarios
        if (secondary_goals && secondary_goals.length > 0) {
            if (secondary_goals.includes('mejorar_flexibilidad')) {
                strategy.flexibilidadRatio += 0.1;
                strategy.fuerzaRatio -= 0.05;
                strategy.cardioRatio -= 0.05;
            }
            if (secondary_goals.includes('reducir_estres')) {
                strategy.intensityFactor *= 0.85;
                strategy.flexibilidadRatio += 0.05;
            }
        }
        
        // Filtrar y categorizar ejercicios con múltiples niveles de respaldo
        const cardioExercises = this.getExercisesByCategory(exercises, 'cardio', fitness_level);
        const fuerzaExercises = this.getExercisesByCategory(exercises, 'fuerza', fitness_level);
        const flexibilidadExercises = this.getExercisesByCategory(exercises, 'flexibilidad', fitness_level, false);
        const funcionalExercises = this.getExercisesByCategory(exercises, 'funcional', fitness_level);
        
        const plan = {
            title: `Plan Personalizado - ${main_goal.replace('_', ' ').toUpperCase()}`,
            description: this.generatePlanDescription(userGoals, userMetrics),
            schedule: [],
            userMetrics,
            planAnalysis: {
                totalExercisesAvailable: exercises.length,
                cardioOptions: cardioExercises.length,
                fuerzaOptions: fuerzaExercises.length,
                flexibilidadOptions: flexibilidadExercises.length,
                strategy: strategy
            }
        };
        
        // Generar rutinas para cada día con distribución inteligente
        const dayDistribution = this.getOptimalDayDistribution(training_days_per_week);
        
        for (let i = 0; i < training_days_per_week; i++) {
            const dayNumber = dayDistribution[i];
            const routine = this.generateDailyRoutine(
                i + 1, // Número secuencial para lógica interna
                cardioExercises, 
                fuerzaExercises.concat(funcionalExercises), // Combinar fuerza y funcional
                flexibilidadExercises, 
                strategy, 
                userGoals,
                userMetrics
            );
            
            plan.schedule.push({
                day: this.getDayName(dayNumber),
                routine,
                focus: this.getDayFocus(i + 1, main_goal, training_days_per_week)
            });
        }
        
        // Añadir días de descanso activo mejorados
        this.addRestDays(plan, training_days_per_week, flexibilidadExercises);
        
        // Análisis de diversidad del plan
        const diversityAnalysis = this.analyzePlanDiversity(plan);
        plan.diversityScore = diversityAnalysis;
        
        return plan;
    }
    
    // Función auxiliar para obtener ejercicios por categoría con respaldo multinivel
    static getExercisesByCategory(exercises, category, fitness_level, requireExactLevel = true) {
        // Filtrar por categoría exacta
        let filtered = exercises.filter(ex => ex.category === category);
        
        // Filtrar por nivel
        let byLevel = filtered.filter(ex => ex.difficulty_level === fitness_level);
        
        // Si no hay suficientes ejercicios del nivel exacto, incluir niveles adyacentes
        if (byLevel.length < 3 && !requireExactLevel) {
            if (fitness_level === 'intermedio' || fitness_level === 'avanzado') {
                byLevel.push(...filtered.filter(ex => ex.difficulty_level === 'principiante'));
            }
            if (fitness_level === 'avanzado') {
                byLevel.push(...filtered.filter(ex => ex.difficulty_level === 'intermedio'));
            }
        }
        
        return byLevel.length > 0 ? byLevel : filtered; // Fallback a todos los de la categoría
    }
    
    // Determinar el enfoque del día
    static getDayFocus(day, goal, totalDays) {
        const focuses = {
            'perder_peso': ['Cardio Intenso', 'Circuito Mixto', 'HIIT', 'Resistencia', 'Quema Grasa'],
            'ganar_musculo': ['Push (Empuje)', 'Pull (Tirón)', 'Piernas', 'Core/Funcional', 'Full Body'],
            'mejorar_resistencia': ['Base Aeróbica', 'Intervalos', 'Tempo', 'Recuperación Activa', 'Resistencia Larga'],
            'mantener_forma': ['Balanceado', 'Fuerza General', 'Cardio Moderado', 'Flexibilidad', 'Funcional']
        };
        
        const dayFocuses = focuses[goal] || focuses['mantener_forma'];
        return dayFocuses[(day - 1) % dayFocuses.length];
    }
    
    // Generar descripción personalizada del plan
    static generatePlanDescription(userGoals, userMetrics) {
        const { main_goal, fitness_level, training_days_per_week, age, gender } = userGoals;
        const { bmiCategory, recommendedCaloriesPerSession } = userMetrics;
        
        let description = `Plan diseñado específicamente para ${gender === 'male' ? 'hombre' : gender === 'female' ? 'mujer' : 'persona'} de ${age} años, `;
        description += `nivel ${fitness_level}, con objetivo principal de ${main_goal.replace('_', ' ')}. `;
        description += `Entrenarás ${training_days_per_week} días por semana, `;
        description += `quemando aproximadamente ${recommendedCaloriesPerSession} calorías por sesión.`;
        
        if (bmiCategory !== 'normal') {
            if (bmiCategory === 'overweight') {
                description += ` Tu plan incluye ejercicios adicionales de cardio para ayudar con la pérdida de peso.`;
            } else if (bmiCategory === 'underweight') {
                description += ` Tu plan se enfoca más en ejercicios de fuerza para ayudar a ganar masa muscular.`;
            }
        }
        
        return description;
    }
    
    // Generar rutina diaria MEJORADA
    static generateDailyRoutine(day, cardioExercises, fuerzaExercises, flexibilidadExercises, strategy, userGoals, userMetrics) {
        const { time_per_session, fitness_level, secondary_goals } = userGoals;
        const routineName = this.generateRoutineName(day, userGoals.main_goal);
        
        // Aplicar optimizaciones por objetivos secundarios
        const optimizedCardio = this.optimizeForSecondaryGoals(cardioExercises, secondary_goals);
        const optimizedFuerza = this.optimizeForSecondaryGoals(fuerzaExercises, secondary_goals);
        const optimizedFlexibilidad = this.optimizeForSecondaryGoals(flexibilidadExercises, secondary_goals);
        
        // Calcular tiempo por categoría con ajuste inteligente
        let cardioTime = Math.floor(time_per_session * strategy.cardioRatio);
        let fuerzaTime = Math.floor(time_per_session * strategy.fuerzaRatio);
        let flexibilidadTime = Math.floor(time_per_session * strategy.flexibilidadRatio);
        
        // Ajustar tiempos basado en objetivos secundarios
        if (secondary_goals && secondary_goals.includes('mejorar_flexibilidad')) {
            flexibilidadTime += 5;
            cardioTime -= 3;
            fuerzaTime -= 2;
        }
        if (secondary_goals && secondary_goals.includes('reducir_estres')) {
            flexibilidadTime += 3;
            cardioTime -= 2;
            fuerzaTime -= 1;
        }
        
        const selectedExercises = [];
        
        // Generar plan de calentamiento
        const warmup = this.generateWarmupPlan([...optimizedCardio, ...optimizedFuerza].slice(0, 3));
        
        // Seleccionar ejercicios de cardio con balance inteligente
        if (cardioTime > 0 && optimizedCardio.length > 0) {
            const cardioCount = Math.min(Math.max(1, Math.floor(cardioTime / 15)), optimizedCardio.length);
            const targetMuscles = day % 2 === 1 ? ['piernas', 'core'] : ['cuerpo_completo'];
            const selectedCardio = this.selectBalancedExercises(optimizedCardio, cardioCount, targetMuscles);
            
            selectedCardio.forEach(exercise => {
                selectedExercises.push(this.adaptExerciseForUser(exercise, 'cardio', fitness_level, cardioTime / cardioCount));
            });
        }
        
        // Seleccionar ejercicios de fuerza con progresión inteligente
        if (fuerzaTime > 0 && optimizedFuerza.length > 0) {
            const fuerzaCount = Math.min(Math.max(2, Math.floor(fuerzaTime / 8)), optimizedFuerza.length);
            
            // Alternar grupos musculares por día
            const targetMusclesByDay = {
                1: ['pecho', 'triceps', 'hombros'], // Push
                2: ['piernas', 'gluteos'], // Legs
                3: ['espalda', 'biceps'], // Pull
                4: ['core', 'funcional'], // Core/Functional
                5: ['cuerpo_completo'] // Full body
            };
            
            const dayTargets = targetMusclesByDay[day % 5] || ['cuerpo_completo'];
            const selectedFuerza = this.selectBalancedExercises(optimizedFuerza, fuerzaCount, dayTargets);
            
            selectedFuerza.forEach((exercise, index) => {
                // Variar intensidad dentro de la sesión
                const intensityMultiplier = index === 0 ? 1.1 : (index === selectedFuerza.length - 1 ? 0.9 : 1.0);
                const adaptedExercise = this.adaptExerciseForUser(exercise, 'fuerza', fitness_level, fuerzaTime / fuerzaCount);
                
                // Aplicar multiplicador de intensidad
                if (adaptedExercise.sets && typeof adaptedExercise.sets === 'number') {
                    adaptedExercise.sets = Math.ceil(adaptedExercise.sets * intensityMultiplier);
                }
                
                selectedExercises.push(adaptedExercise);
            });
        }
        
        // Seleccionar ejercicios de flexibilidad específicos
        if (flexibilidadTime > 0 && optimizedFlexibilidad.length > 0) {
            const flexCount = Math.min(2, optimizedFlexibilidad.length);
            const selectedFlex = this.selectRandomExercises(optimizedFlexibilidad, flexCount);
            
            selectedFlex.forEach(exercise => {
                selectedExercises.push(this.adaptExerciseForUser(exercise, 'flexibilidad', fitness_level, flexibilidadTime / flexCount));
            });
        }
        
        // Calcular calorías estimadas más precisamente
        const estimatedCalories = this.calculateSessionCalories(selectedExercises, userMetrics);
        
        return {
            name: routineName,
            description: this.generateRoutineDescription(day, userGoals.main_goal, selectedExercises.length),
            duration: time_per_session,
            warmup: warmup,
            exercises: selectedExercises,
            estimatedCalories: estimatedCalories,
            muscleGroups: this.extractMainMuscleGroups(selectedExercises),
            difficultyRating: this.calculateDifficultyRating(selectedExercises, fitness_level)
        };
    }
    
    // Calcular calorías de la sesión más precisamente
    static calculateSessionCalories(exercises, userMetrics) {
        let totalCalories = 0;
        
        exercises.forEach(exercise => {
            // Obtener calorías por minuto del ejercicio o usar valor por defecto
            const caloriesPerMinute = exercise.calories_per_minute || 
                (exercise.category === 'cardio' ? 8 : 
                 exercise.category === 'fuerza' ? 5 : 2);
            
            // Calcular duración estimada del ejercicio
            let exerciseDuration = 0;
            if (exercise.reps && exercise.reps.includes('min')) {
                exerciseDuration = parseInt(exercise.reps.match(/\d+/)[0]);
            } else if (exercise.sets && exercise.reps) {
                // Estimar duración basada en sets y repeticiones
                const sets = parseInt(exercise.sets);
                const restTime = (exercise.rest_period_seconds || 60) * sets / 60; // convertir a minutos
                exerciseDuration = sets * 2 + restTime; // ~2 min por set + descansos
            }
            
            totalCalories += caloriesPerMinute * exerciseDuration;
        });
        
        // Ajustar por peso corporal del usuario
        const weightFactor = userMetrics.bmr / 1500; // Factor basado en BMR promedio
        
        return Math.round(totalCalories * weightFactor);
    }
    
    // Calcular dificultad de la rutina
    static calculateDifficultyRating(exercises, userLevel) {
        const levelScores = { 'principiante': 1, 'intermedio': 2, 'avanzado': 3 };
        const userScore = levelScores[userLevel];
        
        let totalDifficulty = 0;
        exercises.forEach(exercise => {
            const exerciseScore = levelScores[exercise.difficulty_level] || 2;
            totalDifficulty += exerciseScore;
        });
        
        const avgDifficulty = totalDifficulty / exercises.length;
        const relativeDifficulty = avgDifficulty / userScore;
        
        if (relativeDifficulty <= 0.8) return 'Fácil';
        if (relativeDifficulty <= 1.2) return 'Apropiado';
        return 'Desafiante';
    }
    
    // Adaptar ejercicio para el usuario específico
    static adaptExerciseForUser(exercise, category, fitness_level, timeAllotted) {
        const levelMultipliers = {
            'principiante': { sets: 1, reps: 0.8, rest: 1.2 },
            'intermedio': { sets: 1.2, reps: 1, rest: 1 },
            'avanzado': { sets: 1.4, reps: 1.2, rest: 0.8 }
        };
        
        const multiplier = levelMultipliers[fitness_level];
        
        let adaptedExercise = {
            name: exercise.name,
            description: exercise.description,
            video_url: exercise.video_url,
            muscle_group: Array.isArray(exercise.muscle_groups) ? exercise.muscle_groups.join(', ') : exercise.muscle_groups,
            equipment_needed: Array.isArray(exercise.equipment_needed) ? exercise.equipment_needed.join(', ') : exercise.equipment_needed,
            difficulty_level: exercise.difficulty_level,
            instructions: exercise.instructions,
        };
        
        if (category === 'cardio') {
            adaptedExercise.sets = 1;
            adaptedExercise.reps = `${Math.floor(timeAllotted / 2)} min`;
            adaptedExercise.rest_period_seconds = 0;
        } else if (category === 'fuerza') {
            adaptedExercise.sets = Math.ceil(3 * multiplier.sets);
            adaptedExercise.reps = fitness_level === 'principiante' ? '8-10' : fitness_level === 'intermedio' ? '10-12' : '12-15';
            adaptedExercise.rest_period_seconds = Math.floor(60 * multiplier.rest);
        } else if (category === 'flexibilidad') {
            adaptedExercise.sets = 1;
            adaptedExercise.reps = `${timeAllotted} min`;
            adaptedExercise.rest_period_seconds = 0;
        }
        
        return adaptedExercise;
    }
    
    // Seleccionar ejercicios aleatorios
    static selectRandomExercises(exercises, count) {
        const shuffled = exercises.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    // === NUEVAS FUNCIONES AVANZADAS ===
    
    // Selección inteligente de ejercicios evitando repetición de grupos musculares
    static selectBalancedExercises(exercises, count, targetMuscleGroups = []) {
        const selected = [];
        const usedMuscleGroups = new Set();
        const exercisesCopy = [...exercises];
        
        // Priorizar ejercicios que trabajen grupos musculares objetivo
        if (targetMuscleGroups.length > 0) {
            exercisesCopy.sort((a, b) => {
                const aMatches = this.countMuscleGroupMatches(a.muscle_groups, targetMuscleGroups);
                const bMatches = this.countMuscleGroupMatches(b.muscle_groups, targetMuscleGroups);
                return bMatches - aMatches;
            });
        }
        
        for (const exercise of exercisesCopy) {
            if (selected.length >= count) break;
            
            const exerciseMuscles = Array.isArray(exercise.muscle_groups) ? 
                exercise.muscle_groups : JSON.parse(exercise.muscle_groups || '[]');
            
            // Verificar si no hay solapamiento excesivo de grupos musculares
            const hasOverlap = exerciseMuscles.some(muscle => usedMuscleGroups.has(muscle));
            
            if (!hasOverlap || selected.length < Math.ceil(count / 2)) {
                selected.push(exercise);
                exerciseMuscles.forEach(muscle => usedMuscleGroups.add(muscle));
            }
        }
        
        // Si no tenemos suficientes, completar con ejercicios aleatorios
        if (selected.length < count) {
            const remaining = exercisesCopy.filter(ex => !selected.includes(ex));
            const shuffled = remaining.sort(() => 0.5 - Math.random());
            selected.push(...shuffled.slice(0, count - selected.length));
        }
        
        return selected;
    }
    
    // Contar coincidencias de grupos musculares
    static countMuscleGroupMatches(exerciseMuscles, targetMuscles) {
        const exerciseArray = Array.isArray(exerciseMuscles) ? 
            exerciseMuscles : JSON.parse(exerciseMuscles || '[]');
        return exerciseArray.filter(muscle => targetMuscles.includes(muscle)).length;
    }
    
    // Generar progresión semanal (hacer ejercicios más difíciles cada semana)
    static generateProgressivePlan(exercises, userGoals, userMetrics, weekNumber = 1) {
        const progressionMultiplier = 1 + (weekNumber - 1) * 0.1; // 10% más cada semana
        
        const modifiedGoals = {
            ...userGoals,
            progression_week: weekNumber,
            intensity_multiplier: Math.min(progressionMultiplier, 1.5) // Max 150%
        };
        
        return this.generateWeeklyRoutines(exercises, modifiedGoals, userMetrics);
    }
    
    // Análisis de diversidad de ejercicios para evitar monotonía
    static analyzePlanDiversity(plan) {
        const allExercises = [];
        const muscleGroupFrequency = {};
        const equipmentUsage = {};
        
        plan.schedule.forEach(day => {
            if (day.routine.exercises) {
                day.routine.exercises.forEach(exercise => {
                    allExercises.push(exercise.name);
                    
                    // Contar grupos musculares
                    const muscles = exercise.muscle_group ? exercise.muscle_group.split(', ') : [];
                    muscles.forEach(muscle => {
                        muscleGroupFrequency[muscle] = (muscleGroupFrequency[muscle] || 0) + 1;
                    });
                    
                    // Contar equipamiento
                    const equipment = exercise.equipment_needed || 'sin_equipo';
                    equipmentUsage[equipment] = (equipmentUsage[equipment] || 0) + 1;
                });
            }
        });
        
        return {
            totalExercises: allExercises.length,
            uniqueExercises: new Set(allExercises).size,
            diversityScore: new Set(allExercises).size / allExercises.length,
            muscleGroupBalance: muscleGroupFrequency,
            equipmentDistribution: equipmentUsage
        };
    }
    
    // Optimizar plan basado en objetivos secundarios
    static optimizeForSecondaryGoals(exercises, secondaryGoals) {
        let optimizedExercises = [...exercises];
        
        if (!secondaryGoals || secondaryGoals.length === 0) return optimizedExercises;
        
        secondaryGoals.forEach(goal => {
            switch(goal) {
                case 'mejorar_flexibilidad':
                    // Priorizar ejercicios de flexibilidad
                    optimizedExercises = optimizedExercises.sort((a, b) => 
                        (b.category === 'flexibilidad' ? 1 : 0) - (a.category === 'flexibilidad' ? 1 : 0)
                    );
                    break;
                    
                case 'reducir_estres':
                    // Priorizar ejercicios de bajo impacto y yoga
                    optimizedExercises = optimizedExercises.sort((a, b) => {
                        const aLowImpact = a.name.toLowerCase().includes('yoga') || 
                                          a.name.toLowerCase().includes('estiramiento') ||
                                          a.category === 'flexibilidad' ? 1 : 0;
                        const bLowImpact = b.name.toLowerCase().includes('yoga') || 
                                          b.name.toLowerCase().includes('estiramiento') ||
                                          b.category === 'flexibilidad' ? 1 : 0;
                        return bLowImpact - aLowImpact;
                    });
                    break;
                    
                case 'mejorar_postura':
                    // Priorizar ejercicios de core y espalda
                    optimizedExercises = optimizedExercises.sort((a, b) => {
                        const aPosture = this.targetsPostureMuscles(a.muscle_groups) ? 1 : 0;
                        const bPosture = this.targetsPostureMuscles(b.muscle_groups) ? 1 : 0;
                        return bPosture - aPosture;
                    });
                    break;
                    
                case 'aumentar_energia':
                    // Priorizar ejercicios de cardio moderado
                    optimizedExercises = optimizedExercises.sort((a, b) => {
                        const aCardio = a.category === 'cardio' && a.difficulty_level !== 'avanzado' ? 1 : 0;
                        const bCardio = b.category === 'cardio' && b.difficulty_level !== 'avanzado' ? 1 : 0;
                        return bCardio - aCardio;
                    });
                    break;
            }
        });
        
        return optimizedExercises;
    }
    
    // Verificar si un ejercicio trabaja músculos importantes para postura
    static targetsPostureMuscles(muscleGroups) {
        const postureMuscles = ['core', 'espalda', 'espalda_baja', 'hombros'];
        const muscles = Array.isArray(muscleGroups) ? 
            muscleGroups : JSON.parse(muscleGroups || '[]');
        return muscles.some(muscle => postureMuscles.includes(muscle));
    }
    
    // Generar plan de calentamiento específico
    static generateWarmupPlan(mainExercises) {
        const warmupExercises = [
            {
                name: "Movilidad Articular",
                description: "Círculos con brazos, caderas y tobillos",
                duration: "3 min",
                instructions: ["Movimientos lentos y controlados", "Cada articulación 10 repeticiones"]
            },
            {
                name: "Activación Cardiovascular",
                description: "Marcha en el lugar con elevación de rodillas",
                duration: "2 min",
                instructions: ["Ritmo moderado", "Respiración profunda"]
            }
        ];
        
        // Añadir calentamiento específico basado en ejercicios principales
        const mainMuscles = this.extractMainMuscleGroups(mainExercises);
        if (mainMuscles.includes('piernas')) {
            warmupExercises.push({
                name: "Sentadillas Suaves",
                description: "Sentadillas lentas para activar piernas",
                duration: "1 min",
                instructions: ["Movimiento lento", "Rango completo de movimiento"]
            });
        }
        
        return {
            name: "Calentamiento",
            duration: 5,
            exercises: warmupExercises
        };
    }
    
    // Extraer grupos musculares principales de una lista de ejercicios
    static extractMainMuscleGroups(exercises) {
        const allMuscles = [];
        exercises.forEach(exercise => {
            const muscles = Array.isArray(exercise.muscle_groups) ? 
                exercise.muscle_groups : JSON.parse(exercise.muscle_groups || '[]');
            allMuscles.push(...muscles);
        });
        
        // Contar frecuencia y devolver los más comunes
        const frequency = {};
        allMuscles.forEach(muscle => {
            frequency[muscle] = (frequency[muscle] || 0) + 1;
        });
        
        return Object.keys(frequency).sort((a, b) => frequency[b] - frequency[a]);
    }
    
    // Generar nombre de rutina
    static generateRoutineName(day, goal) {
        const routineNames = {
            'perder_peso': [
                'Quema Grasa Intensa',
                'Cardio & Fuerza',
                'HIIT Metabólico',
                'Circuito Completo',
                'Activación Total'
            ],
            'ganar_musculo': [
                'Construcción Muscular',
                'Fuerza & Hipertrofia',
                'Desarrollo Muscular',
                'Potencia y Volumen',
                'Anabólico Intenso'
            ],
            'mejorar_resistencia': [
                'Resistencia Aeróbica',
                'Capacidad Cardiovascular',
                'Endurance Training',
                'Resistencia Avanzada',
                'Acondicionamiento'
            ],
            'mantener_forma': [
                'Mantenimiento Activo',
                'Forma Física General',
                'Entrenamiento Balanceado',
                'Acondicionamiento General',
                'Fitness Integral'
            ]
        };
        
        const names = routineNames[goal] || routineNames['mantener_forma'];
        return names[(day - 1) % names.length];
    }
    
    // Generar descripción de rutina
    static generateRoutineDescription(day, goal, exerciseCount) {
        const descriptions = {
            'perder_peso': `Rutina del día ${day} enfocada en maximizar la quema de calorías con ${exerciseCount} ejercicios variados.`,
            'ganar_musculo': `Entrenamiento del día ${day} diseñado para estimular el crecimiento muscular con ${exerciseCount} ejercicios de fuerza.`,
            'mejorar_resistencia': `Sesión del día ${day} para desarrollar capacidad cardiovascular con ${exerciseCount} ejercicios de resistencia.`,
            'mantener_forma': `Rutina balanceada del día ${day} con ${exerciseCount} ejercicios para mantener tu condición física.`
        };
        
        return descriptions[goal] || descriptions['mantener_forma'];
    }
    
    // Obtener nombre del día
    static getDayName(dayNumber) {
        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        return days[(dayNumber - 1) % 7];
    }
    
    // Obtener distribución óptima de días de entrenamiento
    static getOptimalDayDistribution(trainingDays) {
        const distributions = {
            1: [1], // Solo Lunes
            2: [1, 4], // Lunes, Jueves
            3: [1, 3, 5], // Lunes, Miércoles, Viernes
            4: [1, 3, 5, 7], // Lunes, Miércoles, Viernes, Domingo
            5: [1, 2, 4, 5, 7], // Lunes, Martes, Jueves, Viernes, Domingo
            6: [1, 2, 3, 5, 6, 7], // Lunes-Miércoles, Viernes-Domingo
            7: [1, 2, 3, 4, 5, 6, 7] // Todos los días
        };
        
        return distributions[trainingDays] || distributions[3]; // Fallback a 3 días
    }
    
    // Añadir días de descanso CORREGIDO
    static addRestDays(plan, trainingDays, flexibilityExercises) {
        const totalDays = 7;
        
        if (trainingDays < totalDays) {
            // Crear un array de todos los días de la semana
            const allDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
            
            // Obtener los días que ya están ocupados por entrenamiento
            const usedDays = plan.schedule.map(item => item.day);
            
            // Encontrar días disponibles para descanso
            const availableDays = allDays.filter(day => !usedDays.includes(day));
            
            // Añadir días de descanso a los días disponibles
            availableDays.forEach(day => {
                const restExercise = flexibilityExercises.length > 0 ? 
                    this.selectRandomExercises(flexibilityExercises, 1)[0] : null;
                
                plan.schedule.push({
                    day: day,
                    routine: {
                        name: "Descanso Activo",
                        description: "Día de recuperación con actividad suave para mantener la movilidad y acelerar la recuperación.",
                        duration: 20,
                        exercises: restExercise ? [this.adaptExerciseForUser(restExercise, 'flexibilidad', 'principiante', 20)] : [],
                        estimatedCalories: 50,
                        isRestDay: true
                    }
                });
            });
        }
        
        // Ordenar por día de la semana (sin duplicados)
        plan.schedule.sort((a, b) => {
            const dayOrder = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
            return dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
        });
    }
    
    // Guardar plan en la base de datos
    static async savePlanToDB(plan, userId) {
        try {
            const result = await db.query(`
                INSERT INTO training_plans (user_id, title, description, goal, fitness_level, schedule)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id
            `, [userId, plan.title, plan.description, plan.goal || 'general', plan.fitness_level || 'intermedio', JSON.stringify(plan.schedule)]);
            
            return result.rows[0].id;
        } catch (error) {
            console.error('Error saving plan to DB:', error);
            return null;
        }
    }
    
    // Plan de respaldo en caso de error
    static getFallbackPlan() {
        return {
            title: "Plan Básico de Entrenamiento",
            description: "Plan de entrenamiento básico para comenzar tu rutina de ejercicios.",
            schedule: [
                {
                    day: "Día 1",
                    routine: {
                        name: "Introducción al Ejercicio",
                        description: "Rutina suave para comenzar",
                        exercises: [
                            {
                                name: "Caminata",
                                description: "Camina a ritmo moderado",
                                sets: 1,
                                reps: "20 min",
                                rest_period_seconds: 0,
                                muscle_group: "Cardio",
                                equipment_needed: "Ninguno",
                                difficulty_level: "principiante"
                            }
                        ]
                    }
                }
            ]
        };
    }
}


// Tarea: Formulario de perfil de usuario y objetivos (GET)
router.get('/setup', isAuthenticated, async (req, res) => {
  try {
    const userGoalsResult = await db.query('SELECT * FROM user_goals_exercise WHERE user_id = $1', [req.session.user.id]);
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
  const userId = req.session.user.id;

  try {
    // Procesar arrays de checkboxes
    const processedData = {
      ...req.body,
      health_conditions: Array.isArray(req.body.health_conditions) ? req.body.health_conditions : 
                        req.body.health_conditions ? [req.body.health_conditions] : [],
      equipment: Array.isArray(req.body.equipment) ? req.body.equipment : 
                 req.body.equipment ? [req.body.equipment] : [],
      secondary_goals: Array.isArray(req.body.secondary_goals) ? req.body.secondary_goals : 
                       req.body.secondary_goals ? [req.body.secondary_goals] : []
    };

    // Guardar o actualizar los objetivos en la base de datos
    await db.query(`
      INSERT INTO user_goals_exercise (
        user_id, fitness_level, main_goal, secondary_goals, training_days_per_week, 
        time_per_session, preferred_time, health_conditions, other_conditions, 
        equipment, experience_years, current_weight, target_weight, height, age, 
        gender, activity_level, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        fitness_level = EXCLUDED.fitness_level,
        main_goal = EXCLUDED.main_goal,
        secondary_goals = EXCLUDED.secondary_goals,
        training_days_per_week = EXCLUDED.training_days_per_week,
        time_per_session = EXCLUDED.time_per_session,
        preferred_time = EXCLUDED.preferred_time,
        health_conditions = EXCLUDED.health_conditions,
        other_conditions = EXCLUDED.other_conditions,
        equipment = EXCLUDED.equipment,
        experience_years = EXCLUDED.experience_years,
        current_weight = EXCLUDED.current_weight,
        target_weight = EXCLUDED.target_weight,
        height = EXCLUDED.height,
        age = EXCLUDED.age,
        gender = EXCLUDED.gender,
        activity_level = EXCLUDED.activity_level,
        updated_at = NOW();
    `, [
      userId,
      processedData.fitness_level,
      processedData.main_goal,
      JSON.stringify(processedData.secondary_goals),
      processedData.training_days_per_week,
      processedData.time_per_session || 45,
      processedData.preferred_time || 'any',
      JSON.stringify(processedData.health_conditions),
      processedData.other_conditions || null,
      JSON.stringify(processedData.equipment),
      processedData.experience_years || 0,
      processedData.current_weight ? parseFloat(processedData.current_weight) : null,
      processedData.target_weight ? parseFloat(processedData.target_weight) : null,
      processedData.height ? parseInt(processedData.height) : null,
      processedData.age ? parseInt(processedData.age) : null,
      processedData.gender,
      processedData.activity_level || 'sedentary'
    ]);

    // Generar el plan de entrenamiento usando el nuevo algoritmo
    const trainingPlan = await TrainingRecommendationEngine.generateTrainingPlan(processedData, userId);

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

// Nueva ruta para obtener el plan actual del usuario
router.get('/plan', isAuthenticated, async (req, res) => {
  try {
    const planResult = await db.query(`
      SELECT * FROM training_plans 
      WHERE user_id = $1 AND is_active = true 
      ORDER BY created_at DESC 
      LIMIT 1
    `, [req.session.user.id]);
    
    if (planResult.rows.length === 0) {
      return res.redirect('/training/setup');
    }
    
    const savedPlan = planResult.rows[0];
    const plan = {
      title: savedPlan.title,
      description: savedPlan.description,
      schedule: savedPlan.schedule
    };
    
    res.render('training/plan', {
      title: 'Tu Plan de Entrenamiento',
      plan: plan
    });
  } catch (error) {
    console.error('Error al obtener el plan:', error);
    res.render('500');
  }
});

// Registrar actividad desde plan de entrenamiento
router.post('/register-activity', isAuthenticated, async (req, res) => {
  try {
    const { exerciseName, fecha, sets, reps, restPeriod, muscleGroup, difficulty } = req.body;
    const userId = req.session.user.id;
    
    // Validar datos requeridos
    if (!exerciseName || !fecha) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nombre del ejercicio y fecha son requeridos' 
      });
    }
    
    // Calcular calorías estimadas basadas en duración y dificultad
    let estimatedCalories = 50; // Base
    if (difficulty === 'fácil') estimatedCalories = 30;
    else if (difficulty === 'intermedio') estimatedCalories = 50;
    else if (difficulty === 'difícil') estimatedCalories = 80;
    
    // Calcular duración estimada
    const totalSets = parseInt(sets) || 3;
    const totalReps = parseInt(reps) || 12;
    const rest = parseInt(restPeriod) || 60;
    const estimatedDuration = Math.round((totalSets * totalReps * 2 + (totalSets - 1) * rest) / 60); // en minutos
    
    // Preparar medidas adicionales para el ejercicio
    const medidas = {
      sets: totalSets,
      reps: totalReps,
      duracion: estimatedDuration,
      muscle_group: muscleGroup,
      difficulty: difficulty,
      rest_period: rest
    };
    
    // Descripción detallada del ejercicio
    const descripcion = `${exerciseName} - ${totalSets} sets x ${totalReps} reps (${muscleGroup})`;
    
    // Insertar actividad en la tabla activities
    await db.query(
      'INSERT INTO activities (user_id, tipo, descripcion, fecha, calorias, medidas) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, 'ejercicio', descripcion, fecha, estimatedCalories, JSON.stringify(medidas)]
    );
    
    // Registrar que el ejercicio fue completado para bloqueo temporal
    const completedExercise = {
      exercise_name: exerciseName,
      completed_date: fecha,
      user_id: userId
    };
    
    // Guardar en localStorage del servidor (o podrías crear una tabla específica)
    // Por ahora usaremos una tabla temporal o el sistema de activities como referencia
    
    res.json({ 
      success: true, 
      message: 'Actividad registrada exitosamente',
      estimated_calories: estimatedCalories,
      duration: estimatedDuration
    });
    
  } catch (error) {
    console.error('Error al registrar actividad desde plan:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor al registrar la actividad' 
    });
  }
});

// Verificar si un ejercicio fue completado recientemente
router.get('/check-exercise-status/:exerciseName', isAuthenticated, async (req, res) => {
  try {
    const { exerciseName } = req.params;
    const userId = req.session.user.id;
    
    // Buscar si el ejercicio fue registrado en los últimos 5 días
    const result = await db.query(
      `SELECT fecha FROM activities 
       WHERE user_id = $1 
       AND tipo = 'ejercicio' 
       AND descripcion ILIKE $2 
       AND fecha >= CURRENT_DATE - INTERVAL '5 days'
       ORDER BY fecha DESC 
       LIMIT 1`,
      [userId, `%${exerciseName}%`]
    );
    
    const isCompleted = result.rows.length > 0;
    const lastCompletedDate = isCompleted ? result.rows[0].fecha : null;
    
    res.json({
      isCompleted,
      lastCompletedDate,
      canComplete: !isCompleted
    });
    
  } catch (error) {
    console.error('Error al verificar estado del ejercicio:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al verificar el estado del ejercicio' 
    });
  }
});

module.exports = router;
