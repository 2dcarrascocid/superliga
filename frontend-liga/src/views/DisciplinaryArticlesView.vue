<template>
  <div class="container mt-md">
    <div class="flex justify-between items-center mb-lg">
      <h2>Reglamento y Código de Faltas</h2>
    </div>

    <p class="text-muted text-sm mb-lg">
      Mantenedor del reglamento disciplinario: artículos (con su gravedad) y el catálogo de faltas tipificadas
      que un tribunal puede imputar a clubes, equipos, jugadores o cuerpo técnico. Un artículo o falta sin
      deporte asignado aplica de forma transversal a todos los deportes de la organización.
    </p>

    <div v-if="loadError" class="alert alert-error">{{ loadError }}</div>

    <div class="tabs mb-lg">
      <button type="button" class="tab-btn" :class="{ active: tab === 'articles' }" @click="tab = 'articles'">Artículos</button>
      <button type="button" class="tab-btn" :class="{ active: tab === 'infractions' }" @click="tab = 'infractions'">Catálogo de faltas</button>
    </div>

    <!-- ==================== ARTÍCULOS ==================== -->
    <template v-if="tab === 'articles'">
      <div class="card p-0 mb-lg">
        <div class="flex justify-between items-center p-md" style="border-bottom: 1px solid var(--border-color);">
          <h3 class="m-0">Artículos del reglamento</h3>
          <span class="text-muted text-sm">{{ articles.length }} en total</span>
        </div>
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Código</th><th>Título</th><th>Deporte</th><th>Gravedad</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading && !articles.length"><td colspan="6" class="text-center py-lg">Cargando...</td></tr>
              <tr v-for="article in articles" :key="article.id">
                <td>{{ article.code }}</td>
                <td>{{ article.title }}</td>
                <td>{{ article.sport?.name || 'Transversal' }}<span v-if="article.variant"> ({{ article.variant }})</span></td>
                <td><span class="badge" :class="severityBadgeClass(article.severity)">{{ severityLabel(article.severity) }}</span></td>
                <td>
                  <span v-if="article.active" class="badge badge-success">Activo</span>
                  <span v-else class="badge badge-secondary">Inactivo</span>
                </td>
                <td>
                  <div class="table-actions">
                    <button type="button" class="btn btn-secondary btn-sm" @click="handleEditArticle(article)">Editar</button>
                    <button type="button" class="btn btn-danger btn-sm" :disabled="removingArticleId === article.id" @click="handleRemoveArticle(article)">
                      {{ removingArticleId === article.id ? 'Eliminando…' : 'Eliminar' }}
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!loading && !articles.length"><td colspan="6" class="text-center text-muted py-lg">Sin artículos registrados.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <form @submit.prevent="submitArticle">
          <h3 class="mb-md">{{ editingArticleId ? 'Editar artículo' : 'Nuevo artículo' }}</h3>
          <div v-if="articleFormError" class="alert alert-error" role="alert">{{ articleFormError }}</div>
          <div class="form-row-2">
            <div class="input-group">
              <label class="label" for="article-code">Código</label>
              <input id="article-code" v-model.trim="articleForm.code" class="input" placeholder="Ej: ART-45" required />
            </div>
            <div class="input-group">
              <label class="label" for="article-title">Título</label>
              <input id="article-title" v-model.trim="articleForm.title" class="input" placeholder="Ej: Conducta violenta" required />
            </div>
            <div class="input-group">
              <label class="label" for="article-sport">Deporte</label>
              <select id="article-sport" v-model="articleForm.sport_id" class="input">
                <option value="">Transversal (todos los deportes)</option>
                <option v-for="sport in sports" :key="sport.id" :value="sport.id">{{ sport.name }}</option>
              </select>
            </div>
            <div class="input-group">
              <label class="label" for="article-variant">Variante</label>
              <input id="article-variant" v-model.trim="articleForm.variant" class="input" placeholder="Ej: F7, FUTSAL, PLAYA (opcional)" />
            </div>
            <div class="input-group">
              <label class="label" for="article-severity">Gravedad</label>
              <select id="article-severity" v-model="articleForm.severity" class="input">
                <option value="LEVE">Leve</option>
                <option value="GRAVE">Grave</option>
                <option value="GRAVISIMA">Gravísima</option>
              </select>
            </div>
          </div>
          <div class="input-group">
            <label class="label" for="article-description">Descripción</label>
            <textarea id="article-description" v-model.trim="articleForm.description" class="input" rows="2" placeholder="Texto del artículo"></textarea>
          </div>
          <div class="flex justify-end gap-sm mt-md">
            <button v-if="editingArticleId" type="button" class="btn btn-secondary" @click="cancelEditArticle">Cancelar edición</button>
            <button type="submit" class="btn btn-primary" :disabled="savingArticle">
              {{ savingArticle ? 'Guardando…' : (editingArticleId ? 'Guardar cambios' : 'Crear artículo') }}
            </button>
          </div>
        </form>
      </div>
    </template>

    <!-- ==================== CATÁLOGO DE FALTAS ==================== -->
    <template v-else>
      <div class="card p-0 mb-lg">
        <div class="flex justify-between items-center p-md" style="border-bottom: 1px solid var(--border-color);">
          <h3 class="m-0">Faltas tipificadas</h3>
          <span class="text-muted text-sm">{{ infractions.length }} en total</span>
        </div>
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Código</th><th>Nombre</th><th>Artículo</th><th>Sanciona a</th><th>Tipo de sanción</th><th>Cantidad</th><th>Motor automático</th><th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading && !infractions.length"><td colspan="8" class="text-center py-lg">Cargando...</td></tr>
              <tr v-for="infraction in infractions" :key="infraction.id">
                <td>{{ infraction.code }}</td>
                <td>{{ infraction.name }}</td>
                <td>{{ infraction.article?.code || '—' }}</td>
                <td><span class="badge badge-secondary">{{ sanctionedTypeLabel(infraction.sanctioned_type) }}</span></td>
                <td>{{ sanctionKindLabel(infraction.sanction_kind) }}</td>
                <td>{{ infraction.default_quantity ?? '—' }}</td>
                <td>{{ infraction.auto_trigger ? autoTriggerLabel(infraction.auto_trigger) : '—' }}</td>
                <td>
                  <div class="table-actions">
                    <button type="button" class="btn btn-secondary btn-sm" @click="handleEditInfraction(infraction)">Editar</button>
                    <button type="button" class="btn btn-danger btn-sm" :disabled="removingInfractionId === infraction.id" @click="handleRemoveInfraction(infraction)">
                      {{ removingInfractionId === infraction.id ? 'Eliminando…' : 'Eliminar' }}
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!loading && !infractions.length"><td colspan="8" class="text-center text-muted py-lg">Sin faltas tipificadas.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <form @submit.prevent="submitInfraction">
          <h3 class="mb-md">{{ editingInfractionId ? 'Editar falta' : 'Nueva falta tipificada' }}</h3>
          <div v-if="infractionFormError" class="alert alert-error" role="alert">{{ infractionFormError }}</div>
          <div class="form-row-2">
            <div class="input-group">
              <label class="label" for="infraction-code">Código</label>
              <input id="infraction-code" v-model.trim="infractionForm.code" class="input" placeholder="Ej: FALTA_ROJA_DIRECTA" required />
            </div>
            <div class="input-group">
              <label class="label" for="infraction-name">Nombre</label>
              <input id="infraction-name" v-model.trim="infractionForm.name" class="input" placeholder="Ej: Expulsión por roja directa" required />
            </div>
            <div class="input-group">
              <label class="label" for="infraction-article">Artículo</label>
              <select id="infraction-article" v-model="infractionForm.article_id" class="input">
                <option value="">Sin artículo asociado</option>
                <option v-for="article in articles" :key="article.id" :value="article.id">{{ article.code }} — {{ article.title }}</option>
              </select>
            </div>
            <div class="input-group">
              <label class="label" for="infraction-sport">Deporte</label>
              <select id="infraction-sport" v-model="infractionForm.sport_id" class="input">
                <option value="">Transversal (todos los deportes)</option>
                <option v-for="sport in sports" :key="sport.id" :value="sport.id">{{ sport.name }}</option>
              </select>
            </div>
            <div class="input-group">
              <label class="label" for="infraction-sanctioned-type">Sanciona a</label>
              <select id="infraction-sanctioned-type" v-model="infractionForm.sanctioned_type" class="input" required>
                <option value="CLUB">Club</option>
                <option value="TEAM">Equipo / Serie</option>
                <option value="PLAYER">Jugador</option>
                <option value="COACH">Cuerpo técnico / Dirigente</option>
              </select>
            </div>
            <div class="input-group">
              <label class="label" for="infraction-sanction-kind">Tipo de sanción</label>
              <select id="infraction-sanction-kind" v-model="infractionForm.sanction_kind" class="input" required>
                <option value="MATCHES_SUSPENSION">Suspensión por partidos</option>
                <option value="DAYS_SUSPENSION">Suspensión por días</option>
                <option value="FINE">Multa económica</option>
                <option value="POINTS_DEDUCTION">Quita de puntos</option>
                <option value="WALKOVER">Pérdida de partido (W.O.)</option>
                <option value="LOCALIA_SUSPENSION">Suspensión de localía</option>
                <option value="DISQUALIFICATION">Descalificación del torneo</option>
                <option value="EXPULSION">Expulsión de la liga</option>
              </select>
            </div>
            <div class="input-group">
              <label class="label" for="infraction-quantity">Cantidad por defecto</label>
              <input id="infraction-quantity" v-model.number="infractionForm.default_quantity" type="number" min="0" class="input" placeholder="Partidos / días / monto / puntos" />
            </div>
            <div class="input-group">
              <label class="label" for="infraction-auto-trigger">Motor automático</label>
              <select id="infraction-auto-trigger" v-model="infractionForm.auto_trigger" class="input">
                <option value="">Manual (el tribunal resuelve caso a caso)</option>
                <option value="CARD_ACCUMULATION">Acumulación de tarjetas/faltas</option>
                <option value="RED_CARD_DIRECT">Expulsión directa</option>
              </select>
            </div>
          </div>
          <div class="input-group">
            <label class="label" for="infraction-description">Descripción</label>
            <textarea id="infraction-description" v-model.trim="infractionForm.description" class="input" rows="2" placeholder="Condiciones de aplicación"></textarea>
          </div>
          <div class="flex justify-end gap-sm mt-md">
            <button v-if="editingInfractionId" type="button" class="btn btn-secondary" @click="cancelEditInfraction">Cancelar edición</button>
            <button type="submit" class="btn btn-primary" :disabled="savingInfraction">
              {{ savingInfraction ? 'Guardando…' : (editingInfractionId ? 'Guardar cambios' : 'Crear falta') }}
            </button>
          </div>
        </form>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useDisciplinaryStore } from '../stores/disciplinary';
