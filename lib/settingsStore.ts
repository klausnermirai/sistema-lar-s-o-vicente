
export interface InstitutionSettings {
  entityType: 'obra_unida' | 'conselho';
  councilType?: 'nacional' | 'metropolitano' | 'central';
  name: string;
  cnpj: string;
  city?: string;
  centralCouncil?: string;
  metropolitanCouncil?: string;
}

const STORAGE_KEY = 'ssvp_institution_settings';

export const loadInstitutionSettings = (): InstitutionSettings => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const data = JSON.parse(saved);
    // Fallback para dados antigos
    return {
      entityType: data.entityType || 'obra_unida',
      ...data
    };
  }
  return {
    entityType: 'obra_unida',
    name: 'Lar São Vicente de Paulo',
    cnpj: '',
    city: '',
    centralCouncil: 'Monte Alto',
    metropolitanCouncil: 'Jaboticabal'
  };
};

export const saveInstitutionSettings = (settings: InstitutionSettings): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};
