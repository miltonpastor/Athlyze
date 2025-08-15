const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Middleware para verificar autenticación
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  return res.redirect('/auth/login');
};

// Middleware para verificar plan Smart/Pro
const requirePremiumPlan = (req, res, next) => {
  if (req.session.user && (req.session.user.plan === 'smart' || req.session.user.plan === 'pro')) {
    return next();
  }
  return res.status(403).render('403', { 
    title: 'Acceso Denegado', 
    message: 'Esta funcionalidad requiere un plan Smart o Pro.',
    user: req.session.user 
  });
};

// Clase para análisis de progreso
class ProgressAnalyzer {
  constructor() {
    this.stagnationThresholds = {
      weight_change_minimal: 0.5, // kg en 30 días
      performance_decline: 0.1, // 10% decline in performance metrics
      consistency_low: 0.6, // 60% completion rate
      plateau_duration: 21 // días sin progreso significativo
    };
  }

  // Analizar datos de medidas corporales
  async analyzeMeasurements(userId, periodDays = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - periodDays);

    const measurements = await db.query(`
      SELECT * FROM user_measurements 
      WHERE user_id = $1 AND measurement_date >= $2 AND measurement_date <= $3
      ORDER BY measurement_date ASC
    `, [userId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]);

    if (measurements.rows.length < 2) {
      return { insufficient_data: true, measurements: measurements.rows.length };
    }

    const firstMeasurement = measurements.rows[0];
    const lastMeasurement = measurements.rows[measurements.rows.length - 1];

