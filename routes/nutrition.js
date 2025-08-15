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

// Middleware para verificar que el usuario tenga plan Smart o Pro
const requireSmartPlan = (req, res, next) => {
    if (!req.session.user || !['smart', 'pro'].includes(req.session.user.plan)) {
        return res.status(403).render('403', {
            title: 'Acceso Denegado - Athlyze',
            message: 'Esta funcionalidad requiere Plan Smart o Pro',
            user: req.session.user
        });
    }
    next();
};

// Base de datos de alimentos organizada por categorías
const foodDatabase = {
    proteins: {
        animal: [
            { name: "Pollo (pechuga)", calories_per_100g: 165, protein: 31, carbs: 0, fats: 3.6, fiber: 0 },
            { name: "Salmón", calories_per_100g: 208, protein: 25, carbs: 0, fats: 12, fiber: 0 },
            { name: "Atún en agua", calories_per_100g: 132, protein: 30, carbs: 0, fats: 1, fiber: 0 },
            { name: "Huevos (2 unidades)", calories_per_100g: 155, protein: 13, carbs: 1.1, fats: 11, fiber: 0 },
            { name: "Pavo", calories_per_100g: 135, protein: 30, carbs: 0, fats: 1, fiber: 0 },
            { name: "Pescado blanco", calories_per_100g: 82, protein: 18, carbs: 0, fats: 0.7, fiber: 0 }
        ],
        plant: [
            { name: "Lentejas", calories_per_100g: 116, protein: 9, carbs: 20, fats: 0.4, fiber: 8 },
            { name: "Garbanzos", calories_per_100g: 164, protein: 8, carbs: 27, fats: 2.6, fiber: 8 },
            { name: "Quinoa", calories_per_100g: 120, protein: 4.4, carbs: 22, fats: 1.9, fiber: 2.8 },
            { name: "Tofu", calories_per_100g: 76, protein: 8, carbs: 1.9, fats: 4.8, fiber: 0.3 },
            { name: "Frijoles negros", calories_per_100g: 132, protein: 8.9, carbs: 23, fats: 0.5, fiber: 8.7 }
        ]
    },
    carbs: {
        complex: [
            { name: "Avena", calories_per_100g: 389, protein: 16.9, carbs: 66, fats: 6.9, fiber: 10.6 },
            { name: "Arroz integral", calories_per_100g: 123, protein: 2.6, carbs: 23, fats: 0.9, fiber: 1.8 },
            { name: "Batata", calories_per_100g: 86, protein: 1.6, carbs: 20, fats: 0.1, fiber: 3 },
            { name: "Pan integral", calories_per_100g: 247, protein: 13, carbs: 41, fats: 4.2, fiber: 7 }
        ],
        fruits: [
            { name: "Plátano", calories_per_100g: 89, protein: 1.1, carbs: 23, fats: 0.3, fiber: 2.6 },
            { name: "Manzana", calories_per_100g: 52, protein: 0.3, carbs: 14, fats: 0.2, fiber: 2.4 },
            { name: "Berries mixtos", calories_per_100g: 57, protein: 0.7, carbs: 14, fats: 0.3, fiber: 2.4 },
            { name: "Naranja", calories_per_100g: 47, protein: 0.9, carbs: 12, fats: 0.1, fiber: 2.4 }
        ]
    },
    vegetables: [
        { name: "Espinacas", calories_per_100g: 23, protein: 2.9, carbs: 3.6, fats: 0.4, fiber: 2.2 },
        { name: "Brócoli", calories_per_100g: 34, protein: 2.8, carbs: 7, fats: 0.4, fiber: 2.6 },
        { name: "Zanahoria", calories_per_100g: 41, protein: 0.9, carbs: 10, fats: 0.2, fiber: 2.8 },
        { name: "Pimientos", calories_per_100g: 31, protein: 1, carbs: 7, fats: 0.3, fiber: 2.5 },
        { name: "Tomate", calories_per_100g: 18, protein: 0.9, carbs: 3.9, fats: 0.2, fiber: 1.2 }
    ],
    fats: [
        { name: "Aguacate", calories_per_100g: 160, protein: 2, carbs: 9, fats: 15, fiber: 7 },
        { name: "Nueces", calories_per_100g: 654, protein: 15, carbs: 14, fats: 65, fiber: 6.7 },
        { name: "Aceite de oliva (1 cda)", calories_per_100g: 884, protein: 0, carbs: 0, fats: 100, fiber: 0 },
        { name: "Almendras", calories_per_100g: 579, protein: 21, carbs: 22, fats: 50, fiber: 12 }
    ]
};

