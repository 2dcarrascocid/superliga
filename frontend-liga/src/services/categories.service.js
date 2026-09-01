import apiClient from '../api/index.js';

export const listCategories  = (clubId)                   => apiClient.get(`/clubs/${clubId}/categories`);
export const createCategory  = (clubId, data)             => apiClient.post(`/clubs/${clubId}/categories`, data);
export const updateCategory  = (clubId, categoryId, data) => apiClient.patch(`/clubs/${clubId}/categories/${categoryId}`, data);
export const deleteCategory  = (clubId, categoryId)       => apiClient.delete(`/clubs/${clubId}/categories/${categoryId}`);

// Mantenedor de Categorías (Parámetros, a nivel de organización)
export const listSports           = ()                  => apiClient.get('/sports');
export const listCategoriesByOrg  = (orgId)              => apiClient.get(`/orgs/${orgId}/categories`);
export const createCategoryForOrg = (orgId, data)        => apiClient.post(`/orgs/${orgId}/categories`, data);
export const updateCategoryById   = (categoryId, data)   => apiClient.patch(`/categories/${categoryId}`, data);
export const deleteCategoryById   = (categoryId, orgId)  => apiClient.delete(`/categories/${categoryId}`, { params: { org_id: orgId } });