    return {
      weight_change: lastMeasurement.weight - firstMeasurement.weight,
      body_fat_change: lastMeasurement.body_fat_percentage - firstMeasurement.body_fat_percentage,
      muscle_mass_change: lastMeasurement.muscle_mass - firstMeasurement.muscle_mass,
      measurements_count: measurements.rows.length,
      period_days: periodDays,
      trend_analysis: this.calculateTrend(measurements.rows, 'weight')
    };
  }

  // Analizar progreso de entrenamiento
  async analyzeTrainingProgress(userId, periodDays = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - periodDays);

    const progress = await db.query(`
      SELECT * FROM activities 
      WHERE user_id = $1 AND tipo = 'ejercicio' 
        AND fecha >= $2 AND fecha <= $3
      ORDER BY fecha ASC
    `, [userId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]);

    if (progress.rows.length === 0) {
      return { insufficient_data: true, workouts: 0 };
    }

    const totalWorkouts = progress.rows.length;
    const expectedWorkouts = await this.getExpectedWorkoutsPerPeriod(userId, periodDays);
    const completionRate = totalWorkouts / expectedWorkouts;

    // Analizar tendencias de rendimiento basado en actividades
    const performanceMetrics = this.analyzeActivityMetrics(progress.rows);
    
    return {
      completion_rate: completionRate,
      total_workouts: totalWorkouts,
      expected_workouts: expectedWorkouts,
      performance_trend: performanceMetrics.trend,
      average_intensity: performanceMetrics.avgIntensity,
      consistency_score: this.calculateActivityConsistency(progress.rows, periodDays)
    };
  }

  // Detectar estancamiento
  async detectStagnation(userId, periodDays = 30) {
    const measurementAnalysis = await this.analyzeMeasurements(userId, periodDays);
    const trainingAnalysis = await this.analyzeTrainingProgress(userId, periodDays);
    
    const indicators = [];
    let stagnationScore = 0;

    // Verificar cambios mínimos en peso/composición corporal
    if (!measurementAnalysis.insufficient_data) {
      if (Math.abs(measurementAnalysis.weight_change) < this.stagnationThresholds.weight_change_minimal) {
        indicators.push({
          type: 'minimal_weight_change',
          value: measurementAnalysis.weight_change,
          severity: 'medium'
        });
        stagnationScore += 0.3;
      }

      if (measurementAnalysis.trend_analysis && measurementAnalysis.trend_analysis.slope === 'flat') {
        indicators.push({
          type: 'plateau_trend',
          severity: 'high'
        });
        stagnationScore += 0.4;
      }
    }

    // Verificar consistencia de entrenamiento
    if (!trainingAnalysis.insufficient_data) {
      if (trainingAnalysis.completion_rate < this.stagnationThresholds.consistency_low) {
        indicators.push({
          type: 'low_consistency',
          value: trainingAnalysis.completion_rate,
          severity: 'high',
          description: `Tasa de completitud: ${Math.round(trainingAnalysis.completion_rate * 100)}%`
        });
        stagnationScore += 0.5;
      }

      if (trainingAnalysis.performance_trend === 'declining') {
        indicators.push({
          type: 'performance_decline',
          severity: 'high',
          description: 'Tendencia decreciente en intensidad de entrenamientos'
        });
        stagnationScore += 0.4;
      }

      // Nuevo indicador: intensidad muy baja
      if (trainingAnalysis.average_intensity < 2.5) {
        indicators.push({
          type: 'low_intensity',
          value: trainingAnalysis.average_intensity,
          severity: 'medium',
          description: 'Intensidad promedio de entrenamientos muy baja'
        });
        stagnationScore += 0.3;
      }
    }

    const stagnationDetected = stagnationScore >= 0.6;

    return {
      stagnation_detected: stagnationDetected,
      confidence_score: Math.min(stagnationScore, 1.0),
      indicators,
      measurement_analysis: measurementAnalysis,
      training_analysis: trainingAnalysis
    };
  }

  // Motor de recomendaciones de ajuste
  generateAdjustmentRecommendations(stagnationAnalysis, userGoals) {
    const recommendations = [];

    if (!stagnationAnalysis.stagnation_detected) {
      return { adjustment_needed: false, recommendations: [] };
    }

    const indicators = stagnationAnalysis.indicators;
    const hasLowConsistency = indicators.some(i => i.type === 'low_consistency');
    const hasPerformanceDecline = indicators.some(i => i.type === 'performance_decline');
    const hasPlateauTrend = indicators.some(i => i.type === 'plateau_trend');
    const hasLowIntensity = indicators.some(i => i.type === 'low_intensity');

    // Recomendaciones basadas en indicadores
    if (hasLowConsistency) {
      recommendations.push({
        type: 'schedule_adjustment',
        priority: 'high',
        description: 'Reducir frecuencia de entrenamiento para mejorar adherencia',
        changes: {
          training_days_per_week: Math.max(userGoals.training_days_per_week - 1, 2),
          time_per_session: Math.min(userGoals.time_per_session - 5, 30)
        }
      });
    }

    if (hasPerformanceDecline) {
      recommendations.push({
        type: 'deload_week',
        priority: 'high',
        description: 'Implementar semana de descarga para recuperación',
        changes: {
          intensity_reduction: 0.7,
          volume_reduction: 0.8,
          duration: 7
        }
      });
    }

    if (hasLowIntensity && !hasLowConsistency) {
      recommendations.push({
        type: 'intensity_boost',
        priority: 'medium',
        description: 'Incrementar intensidad de los entrenamientos actuales',
        changes: {
          intensity_increase: 0.2,
          add_hiit_sessions: true,
          target_calories_increase: 50
        }
      });
    }

    if (hasPlateauTrend && !hasLowConsistency) {
      recommendations.push({
        type: 'progressive_overload',
        priority: 'medium',
        description: 'Incrementar intensidad y variabilidad de ejercicios',
        changes: {
          intensity_increase: 0.1,
          exercise_variation: true,
          new_exercises_percentage: 0.3
        }
      });
    }

    // Recomendación de plan completamente nuevo si múltiples indicadores
    if (indicators.length >= 3) {
      recommendations.push({
        type: 'complete_plan_change',
        priority: 'high',
        description: 'Generar plan completamente nuevo con enfoque diferente',
        changes: {
          new_plan_required: true,
          focus_change: this.suggestNewFocus(userGoals.main_goal)
        }
      });
    }

    return {
      adjustment_needed: true,
      adjustment_type: this.determineAdjustmentType(recommendations),
      recommendations: recommendations.sort((a, b) => 
        (a.priority === 'high' ? 3 : a.priority === 'medium' ? 2 : 1) - 
        (b.priority === 'high' ? 3 : b.priority === 'medium' ? 2 : 1)
      )
    };
  }

  // Métodos auxiliares
  calculateTrend(measurements, field) {
    if (measurements.length < 3) return null;
    
    const values = measurements.map(m => parseFloat(m[field])).filter(v => !isNaN(v));
    if (values.length < 3) return null;

    const n = values.length;
    const sumX = (n * (n + 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, i) => sum + (i + 1) * y, 0);
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    return {
      slope: Math.abs(slope) < 0.01 ? 'flat' : slope > 0 ? 'increasing' : 'decreasing',
      value: slope
    };
  }

  analyzeActivityMetrics(activityRows) {
    if (activityRows.length === 0) return { trend: 'insufficient_data', avgIntensity: 0 };

    // Analizar intensidad basada en calorías quemadas o descripción
    const intensities = activityRows.map(activity => {
      // Si hay calorías, usarlas como métrica de intensidad
      if (activity.calorias && activity.calorias > 0) {
        // Normalizar calorías a una escala de 1-5
        return Math.min(Math.max(activity.calorias / 100, 1), 5);
      }
      
      // Si no hay calorías, analizar la descripción para estimar intensidad
      const description = activity.descripcion.toLowerCase();
      if (description.includes('alta intensidad') || description.includes('hiit') || description.includes('crossfit')) {
        return 5;
      } else if (description.includes('moderada') || description.includes('cardio') || description.includes('pesas')) {
        return 3;
      } else if (description.includes('baja intensidad') || description.includes('caminar') || description.includes('yoga')) {
        return 2;
      }
      
      return 3; // Intensidad promedio por defecto
    });
    
    const avgIntensity = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    
    // Analizar tendencia comparando primera mitad vs segunda mitad
    const firstHalf = intensities.slice(0, Math.floor(intensities.length / 2));
    const secondHalf = intensities.slice(Math.floor(intensities.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const trend = secondAvg > firstAvg + 0.3 ? 'improving' : 
                  secondAvg < firstAvg - 0.3 ? 'declining' : 'stable';

    return { trend, avgIntensity };
  }

  calculateActivityConsistency(activityRows, periodDays) {
    // Calcular consistencia basada en distribución de días con actividad
    const activityDates = activityRows.map(a => new Date(a.fecha));
    const daysCovered = new Set(activityDates.map(d => d.toDateString())).size;
    return daysCovered / periodDays;
  }

  async getExpectedWorkoutsPerPeriod(userId, periodDays) {
    const userGoals = await db.query(
      'SELECT training_days_per_week FROM user_goals_exercise WHERE user_id = $1',
      [userId]
    );
    
    if (userGoals.rows.length === 0) return periodDays * 0.2; // Fallback: 20% del período
    
    const weeksInPeriod = periodDays / 7;
    return Math.round(userGoals.rows[0].training_days_per_week * weeksInPeriod);
  }

  determineAdjustmentType(recommendations) {
    const types = recommendations.map(r => r.type);
    
    if (types.includes('complete_plan_change')) return 'complete_change';
    if (types.includes('progressive_overload')) return 'intensity';
    if (types.includes('schedule_adjustment')) return 'frequency';
    if (types.includes('deload_week')) return 'volume';
    
    return 'minor_adjustment';
  }

  suggestNewFocus(currentGoal) {
    const focusMap = {
      'perder_peso': 'mejorar_resistencia',
      'ganar_musculo': 'mantener_forma',
      'mejorar_resistencia': 'ganar_musculo',
      'mantener_forma': 'perder_peso'
    };
    
    return focusMap[currentGoal] || 'mantener_forma';
  }
}

// Instancia global del analizador
const progressAnalyzer = new ProgressAnalyzer();

// RUTAS

// Ruta para registrar medidas corporales (obligatorio para usuarios Smart/Pro)
router.post('/measurements', isAuthenticated, requirePremiumPlan, async (req, res) => {
  try {
    const {
      weight,
      body_fat_percentage,
      muscle_mass,
      waist_circumference,
      chest_circumference,
      arm_circumference,
      thigh_circumference,
      resting_heart_rate,
      blood_pressure_systolic,
      blood_pressure_diastolic,
      notes
    } = req.body;

    // Registrar en tabla user_measurements
    await db.query(`
      INSERT INTO user_measurements (
        user_id, weight, body_fat_percentage, muscle_mass, 
        waist_circumference, chest_circumference, arm_circumference, 
        thigh_circumference, resting_heart_rate, blood_pressure_systolic, 
        blood_pressure_diastolic, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      req.session.user.id, weight, body_fat_percentage, muscle_mass,
      waist_circumference, chest_circumference, arm_circumference,
      thigh_circumference, resting_heart_rate, blood_pressure_systolic,
      blood_pressure_diastolic, notes
    ]);

    // Preparar objeto de medidas para la tabla activities
    const medidas = {};
    if (weight) medidas.peso = `${weight}kg`;
    if (body_fat_percentage) medidas.grasa_corporal = `${body_fat_percentage}%`;
    if (muscle_mass) medidas.masa_muscular = `${muscle_mass}kg`;
    if (waist_circumference) medidas.cintura = `${waist_circumference}cm`;
    if (chest_circumference) medidas.pecho = `${chest_circumference}cm`;
    if (arm_circumference) medidas.brazo = `${arm_circumference}cm`;
    if (thigh_circumference) medidas.muslo = `${thigh_circumference}cm`;
    if (resting_heart_rate) medidas.fc_reposo = `${resting_heart_rate}bpm`;
    if (blood_pressure_systolic && blood_pressure_diastolic) {
      medidas.presion_arterial = `${blood_pressure_systolic}/${blood_pressure_diastolic}mmHg`;
    }

    // Crear descripción para la actividad
    const measurementsList = [];
    if (weight) measurementsList.push(`Peso: ${weight}kg`);
    if (body_fat_percentage) measurementsList.push(`Grasa: ${body_fat_percentage}%`);
    if (muscle_mass) measurementsList.push(`Masa muscular: ${muscle_mass}kg`);
    if (waist_circumference) measurementsList.push(`Cintura: ${waist_circumference}cm`);
    
    const descripcion = measurementsList.length > 0 
      ? `Registro de medidas corporales - ${measurementsList.join(', ')}`
      : 'Registro de medidas corporales';

    // También registrar en tabla activities como tipo 'medidas'
    await db.query(`
      INSERT INTO activities (user_id, tipo, descripcion, fecha, medidas)
      VALUES ($1, $2, $3, CURRENT_DATE, $4)
    `, [
      req.session.user.id,
      'medidas',
      descripcion,
      JSON.stringify(medidas)
    ]);

    res.json({ success: true, message: 'Medidas registradas correctamente' });
  } catch (error) {
    console.error('Error al registrar medidas:', error);
    res.status(500).json({ success: false, message: 'Error al registrar medidas' });
  }
});

// Ruta para obtener últimas medidas del usuario
router.get('/measurements/latest', isAuthenticated, requirePremiumPlan, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * FROM user_measurements 
      WHERE user_id = $1 
      ORDER BY measurement_date DESC 
      LIMIT 5
    `, [req.session.user.id]);

    res.json({ measurements: result.rows });
  } catch (error) {
    console.error('Error al obtener medidas:', error);
    res.status(500).json({ success: false, message: 'Error al obtener medidas' });
  }
});

// Ruta para ejecutar evaluación manual de progreso
router.post('/evaluate', isAuthenticated, requirePremiumPlan, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const periodDays = req.body.period_days || 30;

    // Obtener plan activo del usuario
    const activePlan = await db.query(`
      SELECT * FROM training_plans 
      WHERE user_id = $1 AND is_active = true 
      ORDER BY created_at DESC 
      LIMIT 1
    `, [userId]);

    if (activePlan.rows.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No se encontró un plan activo para evaluar' 
      });
    }

    const planId = activePlan.rows[0].id;

    // Realizar análisis de estancamiento
    const stagnationAnalysis = await progressAnalyzer.detectStagnation(userId, periodDays);

    // Obtener objetivos del usuario para generar recomendaciones
    const userGoals = await db.query(
      'SELECT * FROM user_goals_exercise WHERE user_id = $1',
      [userId]
    );

    let adjustmentRecommendations = { adjustment_needed: false, recommendations: [] };
    
    if (userGoals.rows.length > 0) {
      adjustmentRecommendations = progressAnalyzer.generateAdjustmentRecommendations(
        stagnationAnalysis, 
        userGoals.rows[0]
      );
    }

    // Guardar evaluación en la base de datos
    const evaluationResult = await db.query(`
      INSERT INTO progress_evaluations (
        user_id, plan_id, evaluation_period_days, weight_change,
        body_composition_change, performance_metrics, stagnation_detected,
        stagnation_indicators, confidence_score, adjustment_needed,
        adjustment_type, adjustment_details, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      userId, planId, periodDays,
      stagnationAnalysis.measurement_analysis.weight_change || null,
      JSON.stringify(stagnationAnalysis.measurement_analysis || {}),
      JSON.stringify(stagnationAnalysis.training_analysis || {}),
      stagnationAnalysis.stagnation_detected,
      JSON.stringify(stagnationAnalysis.indicators || []),
      stagnationAnalysis.confidence_score || 0,
      adjustmentRecommendations.adjustment_needed,
      adjustmentRecommendations.adjustment_type || null,
      JSON.stringify(adjustmentRecommendations.recommendations || []),
      'processed'
    ]);

    // Crear notificación si se detecta estancamiento
    if (stagnationAnalysis.stagnation_detected) {
      await db.query(`
        INSERT INTO progress_notifications (
          user_id, evaluation_id, notification_type, title, message, action_required, action_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        userId, evaluationResult.rows[0].id, 'stagnation_alert',
        '⚠️ Estancamiento Detectado',
        `Hemos detectado signos de estancamiento en tu progreso. Te recomendamos realizar ajustes en tu plan de entrenamiento.`,
        true, '/progress/adaptations'
      ]);
    }

    res.json({
      success: true,
      evaluation: evaluationResult.rows[0],
      stagnation_analysis: stagnationAnalysis,
      recommendations: adjustmentRecommendations
    });

  } catch (error) {
    console.error('Error en evaluación de progreso:', error);
    res.status(500).json({ success: false, message: 'Error al evaluar progreso' });
  }
});