// Plantillas de comidas por objetivo
const mealTemplates = {
    perder_peso: {
        breakfast: {
            calories: 300,
            protein_ratio: 0.3,
            carbs_ratio: 0.4,
            fat_ratio: 0.3
        },
        lunch: {
            calories: 400,
            protein_ratio: 0.35,
            carbs_ratio: 0.35,
            fat_ratio: 0.3
        },
        dinner: {
            calories: 350,
            protein_ratio: 0.4,
            carbs_ratio: 0.3,
            fat_ratio: 0.3
        },
        snacks: {
            calories: 150,
            protein_ratio: 0.2,
            carbs_ratio: 0.5,
            fat_ratio: 0.3
        }
    },
    ganar_musculo: {
        breakfast: {
            calories: 500,
            protein_ratio: 0.3,
            carbs_ratio: 0.4,
            fat_ratio: 0.3
        },
        lunch: {
            calories: 600,
            protein_ratio: 0.35,
            carbs_ratio: 0.4,
            fat_ratio: 0.25
        },
        dinner: {
            calories: 550,
            protein_ratio: 0.4,
            carbs_ratio: 0.35,
            fat_ratio: 0.25
        },
        snacks: {
            calories: 250,
            protein_ratio: 0.3,
            carbs_ratio: 0.4,
            fat_ratio: 0.3
        }
    },
    mantener_forma: {
        breakfast: {
            calories: 400,
            protein_ratio: 0.25,
            carbs_ratio: 0.45,
            fat_ratio: 0.3
        },
        lunch: {
            calories: 500,
            protein_ratio: 0.3,
            carbs_ratio: 0.4,
            fat_ratio: 0.3
        },
        dinner: {
            calories: 450,
            protein_ratio: 0.35,
            carbs_ratio: 0.35,
            fat_ratio: 0.3
        },
        snacks: {
            calories: 200,
            protein_ratio: 0.2,
            carbs_ratio: 0.5,
            fat_ratio: 0.3
        }
    }
};

// Función para generar plan alimenticio personalizado
const generateNutritionPlan = (profile) => {
    const { goal, dietary_restrictions, allergies, daily_calories, meals_per_day, activity_level } = profile;

    // Calcular calorías por comida basado en el objetivo
    let mealDistribution = mealTemplates[goal] || mealTemplates.mantener_forma;

    // Ajustar calorías según nivel de actividad
    const activityMultipliers = {
        sedentario: 1.0,
        ligero: 1.1,
        moderado: 1.2,
        intenso: 1.3
    };

    const multiplier = activityMultipliers[activity_level] || 1.0;

    // Generar plan para 7 días
    const weekPlan = [];

    for (let day = 1; day <= 7; day++) {
        const dailyMeals = [];

        // Desayuno
        const breakfast = generateMeal('breakfast', mealDistribution.breakfast, dietary_restrictions, allergies, multiplier);
        dailyMeals.push(breakfast);

        // Almuerzo
        const lunch = generateMeal('lunch', mealDistribution.lunch, dietary_restrictions, allergies, multiplier);
        dailyMeals.push(lunch);

        // Cena
        const dinner = generateMeal('dinner', mealDistribution.dinner, dietary_restrictions, allergies, multiplier);
        dailyMeals.push(dinner);

        // Snacks (si solicita más de 3 comidas)
        if (meals_per_day > 3) {
            const snack = generateMeal('snack', mealDistribution.snacks, dietary_restrictions, allergies, multiplier);
            dailyMeals.push(snack);
        }

        weekPlan.push({
            day: `Día ${day}`,
            date: new Date(Date.now() + (day - 1) * 24 * 60 * 60 * 1000).toLocaleDateString('es-ES'),
            meals: dailyMeals,
            total_calories: dailyMeals.reduce((sum, meal) => sum + meal.calories, 0),
            total_protein: dailyMeals.reduce((sum, meal) => sum + meal.protein, 0),
            total_carbs: dailyMeals.reduce((sum, meal) => sum + meal.carbs, 0),
            total_fats: dailyMeals.reduce((sum, meal) => sum + meal.fats, 0)
        });
    }

    return {
        title: `Plan Alimenticio Personalizado - ${goal.replace('_', ' ').toUpperCase()}`,
        description: `Plan generado para ${daily_calories} calorías diarias con ${meals_per_day} comidas por día`,
        total_days: 7,
        goal: goal,
        restrictions: dietary_restrictions,
        allergies: allergies,
        week_plan: weekPlan
    };
};

