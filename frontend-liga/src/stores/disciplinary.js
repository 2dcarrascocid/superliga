import { reactive, toRefs } from 'vue';
import {
  listArticles, createArticle as createArticleApi, updateArticle as updateArticleApi, deleteArticle as deleteArticleApi,
  listInfractions, createInfraction as createInfractionApi, updateInfraction as updateInfractionApi, deleteInfraction as deleteInfractionApi,
  listCases, getCase as getCaseApi, createCase as createCaseApi, updateCaseStatus as updateCaseStatusApi,
  createResolution as createResolutionApi, listResolutions, updateResolutionStatus as updateResolutionStatusApi,
  listSanctioned, checkEligibility as checkEligibilityApi,
} from '../services/disciplinary.service';

const state = reactive({
  articles: [],
  infractions: [],
  cases: [],
  casesNextToken: null,
  casesTotal: 0,
  currentCase: null,
  resolutions: [],
  sanctioned: [],
  sanctionedNextToken: null,
  sanctionedTotal: 0,
  loading: false,
  error: null,
});

const unwrap = (response) => {
  const envelope = response.data;
  return envelope?.data ?? envelope;
};

export const useDisciplinaryStore = () => {
  const setError = (message) => {
    state.error = message;
  };

  // ── Reglamento ────────────────────────────────────────────────────────
  const fetchArticles = async (orgId, params) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await listArticles(orgId, params));
      state.articles = data?.articles ?? [];
      return state.articles;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar el reglamento');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const createArticle = async (payload) => {
    const data = unwrap(await createArticleApi(payload));
    await fetchArticles(payload.org_id);
    return data.article;
  };

  const updateArticle = async (articleId, orgId, payload) => {
    const data = unwrap(await updateArticleApi(articleId, payload));
    await fetchArticles(orgId);
    return data.article;
  };

  const deleteArticle = async (articleId, orgId) => {
    const data = unwrap(await deleteArticleApi(articleId));
    await fetchArticles(orgId);
    return data;
  };

  // ── Catálogo de faltas tipificadas ───────────────────────────────────
  const fetchInfractions = async (orgId, params) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await listInfractions(orgId, params));
      state.infractions = data?.infractions ?? [];
      return state.infractions;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar el catálogo de faltas');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const createInfraction = async (payload) => {
    const data = unwrap(await createInfractionApi(payload));
    await fetchInfractions(payload.org_id);
    return data.infraction;
  };

  const updateInfraction = async (infractionId, orgId, payload) => {
    const data = unwrap(await updateInfractionApi(infractionId, payload));
    await fetchInfractions(orgId);
    return data.infraction;
  };

  const deleteInfraction = async (infractionId, orgId) => {
    const data = unwrap(await deleteInfractionApi(infractionId));
    await fetchInfractions(orgId);
    return data;
  };

  // ── Expedientes (Casos) ───────────────────────────────────────────────
  const fetchCases = async (orgId, params = {}) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await listCases(orgId, params));
      state.cases = params.next_token ? [...state.cases, ...(data?.cases ?? [])] : (data?.cases ?? []);
      state.casesNextToken = data?.next_token ?? null;
      state.casesTotal = data?.total_registros ?? 0;
      return state.cases;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar los expedientes');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const fetchCase = async (caseId) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await getCaseApi(caseId));
      state.currentCase = data?.case ?? null;
      state.resolutions = data?.resolutions ?? [];
      return data;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar el expediente');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const createCase = async (payload) => {
    const data = unwrap(await createCaseApi(payload));
    await fetchCases(payload.org_id);
    return data.case;
  };

  const updateCaseStatus = async (caseId, status) => {
    const data = unwrap(await updateCaseStatusApi(caseId, status));
    if (state.currentCase?.id === caseId) state.currentCase = data.case;
    return data.case;
  };

  // ── Resoluciones ──────────────────────────────────────────────────────
  const createResolution = async (caseId, payload) => {
    const data = unwrap(await createResolutionApi(caseId, payload));
    await fetchCase(caseId);
    return data.resolution;
  };

  const fetchResolutions = async (orgId, params) => {
    const data = unwrap(await listResolutions(orgId, params));
    state.resolutions = data?.resolutions ?? [];
    return state.resolutions;
  };

  const updateResolutionStatus = async (resolutionId, statusCumplimiento, caseId) => {
    const data = unwrap(await updateResolutionStatusApi(resolutionId, statusCumplimiento));
    if (caseId) await fetchCase(caseId);
    return data.resolution;
  };

  // ── Consulta de sancionados / habilitación ──────────────────────────
  const fetchSanctioned = async (orgId, params = {}) => {
    state.loading = true;
    state.error = null;
    try {
      const data = unwrap(await listSanctioned(orgId, params));
      state.sanctioned = params.next_token ? [...state.sanctioned, ...(data?.sanctioned ?? [])] : (data?.sanctioned ?? []);
      state.sanctionedNextToken = data?.next_token ?? null;
      state.sanctionedTotal = data?.total_registros ?? 0;
      return state.sanctioned;
    } catch (error) {
      setError(error.response?.data?.error?.message || 'Error al cargar los sancionados');
      throw error;
    } finally {
      state.loading = false;
    }
  };

  const checkEligibility = async (sanctionedType, sanctionedId, tournamentId) => {
    const data = unwrap(await checkEligibilityApi(sanctionedType, sanctionedId, tournamentId));
    return data;
  };

  return {
    ...toRefs(state),
    state,
    fetchArticles, createArticle, updateArticle, deleteArticle,
    fetchInfractions, createInfraction, updateInfraction, deleteInfraction,
    fetchCases, fetchCase, createCase, updateCaseStatus,
    createResolution, fetchResolutions, updateResolutionStatus,
    fetchSanctioned, checkEligibility,
  };
};