import { listSports } from '../services/categories.service';

const authStore = useAuthStore();
const disciplinaryStore = useDisciplinaryStore();

const orgId = computed(() => authStore.state.org?.id);
const loading = computed(() => disciplinaryStore.state.loading);
const loadError = ref('');

const tab = ref('articles');
const sports = ref([]);

const articles = computed(() => disciplinaryStore.state.articles || []);
const infractions = computed(() => disciplinaryStore.state.infractions || []);

const SEVERITY_LABELS = { LEVE: 'Leve', GRAVE: 'Grave', GRAVISIMA: 'Gravísima' };
const severityLabel = (severity) => SEVERITY_LABELS[severity] || severity;
const severityBadgeClass = (severity) => ({
  LEVE: 'badge-secondary',
  GRAVE: 'badge-warning',
  GRAVISIMA: 'badge-danger',
}[severity] || 'badge-secondary');

const SANCTIONED_TYPE_LABELS = { CLUB: 'Club', TEAM: 'Equipo/Serie', PLAYER: 'Jugador', COACH: 'Cuerpo técnico' };
const sanctionedTypeLabel = (type) => SANCTIONED_TYPE_LABELS[type] || type;

const SANCTION_KIND_LABELS = {
  MATCHES_SUSPENSION: 'Suspensión por partidos', DAYS_SUSPENSION: 'Suspensión por días', FINE: 'Multa económica',
  POINTS_DEDUCTION: 'Quita de puntos', WALKOVER: 'Pérdida de partido (W.O.)', LOCALIA_SUSPENSION: 'Suspensión de localía',
  DISQUALIFICATION: 'Descalificación', EXPULSION: 'Expulsión de la liga',
};
const sanctionKindLabel = (kind) => SANCTION_KIND_LABELS[kind] || kind;

