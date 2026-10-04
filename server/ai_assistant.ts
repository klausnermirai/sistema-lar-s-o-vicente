import { GoogleGenAI } from "@google/genai";
import { getFirestore } from "firebase-admin/firestore";

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("A chave GEMINI_API_KEY não está configurada no ambiente.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

/**
 * Known collections in the system.
 */
const KNOWN_COLLECTIONS = [
  'residents',
  'finance_donations',
  'caixinha_movements',
  'carnes',
  'benefactors',
  'donation_categories',
  'product_stock',
  'stock_movements',
  'medication_inventory',
  'medication_stock_movements',
  'medication_administration_logs',
  'candidates',
  'group_activities',
  'meals',
  'agenda_events',
  'employees',
  'shifts',
  'handovers',
  'suppliers',
  'amendment_grants',
  'muralMessages',
  'sosProtocols',
  'procedure_logs',
  'assistedFamilies',
  'conferencias',
  'conselhos_particulares',
  'conselhos_centrais',
  'membros_ssvp'
];

/**
 * Fetch and build an aggregated, contextual snapshot of the institution's data
 * across all existing collections, strictly matching the user's institutionId/CNPJ/hierarchy.
 */
export async function buildInstitutionKnowledgeContext(
  db: ReturnType<typeof getFirestore>,
  institutionId: string,
  institutionDocData?: any
): Promise<string> {
  const cleanInst = institutionId?.replace(/[\.\-\/]/g, '') || '';
  const formattedInst = institutionId || '';

  // Set of all valid identifier strings for this institution
  const validIds = new Set<string>();
  if (formattedInst) validIds.add(formattedInst);
  if (cleanInst) validIds.add(cleanInst);

  if (institutionDocData) {
    if (institutionDocData.id) validIds.add(institutionDocData.id);
    if (institutionDocData.cnpj) {
      validIds.add(institutionDocData.cnpj);
      validIds.add(institutionDocData.cnpj.replace(/[\.\-\/]/g, ''));
    }
    if (institutionDocData.institutionId) {
      validIds.add(institutionDocData.institutionId);
      validIds.add(institutionDocData.institutionId.replace(/[\.\-\/]/g, ''));
    }
  }

  // Cross-reference with standard Monte Alto and Central Council CNPJs
  const monteAltoCnpj = '52.853.397/0001-68';
  const monteAltoClean = '52853397000168';
  if (validIds.has(monteAltoCnpj) || validIds.has(monteAltoClean) || validIds.has('ga6jzrx1flf') || (institutionDocData?.name && institutionDocData.name.includes('Monte Alto'))) {
    validIds.add(monteAltoCnpj);
    validIds.add(monteAltoClean);
    validIds.add('ga6jzrx1flf');
  }

  const summaryParts: string[] = [];
  const isCentralCouncil = 
    institutionDocData?.entityType === 'conselho_central' || 
    institutionDocData?.type === 'conselho_central' || 
    institutionDocData?.cnpj === '54.927.132/0001-92' || 
    institutionId === '54.927.132/0001-92' ||
    cleanInst === '54927132000192' ||
    !!institutionDocData?.centralCouncil;

  // Reference date/time for temporal inquiries (e.g., "hoje", "amanhã", "próximos dias")
  const now = new Date();
  const currentDateStr = now.toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    timeZone: 'America/Sao_Paulo'
  });
  const currentTimeStr = now.toLocaleTimeString('pt-BR', { 
    timeZone: 'America/Sao_Paulo', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  const currentIsoDate = now.toISOString().split('T')[0];

  summaryParts.push(
    `--- DATA E HORA DE REFERÊNCIA DO SISTEMA ---\n` +
    `Hoje é: ${currentDateStr} (Horário de Brasília: ${currentTimeStr})\n` +
    `Data de hoje em formato AAAA-MM-DD: ${currentIsoDate}`
  );

  if (institutionDocData) {
    summaryParts.push(
      `--- DADOS DA INSTITUIÇÃO ---\n` +
      `Tipo de Entidade: ${isCentralCouncil ? 'Conselho Central da SSVP (Instância de Coordenação e Governança)' : 'Obra Unida / Lar de Idosos (ILPI)'}\n` +
      `Nome/Razão Social: ${institutionDocData.name || institutionDocData.razaoSocial || 'Não informado'}\n` +
      `Nome Fantasia: ${institutionDocData.fantasyName || institutionDocData.name || 'Não informado'}\n` +
      `CNPJ: ${institutionDocData.cnpj || institutionId}\n` +
      `Endereço: ${institutionDocData.address || ''}, ${institutionDocData.city || ''} - ${institutionDocData.state || ''}\n` +
      `Telefone/Contato: ${institutionDocData.phone || institutionDocData.whatsapp || ''}\n` +
      (institutionDocData.capacity ? `Capacidade Máxima: ${institutionDocData.capacity}\n` : '')
    );

    // If it's a Conselho Central, extract Central Council Board, Mandates, and Obras Unidas
    if (institutionDocData.centralCouncil) {
      const cc = institutionDocData.centralCouncil;
      const customRolesText = (cc.customRoles && Array.isArray(cc.customRoles) && cc.customRoles.length > 0)
        ? cc.customRoles.map((cr: any) => `  - ${cr.roleName || 'Cargo'}: ${cr.name || 'Não informado'} (Tel: ${cr.phone || 'Sem telefone'})`).join('\n')
        : '  (Nenhum cargo adicional cadastrado)';

      const mandateHistoryText = (cc.mandateHistory && Array.isArray(cc.mandateHistory) && cc.mandateHistory.length > 0)
        ? cc.mandateHistory.map((mh: any) => `  • Mandato ${mh.posseDate || '-'} a ${mh.mandateEndDate || '-'}: Presidente ${mh.presidenteName || '-'} | Arquivado em: ${mh.archivedAt || '-'}`).join('\n')
        : '  (Nenhum mandato anterior arquivado)';

      summaryParts.push(
        `--- DIRETORIA E MANDATO DO CONSELHO CENTRAL ---\n` +
        `Data de Fundação do Conselho Central: ${cc.foundationDate || 'Não informada'}\n` +
        `Vigência do Mandato Atual: De ${cc.posseDate || 'Não informada'} até ${cc.mandateEndDate || 'Não informada'}\n\n` +
        `Membros da Diretoria Executiva Atual:\n` +
        `  - Presidente: ${cc.presidenteName || 'Não informado'} (Tel: ${cc.presidentePhone || 'Sem telefone'})\n` +
        `  - 1º Vice-Presidente: ${cc.vice1Name || 'Não informado'} (Tel: ${cc.vice1Phone || 'Sem telefone'})\n` +
        `  - 2º Vice-Presidente: ${cc.vice2Name || 'Não informado'} (Tel: ${cc.vice2Phone || 'Sem telefone'})\n` +
        `  - 1º Tesoureiro: ${cc.tesoureiro1Name || 'Não informado'} (Tel: ${cc.tesoureiro1Phone || 'Sem telefone'})\n` +
        `  - 2º Tesoureiro: ${cc.tesoureiro2Name || 'Não informado'} (Tel: ${cc.tesoureiro2Phone || 'Sem telefone'})\n` +
        `  - 1º Secretário: ${cc.secretario1Name || 'Não informado'} (Tel: ${cc.secretario1Phone || 'Sem telefone'})\n` +
        `  - 2º Secretário: ${cc.secretario2Name || 'Não informado'} (Tel: ${cc.secretario2Phone || 'Sem telefone'})\n` +
        `  - Coordenador(a) de Comunicação: ${cc.comunicacaoName || 'Não informado'} (Tel: ${cc.comunicacaoPhone || 'Sem telefone'})\n` +
        `  - Coordenador(a) de Jovens (CJ): ${cc.coordenadorJovensName || 'Não informado'} (Tel: ${cc.coordenadorJovensPhone || 'Sem telefone'})\n` +
        `  - Coordenador(a) de Crianças e Adolescentes (CCA): ${cc.coordenadorCriancasName || 'Não informado'} (Tel: ${cc.coordenadorCriancasPhone || 'Sem telefone'})\n` +
        `  - Coordenador(a) da ECAFO: ${cc.ecafoName || 'Não informado'} (Tel: ${cc.ecafoPhone || 'Sem telefone'})\n\n` +
        `Outros Cargos / Assessores Nomeados:\n${customRolesText}\n\n` +
        `Histórico de Mandatos Anteriores do Conselho Central:\n${mandateHistoryText}`
      );
    }

    if (institutionDocData.obrasUnidas && Array.isArray(institutionDocData.obrasUnidas) && institutionDocData.obrasUnidas.length > 0) {
      summaryParts.push(
        `--- OBRAS UNIDAS VINCULADAS E SUPERVISIONADAS (${institutionDocData.obrasUnidas.length} obras cadastradas) ---\n` +
        institutionDocData.obrasUnidas.map((ou: any, idx: number) => {
          const checklist = ou.fiscalChecklist || {};
          const docs = ou.complianceDocuments || [];
          const docsPendentes = docs.filter((d: any) => d.status === 'pendente' || d.status === 'vencido');
          const docsRegulares = docs.filter((d: any) => d.status === 'regular');

          return `• OBRA UNIDA #${idx + 1}: ${ou.name || ou.fantasyName || 'Obra Unida'}\n` +
                 `  - CNPJ: ${ou.cnpj || '-'} | Cidade: ${ou.city || '-'} | Telefone: ${ou.phone || '-'} | E-mail: ${ou.email || '-'}\n` +
                 `  - Vigência do Mandato: ${ou.startDate || 'Não inf.'} a ${ou.endDate || 'Não inf.'}\n` +
                 `  - Diretoria: Presidente: ${ou.presidente?.name || '-'} (Tel: ${ou.presidente?.phone || '-'}) | Vice: ${ou.vicePresidente?.name || '-'} | Tesoureiro: ${ou.tesoureiro?.name || '-'} | Secretário: ${ou.secretario?.name || '-'}\n` +
                 `  - Checklist Fiscal: Estatuto Vigente: ${checklist.estatutoVigente ? 'SIM' : 'NÃO'} | Ata de Eleição: ${checklist.ataEleicao ? 'SIM' : 'NÃO'} | CND Federal: ${checklist.cndFederal ? 'SIM' : 'NÃO'} | CND Estadual: ${checklist.cndEstadual ? 'SIM' : 'NÃO'} | CND Municipal: ${checklist.cndMunicipal ? 'SIM' : 'NÃO'} | Alvará: ${checklist.alvaraFuncionamento ? 'SIM' : 'NÃO'} | Balanço Contábil: ${checklist.balancoContabil ? 'SIM' : 'NÃO'}\n` +
                 `  - Documentos de Conformidade: Total ${docs.length} (${docsRegulares.length} regulares, ${docsPendentes.length} pendentes/vencidos)`;
        }).join('\n\n')
      );
    }
  }

  // Parallel fetch from all collections
  const rawCollectionResults: Record<string, any[]> = {};

  await Promise.all(
    KNOWN_COLLECTIONS.map(async (colName) => {
      try {
        const snap = await db.collection(colName).get();
        if (!snap.empty) {
          const list: any[] = [];
          snap.forEach(doc => {
            const d = doc.data();
            if (d) list.push({ id: doc.id, ...d });
          });
          rawCollectionResults[colName] = list;
        }
      } catch (err) {
        console.warn(`[AI Assistant] Could not load collection ${colName}:`, err);
      }
    })
  );

  // Match Conselhos Particulares first to capture their IDs
  const matchedCPIds = new Set<string>();
  const matchedCPs: any[] = (rawCollectionResults['conselhos_particulares'] || []).filter(cp => {
    const docInst = cp.institutionId || cp.institution_id || cp.cnpj || cp.centralId || cp.central_id || '';
    const cleanDocInst = typeof docInst === 'string' ? docInst.replace(/[\.\-\/]/g, '') : '';
    const isMatch = validIds.has(docInst) || validIds.has(cleanDocInst) || validIds.has(cp.id) || !cp.centralId;
    if (isMatch) {
      matchedCPIds.add(cp.id);
      return true;
    }
    return false;
  });

  // Match Conferências
  const matchedConfIds = new Set<string>();
  const matchedConfs: any[] = (rawCollectionResults['conferencias'] || []).filter(conf => {
    const docInst = conf.institutionId || conf.institution_id || conf.cnpj || conf.centralId || conf.central_id || '';
    const cleanDocInst = typeof docInst === 'string' ? docInst.replace(/[\.\-\/]/g, '') : '';
    const isMatch = 
      validIds.has(docInst) || 
      validIds.has(cleanDocInst) || 
      validIds.has(conf.id) || 
      (conf.particularId && matchedCPIds.has(conf.particularId)) ||
      !conf.centralId;

    if (isMatch) {
      matchedConfIds.add(conf.id);
      return true;
    }
    return false;
  });

  // Match Membros SSVP
  const matchedMembros: any[] = (rawCollectionResults['membros_ssvp'] || []).filter(m => {
    const docInst = m.institutionId || m.institution_id || m.cnpj || m.centralId || m.central_id || '';
    const cleanDocInst = typeof docInst === 'string' ? docInst.replace(/[\.\-\/]/g, '') : '';
    return (
      validIds.has(docInst) ||
      validIds.has(cleanDocInst) ||
      validIds.has(m.id) ||
      (m.particularId && matchedCPIds.has(m.particularId)) ||
      (m.conferenciaId && matchedConfIds.has(m.conferenciaId)) ||
      !m.centralId
    );
  });

  // Match other collections
  const filterStandardCollection = (colName: string) => {
    return (rawCollectionResults[colName] || []).filter(doc => {
      const docInst = doc.institutionId || doc.institution_id || doc.cnpj || doc.centralId || '';
      const cleanDocInst = typeof docInst === 'string' ? docInst.replace(/[\.\-\/]/g, '') : '';
      return (
        validIds.has(docInst) ||
        validIds.has(cleanDocInst) ||
        validIds.has(doc.id) ||
        (doc.particularId && matchedCPIds.has(doc.particularId)) ||
        (doc.conferenciaId && matchedConfIds.has(doc.conferenciaId))
      );
    });
  };

  // --- Add Hierarchy Summaries for Conselho Central & General ---
  if (matchedCPs.length > 0) {
    summaryParts.push(
      `--- CONSELHOS PARTICULARES VINCULADOS (${matchedCPs.length} conselhos cadastrados) ---\n` +
      matchedCPs.map(cp => {
        const confCount = matchedConfs.filter(c => c.particularId === cp.id).length;
        return `• CP: ${cp.name || 'Sem nome'}\n` +
               `  - Código/Sigla: ${cp.code || '-'}\n` +
               `  - Município/Cidade: ${cp.city || '-'} - ${cp.state || 'SP'}\n` +
               `  - Presidente: ${cp.presidentName || 'Não informado'} (Tel: ${cp.presidentPhone || 'Sem telefone'})\n` +
               `  - Status: ${cp.status || 'Ativo'}\n` +
               `  - Conferências Vinculadas: ${confCount > 0 ? `${confCount} conferência(s)` : (cp.conferenciasCount || '0')}`;
      }).join('\n\n')
    );
  }

  if (matchedConfs.length > 0) {
    summaryParts.push(
      `--- CONFERÊNCIAS VICENTINAS (${matchedConfs.length} conferências cadastradas) ---\n` +
      matchedConfs.map(c => {
        const cp = matchedCPs.find(p => p.id === c.particularId);
        const membersCount = matchedMembros.filter(m => m.conferenciaId === c.id).length;
        return `• Conferência: ${c.name || 'Sem nome'}\n` +
               `  - Conselho Particular: ${cp ? cp.name : (c.particularName || 'Não especificado')}\n` +
               `  - Presidente: ${c.presidentName || 'Não informado'} (Tel: ${c.presidentPhone || 'Sem telefone'})\n` +
               `  - Dia e Horário de Reunião: ${c.meetingDay || '-'} às ${c.meetingTime || '-'}\n` +
               `  - Local de Reunião: ${c.meetingPlace || c.address || '-'}\n` +
               `  - Status: ${c.status || 'Ativa'}\n` +
               `  - Total de Membros Registrados: ${membersCount > 0 ? membersCount : (c.membersCount || 0)}`;
      }).join('\n\n')
    );
  }

  if (matchedMembros.length > 0) {
    const confrades = matchedMembros.filter(m => (m.tipoMembro || m.tipo || '').toLowerCase().includes('confrade'));
    const consocias = matchedMembros.filter(m => (m.tipoMembro || m.tipo || '').toLowerCase().includes('consocia') || (m.tipoMembro || m.tipo || '').toLowerCase().includes('consócia'));
    const aspirantes = matchedMembros.filter(m => (m.tipoMembro || m.tipo || '').toLowerCase().includes('aspirante'));
    const afastados = matchedMembros.filter(m => (m.tipoMembro || m.tipo || '').toLowerCase().includes('afastado') || m.status === 'afastado');
    const ativos = matchedMembros.filter(m => (!m.status || m.status === 'ativo') && (m.tipoMembro || m.tipo || '') !== 'afastado');

    summaryParts.push(
      `--- MEMBROS VICENTINOS (${matchedMembros.length} membros no total: ${confrades.length} Confrades, ${consocias.length} Consócias, ${aspirantes.length} Aspirantes, ${afastados.length} Afastados | ${ativos.length} Ativos) ---\n` +
      `Lista dos Membros Cadastrados:\n` +
      matchedMembros.map(m => {
        const conf = matchedConfs.find(c => c.id === m.conferenciaId);
        const cp = matchedCPs.find(p => p.id === m.particularId);
        return `• ${m.nome || m.name || 'Sem nome'} (${m.tipoMembro || m.tipo || 'Membro'}${m.cargo ? ` - Cargo: ${m.cargo}` : ''}${m.genero || m.gender ? ` | Gênero: ${m.genero || m.gender}` : ''})\n` +
               `  - Conferência: ${conf ? conf.name : (m.conferenciaName || '-')}\n` +
               `  - Conselho Particular: ${cp ? cp.name : (m.particularName || '-')}\n` +
               `  - Status: ${m.status || 'Ativo'} | Tel: ${m.telefone || m.phone || 'Sem telefone'} | E-mail: ${m.email || 'Sem e-mail'}\n` +
               `  - Data de Admissão / Proclamação: ${m.dataAdmissao || m.admissionDate || 'Não informada'}`;
      }).join('\n\n')
    );
  }

  // Assisted Families
  const matchedFamilies = filterStandardCollection('assistedFamilies');
  if (matchedFamilies.length > 0) {
    summaryParts.push(
      `--- FAMÍLIAS ASSISTIDAS PELAS CONFERÊNCIAS (${matchedFamilies.length} famílias cadastradas) ---\n` +
      matchedFamilies.map(f => {
        const conf = matchedConfs.find(c => c.id === f.conferenciaId);
        return `• Família / Responsável: ${f.responsibleName || f.nomeResponsavel || f.name || 'Responsável'}\n` +
               `  - Conferência Responsável: ${conf ? conf.name : (f.conferenciaName || '-')}\n` +
               `  - Endereço: ${f.address || f.endereco || '-'}\n` +
               `  - Telefone: ${f.phone || f.telefone || '-'}\n` +
               `  - Dependentes: ${f.dependentsCount || f.numeroDependentes || '-'}\n` +
               `  - Situação / Observações: ${f.situation || f.observacoes || 'Atendida regularmente'}`;
      }).join('\n\n')
    );
  }

  // --- Add Standard Nursing Home / ILPI Modules if present ---
  const matchedResidents = filterStandardCollection('residents');
  if (matchedResidents.length > 0) {
    const active = matchedResidents.filter(r => !r.isArchived && r.status !== 'inativo' && r.status !== 'obito' && r.status !== 'transferido');
    const inactive = matchedResidents.filter(r => r.isArchived || r.status === 'inativo' || r.status === 'obito' || r.status === 'transferido');
    summaryParts.push(
      `--- MÓDULO ACOLHIDOS / IDOSOS (${matchedResidents.length} no total, ${active.length} ativos) ---\n` +
      active.map(r => {
        const relativesText = (r.relatives && Array.isArray(r.relatives) && r.relatives.length > 0)
          ? r.relatives.map((rel: any) => `${rel.name || 'Familiar'} (${rel.kinship || 'Parentesco não informado'}${rel.isResponsible ? ' - RESPONSÁVEL PRINCIPAL' : ''}): Tel ${rel.phone || 'Sem telefone'} ${rel.observation ? `[${rel.observation}]` : ''}`).join('; ')
          : (r.responsibleName || r.emergencyContact ? `${r.responsibleName || r.emergencyContact} (${r.responsiblePhone || r.emergencyPhone || 'Sem tel'})` : 'Nenhum responsável cadastrado');
        
        const medsText = (r.medications && Array.isArray(r.medications) && r.medications.length > 0)
          ? r.medications.map((m: any) => `${m.name || m.medicationName || 'Medicamento'} (${m.dosage || ''} ${m.frequency || ''})`).join(', ')
          : 'Nenhum';

        return `• IDOSO: ${r.name || 'Sem nome'}\n` +
               `  - Sexo/Idade/Nascimento: ${r.gender || '-'}, ${r.birthDate || r.age || '-'}\n` +
               `  - Quarto/Leito: Quarto ${r.room || '-'}, Leito ${r.bedNumber || r.bed || '-'}\n` +
               `  - Grau de Dependência: ${r.dependencyLevel || r.dependencyDegree || r.grau || '-'}\n` +
               `  - Responsáveis e Contatos Familiares: ${relativesText}\n` +
               `  - Medicamentos em Uso: ${medsText}\n` +
               `  - Cuidados/Restrições/Alergias: ${r.dietaryRestrictions || r.allergies || r.observations || 'Nenhuma'}\n` +
               `  - Documentos: CPF ${r.cpf || '-'} | RG ${r.rg || '-'} | SUS ${r.susCard || '-'}`;
      }).join('\n\n') +
      (inactive.length > 0 ? `\n\n(Acolhidos Inativos/Arquivados: ${inactive.map(r => `${r.name} [Motivo: ${r.archivingReason || r.status || 'arquivado'}]`).join(', ')})` : '')
    );
  }

  const matchedCaixinha = filterStandardCollection('caixinha_movements');
  if (matchedCaixinha.length > 0) {
    const entradas = matchedCaixinha.filter(m => m.type === 'entrada');
    const saidas = matchedCaixinha.filter(m => m.type === 'saida');
    const totalEntradas = entradas.reduce((acc, m) => acc + (Number(m.value) || 0), 0);
    const totalSaidas = saidas.reduce((acc, m) => acc + (Number(m.value) || 0), 0);
    const saldoCaixinha = totalEntradas - totalSaidas;

    summaryParts.push(
      `--- MÓDULO CONTROLE DA CAIXINHA (FUNDO FIXO EM DINHEIRO) ---\n` +
      `Saldo Atual em Mãos: R$ ${saldoCaixinha.toFixed(2)} (Entradas: R$ ${totalEntradas.toFixed(2)}, Saídas: R$ ${totalSaidas.toFixed(2)})\n` +
      `Últimas Movimentações:\n` +
      matchedCaixinha.slice(-15).reverse().map(m =>
        `• [${m.date || '-'}] ${m.type === 'entrada' ? '(+) ENTRADA' : '(-) SAÍDA'} R$ ${Number(m.value || 0).toFixed(2)} - Cat: ${m.category || '-'} - Desc: ${m.description || '-'} - Resp: ${m.responsible || '-'}`
      ).join('\n')
    );
  }

  const matchedDonations = filterStandardCollection('finance_donations');
  if (matchedDonations.length > 0) {
    const totalArrecadado = matchedDonations.reduce((acc, d) => acc + (Number(d.value) || 0), 0);
    summaryParts.push(
      `--- MÓDULO DOAÇÕES & ARRECADAÇÃO (${matchedDonations.length} doações registradas, Total Geral: R$ ${totalArrecadado.toFixed(2)}) ---\n` +
      `Últimas doações:\n` +
      matchedDonations.slice(-15).reverse().map(d =>
        `• Data: ${d.date || '-'} | Valor: R$ ${Number(d.value || 0).toFixed(2)} | Método: ${d.paymentMethod || '-'} | Doador: ${d.benefactorName || 'Anônimo'} | Categoria: ${d.categoryName || '-'}`
      ).join('\n')
    );
  }

  const matchedStock = filterStandardCollection('product_stock');
  if (matchedStock.length > 0) {
    const itemsAbaixoMin = matchedStock.filter(i => Number(i.quantity || 0) <= Number(i.minStock || 0));
    summaryParts.push(
      `--- MÓDULO ESTOQUE & ALMOXARIFADO (${matchedStock.length} itens cadastrados) ---\n` +
      `Itens abaixo do estoque mínimo: ${itemsAbaixoMin.length}\n` +
      `Principais Itens em Estoque:\n` +
      matchedStock.map(i =>
        `• ${i.name || i.productName || 'Item'} - Qtd Atual: ${i.quantity || 0} ${i.unit || 'un'} (Estoque Mínimo: ${i.minStock || 0}) | Categoria: ${i.category || '-'}`
      ).join('\n')
    );
  }

  const matchedMeds = filterStandardCollection('medication_inventory');
  if (matchedMeds.length > 0) {
    summaryParts.push(
      `--- MÓDULO FARMÁCIA & MEDICAMENTOS (${matchedMeds.length} medicamentos cadastrados) ---\n` +
      matchedMeds.map(m =>
        `• ${m.name || m.medicationName || 'Medicamento'} (${m.dosage || '-'}) - Estoque: ${m.stockQuantity || m.quantity || 0} ${m.unit || 'comprimidos'} | Validade: ${m.expirationDate || '-'} | Tarja: ${m.stripe || '-'}`
      ).join('\n')
    );
  }

  const matchedCandidates = filterStandardCollection('candidates');
  if (matchedCandidates.length > 0) {
    summaryParts.push(
      `--- MÓDULO TRIAGEM & LISTA DE ESPERA (${matchedCandidates.length} candidatos) ---\n` +
      matchedCandidates.map(c =>
        `• Candidato: ${c.name || 'Sem nome'} | Grau: ${c.degree || c.grau || '-'} | Status: ${c.status || 'Pendente'} | Solicitante: ${c.requesterName || '-'} (Tel: ${c.requesterPhone || '-'})`
      ).join('\n')
    );
  }

  const matchedEmployees = filterStandardCollection('employees');
  if (matchedEmployees.length > 0) {
    summaryParts.push(
      `--- MÓDULO EQUIPE & COLABORADORES (${matchedEmployees.length} colaboradores) ---\n` +
      matchedEmployees.map(e =>
        `• ${e.name || 'Sem nome'} | Cargo: ${e.role || e.position || '-'} | Turno: ${e.shift || '-'} | Contato: ${e.phone || '-'}`
      ).join('\n')
    );
  }

  const matchedAgenda = filterStandardCollection('agenda_events');
  if (matchedAgenda.length > 0) {
    // Sort chronologically by date and time
    const sortedAgenda = [...matchedAgenda].sort((a, b) => {
      const dateA = `${a.date || ''} ${a.time || ''}`;
      const dateB = `${b.date || ''} ${b.time || ''}`;
      return dateA.localeCompare(dateB);
    });

    summaryParts.push(
      `--- MÓDULO AGENDA DE COMPROMISSOS, CONSULTAS E EVENTOS (${sortedAgenda.length} registros cadastrados) ---\n` +
      sortedAgenda.map(ev => {
        const typeLabel = 
          ev.type === 'consulta_exame' ? 'Consulta/Exame Médico' :
          ev.type === 'visita' ? 'Visita/Atendimento' :
          ev.type === 'salao_festas' ? 'Reserva de Salão/Espaço' :
          ev.type === 'reuniao' ? 'Reunião/Assembleia' :
          ev.type === 'comum' ? 'Evento Comum' : (ev.type || 'Compromisso');
        
        const statusStr = 
          ev.status === 'finalizado' ? '[STATUS: FINALIZADO/CONCLUÍDO]' :
          ev.status === 'cancelado' ? `[STATUS: CANCELADO - Motivo: ${ev.cancellationReason || 'Não informado'}]` :
          ev.status === 'adiado' ? '[STATUS: ADIADO/REAGENDADO]' :
          '[STATUS: AGENDADO/PENDENTE]';

        let details = `• ${statusStr} [${ev.date || 'Sem data'}${ev.time ? ` às ${ev.time}` : ''}] ${ev.title || 'Sem título'} (${typeLabel})`;
        if (ev.elderlyName) details += ` | Acolhido/Idoso: ${ev.elderlyName}`;
        if (ev.professionalName) details += ` | Responsável: ${ev.professionalName}`;
        if (ev.location) details += ` | Local: ${ev.location}`;
        if (ev.description) details += ` | Detalhes: ${ev.description}`;
        if (ev.completedBy) details += ` | Concluído por: ${ev.completedBy}`;
        if (ev.cancelledBy) details += ` | Cancelado por: ${ev.cancelledBy}`;
        if (ev.postponedHistory && ev.postponedHistory.length > 0) {
          const lastPostpone = ev.postponedHistory[ev.postponedHistory.length - 1];
          details += ` | Reagendado de ${lastPostpone.previousDate} ${lastPostpone.previousTime || ''} (Motivo: ${lastPostpone.reason || 'Não informado'})`;
        }
        return details;
      }).join('\n')
    );
  }

  return summaryParts.join('\n\n');
}

/**
 * Handle user query with Gemini
 */
export async function askAiAssistant(
  question: string,
  history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>,
  knowledgeContext: string,
  institutionName: string
): Promise<string> {
  const ai = getAiClient();

  const isCentralCouncil = knowledgeContext.includes('Conselho Central da SSVP') || knowledgeContext.includes('DIRETORIA E MANDATO DO CONSELHO CENTRAL');

  const systemInstruction = `Você é o "Fred", o assistente virtual e consultor oficial da instituição "${institutionName}".
Seu objetivo é responder com rapidez, clareza, simpatia, precisão e respeito aos usuários, gestores e vicentinos da instituição.

PERFIL INSTITUCIONAL:
${isCentralCouncil 
  ? `Esta instituição é um CONSELHO CENTRAL DA SSVP (Sociedade de São Vicente de Paulo). Você domina as informações de:
- Diretoria Executiva do Conselho Central (Presidente, Vice-Presidentes, Tesoureiros, Secretários, ECAFO, Jovens, CCA, Assessores e mandatos).
- Conselhos Particulares (CPs) vinculados e suas cidades/presidentes.
- Conferências Vicentinas vinculadas, dias/locais de reuniões e presidentes.
- Membros Vicentinos (Confrades, Consócias, Aspirantes), seus cargos, contatos e conferências.
- Obras Unidas supervisionadas (Lares de Idosos, etc.), diretorias, vigência de mandatos e conformidade fiscal/documental.
- Agenda de Eventos, Romarias, Reuniões Plenárias e Visitas.
- Famílias assistidas pelas Conferências.`
  : `Esta instituição é uma OBRA UNIDA / LAR DE IDOSOS (ILPI). Você domina as informações de:
- Agenda de Compromissos, Consultas Médicas, Exames, Visitas e Eventos da instituição.
- Acolhidos/Idosos (saúde, familiares responsáveis, quartos, dependência, medicamentos).
- Controle da Caixinha (saldo em dinheiro, entradas e saídas).
- Estoque & Farmácia (itens abaixo do mínimo, validades).
- Doações e Carnês de arrecadação.
- Triagem / Lista de espera e Colaboradores.`
}

REGRAS OBRIGATÓRIAS:
1. Apresente-se ou refira-se como Fred quando fizer sentido ou quando perguntado.
2. Responda estritamente em Português do Brasil de forma simples, amigável, profissional e direta ao ponto.
3. Baseie suas respostas ÚNICA E EXCLUSIVAMENTE nos dados fornecidos no contexto da instituição abaixo.
4. Quando perguntado sobre "agenda", "próximos dias", "hoje", "amanhã" ou "esta semana", use a DATA E HORA DE REFERÊNCIA DO SISTEMA fornecida no início do contexto para calcular com precisão os compromissos cronologicamente relevantes.
5. Se a informação solicitada não existir nos dados da instituição, informe com clareza e delicadeza que o dado não foi encontrado no sistema ou ainda não foi cadastrado.
6. NUNCA invente nomes de pessoas, compromissos, confrades, consócias, idosos, telefones, valores em dinheiro ou informações fiscais.
7. Formate valores monetários como R$ (ex: R$ 1.500,00), datas no padrão brasileiro (DD/MM/AAAA) e use marcadores em tópicos (bullet points) para listas, destacando os dados principais em negrito.`;

  const fullPrompt = `CONTEXTO DOS DADOS REAIS DA INSTITUIÇÃO:\n${knowledgeContext}\n\nPERGUNTA DO USUÁRIO:\n${question}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: [
        ...history,
        {
          role: 'user',
          parts: [{ text: fullPrompt }]
        }
      ],
      config: {
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        temperature: 0.2, // Low temperature for high factual accuracy
      }
    });

    return response.text || "Desculpe, não consegui formular uma resposta no momento. Por favor, tente novamente.";
  } catch (error: any) {
    console.error("[AI Assistant Error]", error);
    throw error;
  }
}