// Ruta para ver adaptaciones sugeridas
router.get('/adaptations', isAuthenticated, requirePremiumPlan, async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Obtener evaluaciones pendientes con recomendaciones
    const evaluations = await db.query(`
      SELECT pe.*, pn.title as notification_title, pn.message as notification_message
      FROM progress_evaluations pe
      LEFT JOIN progress_notifications pn ON pe.id = pn.evaluation_id
      WHERE pe.user_id = $1 AND pe.adjustment_needed = true AND pe.user_acknowledged = false
      ORDER BY pe.created_at DESC
    `, [userId]);

    let evaluationData = evaluations.rows;

    // Obtener historial de adaptaciones aplicadas
    const adaptationHistory = await db.query(`
      SELECT pa.*, tp_old.title as old_plan_title, tp_new.title as new_plan_title
      FROM plan_adaptations pa
      LEFT JOIN training_plans tp_old ON pa.original_plan_id = tp_old.id
      LEFT JOIN training_plans tp_new ON pa.new_plan_id = tp_new.id
      WHERE pa.user_id = $1
      ORDER BY pa.created_at DESC
      LIMIT 10
    `, [userId]);

    res.render('progress/adaptations', {
      title: 'Adaptaciones de Plan',
      user: req.session.user,
      evaluations: evaluationData.map(evaluation => {
        // Procesar indicadores de estancamiento - asegurar que sean strings JSON válidos
        let indicatorsString = '[]';
        try {
          if (typeof evaluation.stagnation_indicators === 'string') {
            // Verificar que sea JSON válido
            JSON.parse(evaluation.stagnation_indicators);
            indicatorsString = evaluation.stagnation_indicators;
          } else if (Array.isArray(evaluation.stagnation_indicators)) {
            indicatorsString = JSON.stringify(evaluation.stagnation_indicators);
          } else if (evaluation.stagnation_indicators && typeof evaluation.stagnation_indicators === 'object') {
            indicatorsString = JSON.stringify(evaluation.stagnation_indicators);
          }
        } catch (e) {
          console.error('Error processing stagnation_indicators:', e);
          indicatorsString = '[]';
        }

        // Procesar recomendaciones - asegurar que sean strings JSON válidos
        let recommendationsString = '[]';
        try {
          if (typeof evaluation.adjustment_details === 'string') {
            // Verificar que sea JSON válido
            JSON.parse(evaluation.adjustment_details);
            recommendationsString = evaluation.adjustment_details;
          } else if (Array.isArray(evaluation.adjustment_details)) {
            recommendationsString = JSON.stringify(evaluation.adjustment_details);
          } else if (evaluation.adjustment_details && typeof evaluation.adjustment_details === 'object') {
            recommendationsString = JSON.stringify(evaluation.adjustment_details);
          }
        } catch (e) {
          console.error('Error processing adjustment_details:', e);
          recommendationsString = '[]';
        }

        return {
          ...evaluation,
          stagnation_indicators: indicatorsString,
          adjustment_details: recommendationsString
        };
      }),
      history: adaptationHistory.rows
    });

  } catch (error) {
    console.error('Error al cargar adaptaciones:', error);
    res.render('500', { title: 'Error', user: req.session.user });
  }
});