const AUTO_TRIGGER_LABELS = { CARD_ACCUMULATION: 'Acumulación de tarjetas', RED_CARD_DIRECT: 'Expulsión directa' };
const autoTriggerLabel = (trigger) => AUTO_TRIGGER_LABELS[trigger] || trigger;

// ── Artículos ────────────────────────────────────────────────────────────
const articleForm = reactive({ code: '', title: '', description: '', sport_id: '', variant: '', severity: 'LEVE' });
const editingArticleId = ref(null);
const savingArticle = ref(false);
const articleFormError = ref('');
const removingArticleId = ref(null);

const resetArticleForm = () => {
  Object.assign(articleForm, { code: '', title: '', description: '', sport_id: '', variant: '', severity: 'LEVE' });
  editingArticleId.value = null;
};

const handleEditArticle = (article) => {
  editingArticleId.value = article.id;
  Object.assign(articleForm, {
    code: article.code || '', title: article.title || '', description: article.description || '',
    sport_id: article.sport_id || '', variant: article.variant || '', severity: article.severity || 'LEVE',
  });
  articleFormError.value = '';
};

const cancelEditArticle = () => { resetArticleForm(); articleFormError.value = ''; };

const submitArticle = async () => {
  if (savingArticle.value) return;
  savingArticle.value = true;
  articleFormError.value = '';
  try {
    const payload = { ...articleForm, org_id: orgId.value, sport_id: articleForm.sport_id || null, variant: articleForm.variant || null };
    if (editingArticleId.value) {
      await disciplinaryStore.updateArticle(editingArticleId.value, orgId.value, payload);
    } else {
      await disciplinaryStore.createArticle(payload);
    }
    resetArticleForm();
  } catch (error) {
    articleFormError.value = error.response?.data?.error?.message || disciplinaryStore.state.error || 'No se pudo guardar el artículo.';
  } finally {
    savingArticle.value = false;
  }
};

