// jobs/procesarCambiosAutomaticos.js
// Cron job para procesar cambios automáticos de estado/apariencia de productos

/**
 * Este archivo configura un cron job que verifica cada 6 horas 
 * si hay productos que necesitan cambiar de estado o apariencia
 * según el campo tiempo_cambio.
 * 
 * Funcionalidad:
 * 1. Se ejecuta automáticamente cada 6 horas
 * 2. Busca productos con cambia_estado=1 o cambia_apariencia=1
 * 3. Verifica si han pasado los días configurados en tiempo_cambio
 * 4. Procesa los cambios automáticamente
 */

import cron from 'node-cron';
import fetch from 'node-fetch';

const API_URL = process.env.API_URL || 'http://localhost:5000';

/**
 * Función que llama al endpoint de procesamiento automático
 */
async function procesarCambiosAutomaticos() {
  try {
    console.log(`[${new Date().toLocaleString('es-CO')}] Iniciando proceso automático de cambios...`);
    
    const response = await fetch(`${API_URL}/api/mermas/procesar-cambios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id_usuario: null // Sistema automático
      })
    });
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const resultado = await response.json();
    
    console.log(`✅ Proceso completado exitosamente:`);
    console.log(`   - Productos procesados: ${resultado.estadisticas.total_productos_procesados}`);
    console.log(`   - Mermas generadas: ${resultado.estadisticas.total_mermas}`);
    console.log(`   - Transformaciones: ${resultado.estadisticas.total_transformaciones}`);
    
    return resultado;
    
  } catch (error) {
    console.error(`❌ Error en proceso automático:`, error.message);
    return null;
  }
}

/**
 * Configuración del cron job
 * Patrón: 0 asterisco-slash-6 asterisco asterisco asterisco = Cada 6 horas
 * 
 * Alternativas comunes:
 * - 0 0 asterisco asterisco asterisco = Una vez al día a medianoche
 * - 0 asterisco-slash-12 asterisco asterisco asterisco = Cada 12 horas
 * - 0 asterisco-slash-4 asterisco asterisco asterisco = Cada 4 horas
 * - asterisco-slash-30 asterisco asterisco asterisco asterisco = Cada 30 minutos (para testing)
 */
export function iniciarCronJobCambiosAutomaticos() {
  // Ejecutar cada 6 horas
  const job = cron.schedule('0 */6 * * *', async () => {
    await procesarCambiosAutomaticos();
  }, {
    scheduled: true,
    timezone: "America/Bogota"
  });
  
  console.log('🕒 Cron job de cambios automáticos iniciado (cada 6 horas)');
  
  // Ejecutar una vez al iniciar el servidor (opcional, comentar si no se desea)
  // setTimeout(procesarCambiosAutomaticos, 5000); // Espera 5 segundos después del inicio
  
  return job;
}

/**
 * Función para testing manual (llamar desde terminal)
 */
export async function ejecutarProcesoManual() {
  console.log('🔧 Ejecutando proceso manual...');
  return await procesarCambiosAutomaticos();
}

export default iniciarCronJobCambiosAutomaticos;
