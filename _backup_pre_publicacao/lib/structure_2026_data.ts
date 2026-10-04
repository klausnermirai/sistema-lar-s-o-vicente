/**
 * Dados imutáveis da estrutura de 2026 do Conselho Central de Jaboticabal
 * Contém os 6 Conselhos Particulares e 52 Conferências oficiais aprovadas.
 */

export interface StaticConferenciaImport {
  name: string;
}

export interface StaticCpImport {
  name: string;
  city: string;
  address: string;
  cep: string;
  phone: string;
  email: string;
  startDate: string;
  endDate: string;
  presidenteName: string;
  presidentePhone: string;
  conferencias: StaticConferenciaImport[];
}

export const ESTRUTURA_2026_JABOTICABAL_DATA: readonly StaticCpImport[] = [
  {
    name: 'Conselho Particular Antonio Fred Ozanam',
    city: 'Jaboticabal',
    address: 'Av. José Batista Ferreira, 795 - Aparecida',
    cep: '14882-115',
    phone: '(16) 99723-1683',
    email: 'cpaf.ozanam@gmail.com, mariadonadon@outlook.com',
    startDate: '2024-12-05',
    endDate: '2028-12-04',
    presidenteName: 'CARLA HELENA D. CAETANO',
    presidentePhone: '(16) 99723-1683',
    conferencias: [
      { name: 'SÃO JOÃO APÓSTOLO' },
      { name: 'SÃO TARCÍSIO' },
      { name: 'SÃO JOSÉ' },
      { name: 'SANTA ISABEL' },
      { name: 'NOSSA SENHORA APARECIDA' },
      { name: 'NOSSA SENHORA DE FÁTIMA' },
      { name: 'SANTA TERESA DE JESUS' },
      { name: 'SÃO FRANCISCO DE ASSIS' },
      { name: 'SÃO MATEUS' },
    ],
  },
  {
    name: 'Conselho Particular Santo Antônio de Santana Galvão (Monte Alto)',
    city: 'Monte Alto',
    address: 'Travessa da Saudade, s/n - Centro',
    cep: '15910-000',
    phone: '(16) 98137-9063',
    email: 'cpfreigalvaoma@gmail.com, norbertoquintini31@gmail.com',
    startDate: '2025-07-24',
    endDate: '2029-07-23',
    presidenteName: 'Norberto Quintino Costa',
    presidentePhone: '(16) 98137-9063',
    conferencias: [
      { name: 'NOSSA SENHORA APARECIDA' },
      { name: 'SANTA CATARINA LABOURÉ' },
      { name: 'SÃO SEBASTIÃO' },
      { name: 'SÃO BENEDITO' },
      { name: 'SÃO BRÁS' },
      { name: 'SANTO AGOSTINHO' },
      { name: 'SANTA RITA (VISTA ALEGRE)' },
      { name: 'SANTA LUZIA (FERNANDO PRESTES)' },
    ],
  },
  {
    name: 'Conselho Particular Imaculada Conceição (Taiaçú)',
    city: 'Taiaçu',
    address: 'Rua São Sebastião, 379 - Centro',
    cep: '14725-000',
    phone: '(16) 99274-9316',
    email: 'ferminoodair9@gmail.com',
    startDate: '2026-03-02',
    endDate: '2030-03-01',
    presidenteName: 'ODAIR FERMINO',
    presidentePhone: '(16) 99274-9316',
    conferencias: [
      { name: 'BOM PASTOR (TAIUVA)' },
      { name: 'IMACULADO CORAÇÃO DE MARIA' },
      { name: 'SÃO FRANCISCO (TAIAÇU)' },
      { name: 'SÃO JOSÉ (TAIAÇU)' },
      { name: 'SANTO ANTONIO (PIRANGI)' },
      { name: 'SANTA CATARINA (PIRANGI)' },
      { name: 'NOSSA SENHORA APARECIDA (BEBEDOURO)' },
      { name: 'NOSSA SENHORA APARECIDA (VIRADOURO)' },
      { name: 'NOSSA SENHORA APARECIDA (CCA=TAIAÇÚ)' },
    ],
  },
  {
    name: 'Conselho Particular Nossa Senhora do Carmo',
    city: 'Jaboticabal',
    address: 'Av. Prudêncio Ortiz, 341',
    cep: '14870-690',
    phone: '(16) 99260-1015',
    email: 'alex.melossvp@gmail.com',
    startDate: '2026-06-27',
    endDate: '2029-06-26',
    presidenteName: 'Alex Aparecido de Melo',
    presidentePhone: '(16) 99260-1015',
    conferencias: [
      { name: 'SÃO MATHEUS (BARRINHA)' },
      { name: 'MARIA DE NAZARÉ' },
      { name: 'SÃO CAMILO DE LELLIS' },
      { name: 'JESUS CRUCIFICADO' },
      { name: 'SANTO ANTONIO' },
      { name: 'SÃO JUDAS TADEU' },
      { name: 'SÃO BENEDITO' },
      { name: 'CCA São Tarcísio (Barrinha)' },
    ],
  },
  {
    name: 'Conselho Particular de Taquaritinga',
    city: 'Taquaritinga',
    address: 'Av. Antônio Micali, 1467 - Jd São Vicente',
    cep: '15900-000',
    phone: '(16) 99736-0146, (16) 3252-3055',
    email: 'ssvptaquaritinga@hotmail.com',
    startDate: '2024-12-12',
    endDate: '2026-12-12',
    presidenteName: 'Maria Claudete Marotti Rizzo',
    presidentePhone: '(16) 99736-0146',
    conferencias: [
      { name: 'SÃO LUIZ GONZAGA' },
      { name: 'SÃO SEBASTIÃO' },
      { name: 'SANTA TEREZINHA M. JESUS' },
      { name: 'SANTO AGOSTINHO' },
      { name: 'SÃO JOSÉ' },
      { name: 'SÃO JOÃO' },
      { name: 'SAGRADO CORAÇÃO DE JESUS' },
      { name: 'SANTA RITA DE CÁSSIA - CCA' },
      { name: 'SANTÍSSIMA TRINDADE' },
      { name: 'SÃO CAETANO' },
      { name: 'SÃO FRANC. DE PAULA (DOBRADA)' },
    ],
  },
  {
    name: 'Conselho Particular Monte Alto',
    city: 'Monte Alto',
    address: 'Largo 08 de Fevereiro, 1384 - Centro',
    cep: '15910-000',
    phone: '(16) 99631-1718',
    email: 'conselhoparticularmontealto@gmail.com',
    startDate: '2026-07-04',
    endDate: '2030-07-03',
    presidenteName: 'Ailton Roberto Costa',
    presidentePhone: '(16) 99631-1718',
    conferencias: [
      { name: 'NOSSA SENHORA DE PERPÉTUO SOCORRO' },
      { name: 'SÃO JUDAS TADEU' },
      { name: 'SÃO CAMILO DE LELIS' },
      { name: 'SÃO CRISTOVÃO' },
      { name: 'SR. BOM JESUS' },
      { name: 'SAGRADO CORAÇÃO DE JESUS (CCA)' },
      { name: 'SANTA RITA DE CÁSSIA' },
    ],
  },
] as const;