const handleRemoveArticle = async (article) => {
  if (!confirm(`¿Eliminar el artículo "${article.code}"?`)) return;
  removingArticleId.value = article.id;
  try {
    await disciplinaryStore.deleteArticle(article.id, orgId.value);
    if (editingArticleId.value === article.id) resetArticleForm();
  } catch (error) {
    alert(error.response?.data?.error?.message || disciplinaryStore.state.error || 'No se pudo eliminar el artículo.');
  } finally {
    removingArticleId.value = null;
  }
};

// ── Faltas tipificadas ───────────────────────────────────────────────────
const infractionForm = reactive({
  code: '', name: '', description: '', article_id: '', sport_id: '',
  sanctioned_type: 'PLAYER', sanction_kind: 'MATCHES_SUSPENSION', default_quantity: null, auto_trigger: '',
});
const editingInfractionId = ref(null);
const savingInfraction = ref(false);
const infractionFormError = ref('');
const removingInfractionId = ref(null);

const resetInfractionForm = () => {
  Object.assign(infractionForm, {
    code: '', name: '', description: '', article_id: '', sport_id: '',
    sanctioned_type: 'PLAYER', sanction_kind: 'MATCHES_SUSPENSION', default_quantity: null, auto_trigger: '',
  });
  editingInfractionId.value = null;
};

