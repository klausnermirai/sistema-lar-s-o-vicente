
export interface InstitutionSettings {
  name: string;
  cnpj: string;
  centralCouncil: string;
  metropolitanCouncil: string;
}

const STORAGE_KEY = 'ssvp_institution_settings';

export const loadInstitutionSettings = (): InstitutionSettings => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);
  return {
    name: 'Lar São Vicente de Paulo',
    cnpj: '',
    centralCouncil: 'Monte Alto',
    metropolitanCouncil: 'Jaboticabal'
  };
};

export const saveInstitutionSettings = (settings: InstitutionSettings): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};
