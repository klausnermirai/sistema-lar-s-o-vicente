
import { getAuthHeaders } from './api';

export const fetchAmendmentCategories = async (institutionId: string) => {
  const response = await fetch(`/api/amendments/categories?institutionId=${institutionId}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar categorias de emendas');
  return response.json();
};

export const saveAmendmentCategory = async (institutionId: string, category: any) => {
  const response = await fetch('/api/amendments/categories', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ institutionId, ...category })
  });
  if (!response.ok) throw new Error('Erro ao salvar categoria de emenda');
  return response.json();
};

export const deleteAmendmentCategory = async (id: string) => {
  const response = await fetch(`/api/amendments/categories/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir categoria');
  return response.json();
};

export const fetchAmendmentGrants = async (institutionId: string) => {
  const response = await fetch(`/api/amendments/grants?institutionId=${institutionId}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar emendas');
  return response.json();
};

export const saveAmendmentGrant = async (institutionId: string, grant: any) => {
  const response = await fetch('/api/amendments/grants', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ institutionId, ...grant })
  });
  if (!response.ok) throw new Error('Erro ao salvar emenda');
  return response.json();
};

export const deleteAmendmentGrant = async (id: string) => {
  const response = await fetch(`/api/amendments/grants/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir emenda');
  return response.json();
};

export const bulkBootstrapAmendments = async (institutionId: string, categories: any[], grants: any[]) => {
  const response = await fetch('/api/amendments/bulk-bootstrap', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ institutionId, categories, grants })
  });
  if (!response.ok) throw new Error('Erro ao realizar bootstrap');
  return response.json();
};
