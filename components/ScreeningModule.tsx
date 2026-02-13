
import React from 'react';
import { 
  Plus, 
  ChevronRight, 
  Search, 
  Clock, 
  UserCheck, 
  AlertTriangle, 
  Archive, 
  ArrowRight, 
  Save, 
  Trash2, 
  ClipboardList, 
  HeartPulse, 
  Scale, 
  Printer,
  ChevronDown,
  LayoutGrid,
  Eye,
  ArrowLeft
} from 'lucide-react';
import { Candidate, CandidateStage, WaitlistPriority, FamilyMemberRecord, Resident } from '../types';
import { INITIAL_CANDIDATE } from '../constants';

interface ScreeningModuleProps {
  candidates: Candidate[];
  onSave: (candidate: Candidate) => void;
  residents: Resident[];
  onAdmit: (candidate: Candidate) => void;
}

const ScreeningModule: React.FC<ScreeningModuleProps> = ({ candidates, onSave, residents, onAdmit }) => {
  const [editingCandidate, setEditingCandidate] = React.useState<Candidate | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [activeStageView, setActiveStageView] = React.useState<CandidateStage | null>(null);

  const stages: { id: CandidateStage; label: string; icon: any; color: string; description: string }[] = [
    { id: 'entrevista', label: '1. Entrevistas', icon: ClipboardList, color: 'blue', description: 'Candidatos em processo de ficha social inicial.' },
    { id: 'aguardando_vaga', label: '2. Fila de Espera', icon: Clock, color: 'orange', description: 'Candidatos aptos aguardando disponibilidade.' },
    { id: 'decisao_diretoria', label: '3. Diretoria', icon: Scale, color: 'purple', description: 'Processos em análise para decisão de vaga.' },
    { id: 'avaliacao_medica', label: '4. Médico/Integração', icon: HeartPulse, color: 'teal', description: 'Candidatos aprovados em fase clínica ou teste.' },
    { id: 'acolhido', label: '5. Acolhidos', icon: UserCheck, color: 'green', description: 'Histórico de acolhimentos finalizados com sucesso.' }
  ];

  const filteredCandidates = candidates.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStageCandidates = (stage: CandidateStage) => 
    filteredCandidates.filter(c => c.stage === stage);

  if (editingCandidate) {
    return (
      <CandidateForm 
        candidate={editingCandidate} 
        onSave={(data) => {
          onSave(data);
          setEditingCandidate(null);
        }} 
        onCancel={() => setEditingCandidate(null)}
        onAdmit={() => {
           onAdmit(editingCandidate);
           setEditingCandidate(null);
        }}
      />
    );
  }

  // Renderiza a lista específica de uma etapa
  if (activeStageView) {
    const stageInfo = stages.find(s => s.id === activeStageView);
    const list = getStageCandidates(activeStageView);

    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between bg-white p-6 rounded-2xl border shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setActiveStageView(null)}
              className="p-2 border rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                {stageInfo && <stageInfo.icon size={20} className={`text-${stageInfo.color}-600`} />}
                <h1 className="text-xl font-black text-gray-900 uppercase tracking-tighter">{stageInfo?.label}</h1>
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stageInfo?.description}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black uppercase text-gray-400 block">Total na etapa</span>
            <span className="text-2xl font-black text-[#004c99]">{list.length}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-500 tracking-widest">
              <tr>
                <th className="px-8 py-4">Candidato</th>
                <th className="px-8 py-4">Data Registro</th>
                <th className="px-8 py-4">Prioridade</th>
                <th className="px-8 py-4">Motivo/Obs</th>
                <th className="px-8 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.map(cand => (
                <tr key={cand.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-8 py-4">
                    <div className="font-black text-xs uppercase text-gray-900">{cand.name}</div>
                    <div className="text-[10px] text-gray-400 font-bold">{cand.phone || 'Sem telefone'}</div>
                  </td>
                  <td className="px-8 py-4 text-[10px] font-medium text-gray-500">{new Date(cand.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td className="px-8 py-4">
                    {cand.priority && (
                      <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase ${
                        cand.priority === 'social' ? 'bg-red-100 text-red-600' : 
                        cand.priority === 'saude' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {cand.priority}
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-4">
                    <div className="text-[10px] font-medium text-gray-600 truncate max-w-xs">{cand.admissionReason || 'Sem motivo detalhado'}</div>
                  </td>
                  <td className="px-8 py-4 text-right">
                    <button 
                      onClick={() => setEditingCandidate(cand)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-[#004c99] rounded-lg text-[10px] font-black uppercase hover:bg-[#004c99] hover:text-white transition-all shadow-sm"
                    >
                      <Eye size={14} /> Visualizar Processo
                    </button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-gray-300 font-black uppercase text-xs">Nenhum candidato nesta fase.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border shadow-sm no-print">
        <div>
          <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Triagens Social ILPI</h1>
          <p className="text-[11px] font-bold text-gray-400 uppercase mt-1">
            Gestão do fluxo de acolhimento • {candidates.length} Solicitações totais
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setEditingCandidate(INITIAL_CANDIDATE)}
            className="bg-[#004c99] hover:bg-blue-800 text-white px-6 py-3 rounded-xl flex items-center gap-2 shadow-xl transition-all font-black text-xs uppercase"
          >
            <Plus size={18} />
            <span>Nova Entrevista Social</span>
          </button>
        </div>
      </div>

      <div className="relative no-print">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
        <input
          type="text"
          placeholder="Buscar candidato por nome..."
          className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm text-sm font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Kanban-like Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 no-print overflow-x-auto pb-4">
        {stages.map((stage) => {
          const list = getStageCandidates(stage.id);
          return (
            <div key={stage.id} className="flex flex-col gap-4 min-w-[240px]">
              <div 
                onClick={() => setActiveStageView(stage.id)}
                className={`p-4 rounded-xl bg-white border-t-4 border-${stage.color}-500 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow group`}
              >
                 <div className="flex items-center gap-2">
                    <stage.icon size={16} className={`text-${stage.color}-600 group-hover:scale-110 transition-transform`} />
                    <span className="text-[10px] font-black uppercase tracking-tight text-gray-700">{stage.label}</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[10px] font-black">{list.length}</span>
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                 </div>
              </div>
              
              <div className="space-y-3">
                 {list.slice(0, 5).map(cand => (
                   <div 
                     key={cand.id} 
                     onClick={() => setEditingCandidate(cand)}
                     className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group"
                   >
                      <div className="text-[10px] font-black text-gray-900 uppercase truncate mb-1 group-hover:text-blue-600">{cand.name}</div>
                      <div className="flex items-center justify-between">
                         <span className="text-[8px] font-bold text-gray-400 uppercase">{new Date(cand.createdAt).toLocaleDateString('pt-BR')}</span>
                         {cand.priority && (
                           <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${
                             cand.priority === 'social' ? 'bg-red-100 text-red-600' : 
                             cand.priority === 'saude' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                           }`}>
                             {cand.priority}
                           </span>
                         )}
                      </div>
                      <div className="mt-2 flex items-center gap-1 text-[8px] font-black text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity uppercase">
                        Ver detalhes <ArrowRight size={10} />
                      </div>
                   </div>
                 ))}
                 {list.length > 5 && (
                    <button 
                      onClick={() => setActiveStageView(stage.id)}
                      className="w-full py-2 text-[8px] font-black uppercase text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      Ver mais {list.length - 5} candidatos...
                    </button>
                 )}
                 {list.length === 0 && (
                    <div className="border-2 border-dashed border-gray-100 rounded-xl p-8 text-center text-gray-200 text-[10px] font-black uppercase">Vazio</div>
                 )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Seção Arquivados */}
      <div className="mt-12 no-print">
         <div className="flex items-center gap-2 mb-4">
            <Archive size={18} className="text-gray-400" />
            <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest">Processos Arquivados / Inaptos</h3>
         </div>
         <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
               <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-500 tracking-widest">
                  <tr>
                     <th className="px-6 py-4">Nome do Candidato</th>
                     <th className="px-6 py-4">Motivo Arquivamento</th>
                     <th className="px-6 py-4">Data Registro</th>
                     <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                  {candidates.filter(c => c.stage === 'arquivado').map(c => (
                     <tr key={c.id} className="hover:bg-gray-50/50 group transition-colors">
                        <td className="px-6 py-4">
                           <div className="text-xs font-black uppercase text-gray-900 group-hover:text-blue-600 transition-colors">{c.name}</div>
                           <div className="text-[10px] font-bold text-gray-400">{c.phone || 'Sem contato'}</div>
                        </td>
                        <td className="px-6 py-4">
                           <span className="text-[9px] uppercase font-black px-3 py-1 bg-red-50 text-red-500 rounded-full border border-red-100">
                              {c.archiveReason || 'Motivo não informado'}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                           {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 text-right flex items-center justify-end gap-3">
                           <button 
                             onClick={() => setEditingCandidate(c)} 
                             className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-[10px] font-black uppercase tracking-tighter"
                           >
                              <Eye size={14} /> Visualizar Processo
                           </button>
                           <div className="w-px h-4 bg-gray-100"></div>
                           <button 
                             onClick={() => {
                                onSave({ ...c, stage: 'entrevista' });
                                // Feedback visual ou logica de reabertura
                             }} 
                             className="text-orange-500 hover:text-orange-700 text-[10px] font-black uppercase tracking-tighter"
                           >
                              Reabrir Processo
                           </button>
                        </td>
                     </tr>
                  ))}
                  {candidates.filter(c => c.stage === 'arquivado').length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-300 font-black uppercase text-[10px]">Nenhum processo arquivado.</td>
                    </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

// --- FORMULÁRIO DE CANDIDATO (11 SEÇÕES) ---

interface CandidateFormProps {
  candidate: Candidate;
  onSave: (data: Candidate) => void;
  onCancel: () => void;
  onAdmit: () => void;
}

const CandidateForm: React.FC<CandidateFormProps> = ({ candidate, onSave, onCancel, onAdmit }) => {
  const [data, setData] = React.useState<Candidate>(candidate);

  const updateField = (field: keyof Candidate, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const addFamilyMember = () => {
    const newMember: FamilyMemberRecord = { id: Date.now().toString(), name: '', kinship: '', age: '', job: '', income: '' };
    setData(prev => ({ ...prev, familyMembers: [...prev.familyMembers, newMember] }));
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      {/* Top Controls */}
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-gray-200 shadow-sm no-print sticky top-0 z-30">
         <div className="flex items-center gap-4">
            <button onClick={onCancel} className="p-2.5 border rounded-xl hover:bg-gray-100 transition-colors text-gray-500"><ArrowLeft size={20} /></button>
            <div>
               <h2 className="text-lg font-black text-gray-900 uppercase tracking-tighter">Ficha Social para Triagem</h2>
               <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${data.stage === 'arquivado' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                    Status: {data.stage.replace('_', ' ')}
                  </span>
                  {data.id && <span className="text-[9px] font-bold text-gray-400 uppercase">ID: {data.id}</span>}
               </div>
            </div>
         </div>
         <div className="flex gap-2">
            <button onClick={handlePrint} className="px-4 py-2.5 border border-gray-300 rounded-xl text-xs font-black uppercase flex items-center gap-2 hover:bg-gray-50 transition-all"><Printer size={16} /> Imprimir</button>
            <button onClick={() => onSave(data)} className="px-6 py-2.5 bg-[#004c99] text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 hover:bg-blue-800 shadow-xl shadow-blue-100 transition-all"><Save size={18} /> Salvar Ficha</button>
         </div>
      </div>

      <div className="bg-white p-12 rounded-2xl shadow-xl border border-gray-200 space-y-12">
        {/* Stage Controller */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-gray-50 rounded-2xl border border-dashed border-gray-300 no-print">
            <div>
               <label className="text-[10px] font-black uppercase text-gray-400">Status do Candidato</label>
               <select 
                  value={data.stage} 
                  onChange={(e) => updateField('stage', e.target.value)}
                  className="w-full mt-1.5 p-3 border border-gray-200 rounded-xl text-xs font-black uppercase bg-white focus:ring-2 focus:ring-blue-500 outline-none"
               >
                  <option value="entrevista">1. Em Entrevista Social</option>
                  <option value="aguardando_vaga">2. Em Fila de Espera</option>
                  <option value="decisao_diretoria">3. Para Decisão Diretoria</option>
                  <option value="avaliacao_medica">4. Avaliação Médica / Clínica</option>
                  <option value="integracao">5. Integração / Contrato</option>
                  <option value="acolhido">6. Acolhimento Realizado</option>
                  <option value="arquivado">X. Arquivar Processo</option>
               </select>
            </div>
            {data.stage === 'aguardando_vaga' && (
               <div>
                  <label className="text-[10px] font-black uppercase text-gray-400">Nível de Prioridade</label>
                  <select 
                     value={data.priority} 
                     onChange={(e) => updateField('priority', e.target.value)}
                     className="w-full mt-1.5 p-3 border border-gray-200 rounded-xl text-xs font-black uppercase bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                     <option value="geral">Normal / Geral</option>
                     <option value="saude">Saúde Questionável (Avaliar)</option>
                     <option value="social">Socialmente Prioritário (Urgente)</option>
                  </select>
               </div>
            )}
            {data.stage === 'integracao' && (
               <div className="flex items-end">
                  <button onClick={onAdmit} className="w-full p-3 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
                    <UserCheck size={18} /> CONCLUIR ACOLHIMENTO FINAL
                  </button>
               </div>
            )}
            {data.stage === 'arquivado' && (
               <div>
                  <label className="text-[10px] font-black uppercase text-gray-400">Motivo do Arquivamento</label>
                  <select 
                     value={data.archiveReason} 
                     onChange={(e) => updateField('archiveReason', e.target.value)}
                     className="w-full mt-1.5 p-3 border border-gray-200 rounded-xl text-xs font-black uppercase bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                     <option value="">Selecione o motivo...</option>
                     <option value="Inapto Saúde">Inapto (Condição de Saúde)</option>
                     <option value="Inapto Financeiro">Inapto (Condição Financeira)</option>
                     <option value="Inapto Familiar">Inapto (Condição Familiar)</option>
                     <option value="Não há Vagas">Não há Vagas Disponíveis</option>
                     <option value="Desistência Familiar">Desistência da Família</option>
                     <option value="Desistência Idoso">Desistência do Idoso</option>
                     <option value="Falecimento">Falecimento</option>
                     <option value="Outra ILPI">Internação em Outra Instituição</option>
                  </select>
               </div>
            )}
        </div>

        {/* 1. IDENTIFICAÇÃO DO IDOSO */}
        <section>
          <SectionTitle number="1" title="IDENTIFICAÇÃO DO IDOSO" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <FormInput label="Nome completo" value={data.name} onChange={(v) => updateField('name', v)} className="md:col-span-2" />
            <FormInput label="Data de nascimento" type="date" value={data.birthDate} onChange={(v) => updateField('birthDate', v)} />
            <FormInput label="Idade" value={data.age} onChange={(v) => updateField('age', v)} />
            <FormInput label="Sexo" value={data.gender} onChange={(v) => updateField('gender', v)} />
            <FormInput label="Estado civil" value={data.maritalStatus} onChange={(v) => updateField('maritalStatus', v)} />
            <FormInput label="RG" value={data.rg} onChange={(v) => updateField('rg', v)} />
            <FormInput label="CPF" value={data.cpf} onChange={(v) => updateField('cpf', v)} />
            <FormInput label="Endereço atual" value={data.address} onChange={(v) => updateField('address', v)} className="md:col-span-3" />
            <FormInput label="Telefone" value={data.phone} onChange={(v) => updateField('phone', v)} />
          </div>
        </section>

        {/* 2. RESPONSÁVEL LEGAL / FAMILIAR */}
        <section>
          <SectionTitle number="2" title="RESPONSÁVEL LEGAL / FAMILIAR" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormInput label="Nome" value={data.repName} onChange={(v) => updateField('repName', v)} />
            <FormInput label="Grau de parentesco" value={data.repKinship} onChange={(v) => updateField('repKinship', v)} />
            <FormInput label="Telefone" value={data.repPhone} onChange={(v) => updateField('repPhone', v)} />
            <FormInput label="Endereço" value={data.repAddress} onChange={(v) => updateField('repAddress', v)} />
          </div>
        </section>

        {/* 3. COMPOSIÇÃO FAMILIAR E REDE DE APOIO */}
        <section>
          <SectionTitle number="3" title="COMPOSIÇÃO FAMILIAR E REDE DE APOIO" />
          <div className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                <FormRadioGroup 
                  label="Com quem o idoso reside atualmente?" 
                  options={['Sozinho', 'Filhos', 'Familiares', 'Outros']} 
                  value={data.residesWith} 
                  onChange={(v) => updateField('residesWith', v)}
                />
                <div className="flex items-end gap-4">
                   <FormRadioGroup label="Possui filhos?" options={['Sim', 'Não']} value={data.hasChildren} onChange={(v) => updateField('hasChildren', v)} />
                   <FormInput label="Se sim, quantos?" value={data.childrenCount} onChange={(v) => updateField('childrenCount', v)} className="w-24" />
                </div>
                <FormRadioGroup 
                  label="Existe cuidador?" 
                  options={['Não', 'Sim', 'Familiar', 'Profissional']} 
                  value={data.hasCaregiver} 
                  onChange={(v) => updateField('hasCaregiver', v)}
                />
                <div className="space-y-2">
                   <FormRadioGroup label="Possui rede de apoio?" options={['Sim', 'Não']} value={data.hasSupportNetwork} onChange={(v) => updateField('hasSupportNetwork', v)} />
                   <FormInput label="Quais?" value={data.supportNetworkDetails} onChange={(v) => updateField('supportNetworkDetails', v)} />
                </div>
             </div>
          </div>
        </section>

        {/* 4. COMPOSIÇÃO FAMILIAR TABLE */}
        <section>
          <SectionTitle number="4" title="COMPOSIÇÃO FAMILIAR" />
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
             <table className="w-full text-left">
                <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-500 tracking-widest">
                   <tr>
                      <th className="px-6 py-3">Nome</th>
                      <th className="px-6 py-3">Parentesco</th>
                      <th className="px-6 py-3">Idade</th>
                      <th className="px-6 py-3">Trabalho</th>
                      <th className="px-6 py-3">Renda Mensal</th>
                      <th className="px-6 py-3 no-print"></th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                   {data.familyMembers.map((m, idx) => (
                      <tr key={m.id}>
                         <td className="px-6 py-2"><input type="text" value={m.name} onChange={(e) => {
                            const newM = [...data.familyMembers];
                            newM[idx].name = e.target.value;
                            updateField('familyMembers', newM);
                         }} className="w-full bg-transparent text-xs font-bold uppercase focus:outline-none focus:text-blue-600" /></td>
                         <td className="px-6 py-2"><input type="text" value={m.kinship} onChange={(e) => {
                            const newM = [...data.familyMembers];
                            newM[idx].kinship = e.target.value;
                            updateField('familyMembers', newM);
                         }} className="w-full bg-transparent text-xs font-bold uppercase focus:outline-none focus:text-blue-600" /></td>
                         <td className="px-6 py-2"><input type="text" value={m.age} onChange={(e) => {
                            const newM = [...data.familyMembers];
                            newM[idx].age = e.target.value;
                            updateField('familyMembers', newM);
                         }} className="w-full bg-transparent text-xs font-bold uppercase focus:outline-none focus:text-blue-600" /></td>
                         <td className="px-6 py-2"><input type="text" value={m.job} onChange={(e) => {
                            const newM = [...data.familyMembers];
                            newM[idx].job = e.target.value;
                            updateField('familyMembers', newM);
                         }} className="w-full bg-transparent text-xs font-bold uppercase focus:outline-none focus:text-blue-600" /></td>
                         <td className="px-6 py-2"><input type="text" value={m.income} onChange={(e) => {
                            const newM = [...data.familyMembers];
                            newM[idx].income = e.target.value;
                            updateField('familyMembers', newM);
                         }} className="w-full bg-transparent text-xs font-bold uppercase focus:outline-none focus:text-blue-600" /></td>
                         <td className="px-6 py-2 text-right no-print">
                            <button onClick={() => {
                               const newM = data.familyMembers.filter(f => f.id !== m.id);
                               updateField('familyMembers', newM);
                            }} className="text-red-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
             <button onClick={addFamilyMember} className="w-full py-4 bg-gray-50 text-[10px] font-black uppercase text-blue-600 hover:bg-blue-100 transition-colors no-print flex items-center justify-center gap-2">
                <Plus size={14} /> Adicionar Integrante Familiar
             </button>
          </div>
        </section>

        {/* 5. CONDIÇÕES DE MORADIA */}
        <section>
           <SectionTitle number="5" title="CONDIÇÕES DE MORADIA" />
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <FormRadioGroup label="Tipo de moradia:" options={['Própria', 'Alugada', 'Cedida']} value={data.housingType} onChange={(v) => updateField('housingType', v)} />
              <FormInput label="Valor aluguel:" value={data.rentValue} onChange={(v) => updateField('rentValue', v)} />
           </div>
        </section>

        {/* 6. SITUAÇÃO SOCIOECONÔMICA */}
        <section>
           <SectionTitle number="6" title="SITUAÇÃO SOCIOECONÔMICA" />
           <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-400">Fonte de renda do idoso:</label>
                    <div className="flex flex-wrap gap-6 mt-1">
                       {['Aposentadoria', 'Pensão', 'BPC/LOAS', 'Outros'].map(opt => (
                         <label key={opt} className="flex items-center gap-2 cursor-pointer group">
                            <input 
                              type="checkbox" 
                              checked={data.incomeSource.includes(opt)}
                              onChange={(e) => {
                                 const current = [...data.incomeSource];
                                 if (e.target.checked) current.push(opt);
                                 else {
                                    const idx = current.indexOf(opt);
                                    if (idx > -1) current.splice(idx, 1);
                                 }
                                 updateField('incomeSource', current);
                              }}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className={`text-[10px] font-black uppercase tracking-widest ${data.incomeSource.includes(opt) ? 'text-blue-600' : 'text-gray-500'}`}>{opt}</span>
                         </label>
                       ))}
                    </div>
                 </div>
                 <FormInput label="Valor aproximado da renda: R$" value={data.incomeValue} onChange={(v) => updateField('incomeValue', v)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="flex items-end gap-6">
                    <FormRadioGroup label="Possui empréstimo?" options={['Sim', 'Não']} value={data.hasLoan} onChange={(v) => updateField('hasLoan', v)} />
                    <FormInput label="Valor R$" value={data.loanValue} onChange={(v) => updateField('loanValue', v)} className="flex-1" />
                 </div>
                 <FormRadioGroup label="A família possui condições de custear cuidados?" options={['Sim', 'Não', 'Parcialmente']} value={data.canAffordCare} onChange={(v) => updateField('canAffordCare', v)} />
              </div>
           </div>
        </section>

        {/* 7. CONDIÇÕES DE SAÚDE */}
        <section>
           <SectionTitle number="7" title="CONDIÇÕES DE SAÚDE" />
           <div className="space-y-8">
              <FormInput label="Diagnósticos médicos:" value={data.medicalDiagnoses} onChange={(v) => updateField('medicalDiagnoses', v)} className="w-full" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <FormRadioGroup label="Uso de medicação contínua?" options={['Sim', 'Não']} value={data.continuousMedication} onChange={(v) => updateField('continuousMedication', v)} />
                 <FormInput label="Quais?" value={data.medicationDetails} onChange={(v) => updateField('medicationDetails', v)} />
              </div>
              <FormRadioGroup label="Possui acompanhamento médico regular?" options={['Sim', 'Não']} value={data.regularMedicalFollowup} onChange={(v) => updateField('regularMedicalFollowup', v)} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <FormRadioGroup label="Apresenta comprometimento cognitivo?" options={['Sim', 'Não', 'Em avaliação']} value={data.cognitiveImpairment} onChange={(v) => updateField('cognitiveImpairment', v)} />
                 <FormInput label="Quais detalhes?" value={data.cognitiveDetails} onChange={(v) => updateField('cognitiveDetails', v)} />
              </div>
           </div>
        </section>

        {/* 8. GRAU DE DEPENDÊNCIA */}
        <section>
           <SectionTitle number="8" title="GRAU DE DEPENDÊNCIA" />
           <div className="bg-blue-50/30 p-6 rounded-2xl border border-blue-100 mb-6">
              <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                 <AlertTriangle size={14} /> O idoso realiza sozinho as atividades abaixo?
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                 <FormRadioGroup label="Higiene pessoal" options={['Sim', 'Não']} value={data.depHygiene} onChange={(v) => updateField('depHygiene', v)} />
                 <FormRadioGroup label="Alimentação" options={['Sim', 'Não']} value={data.depFeeding} onChange={(v) => updateField('depFeeding', v)} />
                 <FormRadioGroup label="Locomoção" options={['Sim', 'Não', 'Andador', 'Cadeira de Rodas']} value={data.depMobility} onChange={(v) => updateField('depMobility', v)} />
                 <FormRadioGroup label="Uso do banheiro" options={['Sim', 'Não']} value={data.depBathroom} onChange={(v) => updateField('depBathroom', v)} />
                 <FormRadioGroup label="Medicação" options={['Sim', 'Não']} value={data.depMedication} onChange={(v) => updateField('depMedication', v)} />
              </div>
           </div>
        </section>

        {/* 9. ASPECTOS PSICOSSOCIAIS */}
        <section>
           <SectionTitle number="9" title="ASPECTOS PSICOSSOCIAIS" />
           <div className="space-y-8">
              <FormRadioGroup label="Necessita de cuidador em tempo integral?" options={['Sim', 'Não']} value={data.needsFullTimeCare} onChange={(v) => updateField('needsFullTimeCare', v)} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <FormRadioGroup label="Há conflitos familiares?" options={['Sim', 'Não']} value={data.familyConflicts} onChange={(v) => updateField('familyConflicts', v)} />
                 <FormInput label="Quais?" value={data.conflictDetails} onChange={(v) => updateField('conflictDetails', v)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <FormRadioGroup label="O idoso concorda com o ingresso na ILPI?" options={['Sim', 'Não', 'Parcialmente']} value={data.elderlyAgrees} onChange={(v) => updateField('elderlyAgrees', v)} />
                <FormRadioGroup label="A família concorda?" options={['Sim', 'Não']} value={data.familyAgrees} onChange={(v) => updateField('familyAgrees', v)} />
              </div>
           </div>
        </section>

        {/* 10. MOTIVO DA SOLICITAÇÃO DO ACOLHIMENTO */}
        <section>
           <SectionTitle number="10" title="MOTIVO DA SOLICITAÇÃO DO ACOLHIMENTO" />
           <textarea 
             value={data.admissionReason} 
             onChange={(e) => updateField('admissionReason', e.target.value)}
             className="w-full p-6 border border-gray-200 rounded-2xl bg-gray-50 text-xs font-black uppercase tracking-tight focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all h-40 outline-none"
             placeholder="Descreva detalhadamente o motivo do pedido..."
           />
        </section>

        {/* 11. PARECER SOCIAL */}
        <section>
           <SectionTitle number="11" title="PARECER SOCIAL" />
           <textarea 
             value={data.socialOpinion} 
             onChange={(e) => updateField('socialOpinion', e.target.value)}
             className="w-full p-6 border border-gray-200 rounded-2xl bg-gray-50 text-xs font-black uppercase tracking-tight focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all h-60 border-l-8 border-l-blue-600 outline-none"
             placeholder="Opinião técnica da assistente social..."
           />
           <div className="mt-12 flex justify-end no-print">
              <div className="text-center w-64 border-t-2 border-black pt-4">
                 <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Assinatura da Assistente Social</span>
              </div>
           </div>
        </section>
      </div>
    </div>
  );
};

// --- COMPONENTES AUXILIARES PARA O FORMULÁRIO ---

const SectionTitle: React.FC<{ number: string; title: string }> = ({ number, title }) => (
  <div className="flex items-center gap-4 mb-8 border-b-2 border-gray-50 pb-3">
    <div className="flex items-center justify-center w-10 h-10 bg-[#004c99] text-white rounded-2xl text-sm font-black shadow-lg shadow-blue-100 rotate-3">
       <span className="-rotate-3">{number}</span>
    </div>
    <h3 className="text-sm font-black uppercase tracking-widest text-[#004c99]">{title}</h3>
  </div>
);

const FormInput: React.FC<{ label: string; value: string; onChange: (v: string) => void; type?: string; className?: string; placeholder?: string }> = ({ label, value, onChange, type = 'text', className = '', placeholder = '' }) => (
  <div className={`space-y-2 ${className}`}>
    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{label}</label>
    <input 
      type={type} 
      value={value} 
      onChange={(e) => onChange(e.target.value)} 
      placeholder={placeholder}
      className="w-full p-2 border-b-2 border-gray-100 focus:border-blue-600 focus:outline-none text-xs font-black uppercase bg-transparent transition-colors placeholder:text-gray-200"
    />
  </div>
);

const FormRadioGroup: React.FC<{ label: string; options: string[]; value: string; onChange: (v: string) => void }> = ({ label, options, value, onChange }) => (
  <div className="space-y-3">
    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block">{label}</label>
    <div className="flex flex-wrap gap-x-6 gap-y-3">
      {options.map(opt => (
        <label key={opt} className="flex items-center gap-2.5 cursor-pointer group">
          <div className="relative flex items-center justify-center">
            <input 
              type="radio" 
              name={label} 
              value={opt} 
              checked={value === opt} 
              onChange={(e) => onChange(e.target.value)}
              className="peer appearance-none w-5 h-5 border-2 border-gray-200 rounded-full checked:border-blue-600 transition-all cursor-pointer" 
            />
            <div className="absolute w-2.5 h-2.5 bg-blue-600 rounded-full scale-0 peer-checked:scale-100 transition-transform"></div>
          </div>
          <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${value === opt ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`}>
            {opt}
          </span>
        </label>
      ))}
    </div>
  </div>
);

export default ScreeningModule;
