
import React from 'react';
import { 
  Save, 
  ArrowLeft, 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  Camera, 
  ShieldCheck, 
  AlertCircle, 
  Users, 
  DollarSign, 
  Package, 
  HeartPulse, 
  Stethoscope, 
  TrendingUp, 
  TrendingDown,
  Clock,
  Briefcase,
  LogIn,
  LogOut,
  MapPin,
  CreditCard,
  FileText,
  Printer
} from 'lucide-react';
import { 
  Resident, 
  Relative, 
  FinancialTransaction, 
  PersonalItem, 
  HealthUpdate, 
  Medication,
  VisitRecord,
  SubTab
} from '../types';

interface ElderlyFormProps {
  initialData: Resident;
  initialTab?: SubTab;
  onSave: (data: Resident) => void;
  onCancel: () => void;
}

const SectionHeader: React.FC<{ title: string; icon?: any }> = ({ title, icon: Icon }) => (
  <div className="flex items-center gap-3 border-b-2 border-blue-50 pb-2 mb-6 mt-8 first:mt-0">
    {Icon && <Icon className="text-[#004c99]" size={20} />}
    <h3 className="text-sm font-black uppercase tracking-widest text-[#004c99]">{title}</h3>
  </div>
);

const FormField: React.FC<{
  label: string;
  name: string;
  type?: string;
  value: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
  options?: string[];
}> = ({ label, name, type = 'text', value, onChange, required, className = "", placeholder, options }) => (
  <div className={`space-y-1 ${className}`}>
    <label htmlFor={name} className="block text-[10px] font-black text-gray-500 uppercase tracking-tighter">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {type === 'select' && options ? (
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm font-medium"
      >
        <option value="">Selecione...</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    ) : (
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm font-medium"
      />
    )}
  </div>
);