// Ruta para aplicar una adaptación recomendada
router.post('/apply-adaptation/:evaluationId', isAuthenticated, requirePremiumPlan, async (req, res) => {
  try {
    const evaluationId = req.params.evaluationId;
    const userId = req.session.user.id;
    const { adaptation_type } = req.body;

    // Obtener la evaluación
    const evaluation = await db.query(`
      SELECT * FROM progress_evaluations 
      WHERE id = $1 AND user_id = $2
    `, [evaluationId, userId]);

    if (evaluation.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Evaluación no encontrada' });
    }

    const evalData = evaluation.rows[0];
    let recommendations = [];
    try {
      // Si ya es un objeto/array, usarlo directamente
      if (typeof evalData.adjustment_details === 'object' && evalData.adjustment_details !== null) {
        recommendations = Array.isArray(evalData.adjustment_details) ? evalData.adjustment_details : [];
      } else if (typeof evalData.adjustment_details === 'string' && evalData.adjustment_details.trim()) {
        recommendations = JSON.parse(evalData.adjustment_details);
      }
    } catch (parseError) {
      console.error('Error parsing adjustment_details:', parseError);
      recommendations = [];
    }

    // Obtener el plan actual para usar como base
    const currentPlan = await db.query(`
      SELECT * FROM training_plans WHERE id = $1
    `, [evalData.plan_id]);

    if (currentPlan.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plan original no encontrado' });
    }

    const originalPlan = currentPlan.rows[0];

    // Obtener objetivos del usuario para aplicar las adaptaciones
    const userGoals = await db.query(`
      SELECT * FROM user_goals_exercise WHERE user_id = $1
    `, [userId]);

    let newPlanData = { ...originalPlan };
    let planTitle = originalPlan.title + ' (Adaptado)';
    let planDescription = originalPlan.description + '\n\nPlan adaptado basado en análisis de progreso.';
    let newSchedule = originalPlan.schedule; // Mantener schedule original por defecto
    
    // Aplicar adaptaciones basadas en las recomendaciones
    let adaptationChanges = [];
    
    for (const rec of recommendations) {
      switch (rec.type) {
        case 'schedule_adjustment':
          if (userGoals.rows.length > 0) {
            const currentDays = userGoals.rows[0].training_days_per_week || 3;
            const newDays = Math.max(currentDays - 1, 2);
            adaptationChanges.push(`Días de entrenamiento reducidos de ${currentDays} a ${newDays} por semana`);
            
            // Actualizar objetivos del usuario
            await db.query(`
              UPDATE user_goals_exercise 
              SET training_days_per_week = $1, updated_at = NOW()
              WHERE user_id = $2
            `, [newDays, userId]);

            // Adaptar el schedule para reflejar menos días de entrenamiento
            try {
              let scheduleData = typeof newSchedule === 'object' ? newSchedule : JSON.parse(newSchedule);
              if (scheduleData && scheduleData.weekly_schedule) {
                // Reducir días activos en el schedule
                let activeDays = Object.keys(scheduleData.weekly_schedule).filter(day => 
                  scheduleData.weekly_schedule[day] && scheduleData.weekly_schedule[day].length > 0
                );
                
                if (activeDays.length > newDays) {
                  // Desactivar algunos días para ajustar a newDays
                  const daysToDeactivate = activeDays.slice(newDays);
                  daysToDeactivate.forEach(day => {
                    scheduleData.weekly_schedule[day] = [];
                  });
                  newSchedule = scheduleData;
                }
              }
            } catch (e) {
              console.error('Error adaptando schedule:', e);
            }
          }
          break;
          
        case 'deload_week':
          adaptationChanges.push('Semana de descarga programada: reducción del 30% en intensidad');
          planDescription += '\n- Semana 1: Intensidad reducida al 70% para recuperación';
          
          // Modificar el schedule para incluir información de deload
          try {
            let scheduleData = typeof newSchedule === 'object' ? newSchedule : JSON.parse(newSchedule);
            if (scheduleData) {
              scheduleData.deload_week = {
                week: 1,
                intensity_reduction: 0.3,
                note: 'Semana de recuperación con intensidad reducida'
              };
              newSchedule = scheduleData;
            }
          } catch (e) {
            console.error('Error adaptando schedule para deload:', e);
          }
          break;
          
        case 'intensity_boost':
          adaptationChanges.push('Incremento de intensidad: enfoque en ejercicios de alta intensidad');
          planDescription += '\n- Incremento de intensidad con sesiones HIIT';
          
          // Modificar el schedule para incluir información de intensidad
          try {
            let scheduleData = typeof newSchedule === 'object' ? newSchedule : JSON.parse(newSchedule);
            if (scheduleData) {
              scheduleData.intensity_boost = {
                target_increase: 0.2,
                add_hiit: true,
                min_calories_per_session: 200,
                note: 'Enfoque en ejercicios de alta intensidad'
              };
              newSchedule = scheduleData;
            }
          } catch (e) {
            console.error('Error adaptando schedule para intensity boost:', e);
          }
          break;
          
        case 'progressive_overload':
          adaptationChanges.push('Incremento gradual de intensidad del 10%');
          planDescription += '\n- Incremento progresivo de carga en ejercicios principales';
          
          // Modificar el schedule para incluir información de overload
          try {
            let scheduleData = typeof newSchedule === 'object' ? newSchedule : JSON.parse(newSchedule);
            if (scheduleData) {
              scheduleData.progressive_overload = {
                weekly_increase: 0.1,
                note: 'Incremento semanal del 10% en ejercicios principales'
              };
              newSchedule = scheduleData;
            }
          } catch (e) {
            console.error('Error adaptando schedule para overload:', e);
          }
          break;
          
        case 'complete_plan_change':
          planTitle = 'Plan Renovado - ' + new Date().getFullYear();
          planDescription = 'Plan completamente nuevo generado para superar el estancamiento detectado.';
          adaptationChanges.push('Plan completamente renovado con nuevo enfoque');
          break;
          
        case 'measurement_consistency':
        case 'workout_logging':
          // Estas son recomendaciones de comportamiento, no cambios al plan
          adaptationChanges.push(`Recomendación: ${rec.description}`);
          break;
      }
    }

    // Desactivar el plan actual
    await db.query(`
      UPDATE training_plans 
      SET is_active = false
      WHERE id = $1
    `, [evalData.plan_id]);

    // Crear el nuevo plan adaptado
    const newPlan = await db.query(`
      INSERT INTO training_plans (
        user_id, title, description, goal, fitness_level, 
        duration_weeks, schedule, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      userId, planTitle, planDescription, 
      originalPlan.goal, originalPlan.fitness_level,
      originalPlan.duration_weeks, JSON.stringify(newSchedule), true
    ]);

    // Marcar evaluación como aplicada
    await db.query(`
      UPDATE progress_evaluations 
      SET user_acknowledged = true, status = 'applied', processed_at = NOW()
      WHERE id = $1
    `, [evaluationId]);

    // Registrar la adaptación con el nuevo plan ID
    await db.query(`
      INSERT INTO plan_adaptations (
        user_id, original_plan_id, new_plan_id, evaluation_id, adaptation_type,
        adaptation_reason, changes_summary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      userId, evalData.plan_id, newPlan.rows[0].id, evaluationId, adaptation_type,
      'Adaptación basada en detección automática de estancamiento',
      JSON.stringify({
        recommendations: Array.isArray(recommendations) ? recommendations : [],
        changes_applied: adaptationChanges,
        new_plan_id: newPlan.rows[0].id,
        adaptation_date: new Date().toISOString()
      })
    ]);

    // Crear notificación de éxito
    await db.query(`
      INSERT INTO progress_notifications (
        user_id, notification_type, title, message, action_required, action_url
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      userId, 'plan_updated',
      '✅ Plan Actualizado',
      `Tu plan ha sido adaptado exitosamente. Cambios aplicados: ${adaptationChanges.join(', ')}`,
      false, '/training/plan'
    ]);

    res.json({ 
      success: true, 
      message: 'Adaptación aplicada correctamente. Nuevo plan creado.',
      new_plan_id: newPlan.rows[0].id,
      changes_applied: adaptationChanges
    });

  } catch (error) {
    console.error('Error al aplicar adaptación:', error);
    res.status(500).json({ success: false, message: 'Error al aplicar adaptación' });
  }
});

// Ruta para obtener notificaciones de progreso del usuario
router.get('/notifications', isAuthenticated, requirePremiumPlan, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const notifications = await db.query(`
      SELECT * FROM progress_notifications 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 20
    `, [userId]);

    res.json({ notifications: notifications.rows });
  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    res.status(500).json({ success: false, message: 'Error al obtener notificaciones' });
  }
});

// Ruta para marcar notificación como leída
router.post('/notifications/:id/read', isAuthenticated, requirePremiumPlan, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.session.user.id;

    await db.query(`
      UPDATE progress_notifications 
      SET read_at = NOW() 
      WHERE id = $1 AND user_id = $2
    `, [notificationId, userId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error al marcar notificación:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar notificación' });
  }
});

// FUNCIONES AUTOMÁTICAS

// Función para ejecutar evaluaciones automáticas mensuales
async function runAutomaticEvaluations() {
  try {
    console.log('🔄 Iniciando evaluaciones automáticas mensuales...');
    
    // Obtener usuarios Smart/Pro que no han sido evaluados en los últimos 30 días
    const usersToEvaluate = await db.query(`
      SELECT DISTINCT u.id, u.nombre, u.email, u.plan
      FROM users u
      INNER JOIN user_goals_exercise uge ON u.id = uge.user_id
      LEFT JOIN progress_evaluations pe ON u.id = pe.user_id 
        AND pe.created_at > NOW() - INTERVAL '30 days'
      WHERE u.plan IN ('smart', 'pro') 
        AND u.activo = true
        AND pe.id IS NULL
    `);

    console.log(`📊 ${usersToEvaluate.rows.length} usuarios encontrados para evaluación automática`);

    let evaluationsCreated = 0;
    let stagnationDetected = 0;

    for (const user of usersToEvaluate.rows) {
      try {
        console.log(`🔍 Evaluando usuario: ${user.nombre} (ID: ${user.id})`);

        // Verificar que el usuario tenga un plan activo
        const activePlan = await db.query(`
          SELECT * FROM training_plans 
          WHERE user_id = $1 AND is_active = true 
          ORDER BY created_at DESC 
          LIMIT 1
        `, [user.id]);

        if (activePlan.rows.length === 0) {
          console.log(`⚠️  Usuario ${user.nombre} no tiene plan activo. Saltando.`);
          continue;
        }

        // Verificar que tenga actividades de ejercicio registradas
        const activitiesCount = await db.query(`
          SELECT COUNT(*) as count 
          FROM activities 
          WHERE user_id = $1 AND tipo = 'ejercicio' 
            AND fecha > NOW() - INTERVAL '60 days'
        `, [user.id]);

        if (parseInt(activitiesCount.rows[0].count) < 3) {
          console.log(`⚠️  Usuario ${user.nombre} no tiene suficientes actividades de ejercicio. Saltando.`);
          
          // Crear notificación para recordar registro de actividades
          await db.query(`
            INSERT INTO progress_notifications (
              user_id, notification_type, title, message, action_required, action_url
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            user.id, 'activity_reminder',
            '🏃 Registro de Actividades Requerido',
            'Para que podamos evaluar tu progreso automáticamente, necesitas registrar tus actividades de ejercicio regularmente. ¡Ayúdanos a ayudarte!',
            true, '/activities'
          ]);
          
          continue;
        }

        const planId = activePlan.rows[0].id;

        // Realizar análisis de estancamiento
        const stagnationAnalysis = await progressAnalyzer.detectStagnation(user.id, 30);

        // Obtener objetivos del usuario
        const userGoals = await db.query(
          'SELECT * FROM user_goals_exercise WHERE user_id = $1',
          [user.id]
        );

        let adjustmentRecommendations = { adjustment_needed: false, recommendations: [] };
        
        if (userGoals.rows.length > 0) {
          adjustmentRecommendations = progressAnalyzer.generateAdjustmentRecommendations(
            stagnationAnalysis, 
            userGoals.rows[0]
          );
        }

        // Guardar evaluación automática
        const evaluationResult = await db.query(`
          INSERT INTO progress_evaluations (
            user_id, plan_id, evaluation_period_days, weight_change,
            body_composition_change, performance_metrics, stagnation_detected,
            stagnation_indicators, confidence_score, adjustment_needed,
            adjustment_type, adjustment_details, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *
        `, [
          user.id, planId, 30,
          stagnationAnalysis.measurement_analysis.weight_change || null,
          JSON.stringify(stagnationAnalysis.measurement_analysis),
          JSON.stringify(stagnationAnalysis.training_analysis),
          stagnationAnalysis.stagnation_detected,
          JSON.stringify(stagnationAnalysis.indicators),
          stagnationAnalysis.confidence_score,
          adjustmentRecommendations.adjustment_needed,
          adjustmentRecommendations.adjustment_type || null,
          JSON.stringify(adjustmentRecommendations.recommendations),
          'processed'
        ]);

        evaluationsCreated++;

        // Crear notificaciones apropiadas
        if (stagnationAnalysis.stagnation_detected) {
          stagnationDetected++;
          
          await db.query(`
            INSERT INTO progress_notifications (
              user_id, evaluation_id, notification_type, title, message, action_required, action_url
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            user.id, evaluationResult.rows[0].id, 'stagnation_alert',
            '⚠️ Evaluación Mensual: Ajustes Recomendados',
            `Hola ${user.nombre}, hemos detectado oportunidades de mejora en tu progreso del último mes. Te hemos preparado recomendaciones personalizadas para optimizar tu plan.`,
            true, '/progress/adaptations'
          ]);

          console.log(`🚨 Estancamiento detectado para ${user.nombre}`);
        } else {
          await db.query(`
            INSERT INTO progress_notifications (
              user_id, evaluation_id, notification_type, title, message, action_required
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            user.id, evaluationResult.rows[0].id, 'progress_milestone',
            '🎉 Evaluación Mensual: ¡Buen Progreso!',
            `¡Excelente trabajo ${user.nombre}! Tu progreso del último mes está en buen camino. Continúa con tu plan actual y sigue registrando tu actividad.`,
            false
          ]);

          console.log(`✅ Progreso positivo para ${user.nombre}`);
        }

      } catch (userError) {
        console.error(`❌ Error evaluando usuario ${user.nombre}:`, userError);
      }
    }

    console.log(`✨ Evaluaciones automáticas completadas:`);
    console.log(`   📊 ${evaluationsCreated} evaluaciones creadas`);
    console.log(`   🚨 ${stagnationDetected} casos de estancamiento detectados`);
    
    return {
      success: true,
      evaluations_created: evaluationsCreated,
      stagnation_detected: stagnationDetected,
      users_evaluated: usersToEvaluate.rows.length
    };

  } catch (error) {
    console.error('❌ Error en evaluaciones automáticas:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Ruta administrativa para ejecutar evaluaciones manuales (para testing)
router.post('/run-automatic-evaluations', async (req, res) => {
  try {
    // Solo permitir en desarrollo o con autenticación admin
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ 
        success: false, 
        message: 'Esta funcionalidad no está disponible en producción' 
      });
    }

    const result = await runAutomaticEvaluations();
    res.json(result);
  } catch (error) {
    console.error('Error ejecutando evaluaciones:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error ejecutando evaluaciones automáticas' 
    });
  }
});

module.exports = router;