const handleEditInfraction = (infraction) => {
  editingInfractionId.value = infraction.id;
  Object.assign(infractionForm, {
    code: infraction.code || '', name: infraction.name || '', description: infraction.description || '',
    article_id: infraction.article_id || '', sport_id: infraction.sport_id || '',
    sanctioned_type: infraction.sanctioned_type || 'PLAYER', sanction_kind: infraction.sanction_kind || 'MATCHES_SUSPENSION',
    default_quantity: infraction.default_quantity ?? null, auto_trigger: infraction.auto_trigger || '',
  });
  infractionFormError.value = '';
};

const cancelEditInfraction = () => { resetInfractionForm(); infractionFormError.value = ''; };

const submitInfraction = async () => {
  if (savingInfraction.value) return;
  savingInfraction.value = true;
  infractionFormError.value = '';
  try {
    const payload = {
      ...infractionForm, org_id: orgId.value,
      article_id: infractionForm.article_id || null, sport_id: infractionForm.sport_id || null,
      auto_trigger: infractionForm.auto_trigger || null,
    };
    if (editingInfractionId.value) {
      await disciplinaryStore.updateInfraction(editingInfractionId.value, orgId.value, payload);
    } else {
      await disciplinaryStore.createInfraction(payload);
    }
    resetInfractionForm();
  } catch (error) {
    infractionFormError.value = error.response?.data?.error?.message || disciplinaryStore.state.error || 'No se pudo guardar la falta.';
  } finally {
    savingInfraction.value = false;
  }
};

const handleRemoveInfraction = async (infraction) => {
  if (!confirm(`¿Eliminar la falta "${infraction.name}"?`)) return;
  removingInfractionId.value = infraction.id;
  try {
    await disciplinaryStore.deleteInfraction(infraction.id, orgId.value);
    if (editingInfractionId.value === infraction.id) resetInfractionForm();
  } catch (error) {
    alert(error.response?.data?.error?.message || disciplinaryStore.state.error || 'No se pudo eliminar la falta.');
  } finally {
    removingInfractionId.value = null;
  }
};

onMounted(async () => {
  try {
    const sportsRes = await listSports();
    sports.value = sportsRes.data?.data?.sports ?? sportsRes.data?.sports ?? [];
    await Promise.all([disciplinaryStore.fetchArticles(orgId.value), disciplinaryStore.fetchInfractions(orgId.value)]);
  } catch (error) {
    loadError.value = disciplinaryStore.state.error || 'No se pudo cargar el reglamento.';
  }
});
</script>

<style scoped>
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.table-actions { display: flex; gap: var(--spacing-xs, 8px); flex-wrap: wrap; }
.p-0 { padding: 0 !important; }
.py-lg { padding-top: var(--spacing-lg); padding-bottom: var(--spacing-lg); }

.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border-color); }
.tab-btn {
  padding: 8px 16px; border: none; background: none; cursor: pointer;
  font-size: 0.9rem; color: var(--text-muted, #666);
  border-bottom: 2px solid transparent;
}
.tab-btn.active { color: var(--primary-color, #1976d2); border-bottom-color: var(--primary-color, #1976d2); font-weight: 600; }

.badge-warning { background: #fff3cd; color: #856404; }
.badge-danger { background: #f8d7da; color: #721c24; }

@media (max-width: 640px) {
  .form-row-2 { grid-template-columns: 1fr; }
}
</style>
