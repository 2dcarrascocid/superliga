<template>
  <Teleport to="body">
  <Transition name="fade">
    <div v-if="loading" class="sports-loader-overlay" role="dialog" aria-modal="true" aria-label="Cargando liga deportiva">
      <div class="loader-content">
        <!-- Contenedor Principal de la Animación -->
        <div class="stage-container">
          
          <!-- Balón Animado (Futbol, Básquetbol o Vóleibol) -->
          <div class="ball-wrapper" :class="activeSportClass">
            
            <!-- 1. Balón de Fútbol / Soccer -->
            <svg v-if="currentSport === 'football' || currentSport === 'soccer'" class="ball-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="46" fill="#FFFFFF" stroke="#1E293B" stroke-width="4"/>
              <!-- Pentágono Central -->
              <polygon points="50,34 65,45 59,62 41,62 35,45" fill="#1E293B"/>
              <!-- Paneles Periféricos -->
              <line x1="50" y1="34" x2="50" y2="14" stroke="#1E293B" stroke-width="3"/>
              <line x1="65" y1="45" x2="84" y2="39" stroke="#1E293B" stroke-width="3"/>
              <line x1="59" y1="62" x2="74" y2="78" stroke="#1E293B" stroke-width="3"/>
              <line x1="41" y1="62" x2="26" y2="78" stroke="#1E293B" stroke-width="3"/>
              <line x1="35" y1="45" x2="16" y2="39" stroke="#1E293B" stroke-width="3"/>
              <!-- Esquinas externas -->
              <polygon points="50,4 38,14 62,14" fill="#1E293B"/>
              <polygon points="96,32 84,39 90,58" fill="#1E293B"/>
              <polygon points="80,90 74,78 88,74" fill="#1E293B"/>
              <polygon points="20,90 26,78 12,74" fill="#1E293B"/>
              <polygon points="4,32 16,39 10,58" fill="#1E293B"/>
            </svg>

            <!-- 2. Balón de Básquetbol -->
            <svg v-else-if="currentSport === 'basketball'" class="ball-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="46" fill="#EA580C" stroke="#1E293B" stroke-width="4"/>
              <!-- Líneas negras características de básquetbol -->
              <line x1="4" y1="50" x2="96" y2="50" stroke="#1E293B" stroke-width="3.5"/>
              <line x1="50" y1="4" x2="50" y2="96" stroke="#1E293B" stroke-width="3.5"/>
              <path d="M 20,10 A 45,45 0 0,1 20,90" fill="none" stroke="#1E293B" stroke-width="3.5"/>
              <path d="M 80,10 A 45,45 0 0,0 80,90" fill="none" stroke="#1E293B" stroke-width="3.5"/>
            </svg>

            <!-- 3. Balón de Vóleibol -->
            <svg v-else-if="currentSport === 'volleyball'" class="ball-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="46" fill="#FFFFFF" stroke="#1E293B" stroke-width="4"/>
              <!-- Paneles tricolores de vóleibol (Azul / Amarillo / Blanco) -->
              <path d="M 50,4 A 46,46 0 0,1 96,50 L 50,50 Z" fill="#2563EB"/>
              <path d="M 96,50 A 46,46 0 0,1 50,96 L 50,50 Z" fill="#FACC15"/>
              <path d="M 50,96 A 46,46 0 0,1 4,50 L 50,50 Z" fill="#2563EB"/>
              <path d="M 4,50 A 46,46 0 0,1 50,4 L 50,50 Z" fill="#FACC15"/>
              <!-- Curvas internas de paneles de voleibol -->
              <circle cx="50" cy="50" r="46" fill="none" stroke="#1E293B" stroke-width="4"/>
              <path d="M 20,15 Q 50,35 80,15" fill="none" stroke="#1E293B" stroke-width="3"/>
              <path d="M 85,20 Q 65,50 85,80" fill="none" stroke="#1E293B" stroke-width="3"/>
              <path d="M 80,85 Q 50,65 20,85" fill="none" stroke="#1E293B" stroke-width="3"/>
              <path d="M 15,80 Q 35,50 15,20" fill="none" stroke="#1E293B" stroke-width="3"/>
            </svg>

          </div>

          <!-- Sombra Dinámica de Rebote -->
          <div class="shadow-ellipse"></div>

          <!-- Pista / Marcador Base -->
          <div class="court-line"></div>
        </div>

        <!-- Texto de Estado -->
        <p class="loader-message">{{ message }}</p>

        <!-- Indicador de Puntos -->
        <div class="dots-bar">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>

        <!-- Aviso de Timeout + Salida (no oculta el loader abruptamente) -->
        <Transition name="fade">
          <div v-if="hasTimedOut" class="timeout-panel">
            <p class="timeout-message">
              La petición está tomando más tiempo de lo esperado.
            </p>
            <button type="button" class="cancel-btn" @click="handleCancel">
              Cancelar / Salir
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useLoaderStore } from '../../../stores/loader'