// Función auxiliar para generar una comida específica
const generateMeal = (mealType, template, restrictions, allergies, multiplier) => {
    const targetCalories = Math.round(template.calories * multiplier);
    const targetProtein = Math.round((targetCalories * template.protein_ratio) / 4); // 4 cal/g
    const targetCarbs = Math.round((targetCalories * template.carbs_ratio) / 4); // 4 cal/g
    const targetFats = Math.round((targetCalories * template.fat_ratio) / 9); // 9 cal/g

    const foods = [];
    let currentCalories = 0;
    let currentProtein = 0;
    let currentCarbs = 0;
    let currentFats = 0;

    // Seleccionar proteína
    const proteinSources = restrictions.includes('vegetariano') ?
        foodDatabase.proteins.plant :
        [...foodDatabase.proteins.animal, ...foodDatabase.proteins.plant];

    const selectedProtein = selectFood(proteinSources, allergies);
    if (selectedProtein) {
        const portion = Math.round(targetProtein / selectedProtein.protein * 100);
        foods.push({
            ...selectedProtein,
            portion_g: portion,
            calories: Math.round(selectedProtein.calories_per_100g * portion / 100),
            protein: Math.round(selectedProtein.protein * portion / 100),
            carbs: Math.round(selectedProtein.carbs * portion / 100),
            fats: Math.round(selectedProtein.fats * portion / 100)
        });

        currentCalories += foods[foods.length - 1].calories;
        currentProtein += foods[foods.length - 1].protein;
        currentCarbs += foods[foods.length - 1].carbs;
        currentFats += foods[foods.length - 1].fats;
    }

    // Seleccionar carbohidrato
    const carbSources = [...foodDatabase.carbs.complex, ...foodDatabase.carbs.fruits];
    const selectedCarb = selectFood(carbSources, allergies);
    if (selectedCarb) {
        const remainingCarbs = Math.max(5, targetCarbs - currentCarbs);
        const portion = Math.round(remainingCarbs / selectedCarb.carbs * 100);
        foods.push({
            ...selectedCarb,
            portion_g: portion,
            calories: Math.round(selectedCarb.calories_per_100g * portion / 100),
            protein: Math.round(selectedCarb.protein * portion / 100),
            carbs: Math.round(selectedCarb.carbs * portion / 100),
            fats: Math.round(selectedCarb.fats * portion / 100)
        });

        currentCalories += foods[foods.length - 1].calories;
        currentProtein += foods[foods.length - 1].protein;
        currentCarbs += foods[foods.length - 1].carbs;
        currentFats += foods[foods.length - 1].fats;
    }

    // Agregar vegetales
    const selectedVeggie = selectFood(foodDatabase.vegetables, allergies);
    if (selectedVeggie) {
        foods.push({
            ...selectedVeggie,
            portion_g: 100,
            calories: selectedVeggie.calories_per_100g,
            protein: selectedVeggie.protein,
            carbs: selectedVeggie.carbs,
            fats: selectedVeggie.fats
        });

        currentCalories += selectedVeggie.calories_per_100g;
        currentProtein += selectedVeggie.protein;
        currentCarbs += selectedVeggie.carbs;
        currentFats += selectedVeggie.fats;
    }

    // Completar con grasas saludables si es necesario
    const remainingFats = targetFats - currentFats;
    if (remainingFats > 2) {
        const selectedFat = selectFood(foodDatabase.fats, allergies);
        if (selectedFat) {
            const portion = Math.round(remainingFats / selectedFat.fats * 100);
            foods.push({
                ...selectedFat,
                portion_g: Math.min(portion, 30), // Máximo 30g de grasas puras
                calories: Math.round(selectedFat.calories_per_100g * Math.min(portion, 30) / 100),
                protein: Math.round(selectedFat.protein * Math.min(portion, 30) / 100),
                carbs: Math.round(selectedFat.carbs * Math.min(portion, 30) / 100),
                fats: Math.round(selectedFat.fats * Math.min(portion, 30) / 100)
            });

            currentCalories += foods[foods.length - 1].calories;
            currentFats += foods[foods.length - 1].fats;
        }
    }

    return {
        meal_type: mealType,
        meal_name: getMealName(mealType),
        foods: foods,
        calories: currentCalories,
        protein: currentProtein,
        carbs: currentCarbs,
        fats: currentFats,
        fiber: foods.reduce((sum, food) => sum + (food.fiber || 0), 0),
        preparation_time: Math.floor(Math.random() * 20) + 10, // 10-30 min aleatorio
        difficulty: ['Fácil', 'Intermedio'][Math.floor(Math.random() * 2)]
    };
};

