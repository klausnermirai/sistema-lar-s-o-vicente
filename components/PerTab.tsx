import { getProfessionalSignature, fetchSosProtocols } from '../lib/api';
import React, { useState, useEffect } from 'react';
import { Resident, PerData, ClinicalProgressEntry, SosProtocol } from '../types';
import { 
  Heart, 
  Activity, 
  AlertCircle, 
  Clipboard, 
  History, 
  ShieldCheck, 
  Calendar,
  User,
  Plus,
  Stethoscope,
  Clock,
  Save,
  X,
  Pill
} from 'lucide-react';

interface PerTabProps {
  resident: Resident;
  onUpdatePer: (per: PerData) => void;
}

const PerTab: React.FC<PerTabProps> = ({ resident, onUpdatePer }) => {
  const per = resident.per;
  const [isAddingProgress, setIsAddingProgress] = useState(false);
  const [newProgressNote, setNewProgressNote] = useState('');
  const [professionalName, setProfessionalName] = useState('');
  const [professionalCRM, setProfessionalCRM] = useState('');
  const [sosProtocols, setSosProtocols] = useState<SosProtocol[]>([]);

  
  const getDependencyDegree = (r: Resident) => {
    let count = 0;
    const careKeys = [
      'bathAssistance',
      'oralHygieneAssistance',
      'feedingAssistance',
      'diaperChangeAssistance',
      'decubitusChangeAssistance',
      'tricotomyAssistance',
      'nailCareAssistance',
      'woundCareAssistance'
    ];
    
    careKeys.forEach(k => {
      if ((r.careNeeds as any)?.[k]) count++;
    });

    const computed = count <= 2 ? 1 : count <= 5 ? 2 : 3;
    
    if (r.grauDependenciaManual !== undefined && r.grauDependenciaManual !== null) {
      return r.grauDependenciaManual;
    }
    return computed;
  };

  const getActiveDependencies = (r: Resident) => {
    const careKeys = [
      { key: 'bathAssistance', label: 'Banho' },
      { key: 'oralHygieneAssistance', label: 'Higiene' },
      { key: 'feedingAssistance', label: 'Alimentação' },
      { key: 'diaperChangeAssistance', label: 'Fraldas' },
      { key: 'decubitusChangeAssistance', label: 'Decúbito' },
      { key: 'tricotomyAssistance', label: 'Tricotomia' },
      { key: 'nailCareAssistance', label: 'Unhas' },
      { key: 'woundCareAssistance', label: 'Curativo/Pele' }
    ];
    return careKeys.filter(k => (r.careNeeds as any)?.[k.key]).map(k => k.label);
  };

  useEffect(() => {
    const loadProtocols = async () => {
      try {
         const session = JSON.parse(localStorage.getItem('ssvp_session') || '{}');
         if (session.institutionId && resident.id) {
           const protocols = await fetchSosProtocols(session.institutionId, resident.id);
           setSosProtocols(protocols.filter((p: SosProtocol) => p.status === 'ativo'));
         }
      } catch (err) {
         console.error('Error loading SOS protocols', err);
      }
    };
    loadProtocols();
  }, [resident.id]);

  if (!per) {
    return (
      <div className="p-12 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
        <div className="w-16 h-16 bg-blue-50 text-[#004c99] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Clipboard size={32} />
        </div>
        <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Prontuário Eletrônico não iniciado</h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto mt-2">
          Não foram encontrados dados de saúde prévios para este residente. 
          Inicie o prontuário para centralizar o histórico clínico e sinais vitais.
        </p>
        <button type="button"
          onClick={() => {
            const initialPer: PerData = {
              lastUpdated: new Date().toISOString(),
              vitalSignsHistory: [],
              diagnoses: [],
              allergies: '',
              clinicalHistory: '',
              functionalStatus: {
                mobility: '',
                continence: '',
                consciousness: '',
                dependencyLevel: ''
              }
            };
            onUpdatePer(initialPer);
          }}
          className="mt-6 px-6 py-3 bg-[#004c99] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-800 transition-all shadow-xl"
        >
          Iniciar Prontuário Eletrônico
        </button>
      </div>
    );
  }

  const latestVitalSigns = per.vitalSignsHistory.length > 0 
    ? per.vitalSignsHistory[per.vitalSignsHistory.length - 1] 
    : null;

  const handleAddProgress = () => {
    if (!newProgressNote.trim() || !professionalName.trim()) {
      alert("Por favor, preencha o nome do profissional e a nota clínica.");
      return;
    }

    const newProgress: ClinicalProgressEntry = {
      id: Date.now().toString(), ...getProfessionalSignature(),
      date: new Date().toISOString(),
      professionalName,
      crm: professionalCRM,
      note: newProgressNote
    };

    onUpdatePer({
      ...per,
      lastUpdated: new Date().toISOString(),
      clinicalProgress: [newProgress, ...(per.clinicalProgress || [])]
    });

    setNewProgressNote('');
    setProfessionalName('');
    setProfessionalCRM('');
    setIsAddingProgress(false);
  };

  return (
    <div className="space-y-8 p-8 animate-in fade-in duration-500">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-8">
        <div>
          <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter flex items-center gap-3">
            <ShieldCheck className="text-[#004c99]" size={28} />
            Prontuário Eletrônico do Residente (PER)
          </h3>
          <p className="text-sm text-gray-500 font-medium mt-1 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full w-fit">
            Última atualização: {new Date(per.lastUpdated).toLocaleString('pt-BR')}
          </p>
        </div>
        <div className="flex gap-3">
        </div>
      </div>

      {/* Critical Data */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Allergies & Alerts */}
        <div className="p-6 bg-red-50 border border-red-100 rounded-3xl shadow-sm relative overflow-hidden">
          <AlertCircle className="absolute -right-4 -bottom-4 text-red-100 w-24 h-24" />
          <h4 className="text-xs font-black text-red-800 uppercase tracking-widest mb-4 flex items-center gap-2">
            <AlertCircle size={16} /> Alergias e Alertas
          </h4>
          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-red-200">
            <p className="text-sm font-bold text-red-900 leading-relaxed">
              {per.allergies || 'Nenhuma alergia relatada'}
            </p>
          </div>
        </div>

        {/* Vital Signs Overview */}
        <div className="p-6 bg-[#004c99] border border-blue-800 rounded-3xl shadow-xl col-span-1 md:col-span-2 relative overflow-hidden text-white">
          <Activity className="absolute -right-4 -bottom-4 text-white/5 w-32 h-32" />
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-xs font-black text-blue-100 uppercase tracking-widest flex items-center gap-2">
              <Heart size={16} /> Sinais Vitais (Última Aferição)
            </h4>
            {latestVitalSigns && (
              <span className="text-[10px] font-black uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full">
                {new Date(latestVitalSigns.date).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">P.A.</p>
              <p className="text-2xl font-black">{latestVitalSigns ? `${latestVitalSigns.paSystolic}/${latestVitalSigns.paDiastolic}` : '--'} <span className="text-[10px] opacity-60">mmHg</span></p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">FC / FR</p>
              <p className="text-2xl font-black">{latestVitalSigns?.fc || '--'} / {latestVitalSigns?.fr || '--'} <span className="text-[10px] opacity-60">BPM/IPM</span></p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Saturação O2</p>
              <p className="text-2xl font-black">{latestVitalSigns?.spo2 || '--'} <span className="text-[10px] opacity-60">%</span></p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Glicemia (HGT)</p>
              <p className="text-2xl font-black">{latestVitalSigns?.hgtValue || '--'} <span className="text-[10px] opacity-60">mg/dL</span></p>
              {latestVitalSigns && (
                <p className="text-[8px] font-black uppercase opacity-60">{latestVitalSigns.hgtType}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
        {/* Left Column: Details */}
        <div className="lg:col-span-8 space-y-8">
          {/* Clinical History */}
          <div className="bg-white border rounded-3xl p-6 shadow-sm">
            <h4 className="text-sm font-black text-gray-800 uppercase tracking-tight mb-6 flex items-center gap-2 border-b pb-4">
              <Clipboard size={18} className="text-[#004c99]" />
              Resumo da Admissão e Histórico Clínico
            </h4>
            <div className="space-y-6">
              {per.nursingAdmissionSummary && (
                <div className="bg-gray-50 border-l-4 border-[#004c99] p-4 rounded-r-2xl">
                  <p className="text-xs font-black text-[#004c99] uppercase tracking-widest mb-1">Nota de Admissão (Migrada da Triagem)</p>
                  <p className="text-sm text-gray-700 leading-relaxed italic">{per.nursingAdmissionSummary}</p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Diagnósticos e Comorbidades</h5>
                  {per.diagnoses.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {per.diagnoses.map((diag, i) => (
                        <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase border border-blue-100 shadow-sm">
                          {diag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Nenhum diagnóstico listado</p>
                  )}
                </div>
                <div>
                  <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Histórico Cirúrgico</h5>
                  <p className="text-sm text-gray-700 font-medium">{per.surgeryHistory || 'Sem registros'}</p>
                </div>
              </div>

              <div>
                <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Histórico Clínico Detalhado</h5>
                <p className="text-sm text-gray-700 leading-relaxed">{per.clinicalHistory || 'Nenhum detalhe adicional relatado.'}</p>
              </div>
            </div>
          </div>

          {/* Condutas SOS */}
          <div className="bg-white border rounded-3xl p-6 shadow-sm overflow-hidden relative">
            <h4 className="text-sm font-black text-gray-800 uppercase tracking-tight mb-6 flex items-center gap-2 border-b pb-4">
              <Pill size={18} className="text-purple-600" />
              Condutas SOS / Medicações Eventuais Autorizadas
            </h4>
            
            {sosProtocols.length === 0 ? (
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest text-center py-6">Nenhuma conduta SOS ativa para este residente.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {sosProtocols.map(p => (
                   <div key={p.id} className="p-4 bg-purple-50/50 border border-purple-100 rounded-2xl flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                         <span className="text-sm font-black text-purple-900 uppercase leading-none">{p.sintomaOuQueixa}</span>
                      </div>
                      <div>
                         <p className="text-[10px] font-black uppercase text-purple-500 tracking-widest leading-none mt-1">Autorizado:</p>
                         <p className="text-sm font-bold text-gray-800 mt-0.5">{p.medicamentoAutorizado} <span className="text-xs text-gray-500 ml-1">{p.dosagem} {p.quantidade}</span></p>
                      </div>
                      <div className="flex gap-4 mt-2">
                         <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-gray-400 uppercase">Via</span>
                            <span className="text-xs font-black text-gray-700 uppercase">{p.via || 'N/A'}</span>
                         </div>
                         {p.intervaloMinimoHoras && (
                           <div className="flex flex-col">
                              <span className="text-[9px] font-bold text-gray-400 uppercase">Intervalo</span>
                              <span className="text-xs font-black text-gray-700 uppercase">{p.intervaloMinimoHoras}h</span>
                           </div>
                         )}
                      </div>
                      {p.observacoes && (
                        <p className="text-[10px] text-gray-600 bg-white p-2 rounded-lg border mt-2 leading-tight">
                           <span className="font-bold uppercase tracking-widest text-gray-400 block mb-1">Obs:</span>
                           {p.observacoes}
                        </p>
                      )}
                      <p className="text-[8px] font-bold text-gray-400 uppercase text-right mt-2">Por {p.autorizadoPorNome}</p>
                   </div>
                 ))}
              </div>
            )}
            <div className="mt-4 p-3 bg-gray-50 border border-gray-100 rounded-xl">
               <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                 O gerenciamento de novas condutas SOS está disponível na aba "Condutas SOS" (Módulo Gestão na Enfermagem).
               </p>
            </div>
          </div>

          {/* Current Medications */}
          <div className="bg-white border rounded-3xl p-6 shadow-sm overflow-hidden relative">
            <Stethoscope className="absolute -right-6 -top-6 text-gray-50 w-24 h-24" />
            <h4 className="text-sm font-black text-gray-800 uppercase tracking-tight mb-6 flex items-center gap-2 border-b pb-4">
              <Activity size={18} className="text-[#004c99]" />
              Medicações em Uso e Hábitos
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Medicações (Triagem)</h5>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{per.currentMedications || 'Não informado'}</p>
                <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest flex items-center gap-2">
                    <Pill size={12} /> Alterações de Prescrição
                  </p>
                  <p className="text-xs text-blue-900 mt-1">Acesse a aba <strong>Médicamentos</strong> para ver as alterações recentes e a prescrição atual rigorosa.</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Hábitos de Vida</h5>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                       <div className={`w-3 h-3 rounded-full ${per.habits?.smoking ? 'bg-orange-500 animate-pulse' : 'bg-gray-200'}`}></div>
                       <span className="text-xs font-black uppercase tracking-tighter text-gray-600">Tabagismo: {per.habits?.smoking ? 'Sim' : 'Não'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className={`w-3 h-3 rounded-full ${per.habits?.alcohol ? 'bg-orange-500 animate-pulse' : 'bg-gray-200'}`}></div>
                       <span className="text-xs font-black uppercase tracking-tighter text-gray-600">Etilismo: {per.habits?.alcohol ? 'Sim' : 'Não'}</span>
                    </div>
                  </div>
                </div>
                {per.healthSupport && (
                  <div>
                    <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Suporte de Saúde (SUS)</h5>
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500 font-bold uppercase tracking-widest text-[9px]">UBS Ref.</span>
                        <span className="text-[#004c99] font-black uppercase tracking-tighter">{per.healthSupport.ubs || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500 font-bold uppercase tracking-widest text-[9px]">Cartão SUS</span>
                        <span className="text-[#004c99] font-black uppercase tracking-tighter">{per.healthSupport.susCard || 'N/A'}</span>
                      </div>
                      {per.healthSupport.doctor && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500 font-bold uppercase tracking-widest text-[9px]">Medico Ref.</span>
                          <span className="text-[#004c99] font-black uppercase tracking-tighter">{per.healthSupport.doctor}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Clinical Progress / Evolução Médica */}
          <div id="history-section" className="bg-white border rounded-3xl shadow-sm overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
              <h4 className="text-sm font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                <History size={18} className="text-[#004c99]" />
                Registros de Consultas e Evolução Clínica
              </h4>
            </div>

            <div className="p-6">
              {(!per.clinicalProgress || per.clinicalProgress.length === 0) ? (
                <div className="text-center py-8">
                  <History className="mx-auto text-gray-200 mb-3" size={32} />
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Nenhuma evolução registrada</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {per.clinicalProgress.map(prog => (
                    <div key={prog.id} className="p-4 bg-gray-50 rounded-2xl border flex gap-4">
                      <div className="pt-1">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-[#004c99] flex items-center justify-center">
                          <Stethoscope size={14} />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-xs font-black text-gray-900 uppercase">{prog.professionalName}</p>
                            {prog.crm && <p className="text-[9px] font-bold text-gray-400 uppercase">{prog.crm}</p>}
                          </div>
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                            <Clock size={10} />
                            {new Date(prog.date).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{prog.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Functional Status & Quick Actions */}
        <div className="lg:col-span-4 space-y-8">
           {/* Functional Status */}
           <div className="bg-white border rounded-3xl p-6 shadow-sm">
            <h4 className="text-sm font-black text-gray-800 uppercase tracking-tight mb-6 border-b pb-4">Quadro de Dependências</h4>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-2xl border">
                 <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Grau de Dependência (Enfermagem)</p>
                 <p className="text-xs font-black uppercase tracking-tighter text-[#004c99]">
                   Grau {getDependencyDegree(resident)}
                   {resident.grauDependenciaManual !== undefined && resident.grauDependenciaManual !== null ? ' (Ajuste Manual)' : ''}
                 </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl border">
                 <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Dependências Ativas</p>
                 {getActiveDependencies(resident).length > 0 ? (
                   <div className="flex flex-wrap gap-1.5">
                     {getActiveDependencies(resident).map(dep => (
                       <span key={dep} className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-[9px] font-bold text-gray-500 uppercase tracking-widest">{dep}</span>
                     ))}
                   </div>
                 ) : (
                   <p className="text-xs font-black uppercase tracking-tighter text-gray-400">Nenhuma dependência registrada</p>
                 )}
              </div>
            </div>
          </div>

          {/* Next Appointments Placeholder */}
          <div className="p-6 bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl shadow-xl text-white">
            <h4 className="text-xs font-black uppercase tracking-widest mb-4">Próximas Consultas</h4>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-center">
              <Calendar className="mx-auto mb-2 opacity-50" size={24} />
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mantenha a agenda atualizada no módulo de consultas</p>
            </div>
            <button type="button" className="w-full mt-6 py-3 bg-white text-gray-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all">
              Agendar Avaliação
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerTab;