const ElderlyForm: React.FC<ElderlyFormProps> = ({ initialData, initialTab = 'geral', onSave, onCancel }) => {
  const [formData, setFormData] = React.useState<Resident>(initialData);
  const [activeTab, setActiveTab] = React.useState<SubTab>(initialTab);

  React.useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePrint = () => {
    window.print();
  };

  const updateListField = (listName: keyof Resident, id: string, field: string, value: any) => {
    setFormData(prev => {
      const list = prev[listName];
      if (!Array.isArray(list)) return prev;
      return {
        ...prev,
        [listName]: list.map((item: any) => 
          item.id === id ? { ...item, [field]: value } : item
        )
      };
    });
  };

  const removeFromList = (listName: keyof Resident, id: string) => {
    setFormData(prev => ({ ...prev, [listName]: (prev[listName] as any[]).filter(i => i.id !== id) }));
  };

  const handleRelativeChange = (id: string, field: keyof Relative, value: any) => {
    setFormData(prev => ({
      ...prev,
      relatives: prev.relatives.map(r => {
        if (r.id === id) return { ...r, [field]: value };
        if (field === 'isResponsible' && value === true) return { ...r, isResponsible: false };
        return r;
      })
    }));
  };

  const addRelative = () => {
    const newRel: Relative = { id: Date.now().toString(), name: '', kinship: '', phone: '', observation: '', isResponsible: formData.relatives.length === 0 };
    setFormData(prev => ({ ...prev, relatives: [...prev.relatives, newRel] }));
  };

  const addVisitRecord = () => {
    const newVisit: VisitRecord = { 
      id: Date.now().toString(), 
      date: new Date().toISOString().split('T')[0], 
      visitorName: '', 
      visitorDoc: '', 
      timeIn: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), 
      timeOut: '', 
      observation: '' 
    };
    setFormData(prev => ({ ...prev, visitRecords: [...prev.visitRecords, newVisit] }));
  };

  const addFinancial = (type: 'entrada' | 'saída') => {
    const newFin: FinancialTransaction = { id: Date.now().toString(), date: new Date().toISOString().split('T')[0], type, description: '', amount: 0 };
    setFormData(prev => ({ ...prev, financials: [...prev.financials, newFin] }));
  };

  const balance = formData.financials.reduce((acc, curr) => curr.type === 'entrada' ? acc + Number(curr.amount) : acc - Number(curr.amount), 0);

  const addPersonalItem = () => {
    const newItem: PersonalItem = { id: Date.now().toString(), description: '', status: 'Entrada', date: new Date().toISOString().split('T')[0], observation: '' };
    setFormData(prev => ({ ...prev, personalItems: [...prev.personalItems, newItem] }));
  };

  const addHealthUpdate = () => {
    const newHealth: HealthUpdate = { id: Date.now().toString(), date: new Date().toISOString().split('T')[0], summary: '', professional: '', observation: '' };
    setFormData(prev => ({ ...prev, healthUpdates: [...prev.healthUpdates, newHealth] }));
  };

  const addMedication = () => {
    const newMed: Medication = { id: Date.now().toString(), name: '', dosage: '', frequency: '', stock: 0, lastUpdate: new Date().toISOString().split('T')[0] };
    setFormData(prev => ({ ...prev, medications: [...prev.medications, newMed] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const tabs: { id: SubTab; label: string; icon: any }[] = [
    { id: 'geral', label: 'Dados Gerais', icon: ImageIcon },
    { id: 'familiares-visitantes', label: 'Familiares e Visitantes', icon: Users },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
    { id: 'itens', label: 'Itens Pessoais', icon: Package },
    { id: 'saude', label: 'Saúde', icon: HeartPulse },
    { id: 'medicamentos', label: 'Medicamentos', icon: Stethoscope },
    { id: 'convenio', label: 'Convênios', icon: Briefcase },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Export/Print Button */}
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-gray-200 shadow-sm no-print">
        <div className="flex items-center gap-6">
          <button onClick={onCancel} className="p-2.5 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors border">
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center gap-4">
            <img 
              src={formData.photo || `https://ui-avatars.com/api/?name=${formData.name || 'Novo'}&background=004c99&color=fff`} 
              className="w-14 h-14 rounded-full border-2 border-blue-50 object-cover"
            />
            <div>
              <h1 className="text-xl font-black text-gray-900 uppercase">
                {formData.name || 'Novo Cadastro de Idoso'}
              </h1>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">
                Ficha Individual • {activeTab.replace('-', ' ')}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
           <button 
             type="button" 
             onClick={handlePrint} 
             className="px-6 py-2 border-2 border-[#004c99] rounded-lg text-[#004c99] font-black text-xs uppercase hover:bg-blue-50 flex items-center gap-2 shadow-sm"
           >
             <Printer size={16} />
             Exportar PDF
           </button>
           <button type="button" onClick={onCancel} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-bold text-xs uppercase hover:bg-gray-50">Sair</button>
           <button onClick={handleSubmit} className="bg-[#004c99] hover:bg-blue-800 text-white px-8 py-2 rounded-lg flex items-center gap-2 shadow-lg transition-all font-bold text-xs uppercase">
             <Save size={18} />
             <span>Salvar Tudo</span>
           </button>
        </div>
      </div>

      {/* Hidden Printable Area (Mimics the SSVP PDF Layout) */}
      <div id="printable-area" className="hidden print:block p-10 font-sans text-gray-900 bg-white">
        <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="bg-[#004c99] p-3 rounded-full text-white font-black text-xl">SSVP</div>
            <div>
              <div className="font-black text-lg uppercase leading-tight text-blue-900">Larsão Vicente de Paulo</div>
              <div className="font-bold text-xs uppercase text-blue-800">Obraunida à Sociedade de São Vicente de Paulo</div>
              <div className="text-[10px] mt-1 text-gray-600">LARGO 8 DE FEVEREIRO, 1384 • MONTE ALTO - SP • CEP 15910-000</div>
            </div>
          </div>
          <div className="text-right">
             <div className="font-black text-[10px] uppercase border-b border-gray-300 pb-1 mb-1">Ficha de Informações Cadastrais</div>
             <div className="text-[10px] font-bold text-gray-500">{new Date().toLocaleDateString('pt-BR')}</div>
          </div>
        </div>

        <div className="space-y-6">
           {/* Section 1 */}
           <section>
              <div className="bg-gray-100 px-4 py-1 font-black text-[10px] uppercase mb-4 border-l-4 border-[#004c99]">I. Informações Pessoais</div>
              <div className="flex gap-8 items-start">
                 <img src={formData.photo || `https://ui-avatars.com/api/?name=${formData.name}&background=004c99&color=fff`} className="w-24 h-24 rounded-lg border border-gray-200 object-cover" />
                 <div className="flex-1 grid grid-cols-3 gap-y-3 gap-x-4">
                    <div className="col-span-2">
                       <div className="text-[9px] font-black uppercase text-gray-400">Nome Completo</div>
                       <div className="text-xs font-bold uppercase">{formData.name || 'NÃO INFORMADO'}</div>
                    </div>
                    <div>
                       <div className="text-[9px] font-black uppercase text-gray-400">Nascimento</div>
                       <div className="text-xs font-bold uppercase">{formData.birthDate ? new Date(formData.birthDate).toLocaleDateString('pt-BR') : '-'}</div>
                    </div>
                    <div>
                       <div className="text-[9px] font-black uppercase text-gray-400">Gênero</div>
                       <div className="text-xs font-bold uppercase">{formData.gender}</div>
                    </div>
                    <div>
                       <div className="text-[9px] font-black uppercase text-gray-400">Estado Civil</div>
                       <div className="text-xs font-bold uppercase">{formData.maritalStatus || '-'}</div>
                    </div>
                    <div>
                       <div className="text-[9px] font-black uppercase text-gray-400">Naturalidade</div>
                       <div className="text-xs font-bold uppercase">{formData.naturalness || '-'}</div>
                    </div>
                    <div>
                       <div className="text-[9px] font-black uppercase text-gray-400">Nome do Pai</div>
                       <div className="text-xs font-bold uppercase">{formData.fatherName || '-'}</div>
                    </div>
                    <div className="col-span-2">
                       <div className="text-[9px] font-black uppercase text-gray-400">Nome da Mãe</div>
                       <div className="text-xs font-bold uppercase">{formData.motherName || '-'}</div>
                    </div>
                 </div>
              </div>
           </section>

           {/* Section 2 */}
           <section>
              <div className="bg-gray-100 px-4 py-1 font-black text-[10px] uppercase mb-4 border-l-4 border-[#004c99]">II. Documentação & Benefícios</div>
              <div className="grid grid-cols-4 gap-y-3 gap-x-4">
                 <div>
                    <div className="text-[9px] font-black uppercase text-gray-400">CPF</div>
                    <div className="text-xs font-bold">{formData.cpf || '-'}</div>
                 </div>
                 <div>
                    <div className="text-[9px] font-black uppercase text-gray-400">RG</div>
                    <div className="text-xs font-bold">{formData.rg || '-'}</div>
                 </div>
                 <div>
                    <div className="text-[9px] font-black uppercase text-gray-400">Cartão SUS</div>
                    <div className="text-xs font-bold">{formData.susCard || '-'}</div>
                 </div>
                 <div>
                    <div className="text-[9px] font-black uppercase text-gray-400">Nº Benefício INSS</div>
                    <div className="text-xs font-bold">{formData.inssNumber || '-'}</div>
                 </div>
              </div>
           </section>

           {/* Section 3 */}
           <section>
              <div className="bg-gray-100 px-4 py-1 font-black text-[10px] uppercase mb-4 border-l-4 border-[#004c99]">III. Endereço e Acolhimento</div>
              <div className="grid grid-cols-4 gap-y-3 gap-x-4">
                 <div className="col-span-2">
                    <div className="text-[9px] font-black uppercase text-gray-400">Endereço</div>
                    <div className="text-xs font-bold uppercase">{formData.address || '-'}, {formData.addressNumber || '-'}</div>
                 </div>
                 <div>
                    <div className="text-[9px] font-black uppercase text-gray-400">Bairro</div>
                    <div className="text-xs font-bold uppercase">{formData.neighborhood || '-'}</div>
                 </div>
                 <div>
                    <div className="text-[9px] font-black uppercase text-gray-400">Cidade/UF</div>
                    <div className="text-xs font-bold uppercase">{formData.city || '-'} / {formData.state || '-'}</div>
                 </div>
                 <div>
                    <div className="text-[9px] font-black uppercase text-gray-400">Acolhimento</div>
                    <div className="text-xs font-bold">{formData.admissionDate || '-'}</div>
                 </div>
                 <div>
                    <div className="text-[9px] font-black uppercase text-gray-400">Estadia</div>
                    <div className="text-xs font-bold uppercase">{formData.stayType || '-'}</div>
                 </div>
                 <div>
                    <div className="text-[9px] font-black uppercase text-gray-400">Quarto/Ala</div>
                    <div className="text-xs font-bold uppercase">{formData.room || '-'}</div>
                 </div>
                 <div>
                    <div className="text-[9px] font-black uppercase text-gray-400">Rendimento</div>
                    <div className="text-xs font-bold uppercase">{formData.income || '-'}</div>
                 </div>
              </div>
           </section>

           {/* Section 4 - Família e Visitantes (Summary) */}
           <section>
              <div className="bg-gray-100 px-4 py-1 font-black text-[10px] uppercase mb-4 border-l-4 border-[#004c99]">IV. Familiares e Contatos de Emergência</div>
              <div className="space-y-2">
                 {formData.relatives.map(rel => (
                    <div key={rel.id} className="flex justify-between border-b border-gray-100 pb-1">
                       <div className="text-[10px] font-bold uppercase">{rel.name} ({rel.kinship})</div>
                       <div className="text-[10px] font-bold">{rel.phone} {rel.isResponsible && ' [RESPONSÁVEL]'}</div>
                    </div>
                 ))}
                 {formData.relatives.length === 0 && <div className="text-[10px] text-gray-400 uppercase italic">Nenhum familiar cadastrado.</div>}
              </div>
           </section>

           {/* Section 5 - Visits (Summary) */}
           <section>
              <div className="bg-gray-100 px-4 py-1 font-black text-[10px] uppercase mb-4 border-l-4 border-[#004c99]">V. Últimas Visitas Registradas</div>
              <div className="grid grid-cols-4 gap-2 text-[9px] font-black uppercase text-gray-400 mb-1">
                <div>Data</div>
                <div>Visitante</div>
                <div>Entrada</div>
                <div>Saída</div>
              </div>
              <div className="space-y-1">
                 {formData.visitRecords.slice(0, 5).map(v => (
                    <div key={v.id} className="grid grid-cols-4 gap-2 text-[10px] border-b border-gray-50 pb-1">
                       <div>{v.date}</div>
                       <div className="font-bold">{v.visitorName}</div>
                       <div>{v.timeIn}</div>
                       <div>{v.timeOut || '--:--'}</div>
                    </div>
                 ))}
                 {formData.visitRecords.length === 0 && <div className="text-[10px] text-gray-400 uppercase italic">Sem registros de visitas.</div>}
              </div>
           </section>
        </div>

        <div className="mt-16 flex justify-around border-t border-gray-200 pt-8">
           <div className="flex flex-col items-center gap-1">
              <div className="w-40 border-b border-black"></div>
              <div className="text-[8px] font-black uppercase">Responsável SSVP</div>
           </div>
           <div className="flex flex-col items-center gap-1">
              <div className="w-40 border-b border-black"></div>
              <div className="text-[8px] font-black uppercase">Responsável Familiar</div>
           </div>
        </div>
      </div>

      <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-4 overflow-x-auto no-scrollbar no-print">
        {tabs.map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-4 text-[10px] font-black uppercase transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === tab.id ? 'border-[#004c99] text-[#004c99]' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-b-xl shadow-md border border-gray-200 overflow-hidden mb-12 no-print">
        {activeTab === 'geral' && (
          <div className="p-8 space-y-2 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row gap-10 mb-8">
              <div className="w-full md:w-56 shrink-0 space-y-4">
                <div className="aspect-square bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 gap-2 relative group cursor-pointer hover:bg-gray-100 transition-colors overflow-hidden">
                  {formData.photo ? (
                    <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <ImageIcon size={48} strokeWidth={1} />
                      <span className="text-[10px] uppercase font-black text-center px-4">Foto do Idoso</span>
                    </>
                  )}
                  <div className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={24} />
                  </div>
                </div>
              </div>
              
              <div className="flex-1">
                <SectionHeader title="Informações Pessoais" icon={Users} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                  <FormField label="Nome" name="name" value={formData.name} onChange={handleChange} required className="md:col-span-1" />
                  <FormField label="Gênero" name="gender" type="select" options={['Masculino', 'Feminino', 'Outro']} value={formData.gender} onChange={handleChange} />
                  <FormField label="Data de Nascimento" name="birthDate" type="date" value={formData.birthDate} onChange={handleChange} />
                  
                  <FormField label="Nacionalidade" name="nationality" value={formData.nationality} onChange={handleChange} />
                  <FormField label="Naturalidade" name="naturalness" value={formData.naturalness} onChange={handleChange} />
                  <FormField label="Estado Civil" name="maritalStatus" type="select" options={['Solteiro(a)', 'Casado(a)', 'Viúvo(a)', 'Divorciado(a)', 'União Estável']} value={formData.maritalStatus} onChange={handleChange} />
                  
                  <FormField label="Escolaridade" name="education" value={formData.education} onChange={handleChange} />
                  <FormField label="Nome do Pai" name="fatherName" value={formData.fatherName} onChange={handleChange} />
                  <FormField label="Nome da Mãe" name="motherName" value={formData.motherName} onChange={handleChange} />
                  
                  <FormField label="Apelido" name="nickname" value={formData.nickname} onChange={handleChange} />
                  <FormField label="Profissão" name="profession" value={formData.profession} onChange={handleChange} />
                  <FormField label="Cônjuge" name="spouse" value={formData.spouse} onChange={handleChange} />
                  
                  <FormField label="Hospitais de Preferência" name="preferredHospitals" value={formData.preferredHospitals} onChange={handleChange} className="md:col-span-3" />
                  
                  <div className="md:col-span-3 space-y-1">
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-tighter">Observações</label>
                    <textarea name="observations" value={formData.observations} onChange={handleChange} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium" />
                  </div>
                </div>
              </div>
            </div>

            <SectionHeader title="Documentos" icon={FileText} />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-4 mb-8">
              <FormField label="CPF" name="cpf" value={formData.cpf} onChange={handleChange} />
              <FormField label="RG / RNE" name="rg" value={formData.rg} onChange={handleChange} />
              <FormField label="Órgão Expeditor" name="issuingBody" value={formData.issuingBody} onChange={handleChange} />
              <div className="hidden md:block"></div>

              <FormField label="Título do Eleitor" name="voterTitle" value={formData.voterTitle} onChange={handleChange} />
              <FormField label="Seção Eleitoral" name="voterSection" value={formData.voterSection} onChange={handleChange} />
              <FormField label="Zona Eleitoral" name="voterZone" value={formData.voterZone} onChange={handleChange} />
              <div className="hidden md:block"></div>

              <FormField label="Tipo de Certificado" name="certType" type="select" options={['Certidão de Nascimento', 'Certidão de Casamento']} value={formData.certType} onChange={handleChange} />
              <FormField label="Número" name="certNumber" value={formData.certNumber} onChange={handleChange} />
              <FormField label="Folha" name="certPage" value={formData.certPage} onChange={handleChange} />
              <FormField label="Livro" name="certBook" value={formData.certBook} onChange={handleChange} />
              
              <FormField label="Cidade (Certidão)" name="certCity" value={formData.certCity} onChange={handleChange} />
              <FormField label="Estado (Certidão)" name="certState" value={formData.certState} onChange={handleChange} />
              <FormField label="Data (Certidão)" name="certDate" type="date" value={formData.certDate} onChange={handleChange} />
            </div>

            <SectionHeader title="Cartões e Previdência (INSS)" icon={CreditCard} />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-4 mb-8">
              <FormField label="Cartão SAMS" name="samsCard" value={formData.samsCard} onChange={handleChange} />
              <FormField label="Cartão SUS" name="susCard" value={formData.susCard} onChange={handleChange} />
              <FormField label="Cadastro Único" name="cadUnico" value={formData.cadUnico} onChange={handleChange} />
              <FormField label="Nº Ben. INSS" name="inssNumber" value={formData.inssNumber} onChange={handleChange} />
              
              <FormField label="Tipo Ben. INSS" name="inssType" value={formData.inssType} onChange={handleChange} />
              <FormField label="Sit. Ben. INSS" name="inssStatus" value={formData.inssStatus} onChange={handleChange} />
            </div>

            <SectionHeader title="Endereço" icon={MapPin} />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-4 mb-8">
              <FormField label="CEP" name="cep" value={formData.cep} onChange={handleChange} />
              <FormField label="Cidade" name="city" value={formData.city} onChange={handleChange} />
              <FormField label="Estado" name="state" value={formData.state} onChange={handleChange} />
              <FormField label="Bairro" name="neighborhood" value={formData.neighborhood} onChange={handleChange} />
              
              <FormField label="Endereço" name="address" value={formData.address} onChange={handleChange} className="md:col-span-2" />
              <FormField label="Número" name="addressNumber" value={formData.addressNumber} onChange={handleChange} />
              <FormField label="Referência" name="reference" value={formData.reference} onChange={handleChange} />
              
              <FormField label="Complemento" name="complement" value={formData.complement} onChange={handleChange} className="md:col-span-4" />
            </div>

            <SectionHeader title="Acolhimento" icon={LogIn} />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-4 mb-8">
              <FormField label="Estadia" name="stayType" type="select" options={['Residente / Mensalista', 'Residente', 'Pernoite', 'Temporário']} value={formData.stayType} onChange={handleChange} />
              <FormField label="Data do Acolhimento" name="admissionDate" type="date" value={formData.admissionDate} onChange={handleChange} />
              <FormField label="Ocupação do Residente" name="room" value={formData.room} onChange={handleChange} placeholder="Ex: Apartamento 6" />
              <FormField label="Rendimento" name="income" value={formData.income} onChange={handleChange} />
              
              <FormField label="Motivo do Acolhimento" name="admissionReason" value={formData.admissionReason} onChange={handleChange} />
              <FormField label="Grupo do Residente" name="residentGroup" value={formData.residentGroup} onChange={handleChange} />
              <FormField label="Grau de Dependência" name="dependencyLevel" type="select" options={['Grau I', 'Grau II', 'Grau III']} value={formData.dependencyLevel} onChange={handleChange} />
              <div className="hidden md:block"></div>
              
              <FormField label="Nome da Instituição Anterior" name="previousInstitution" value={formData.previousInstitution} onChange={handleChange} />
              <FormField label="Tempo de Estadia" name="stayTime" value={formData.stayTime} onChange={handleChange} />
              <FormField label="Motivo da Troca" name="changeReason" value={formData.changeReason} onChange={handleChange} />
            </div>
          </div>
        )}

        {activeTab === 'familiares-visitantes' && (
          <div className="p-8 animate-in slide-in-from-right duration-300 space-y-12">
            <section>
              <div className="flex justify-between items-center mb-8">
                 <div>
                    <h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter">1. Cadastro de Familiares e Contatos</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Gerencie os vínculos permanentes e responsáveis legais.</p>
                 </div>
                 <button type="button" onClick={addRelative} className="flex items-center gap-2 text-xs font-black text-white bg-[#004c99] hover:bg-blue-800 px-6 py-3 rounded-xl transition-all shadow-lg uppercase">
                   <Plus size={18} /> ADICIONAR FAMILIAR
                 </button>
              </div>
              <div className="grid grid-cols-1 gap-6">
                 {formData.relatives.map((rel) => (
                   <div key={rel.id} className={`relative p-8 border rounded-2xl transition-all shadow-sm ${rel.isResponsible ? 'border-[#004c99] bg-blue-50/30 ring-2 ring-blue-100' : 'border-gray-200 bg-white'}`}>
                      {rel.isResponsible && <div className="absolute -top-3 left-8 bg-[#004c99] text-white text-[10px] font-black uppercase px-4 py-1.5 rounded-full flex items-center gap-2 shadow-md"><ShieldCheck size={14} /> Contato Responsável</div>}
                      <div className="flex flex-col md:flex-row gap-8">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
                          <FormField label="Nome Completo" name={`rel-name-${rel.id}`} value={rel.name} onChange={(e) => handleRelativeChange(rel.id, 'name', e.target.value)} />
                          <FormField label="Vínculo" name={`rel-kinship-${rel.id}`} value={rel.kinship} onChange={(e) => handleRelativeChange(rel.id, 'kinship', e.target.value)} />
                          <FormField label="Telefone" name={`rel-phone-${rel.id}`} value={rel.phone} onChange={(e) => handleRelativeChange(rel.id, 'phone', e.target.value)} />
                        </div>
                        <div className="flex flex-row md:flex-col gap-3 justify-center">
                           {!rel.isResponsible && (
                             <button type="button" onClick={() => handleRelativeChange(rel.id, 'isResponsible', true)} className="px-4 py-2 text-[10px] font-black uppercase border-2 border-blue-600 text-blue-600 rounded-xl hover:bg-blue-50 transition-colors">Responsável</button>
                           )}
                           <button type="button" onClick={() => removeFromList('relatives', rel.id)} className="p-2.5 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"><Trash2 size={20} /></button>
                        </div>
                      </div>
                   </div>
                 ))}
              </div>
            </section>

            <section>
               <div className="flex justify-between items-center mb-8 bg-gray-50 p-6 rounded-2xl border border-dashed border-gray-300">
                  <div>
                     <h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter">2. Controle de Portaria / Visitas</h3>
                     <p className="text-[10px] font-bold text-gray-400 uppercase">Registro pontual de entradas e saídas de visitantes.</p>
                  </div>
                  <button type="button" onClick={addVisitRecord} className="flex items-center gap-2 text-xs font-black text-[#004c99] bg-white border-2 border-[#004c99] hover:bg-blue-50 px-6 py-3 rounded-xl transition-all shadow-md uppercase">
                    <LogIn size={18} /> REGISTRAR ENTRADA
                  </button>
               </div>

               <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                     <thead className="bg-gray-100 text-[10px] font-black uppercase text-gray-500 tracking-widest">
                        <tr>
                           <th className="px-6 py-4">Data</th>
                           <th className="px-6 py-4">Visitante</th>
                           <th className="px-6 py-4">Entrada</th>
                           <th className="px-6 py-4">Saída</th>
                           <th className="px-6 py-4">Ações</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50">
                        {formData.visitRecords.sort((a,b) => b.date.localeCompare(a.date)).map((v) => (
                           <tr key={v.id} className="hover:bg-blue-50/10">
                              <td className="px-6 py-3"><input type="date" value={v.date} onChange={(e) => updateListField('visitRecords', v.id, 'date', e.target.value)} className="bg-transparent text-sm font-bold focus:outline-none w-32" /></td>
                              <td className="px-6 py-3"><input type="text" value={v.visitorName} onChange={(e) => updateListField('visitRecords', v.id, 'visitorName', e.target.value)} placeholder="Visitante..." className="bg-transparent text-sm w-full focus:outline-none" /></td>
                              <td className="px-6 py-3"><input type="time" value={v.timeIn} onChange={(e) => updateListField('visitRecords', v.id, 'timeIn', e.target.value)} className="bg-transparent text-sm focus:outline-none" /></td>
                              <td className="px-6 py-3"><input type="time" value={v.timeOut} onChange={(e) => updateListField('visitRecords', v.id, 'timeOut', e.target.value)} className="bg-transparent text-sm focus:outline-none" /></td>
                              <td className="px-6 py-3 text-center">
                                 <button type="button" onClick={() => removeFromList('visitRecords', v.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </section>
          </div>
        )}

        {activeTab === 'financeiro' && (
          <div className="p-8 animate-in slide-in-from-right duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
               <div className="bg-gradient-to-br from-[#004c99] to-blue-800 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden group">
                  <div className="absolute -right-8 -top-8 text-white opacity-5 transform rotate-12 group-hover:scale-110 transition-transform"><DollarSign size={160} /></div>
                  <div className="text-[10px] uppercase font-black opacity-70 tracking-widest">Saldo Atual</div>
                  <div className="text-4xl font-black mt-2 tracking-tighter">R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
               </div>
               <div className="flex items-center justify-center gap-6 col-span-2">
                  <button type="button" onClick={() => addFinancial('entrada')} className="flex-1 h-full bg-white border-2 border-green-100 text-green-700 rounded-3xl flex flex-col items-center justify-center p-6 hover:bg-green-50 transition-all shadow-sm">
                     <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-3"><TrendingUp size={32} /></div>
                     <span className="text-xs font-black uppercase tracking-widest">Nova Entrada</span>
                  </button>
                  <button type="button" onClick={() => addFinancial('saída')} className="flex-1 h-full bg-white border-2 border-red-100 text-red-700 rounded-3xl flex flex-col items-center justify-center p-6 hover:bg-red-50 transition-all shadow-sm">
                     <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-3"><TrendingDown size={32} /></div>
                     <span className="text-xs font-black uppercase tracking-widest">Nova Saída</span>
                  </button>
               </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden">
               <table className="w-full text-left">
                  <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-500 tracking-widest">
                     <tr>
                        <th className="px-8 py-5">Data</th>
                        <th className="px-8 py-5">Descrição</th>
                        <th className="px-8 py-5 text-right">Valor</th>
                        <th className="px-8 py-5 text-center">Ações</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                     {formData.financials.map((fin) => (
                        <tr key={fin.id} className="hover:bg-blue-50/20 transition-colors">
                           <td className="px-8 py-4"><input type="date" value={fin.date} onChange={(e) => updateListField('financials', fin.id, 'date', e.target.value)} className="bg-transparent text-sm font-bold focus:outline-none" /></td>
                           <td className="px-8 py-4"><input type="text" value={fin.description} onChange={(e) => updateListField('financials', fin.id, 'description', e.target.value)} className="bg-transparent text-sm w-full focus:outline-none" /></td>
                           <td className="px-8 py-4 text-right">
                              <input type="number" step="0.01" value={fin.amount} onChange={(e) => updateListField('financials', fin.id, 'amount', e.target.value)} className={`bg-transparent text-sm w-24 text-right focus:outline-none font-black ${fin.type === 'entrada' ? 'text-green-600' : 'text-red-600'}`} />
                           </td>
                           <td className="px-8 py-4 text-center"><button type="button" onClick={() => removeFromList('financials', fin.id)} className="text-red-300 hover:text-red-600 transition-colors"><Trash2 size={18} /></button></td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
          </div>
        )}

        {activeTab === 'itens' && (
          <div className="p-8 animate-in slide-in-from-right duration-300">
             <div className="flex justify-between items-center mb-10">
                <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Itens Pessoais</h3>
                <button type="button" onClick={addPersonalItem} className="flex items-center gap-2 text-xs font-black text-white bg-[#004c99] hover:bg-blue-800 px-6 py-3 rounded-xl shadow-lg uppercase">
                  <Plus size={18} /> NOVO ITEM
                </button>
             </div>
             <div className="grid grid-cols-1 gap-4">
                {formData.personalItems.map((item) => (
                  <div key={item.id} className="p-6 border rounded-2xl bg-white shadow-sm grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
                     <FormField label="Descrição" name={`item-desc-${item.id}`} value={item.description} onChange={(e) => updateListField('personalItems', item.id, 'description', e.target.value)} className="md:col-span-2" />
                     <FormField label="Movimento" name={`item-stat-${item.id}`} type="select" options={['Entrada', 'Saída']} value={item.status} onChange={(e) => updateListField('personalItems', item.id, 'status', e.target.value)} />
                     <FormField label="Data" name={`item-date-${item.id}`} type="date" value={item.date} onChange={(e) => updateListField('personalItems', item.id, 'date', e.target.value)} />
                     <div className="flex items-center justify-end">
                        <button type="button" onClick={() => removeFromList('personalItems', item.id)} className="p-2.5 text-red-400 hover:text-red-600 bg-red-50 rounded-xl"><Trash2 size={18} /></button>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'saude' && (
           <div className="p-8 animate-in slide-in-from-right duration-300">
              <div className="flex justify-between items-center mb-10">
                 <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Saúde</h3>
                 <button type="button" onClick={addHealthUpdate} className="flex items-center gap-2 text-xs font-black text-white bg-[#004c99] hover:bg-blue-800 px-6 py-3 rounded-xl shadow-lg uppercase">
                   <Plus size={18} /> EVOLUÇÃO
                 </button>
              </div>
              <div className="space-y-6">
                 {formData.healthUpdates.map((h) => (
                    <div key={h.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                          <FormField label="Data" name={`h-date-${h.id}`} type="date" value={h.date} onChange={(e) => updateListField('healthUpdates', h.id, 'date', e.target.value)} />
                          <FormField label="Profissional" name={`h-prof-${h.id}`} value={h.professional} onChange={(e) => updateListField('healthUpdates', h.id, 'professional', e.target.value)} className="md:col-span-2" />
                       </div>
                       <FormField label="Resumo" name={`h-sum-${h.id}`} value={h.summary} onChange={(e) => updateListField('healthUpdates', h.id, 'summary', e.target.value)} className="mb-4" />
                       <div className="flex justify-end">
                          <button type="button" onClick={() => removeFromList('healthUpdates', h.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        )}

        {activeTab === 'medicamentos' && (
           <div className="p-8 animate-in slide-in-from-right duration-300">
              <div className="flex justify-between items-center mb-10">
                 <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Medicamentos</h3>
                 <button type="button" onClick={addMedication} className="flex items-center gap-2 text-xs font-black text-white bg-[#004c99] hover:bg-blue-800 px-6 py-3 rounded-xl shadow-lg uppercase">
                   <Plus size={18} /> ADICIONAR
                 </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {formData.medications.map((med) => (
                    <div key={med.id} className="p-6 border rounded-2xl bg-white shadow-sm relative group">
                       {/* Fixed typo in 'removeFromList' call: 'medicications' to 'medications' */}
                       <button type="button" onClick={() => removeFromList('medications', med.id)} className="absolute top-4 right-4 text-gray-300 hover:text-red-500"><Trash2 size={18} /></button>
                       <div className="space-y-4">
                          <input type="text" value={med.name} onChange={(e) => updateListField('medications', med.id, 'name', e.target.value)} placeholder="Nome..." className="w-full text-lg font-black focus:outline-none uppercase" />
                          <div className="grid grid-cols-2 gap-4">
                             <FormField label="Posologia" name={`m-d-${med.id}`} value={med.dosage} onChange={(e) => updateListField('medications', med.id, 'dosage', e.target.value)} />
                             <FormField label="Freq." name={`m-f-${med.id}`} value={med.frequency} onChange={(e) => updateListField('medications', med.id, 'frequency', e.target.value)} />
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        )}

        {activeTab === 'convenio' && (
           <div className="p-20 text-center animate-in zoom-in duration-300">
              <div className="flex flex-col items-center justify-center gap-4">
                <Briefcase size={48} className="text-gray-300" />
                <h3 className="text-xl font-black text-gray-800 uppercase">Convênios</h3>
                <button type="button" className="bg-[#004c99] text-white px-8 py-2 rounded-xl font-black text-xs uppercase shadow-md">NOVO CONVÊNIO</button>
              </div>
           </div>
        )}
      </form>
    </div>
  );
};

export default ElderlyForm;