// Función auxiliar para seleccionar alimento evitando alergias
const selectFood = (foodArray, allergies) => {
    const availableFoods = foodArray.filter(food => {
        return !allergies.some(allergen =>
            food.name.toLowerCase().includes(allergen.toLowerCase())
        );
    });

    if (availableFoods.length === 0) return null;

    return availableFoods[Math.floor(Math.random() * availableFoods.length)];
};

// Función auxiliar para nombres de comidas
const getMealName = (mealType) => {
    const names = {
        breakfast: ['Desayuno Energético', 'Desayuno Proteico', 'Desayuno Balanceado'],
        lunch: ['Almuerzo Completo', 'Almuerzo Nutritivo', 'Almuerzo Saludable'],
        dinner: ['Cena Ligera', 'Cena Balanceada', 'Cena Nutritiva'],
        snack: ['Snack Saludable', 'Merienda Nutritiva', 'Tentempié Fitness']
    };

    const options = names[mealType] || ['Comida Saludable'];
    return options[Math.floor(Math.random() * options.length)];
};

// API: Verificar si el usuario tiene un plan nutricional (para uso del frontend)
router.get('/api/has-plan', requireAuth, requireSmartPlan, async (req, res) => {
    try {
        const userId = req.session.user.id;

        const planCount = await db.query(`
            SELECT COUNT(*) as count FROM nutrition_plans 
            WHERE user_id = $1
        `, [userId]);

        const hasPlan = parseInt(planCount.rows[0].count) > 0;

        res.json({ hasPlans: hasPlan });
    } catch (error) {
        console.error('Error checking nutrition plan:', error);
        res.status(500).json({ error: 'Error interno del servidor', hasPlans: false });
    }
});

// GET: Ruta raíz - Redirección inteligente
router.get('/', requireAuth, requireSmartPlan, async (req, res) => {
    try {
        const userId = req.session.user.id;

        // Verificar si ya tiene un plan nutricional generado
        const existingPlan = await db.query(`
            SELECT id FROM nutrition_plans 
            WHERE user_id = $1
            ORDER BY created_at DESC 
            LIMIT 1
        `, [userId]);

        // Si ya tiene un plan, redirigir a la vista del plan
        if (existingPlan.rows.length > 0) {
            return res.redirect('/nutrition/plan');
        }

        // Si no tiene plan, redirigir al setup
        res.redirect('/nutrition/setup');
    } catch (error) {
        console.error('Error en nutrition root route:', error);
        // En caso de error, redirigir al setup por defecto
        res.redirect('/nutrition/setup');
    }
});