// Único indicador de carga global del sistema: se monta una sola vez en
// App.vue y lee su estado directamente de useLoaderStore (mismo patrón que
// NotifyModal.vue con useNotifyStore), sin necesidad de props.
const { isLoading, activeSport, message, hasTimedOut, cancelAll } = useLoaderStore()

const loading = computed(() => isLoading.value)

// Lista de deportes para el modo 'auto'
const sportsList = ['football', 'basketball', 'volleyball']
const autoIndex = ref(0)
let timer = null

onMounted(() => {
  timer = setInterval(() => {
    autoIndex.value = (autoIndex.value + 1) % sportsList.length
  }, 2200) // Cambia de balón cada ciclo de rebote, solo se usa en modo 'auto'
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

// Devolver el deporte activo
const currentSport = computed(() => {
  const sport = (activeSport.value || 'auto').toLowerCase()
  if (sport === 'auto') {
    return sportsList[autoIndex.value]
  }
  return sport
})

const activeSportClass = computed(() => `sport-${currentSport.value}`)

const handleCancel = () => {
  cancelAll()
}
</script>

<style scoped>
/* Overlay Modal de Pantalla Completa */
.sports-loader-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(248, 250, 252, 0.82);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.loader-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

/* Escenario de la Animación */
.stage-container {
  position: relative;
  width: 140px;
  height: 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
}

/* Contenedor del Balón */
.ball-wrapper {
  width: 72px;
  height: 72px;
  position: absolute;
  bottom: 20px;
  animation: bounceBall 1.1s cubic-bezier(0.4, 0, 0.6, 1) infinite alternate;
}

.ball-svg {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));
  animation: rotateBall 2.2s linear infinite;
}

/* Animación de Sombra con Física de Escala */
.shadow-ellipse {
  width: 56px;
  height: 10px;
  background: rgba(30, 41, 59, 0.25);
  border-radius: 50%;
  position: absolute;
  bottom: 8px;
  animation: scaleShadow 1.1s cubic-bezier(0.4, 0, 0.6, 1) infinite alternate;
}

/* Línea Minimalista de Pista */
.court-line {
  width: 110px;
  height: 3px;
  background: #1E293B;
  border-radius: 2px;
  position: absolute;
  bottom: 6px;
}

/* Keyframes de Física de Rebote */
@keyframes bounceBall {
  0% {
    transform: translateY(-75px) scaleX(0.95) scaleY(1.05);
  }
  90% {
    transform: translateY(0px) scaleX(1) scaleY(1);
  }
  100% {
    transform: translateY(3px) scaleX(1.12) scaleY(0.88); /* Efecto de compresión al impactar el suelo */
  }
}

@keyframes scaleShadow {
  0% {
    transform: scale(0.3);
    opacity: 0.15;
  }
  100% {
    transform: scale(1.1);
    opacity: 0.45;
  }
}

@keyframes rotateBall {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* Tipografía y Textos */
.loader-message {
  margin-top: 20px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 0.92rem;
  font-weight: 700;
  color: #0F172A;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  text-align: center;
}

/* Indicador de Puntos en Movimiento */
.dots-bar {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.dot {
  width: 7px;
  height: 7px;
  background-color: #0284C7;
  border-radius: 50%;
  animation: pulseDot 1.2s infinite ease-in-out both;
}

.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes pulseDot {
  0%, 80%, 100% {
    transform: scale(0.6);
    opacity: 0.3;
  }
  40% {
    transform: scale(1.25);
    opacity: 1;
    background-color: #EA580C;
  }
}

/* Aviso de Timeout + Botón de Salida */
.timeout-panel {
  margin-top: 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  max-width: 280px;
  padding-top: 16px;
  border-top: 1px solid rgba(30, 41, 59, 0.15);
}

.timeout-message {
  margin: 0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 0.85rem;
  font-weight: 500;
  color: #B45309;
  text-align: center;
  line-height: 1.4;
}

.cancel-btn {
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  color: #FFFFFF;
  background-color: #DC2626;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.15s ease;
}

.cancel-btn:hover {
  background-color: #B91C1C;
}

.cancel-btn:active {
  transform: scale(0.97);
}

/* Transición Vue Fade */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.28s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>