// GET: Mostrar formulario de configuración nutricional
router.get('/setup', requireAuth, requireSmartPlan, async (req, res) => {
    try {
        console.log('AQUI ME DA UN PROBLEMA Y NO SE PORQUE')
        const userId = req.session.user.id;

        // Verificar si ya tiene perfil nutricional
        const existingProfile = await db.query(`
            SELECT * FROM nutrition_profiles 
            WHERE user_id = $1
        `, [userId]);

        res.render('nutrition/setup', {
            title: 'Configuración Nutricional - Athlyze',
            profile: existingProfile.rows[0] || null,
            user: req.session.user
        });
    } catch (error) {
        console.error('Error en nutrition setup:', error);
        res.status(500).render('500', {
            title: 'Error del servidor',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

// POST: Generar plan alimenticio personalizado
router.post('/generate', [
    body('goal').isIn(['perder_peso', 'ganar_musculo', 'mantener_forma']).withMessage('Objetivo no válido'),
    body('daily_calories').isInt({ min: 1000, max: 4000 }).withMessage('Calorías diarias entre 1000 y 4000'),
    body('meals_per_day').isInt({ min: 3, max: 6 }).withMessage('Entre 3 y 6 comidas por día'),
    body('activity_level').isIn(['sedentario', 'ligero', 'moderado', 'intenso']).withMessage('Nivel de actividad no válido')
], requireAuth, requireSmartPlan, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const userId = req.session.user.id;
        const {
            goal,
            daily_calories,
            meals_per_day,
            activity_level,
            dietary_restrictions,
            allergies,
            preferred_foods,
            disliked_foods
        } = req.body;

        // Clean and deduplicate arrays
        const cleanArray = (arr) => {
            if (!arr) return [];
            const items = Array.isArray(arr) ? arr : [arr];
            return items
                .map(item => String(item).trim())
                .filter((item, index, arr) => item && arr.indexOf(item) === index);
        };

        const cleanAllergies = cleanArray(allergies);
        const cleanPreferred = cleanArray(preferred_foods);
        const cleanDisliked = cleanArray(disliked_foods);
        const cleanRestrictions = cleanArray(dietary_restrictions);

        // Guardar perfil nutricional en base de datos
        await db.query(`
            INSERT INTO nutrition_profiles (
                user_id, goal, daily_calories, meals_per_day, 
                activity_level, dietary_restrictions, allergies, 
                preferred_foods, disliked_foods, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                goal = $2, daily_calories = $3, meals_per_day = $4,
                activity_level = $5, dietary_restrictions = $6, allergies = $7,
                preferred_foods = $8, disliked_foods = $9, updated_at = CURRENT_TIMESTAMP
        `, [
            userId, goal, daily_calories, meals_per_day, activity_level,
            JSON.stringify(cleanRestrictions),
            JSON.stringify(cleanAllergies),
            JSON.stringify(cleanPreferred),
            JSON.stringify(cleanDisliked)
        ]);

        // Generar plan alimenticio
        const nutritionPlan = generateNutritionPlan({
            goal,
            daily_calories: parseInt(daily_calories),
            meals_per_day: parseInt(meals_per_day),
            activity_level,
            dietary_restrictions: cleanRestrictions,
            allergies: cleanAllergies,
            preferred_foods: cleanPreferred,
            disliked_foods: cleanDisliked
        });

        // Guardar plan generado
        console.log('Saving nutrition plan:', JSON.stringify(nutritionPlan, null, 2));
        await db.query(`
            INSERT INTO nutrition_plans (
                user_id, plan_data, goal, created_at
            ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        `, [userId, nutritionPlan, goal]);

        res.render('nutrition/plan', {
            title: 'Tu Plan Alimenticio - Athlyze',
            plan: nutritionPlan,
            user: req.session.user
        });

    } catch (error) {
        console.error('Error generando plan nutricional:', error);
        res.status(500).render('500', {
            title: 'Error del servidor',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

// GET: Ver plan alimenticio actual
router.get('/plan', requireAuth, requireSmartPlan, async (req, res) => {
    try {
        const userId = req.session.user.id;

        // Obtener último plan generado
        const planResult = await db.query(`
            SELECT plan_data, goal, created_at 
            FROM nutrition_plans 
            WHERE user_id = $1 
            ORDER BY created_at DESC 
            LIMIT 1
        `, [userId]);

        if (planResult.rows.length === 0) {
            return res.redirect('/nutrition/setup');
        }

        const rawPlanData = planResult.rows[0].plan_data;
        console.log('Raw plan_data:', rawPlanData);
        console.log('Type of plan_data:', typeof rawPlanData);

        let plan;
        if (typeof rawPlanData === 'string') {
            try {
                plan = JSON.parse(rawPlanData);
            } catch (error) {
                console.error('Error parsing plan_data as JSON:', error);
                console.error('Raw data that failed:', rawPlanData);
                return res.redirect('/nutrition/setup');
            }
        } else if (typeof rawPlanData === 'object' && rawPlanData !== null) {
            // If it's already an object, use it directly
            plan = rawPlanData;
        } else {
            console.error('Unexpected plan_data type:', typeof rawPlanData, rawPlanData);
            return res.redirect('/nutrition/setup');
        }

        res.render('nutrition/plan', {
            title: 'Tu Plan Alimenticio - Athlyze',
            plan: plan,
            created_at: planResult.rows[0].created_at,
            user: req.session.user
        });

    } catch (error) {
        console.error('Error obteniendo plan nutricional:', error);
        res.status(500).render('500', {
            title: 'Error del servidor',
            error: process.env.NODE_ENV === 'development' ? error : null
        });
    }
});

module.exports = router;
