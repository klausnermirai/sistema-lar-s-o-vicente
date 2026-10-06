
import { getProfessionalSignature, fetchResidentById } from '../lib/api';
import jsPDF from 'jspdf';
import { addPdfHeaderAndFooter, createPdfContext, urlToBase64 } from '../lib/pdfHelpers';
import React, { useRef } from 'react';
import { motion } from 'motion/react';
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
  Pill,
  TrendingUp, 
  TrendingDown,
  Clock,
  Printer,
  ChevronRight,
  ChevronDown,
  X,
  PlusCircle,
  FileText,
  ClipboardList,
  Briefcase,
  LogIn,
  LogOut,
  MapPin,
  CreditCard
} from 'lucide-react';
import { 
  Resident, 
  Relative, 
  FinancialTransaction, 
  PersonalItem, 
  HealthUpdate, 
  Medication,
  VisitRecord,
  SubTab,
  InstitutionSettings
} from '../types';
import ProntuarioTab from './ProntuarioTab';
import PiaTab from './PiaTab';
import PerTab from './PerTab';
import MedicationTab from './MedicationTab';
import IntercurrenceHistoryTab from './IntercurrenceHistoryTab';
import { INITIAL_CANDIDATE } from '../constants';

interface ElderlyFormProps {
  initialData: Resident;
  initialTab?: SubTab;
  financialOnly?: boolean;
  settings: InstitutionSettings | null;
  onSave: (data: Resident) => void;
  onCancel: () => void;
  accessLevel?: string;
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

const ElderlyForm: React.FC<ElderlyFormProps> = ({ initialData, initialTab = 'geral', financialOnly, settings, onSave, onCancel, accessLevel }) => {
  const [formData, setFormData] = React.useState<Resident>(initialData);
  const [activeTab, setActiveTab] = React.useState<SubTab>(initialTab);
  const [prontuarioResident, setProntuarioResident] = React.useState<Resident | null>(null);
  const [loadingProntuario, setLoadingProntuario] = React.useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [croppingImage, setCroppingImage] = React.useState<string | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [isDrag, setIsDrag] = React.useState(false);
  const [startPos, setStartPos] = React.useState({ x: 0, y: 0 });
  const [visitDateFrom, setVisitDateFrom] = React.useState('');
  const [visitDateTo, setVisitDateTo] = React.useState('');
  const [financeDateFrom, setFinanceDateFrom] = React.useState('');
  const [financeDateTo, setFinanceDateTo] = React.useState('');

  React.useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  React.useEffect(() => {
    setProntuarioResident(null);
  }, [initialData.id]);

  React.useEffect(() => {
    if (activeTab !== 'prontuario' || !formData.id || prontuarioResident || loadingProntuario) return;

    const loadProntuarioResident = async () => {
      setLoadingProntuario(true);
      try {
        const sessionStr = localStorage.getItem('ssvp_session');
        const session = sessionStr ? JSON.parse(sessionStr) : null;
        const institutionId = session?.institutionId || session?.cnpj || formData.institutionId;
        if (!institutionId) return;
        const completeResident = await fetchResidentById(formData.id, institutionId);
        setProntuarioResident(completeResident);
      } catch (error) {
        console.error('Erro ao carregar prontuário multidisciplinar completo:', error);
      } finally {
        setLoadingProntuario(false);
      }
    };

    loadProntuarioResident();
  }, [activeTab, formData.id, formData.institutionId, prontuarioResident, loadingProntuario]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("A imagem é muito grande. Por favor, escolha uma imagem menor que 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCroppingImage(reader.result as string);
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropSave = () => {
    if (!croppingImage) return;

    const img = new Image();
    img.src = croppingImage;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 300; // Final size 300x300
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // The preview container is 256px (w-64 h-64)
      const previewSize = 256;
      const scale = size / previewSize;

      const aspect = img.width / img.height;
      let drawW, drawH;
      
      // Calculate how the image was fit in the 256px preview
      // Line 960: objectFit: 'contain' actually makes it fit inside.
      // But lines 954-955 set maxWidth: 'none' and height: '100%'.
      
      if (aspect > 1) {
        drawH = size * zoom;
        drawW = drawH * aspect;
      } else {
        drawW = size * zoom;
        drawH = drawW / aspect;
      }

      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, size, size);
      
      // Scale offset to canvas size
      const scaledOffsetX = offset.x * scale;
      const scaledOffsetY = offset.y * scale;
      
      // Draw image centered with offset
      const posX = (size - drawW) / 2 + scaledOffsetX;
      const posY = (size - drawH) / 2 + scaledOffsetY;
      
      ctx.drawImage(img, posX, posY, drawW, drawH);
      
      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.9);
      setFormData(prev => ({ ...prev, photo: croppedBase64 }));
      setCroppingImage(null);
    };
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
        if (r.id === id) {
          if (field === 'deceased' && value === true) {
            return { ...r, deceased: true, isResponsible: false };
          }
          if (field === 'isResponsible' && value === true && r.deceased) {
            return r;
          }
          return { ...r, [field]: value };
        }
        if (field === 'isResponsible' && value === true) return { ...r, isResponsible: false };
        return r;
      })
    }));
  };

  const updateResidesWith = (value: string) => {
    setFormData(prev => ({
      ...prev,
      interview: {
        ...(prev.interview || INITIAL_CANDIDATE.interview),
        residesWith: value
      }
    }));
  };

  const addRelative = () => {
    const newRel: Relative = { id: Date.now().toString(), ...getProfessionalSignature(), name: '', kinship: '', phone: '', observation: '', isResponsible: formData.relatives.length === 0, deceased: false };
    setFormData(prev => ({ ...prev, relatives: [...prev.relatives, newRel] }));
  };

  const addVisitRecord = () => {
    const newVisit: VisitRecord = { 
      id: Date.now().toString(), ...getProfessionalSignature(), 
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
    const newFin: FinancialTransaction = { id: Date.now().toString(), ...getProfessionalSignature(), date: new Date().toISOString().split('T')[0], type, description: '', amount: 0 };
    setFormData(prev => ({ ...prev, financials: [...prev.financials, newFin] }));
  };

  const initialBalance = Number(formData.initialBalance) || 0;
  const entriesTotal = (formData.financials || []).reduce((acc, curr) => curr.type === 'entrada' ? acc + Number(curr.amount) : acc, 0);
  const exitsTotal = (formData.financials || []).reduce((acc, curr) => curr.type === 'saída' ? acc + Number(curr.amount) : acc, 0);
  const balance = initialBalance + entriesTotal - exitsTotal;

  const addPersonalItem = () => {
    const newItem: PersonalItem = { id: Date.now().toString(), ...getProfessionalSignature(), description: '', status: 'Entrada', date: new Date().toISOString().split('T')[0], observation: '' };
    setFormData(prev => ({ ...prev, personalItems: [...prev.personalItems, newItem] }));
  };

  const addHealthUpdate = () => {
    const newHealth: HealthUpdate = { id: Date.now().toString(), ...getProfessionalSignature(), date: new Date().toISOString().split('T')[0], summary: '', professional: '', observation: '' };
    setFormData(prev => ({ ...prev, healthUpdates: [...prev.healthUpdates, newHealth] }));
  };

  const addMedication = () => {
    const newMed: Medication = { 
      id: Date.now().toString(), ...getProfessionalSignature(), 
      name: '', 
      concentration: '',
      dose: '',
      frequency: 1,
      times: ['08:00'],
      type: 'continuo',
      startDate: new Date().toISOString().split('T')[0],
      stock: 0, 
      lastUpdate: new Date().toISOString().split('T')[0] 
    };
    setFormData(prev => ({ ...prev, medications: [...(prev.medications || []), newMed] }));
  };

  const formatDate = (value?: string) => {
    if (!value) return 'Não informado';
    const base = value.includes('T') ? value.split('T')[0] : value;
    const [year, month, day] = base.split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  };

  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return 'Não informado';
    const birth = new Date(`${birthDate}T12:00:00`);
    if (Number.isNaN(birth.getTime())) return 'Não informado';
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
    return `${age} anos`;
  };

  const finalizePdf = async (doc: jsPDF, title: string, filename: string) => {
    await addPdfHeaderAndFooter(doc, settings, title);
    doc.save(filename);
  };

  const handleGenerateCadastroPdf = async () => {
    const doc = new jsPDF();
    const pdf = createPdfContext(doc);

    pdf.writeSection('Identificação');
    let photoRendered = false;
    if (formData.photo) {
      try {
        const photo = await urlToBase64(formData.photo);
        if (photo) {
          const startY = pdf.getY();
          const photoFormat = photo.startsWith('data:image/jpeg') || photo.startsWith('data:image/jpg') ? 'JPEG' : 'PNG';
          doc.addImage(photo, photoFormat, 14, startY, 25, 25);
          pdf.writeText(`Nome: ${pdf.safeValue(formData.name)}`, { font: 'bold', indent: 32 });
          pdf.writeText(`Nascimento: ${formatDate(formData.birthDate)} | Idade: ${calculateAge(formData.birthDate)}`, { indent: 32 });
          pdf.writeText(`Gênero: ${pdf.safeValue(formData.gender)} | Estado civil: ${pdf.safeValue(formData.maritalStatus)}`, { indent: 32 });
          pdf.setY(Math.max(pdf.getY(), startY + 28));
          photoRendered = true;
        }
      } catch (error) {
        console.warn('Não foi possível incluir a foto no PDF cadastral:', error);
      }
    }
    if (!photoRendered) {
      pdf.writeField('Nome', formData.name);
      pdf.writeField('Nascimento / Idade', `${formatDate(formData.birthDate)} / ${calculateAge(formData.birthDate)}`);
      pdf.writeField('Gênero', formData.gender);
      pdf.writeField('Estado civil', formData.maritalStatus);
    }
    pdf.writeField('Nacionalidade', formData.nationality);
    pdf.writeField('Naturalidade', formData.naturalness);
    pdf.writeField('Escolaridade', formData.education);
    pdf.writeField('Apelido', formData.nickname);
    pdf.writeField('Profissão', formData.profession);
    pdf.writeField('Cônjuge', formData.spouse);
    pdf.writeField('Pai', formData.fatherName);
    pdf.writeField('Mãe', formData.motherName);

    pdf.writeSection('Documentação e benefícios');
    pdf.writeField('CPF', formData.cpf);
    pdf.writeField('RG / Órgão expedidor', [formData.rg, formData.issuingBody].filter(Boolean).join(' - '));
    pdf.writeField('Cartão SUS', formData.susCard);
    pdf.writeField('Cartão SAMS', formData.samsCard);
    pdf.writeField('Título de eleitor', formData.voterTitle);
    pdf.writeField('Zona / Seção', [formData.voterZone, formData.voterSection].filter(Boolean).join(' / '));
    pdf.writeField('Benefício INSS', formData.inssNumber);
    pdf.writeField('Tipo / Situação INSS', [formData.inssType, formData.inssStatus].filter(Boolean).join(' / '));
    pdf.writeField('Cadastro Único', formData.cadUnico);
    pdf.writeField('Certidão civil', [formData.certType, formData.certNumber, formData.certBook, formData.certPage].filter(Boolean).join(' | '));

    pdf.writeSection('Endereço');
    pdf.writeField('Endereço', [formData.address, formData.addressNumber, formData.complement].filter(Boolean).join(', '));
    pdf.writeField('Bairro', formData.neighborhood);
    pdf.writeField('Cidade / UF', [formData.city, formData.state].filter(Boolean).join(' / '));
    pdf.writeField('CEP', formData.cep);
    pdf.writeField('Referência', formData.reference);

    pdf.writeSection('Acolhimento');
    pdf.writeField('Data do acolhimento', formatDate(formData.admissionDate));
    pdf.writeField('Tipo de estadia', formData.stayType);
    pdf.writeField('Quarto / Leito', [formData.room, formData.bedNumber].filter(Boolean).join(' / '));
    pdf.writeField('Grau de dependência', formData.grauDependenciaFinal ?? formData.dependencyLevel);
    pdf.writeField('Motivo do acolhimento', formData.admissionReason);
    pdf.writeField('Hospitais preferenciais', formData.preferredHospitals);
    pdf.writeField('Observações', formData.observations);

    await finalizePdf(doc, 'Ficha Cadastral do Residente', `Ficha_Cadastral_${formData.name.replace(/\s+/g, '_')}.pdf`);
  };

  const handleGenerateFamiliaresPdf = async () => {
    const doc = new jsPDF();
    const pdf = createPdfContext(doc);
    pdf.writeField('Residente', formData.name);
    pdf.writeField('Moradia antes do acolhimento', formData.interview?.residesWith);

    pdf.writeSection('Familiares e contatos');
    if (!formData.relatives?.length) {
      pdf.writeText('Nenhum familiar ou contato cadastrado.', { font: 'italic' });
    } else {
      formData.relatives.forEach((rel, index) => {
        pdf.ensureSpace(24);
        pdf.writeText(`${index + 1}. ${pdf.safeValue(rel.name)}`, { font: 'bold', size: 10 });
        pdf.writeField('Vínculo', rel.kinship);
        pdf.writeField('Telefone', rel.deceased ? 'Contato não ativo' : rel.phone);
        pdf.writeField('Situação', rel.deceased ? 'Falecido' : (rel.isResponsible ? 'Responsável principal' : 'Contato'));
        if (rel.document) pdf.writeField('Documento', rel.document);
        if (rel.observation) pdf.writeField('Observação', rel.observation);
        pdf.separator();
      });
    }

    await finalizePdf(doc, 'Cadastro de Familiares e Contatos', `Familiares_${formData.name.replace(/\s+/g, '_')}.pdf`);
  };

  const handleGenerateVisitasPdf = async () => {
    const doc = new jsPDF();
    const pdf = createPdfContext(doc);
    const visits = [...(formData.visitRecords || [])]
      .filter(v => !visitDateFrom || v.date >= visitDateFrom)
      .filter(v => !visitDateTo || v.date <= visitDateTo)
      .sort((a, b) => b.date.localeCompare(a.date));

    pdf.writeField('Residente', formData.name);
    if (visitDateFrom || visitDateTo) {
      pdf.writeField('Período', `${visitDateFrom ? formatDate(visitDateFrom) : 'início'} até ${visitDateTo ? formatDate(visitDateTo) : 'atual'}`);
    }
    pdf.writeSection('Visitas');

    if (!visits.length) {
      pdf.writeText('Nenhuma visita encontrada para o período selecionado.', { font: 'italic' });
    } else {
      visits.forEach((visit, index) => {
        pdf.ensureSpace(24);
        pdf.writeText(`${index + 1}. ${formatDate(visit.date)} — ${pdf.safeValue(visit.visitorName)}`, { font: 'bold', size: 10 });
        pdf.writeField('Documento', visit.visitorDoc);
        pdf.writeField('Entrada / Saída', `${pdf.safeValue(visit.timeIn, '--:--')} / ${pdf.safeValue(visit.timeOut, '--:--')}`);
        if (visit.matchedVia) pdf.writeField('Identificação', visit.matchedVia === 'facial' ? 'Reconhecimento facial' : 'Manual');
        if (visit.observation) pdf.writeField('Observação', visit.observation);
        pdf.separator();
      });
    }

    await finalizePdf(doc, 'Relação de Visitas do Residente', `Visitas_${formData.name.replace(/\s+/g, '_')}.pdf`);
  };

  const formatCurrency = (value: number) =>
    `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleGenerateFinancePdf = async () => {
    const doc = new jsPDF();
    const pdf = createPdfContext(doc);
    const transactions = [...(formData.financials || [])]
      .filter(fin => !financeDateFrom || fin.date >= financeDateFrom)
      .filter(fin => !financeDateTo || fin.date <= financeDateTo)
      .sort((a, b) => b.date.localeCompare(a.date));

    const filteredEntries = transactions.reduce((sum, fin) => fin.type === 'entrada' ? sum + Number(fin.amount || 0) : sum, 0);
    const filteredExits = transactions.reduce((sum, fin) => fin.type === 'saída' ? sum + Number(fin.amount || 0) : sum, 0);

    pdf.writeField('Residente', formData.name);
    if (financeDateFrom || financeDateTo) {
      pdf.writeField('Período', `${financeDateFrom ? formatDate(financeDateFrom) : 'início'} até ${financeDateTo ? formatDate(financeDateTo) : 'atual'}`);
    }

    pdf.writeSection('Resumo financeiro');
    pdf.writeField('Saldo inicial', formatCurrency(initialBalance));
    pdf.writeField('Total de entradas no período', formatCurrency(filteredEntries));
    pdf.writeField('Total de saídas no período', formatCurrency(filteredExits));
    pdf.writeField('Saldo atual geral', formatCurrency(balance));

    pdf.writeSection('Movimentações');
    if (!transactions.length) {
      pdf.writeText('Nenhuma movimentação encontrada para o período selecionado.', { font: 'italic' });
    } else {
      transactions.forEach((fin, index) => {
        pdf.ensureSpace(20);
        pdf.writeText(`${index + 1}. ${formatDate(fin.date)} — ${fin.type === 'entrada' ? 'Entrada' : 'Saída'} — ${formatCurrency(Number(fin.amount || 0))}`, { font: 'bold', size: 10 });
        pdf.writeField('Descrição', fin.description);
        pdf.separator();
      });
    }

    await finalizePdf(doc, 'Extrato Financeiro Individual', `Extrato_Financeiro_${formData.name.replace(/\s+/g, '_')}.pdf`);
  };

  const handleGenerateItemsPdf = async () => {
    const doc = new jsPDF();
    const pdf = createPdfContext(doc);
    const items = [...(formData.personalItems || [])].sort((a, b) => b.date.localeCompare(a.date));

    pdf.writeField('Residente', formData.name);
    pdf.writeSection('Itens pessoais');

    if (!items.length) {
      pdf.writeText('Nenhum item pessoal registrado.', { font: 'italic' });
    } else {
      items.forEach((item, index) => {
        pdf.ensureSpace(20);
        pdf.writeText(`${index + 1}. ${pdf.safeValue(item.description)}`, { font: 'bold', size: 10 });
        pdf.writeField('Status', item.status);
        pdf.writeField('Data', formatDate(item.date));
        if (item.observation) pdf.writeField('Observação', item.observation);
        pdf.separator();
      });
    }

    await finalizePdf(doc, 'Relação de Itens Pessoais', `Itens_Pessoais_${formData.name.replace(/\s+/g, '_')}.pdf`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  let tabs: { id: SubTab; label: string; icon: any }[] = [
    { id: 'geral', label: 'Dados Gerais', icon: ImageIcon },
    { id: 'familiares-visitantes', label: 'Familiares e Visitantes', icon: Users },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
    { id: 'itens', label: 'Itens Pessoais', icon: Package },
    { id: 'prontuario', label: 'Prontuário Multidisciplinar', icon: FileText },
    { id: 'prontuario-medico', label: 'Prontuário Clínico', icon: Stethoscope },
    { id: 'intercorrencias', label: 'Histórico de Intercorrências', icon: AlertCircle },
    { id: 'medicamentos', label: 'Medicamentos', icon: Pill },
    { id: 'pia', label: 'PIA', icon: ClipboardList },
  ];

  const allowedFinanceiro = ['administrador', 'gerencial', 'assistente_social', 'auxiliar_administrativo'];
  if (!allowedFinanceiro.includes(accessLevel || '')) {
    tabs = tabs.filter(t => t.id !== 'financeiro');
  }

  if (accessLevel === 'auxiliar_administrativo') {
    tabs = tabs.filter(t => t.id === 'geral' || t.id === 'financeiro');
  }

  if (financialOnly) {
    tabs = tabs.filter(t => t.id === 'financeiro');
  }

  return (
    <div className="space-y-6">
      {/* Header with Export/Print Button */}
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-gray-200 shadow-sm no-print">
        <div className="flex items-center gap-6">
          <button type="button" onClick={onCancel} className="p-2.5 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors border">
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center gap-4">
            <img 
              src={formData.photo || `https://ui-avatars.com/api/?name=${formData.name || 'Novo'}&background=004c99&color=fff`} 
              className="w-14 h-14 rounded-full border-2 border-blue-50 object-cover"
            />
            <div>
              <h1 className="text-xl font-black text-gray-900 uppercase">
                {financialOnly ? `Gestão Financeira • ${formData.name || 'Idoso'}` : (formData.name || 'Novo Cadastro de Idoso')}
              </h1>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">
                {financialOnly ? 'Movimentações e Extrato Individual' : `Ficha Individual • ${activeTab.replace('-', ' ')}`}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
           
           <button type="button" onClick={onCancel} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-bold text-xs uppercase hover:bg-gray-50">Sair</button>
           <button type="button" onClick={handleSubmit} className="bg-[#004c99] hover:bg-blue-800 text-white px-8 py-2 rounded-lg flex items-center gap-2 shadow-lg transition-all font-bold text-xs uppercase">
             <Save size={18} />
             <span>Salvar Tudo</span>
           </button>
        </div>
      </div>

      <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-4 overflow-x-auto custom-scrollbar no-print">
        {tabs.map(tab => (
          <button type="button" 
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
            <div className="flex justify-end mb-6">
              <button type="button" onClick={handleGenerateCadastroPdf} className="px-5 py-2.5 border-2 border-[#004c99] rounded-xl text-[#004c99] font-black text-xs uppercase hover:bg-blue-50 flex items-center gap-2">
                <Printer size={16} /> Gerar Ficha Cadastral PDF
              </button>
            </div>
            <div className="flex flex-col md:flex-row gap-10 mb-8">
              <div className="w-full md:w-56 shrink-0 space-y-4">
                <div 
                  className="aspect-square bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 gap-2 relative group cursor-pointer hover:bg-gray-100 transition-colors overflow-hidden"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handlePhotoUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />
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
                
                {/* Grau de Dependência Banner */}
                {formData.grauDependenciaFinal !== undefined && (
                  <div className="mb-6 p-4 rounded-xl border flex items-center gap-4 bg-blue-50 border-blue-100">
                    <div className="flex-1">
                      <h3 className="text-xs font-black uppercase text-[#004c99] tracking-tighter mb-1">
                        Grau de Dependência: {formData.grauDependenciaFinal}
                      </h3>
                      <p className="text-[10px] uppercase font-bold text-blue-600/70 tracking-widest leading-relaxed">
                        Origem: {formData.grauDependenciaManual !== undefined && formData.grauDependenciaManual !== null
                          ? "Ajustado manualmente pela equipe técnica"
                          : "Calculado automaticamente (Mapeamento de Dependências)"}
                      </p>
                      {formData.grauDependenciaAtualizadoEm && (
                        <p className="text-[9px] uppercase font-bold text-blue-600/50 tracking-widest mt-1">
                          Atualizado em {new Date(formData.grauDependenciaAtualizadoEm).toLocaleDateString("pt-BR", {hour: '2-digit', minute:'2-digit'})} por {formData.grauDependenciaAtualizadoPor || 'Sistema'}
                        </p>
                      )}
                    </div>
                  </div>
                )}

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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-4 mb-4">
              <FormField label="Cartão SAMS" name="samsCard" value={formData.samsCard} onChange={handleChange} />
              <FormField label="Cartão SUS" name="susCard" value={formData.susCard} onChange={handleChange} />
              <FormField label="Cadastro Único" name="cadUnico" value={formData.cadUnico} onChange={handleChange} />
              <FormField label="Nº Ben. INSS" name="inssNumber" value={formData.inssNumber} onChange={handleChange} />
              
              <FormField label="Tipo Ben. INSS" name="inssType" value={formData.inssType} onChange={handleChange} />
              <FormField label="Sit. Ben. INSS" name="inssStatus" value={formData.inssStatus} onChange={handleChange} />
            </div>

            <div className="mb-8">
              <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block">Fonte de Renda do Idoso</label>
              <div className="flex flex-wrap gap-4">
                {["Aposentadoria", "Pensão", "BPC/LOAS", "Outros"].map(source => {
                  const curr = Array.isArray(formData.incomeSource)
                    ? formData.incomeSource
                    : formData.incomeSource
                      ? [formData.incomeSource]
                      : [];
                  const isSelected = curr.includes(source);
                  return (
                    <div key={source} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`incomeSource_${source}`}
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, incomeSource: [...curr, source] });
                          } else {
                            setFormData({ ...formData, incomeSource: curr.filter((s: string) => s !== source) });
                          }
                        }}
                        className="w-4 h-4 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
                      />
                      <label htmlFor={`incomeSource_${source}`} className="text-xs font-bold text-gray-700 cursor-pointer">{source}</label>
                    </div>
                  );
                })}
              </div>
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
              <FormField 
                label="Ocupação do Residente" 
                name="room" 
                type="select" 
                options={Array.from({ length: 100 }, (_, i) => `Q${(i + 1).toString().padStart(2, '0')}`)}
                value={formData.room} 
                onChange={handleChange} 
                placeholder="Selecione o Quarto" 
              />
              <FormField 
                label="Número do Leito" 
                name="bedNumber" 
                type="select"
                options={['L01', 'L02', 'L03', 'L04', 'L05', 'L06']}
                value={formData.bedNumber} 
                onChange={handleChange} 
                placeholder="Selecione o Leito" 
              />
              <FormField label="Rendimento" name="income" value={formData.income} onChange={handleChange} />
              
              <FormField label="Motivo do Acolhimento" name="admissionReason" value={formData.admissionReason} onChange={handleChange} />
              <FormField label="Grupo do Residente" name="residentGroup" value={formData.residentGroup} onChange={handleChange} />
              <FormField label="Grau de Dependência" name="dependencyLevel" type="select" options={['Grau I', 'Grau II', 'Grau III']} value={formData.dependencyLevel} onChange={handleChange} />
              
              <div className="md:col-span-4 mt-4">
                <label className="text-[10px] font-black uppercase text-gray-400 mb-3 block border-b pb-2">Necessidades de Auxílio (Rotinas Comuns)</label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox" id="bathAssistance"
                      checked={formData.careNeeds?.bathAssistance || false}
                      onChange={(e) => setFormData({ ...formData, careNeeds: { ...(formData.careNeeds || {}), bathAssistance: e.target.checked } })}
                      className="w-4 h-4 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
                    />
                    <label htmlFor="bathAssistance" className="text-xs font-bold text-gray-700 cursor-pointer">Banho</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox" id="oralHygieneAssistance"
                      checked={formData.careNeeds?.oralHygieneAssistance || false}
                      onChange={(e) => setFormData({ ...formData, careNeeds: { ...(formData.careNeeds || {}), oralHygieneAssistance: e.target.checked } })}
                      className="w-4 h-4 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
                    />
                    <label htmlFor="oralHygieneAssistance" className="text-xs font-bold text-gray-700 cursor-pointer">Higiene Oral</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox" id="feedingAssistance"
                      checked={formData.careNeeds?.feedingAssistance || false}
                      onChange={(e) => setFormData({ ...formData, careNeeds: { ...(formData.careNeeds || {}), feedingAssistance: e.target.checked } })}
                      className="w-4 h-4 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
                    />
                    <label htmlFor="feedingAssistance" className="text-xs font-bold text-gray-700 cursor-pointer">Necessita acompanhamento na alimentação?</label>
                  </div>
                  {formData.careNeeds?.feedingAssistance && (
                    <div className="mt-2 ml-6">
                      <label className="block text-xs font-bold text-gray-500 mb-1">Observações de alimentação</label>
                      <input 
                        type="text"
                        value={formData.careNeeds?.observacoesAlimentacao || ''}
                        onChange={(e) => setFormData({ ...formData, careNeeds: { ...(formData.careNeeds || {}), observacoesAlimentacao: e.target.value } })}
                        placeholder="Ex: Precisa de dieta pastosa, recusa carne..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox" id="diaperChangeAssistance"
                      checked={formData.careNeeds?.diaperChangeAssistance || false}
                      onChange={(e) => setFormData({ ...formData, careNeeds: { ...(formData.careNeeds || {}), diaperChangeAssistance: e.target.checked } })}
                      className="w-4 h-4 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
                    />
                    <label htmlFor="diaperChangeAssistance" className="text-xs font-bold text-gray-700 cursor-pointer">Troca de Fraldas</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox" id="decubitusChangeAssistance"
                      checked={formData.careNeeds?.decubitusChangeAssistance || false}
                      onChange={(e) => setFormData({ ...formData, careNeeds: { ...(formData.careNeeds || {}), decubitusChangeAssistance: e.target.checked } })}
                      className="w-4 h-4 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
                    />
                    <label htmlFor="decubitusChangeAssistance" className="text-xs font-bold text-gray-700 cursor-pointer">M. de Decúbito</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox" id="tricotomyAssistance"
                      checked={formData.careNeeds?.tricotomyAssistance || false}
                      onChange={(e) => setFormData({ ...formData, careNeeds: { ...(formData.careNeeds || {}), tricotomyAssistance: e.target.checked } })}
                      className="w-4 h-4 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
                    />
                    <label htmlFor="tricotomyAssistance" className="text-xs font-bold text-gray-700 cursor-pointer">Tricotomia / Barba</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox" id="nailCareAssistance"
                      checked={formData.careNeeds?.nailCareAssistance || false}
                      onChange={(e) => setFormData({ ...formData, careNeeds: { ...(formData.careNeeds || {}), nailCareAssistance: e.target.checked } })}
                      className="w-4 h-4 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
                    />
                    <label htmlFor="nailCareAssistance" className="text-xs font-bold text-gray-700 cursor-pointer">Corte de Unhas</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox" id="woundCareAssistance"
                      checked={formData.careNeeds?.woundCareAssistance || false}
                      onChange={(e) => setFormData({ ...formData, careNeeds: { ...(formData.careNeeds || {}), woundCareAssistance: e.target.checked } })}
                      className="w-4 h-4 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
                    />
                    <label htmlFor="woundCareAssistance" className="text-xs font-bold text-gray-700 cursor-pointer">Curativos</label>
                  </div>
                </div>
              </div>
              
              <FormField label="Nome da Instituição Anterior" name="previousInstitution" value={formData.previousInstitution} onChange={handleChange} />
              <FormField label="Tempo de Estadia" name="stayTime" value={formData.stayTime} onChange={handleChange} />
              <FormField label="Motivo da Troca" name="changeReason" value={formData.changeReason} onChange={handleChange} />
            </div>
          </div>
        )}

        {activeTab === 'familiares-visitantes' && (
          <div className="p-8 animate-in slide-in-from-right duration-300 space-y-12">
            <section>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight mb-1">Contexto de Moradia / Procedência</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-4">Informação social anterior ao acolhimento</p>
                <FormField
                  label="Com quem residia antes do acolhimento?"
                  name="interview-resides-with"
                  type="select"
                  value={formData.interview?.residesWith || ''}
                  onChange={(e) => updateResidesWith(e.target.value)}
                  options={["Sozinho", "Filhos", "Familiares", "Instituição de acolhimento / clínica", "Outros"]}
                />
              </div>
            </section>

            <section>
              <div className="flex justify-between items-center mb-8">
                 <div>
                    <h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter">1. Cadastro de Familiares e Contatos</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Gerencie os vínculos permanentes e responsáveis legais.</p>
                 </div>
                 <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={handleGenerateFamiliaresPdf} className="flex items-center gap-2 text-xs font-black text-[#004c99] border-2 border-[#004c99] hover:bg-blue-50 px-5 py-3 rounded-xl uppercase">
                      <Printer size={16} /> GERAR CADASTRO PDF
                    </button>
                    <button type="button" onClick={addRelative} className="flex items-center gap-2 text-xs font-black text-white bg-[#004c99] hover:bg-blue-800 px-6 py-3 rounded-xl transition-all shadow-lg uppercase">
                      <Plus size={18} /> ADICIONAR FAMILIAR
                    </button>
                  </div>
              </div>
              <div className="grid grid-cols-1 gap-6">
                 {formData.relatives.map((rel) => (
                   <div key={rel.id} className={`relative p-8 border rounded-2xl transition-all shadow-sm ${rel.deceased ? 'border-gray-300 bg-gray-50' : rel.isResponsible ? 'border-[#004c99] bg-blue-50/30 ring-2 ring-blue-100' : 'border-gray-200 bg-white'}`}>
                      {rel.isResponsible && !rel.deceased && <div className="absolute -top-3 left-8 bg-[#004c99] text-white text-[10px] font-black uppercase px-4 py-1.5 rounded-full flex items-center gap-2 shadow-md"><ShieldCheck size={14} /> Contato Responsável</div>}
                      {rel.deceased && <div className="absolute -top-3 left-8 bg-gray-600 text-white text-[10px] font-black uppercase px-4 py-1.5 rounded-full shadow-md">Falecido</div>}
                      <div className="flex flex-col md:flex-row gap-8">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6">
                          <FormField label="Nome Completo" name={`rel-name-${rel.id}`} value={rel.name} onChange={(e) => handleRelativeChange(rel.id, 'name', e.target.value)} />
                          <FormField label="Vínculo" name={`rel-kinship-${rel.id}`} value={rel.kinship} onChange={(e) => handleRelativeChange(rel.id, 'kinship', e.target.value)} />
                          <FormField label="Telefone" name={`rel-phone-${rel.id}`} value={rel.phone} onChange={(e) => handleRelativeChange(rel.id, 'phone', e.target.value)} />
                          <div className="space-y-1">
                            <span className="block text-[10px] font-black text-gray-500 uppercase tracking-tighter">Situação</span>
                            <label className="h-[38px] px-3 border border-gray-300 rounded-lg bg-white flex items-center gap-2 text-xs font-black uppercase text-gray-600">
                              <input
                                type="checkbox"
                                checked={Boolean(rel.deceased)}
                                onChange={(e) => handleRelativeChange(rel.id, 'deceased', e.target.checked)}
                                className="w-4 h-4 rounded text-[#004c99]"
                              />
                              Falecido
                            </label>
                          </div>
                        </div>
                        <div className="flex flex-row md:flex-col gap-3 justify-center">
                           {!rel.isResponsible && !rel.deceased && (
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
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <label className="block text-[9px] font-black uppercase text-gray-400 mb-1">Data inicial</label>
                      <input type="date" value={visitDateFrom} onChange={(e) => setVisitDateFrom(e.target.value)} className="border rounded-lg px-2 py-2 text-xs" />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black uppercase text-gray-400 mb-1">Data final</label>
                      <input type="date" value={visitDateTo} onChange={(e) => setVisitDateTo(e.target.value)} className="border rounded-lg px-2 py-2 text-xs" />
                    </div>
                    <button type="button" onClick={handleGenerateVisitasPdf} className="flex items-center gap-2 text-xs font-black text-[#004c99] bg-white border-2 border-[#004c99] hover:bg-blue-50 px-4 py-2.5 rounded-xl uppercase">
                      <Printer size={16} /> GERAR RELAÇÃO PDF
                    </button>
                    <button type="button" onClick={addVisitRecord} className="flex items-center gap-2 text-xs font-black text-[#004c99] bg-white border-2 border-[#004c99] hover:bg-blue-50 px-4 py-2.5 rounded-xl transition-all shadow-md uppercase">
                      <LogIn size={18} /> REGISTRAR ENTRADA
                    </button>
                  </div>
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
          <div className="p-8 animate-in slide-in-from-right duration-300 space-y-8">
            {/* Top Cards: Saldo Inicial, Resumo e Saldo Atual */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               {/* Card 1: Saldo Inicial */}
               <div className="bg-white p-6 rounded-3xl border-2 border-blue-100 shadow-md flex flex-col justify-between relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                     <span className="text-[10px] uppercase font-black text-gray-500 tracking-wider">Saldo Inicial (R$)</span>
                     <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md">Valor de Origem</span>
                  </div>
                  <div>
                     <input
                        type="number"
                        step="0.01"
                        value={formData.initialBalance !== undefined ? formData.initialBalance : ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, initialBalance: parseFloat(e.target.value) || 0 }))}
                        placeholder="0,00"
                        className="w-full text-2xl font-black text-gray-800 bg-gray-50 border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:border-[#004c99] focus:bg-white transition-all"
                     />
                  </div>
                  <p className="text-[10px] text-gray-400 font-semibold mt-2">
                     Saldo anterior trazido do acolhimento/prontuário do idoso.
                  </p>
               </div>

               {/* Card 2: Entradas vs Saídas */}
               <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-md flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-black text-gray-500 tracking-wider block mb-2">Movimentações Lançadas</span>
                  <div className="space-y-2">
                     <div className="flex items-center justify-between text-xs font-bold text-emerald-700 bg-emerald-50/80 p-2 rounded-xl">
                        <span>Total Entradas:</span>
                        <span>+ R$ {entriesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                     </div>
                     <div className="flex items-center justify-between text-xs font-bold text-red-700 bg-red-50/80 p-2 rounded-xl">
                        <span>Total Saídas:</span>
                        <span>- R$ {exitsTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                     </div>
                  </div>
               </div>

               {/* Card 3: Saldo Atual Geral */}
               <div className="bg-gradient-to-br from-[#004c99] to-blue-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute -right-6 -top-6 text-white opacity-10 transform rotate-12"><DollarSign size={130} /></div>
                  <div>
                     <span className="text-[10px] uppercase font-black opacity-80 tracking-widest block">Saldo Atual em Caixa</span>
                     <div className="text-3xl font-black mt-1 tracking-tighter">
                        R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                     </div>
                  </div>
                  <div className="text-[10px] font-bold opacity-80 mt-2">
                     Fórmula: Saldo Inicial + Entradas - Saídas
                  </div>
               </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col xl:flex-row items-end xl:items-center justify-between gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-150">
                <div className="flex flex-wrap items-end gap-3 w-full xl:w-auto">
                  <div>
                    <label className="block text-[9px] font-black uppercase text-gray-400 mb-1">Data inicial</label>
                    <input type="date" value={financeDateFrom} onChange={(e) => setFinanceDateFrom(e.target.value)} className="border rounded-lg px-2 py-2 text-xs bg-white" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase text-gray-400 mb-1">Data final</label>
                    <input type="date" value={financeDateTo} onChange={(e) => setFinanceDateTo(e.target.value)} className="border rounded-lg px-2 py-2 text-xs bg-white" />
                  </div>
                  <button type="button" onClick={handleGenerateFinancePdf} className="px-4 py-2.5 border-2 border-[#004c99] text-[#004c99] rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-blue-50 bg-white">
                    <Printer size={15} /> Gerar Extrato PDF
                  </button>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button type="button" onClick={() => addFinancial('entrada')} className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all">
                    <TrendingUp size={16} />
                    <span>+ Nova Entrada</span>
                  </button>
                  <button type="button" onClick={() => addFinancial('saída')} className="flex-1 sm:flex-initial bg-red-600 hover:bg-red-700 text-white rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all">
                    <TrendingDown size={16} />
                    <span>- Nova Saída</span>
                  </button>
                </div>
             </div>

             {/* High Contrast Zebrado Table */}
            <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-xl overflow-hidden">
               <div className="bg-[#004c99] text-white px-6 py-3.5 flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider">
                     Extrato de Lançamentos Financeiros do Idoso
                  </h4>
                  <span className="text-[10px] font-bold bg-white/20 px-2.5 py-1 rounded-md">
                     {formData.financials.length} registro(s)
                  </span>
               </div>

               <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-100 text-[10px] font-black uppercase text-gray-700 tracking-wider border-b-2 border-gray-300">
                     <tr>
                        <th className="px-6 py-4">Data</th>
                        <th className="px-6 py-4">Tipo</th>
                        <th className="px-6 py-4">Descrição / Histórico</th>
                        <th className="px-6 py-4 text-right">Valor (R$)</th>
                        <th className="px-6 py-4 text-center">Ações</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                     {formData.financials.length === 0 ? (
                        <tr>
                           <td colSpan={5} className="px-6 py-8 text-center text-xs font-bold text-gray-400 uppercase">
                              Nenhuma movimentação registrada. Utilize os botões acima para lançar uma entrada ou saída.
                           </td>
                        </tr>
                     ) : (
                        formData.financials.map((fin, index) => {
                           // High-contrast zebrado: alternating between white and clean soft-blue background (#e6f0fa)
                           const isEven = index % 2 === 0;
                           return (
                              <tr 
                                 key={fin.id} 
                                 className={`${isEven ? 'bg-white' : 'bg-[#e6f0fa]'} hover:bg-blue-100/80 transition-colors border-b border-gray-200/80`}
                              >
                                 <td className="px-6 py-3.5">
                                    <input 
                                       type="date" 
                                       value={fin.date} 
                                       onChange={(e) => updateListField('financials', fin.id, 'date', e.target.value)} 
                                       className="bg-transparent text-xs font-extrabold text-gray-800 focus:outline-none focus:bg-white/80 rounded px-1.5 py-1 border border-transparent hover:border-gray-300" 
                                    />
                                 </td>
                                 <td className="px-6 py-3.5">
                                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md inline-block ${
                                       fin.type === 'entrada' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-800 border border-red-300'
                                    }`}>
                                       {fin.type === 'entrada' ? 'Entrada' : 'Saída'}
                                    </span>
                                 </td>
                                 <td className="px-6 py-3.5">
                                    <input 
                                       type="text" 
                                       value={fin.description} 
                                       onChange={(e) => updateListField('financials', fin.id, 'description', e.target.value)} 
                                       placeholder="Descrição da movimentação..."
                                       className="bg-transparent text-xs font-semibold text-gray-800 w-full focus:outline-none focus:bg-white/80 rounded px-2 py-1 border border-transparent hover:border-gray-300" 
                                    />
                                 </td>
                                 <td className="px-6 py-3.5 text-right">
                                    <input 
                                       type="number" 
                                       step="0.01" 
                                       value={fin.amount} 
                                       onChange={(e) => updateListField('financials', fin.id, 'amount', e.target.value)} 
                                       className={`bg-transparent text-xs w-28 text-right focus:outline-none focus:bg-white/80 rounded px-2 py-1 border border-transparent hover:border-gray-300 font-black ${
                                          fin.type === 'entrada' ? 'text-emerald-700' : 'text-red-700'
                                       }`} 
                                    />
                                 </td>
                                 <td className="px-6 py-3.5 text-center">
                                    <button 
                                       type="button" 
                                       onClick={() => removeFromList('financials', fin.id)} 
                                       className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100/80 rounded-lg transition-colors"
                                       title="Excluir movimentação"
                                    >
                                       <Trash2 size={16} />
                                    </button>
                                 </td>
                              </tr>
                           );
                        })
                     )}
                  </tbody>
               </table>
            </div>
          </div>
        )}

         {activeTab === 'itens' && (
          <div className="p-8 animate-in slide-in-from-right duration-300">
             <div className="flex justify-between items-center mb-10">
                 <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Itens Pessoais</h3>
                 <button type="button" onClick={handleGenerateItemsPdf} className="px-4 py-2.5 border-2 border-[#004c99] text-[#004c99] rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-blue-50">
                   <Printer size={15} /> Gerar Relação PDF
                 </button>
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

        {activeTab === 'prontuario' && (
          loadingProntuario && !prontuarioResident ? (
            <div className="p-8 text-sm font-bold text-gray-500">Carregando prontuário multidisciplinar...</div>
          ) : (
            <ProntuarioTab resident={prontuarioResident || formData} settings={settings} />
          )
        )}

        {activeTab === 'prontuario-medico' && (
          <PerTab 
            resident={formData} 
            onUpdatePer={(newPer) => setFormData({ ...formData, per: newPer })} 
            settings={settings}
          />
        )}

        {activeTab === 'intercorrencias' && (
          <IntercurrenceHistoryTab 
              resident={formData} 
              settings={settings}
              onUpdateIncidents={(newIncidents) => setFormData({...formData, incidents: newIncidents})}
          />
        )}

        {activeTab === 'medicamentos' && (
          <MedicationTab 
            resident={formData}
            onUpdateMedications={(newMeds) => setFormData({ ...formData, medications: newMeds })}
            settings={settings}
          />
        )}

        {activeTab === 'pia' && (
          <PiaTab 
            resident={formData} 
            onChange={(newPia) => setFormData({ ...formData, pia: newPia })} 
            settings={settings}
          />
        )}

      </form>

      {croppingImage && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl"
          >
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-sm font-black uppercase text-gray-700">Ajustar Foto</h3>
              <button type="button" onClick={() => setCroppingImage(null)} className="p-2 hover:bg-gray-200 rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div 
                className="aspect-square w-64 h-64 mx-auto bg-gray-200 rounded-xl relative overflow-hidden cursor-move border-4 border-white shadow-inner"
                onMouseDown={(e) => {
                  setIsDrag(true);
                  setStartPos({ x: e.clientX - offset.x, y: e.clientY - offset.y });
                }}
                onMouseMove={(e) => {
                  if (isDrag) {
                    setOffset({
                      x: e.clientX - startPos.x,
                      y: e.clientY - startPos.y
                    });
                  }
                }}
                onMouseUp={() => setIsDrag(false)}
                onMouseLeave={() => setIsDrag(false)}
                onTouchStart={(e) => {
                  setIsDrag(true);
                  const touch = e.touches[0];
                  setStartPos({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
                }}
                onTouchMove={(e) => {
                  if (isDrag) {
                    const touch = e.touches[0];
                    setOffset({
                      x: touch.clientX - startPos.x,
                      y: touch.clientY - startPos.y
                    });
                  }
                }}
                onTouchEnd={() => setIsDrag(false)}
              >
                <img 
                  src={croppingImage} 
                  alt="Ajuste" 
                  className="absolute pointer-events-none"
                  style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                    maxWidth: 'none',
                    height: '100%',
                    left: '50%',
                    top: '50%',
                    marginLeft: '-50%',
                    marginTop: '-50%',
                    objectFit: 'contain'
                  }}
                />
                {/* Circular indicator to show center */}
                <div className="absolute inset-0 border-4 border-[#004c99]/20 rounded-xl pointer-events-none"></div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase text-gray-500">
                  <span>Zoom</span>
                  <span>{Math.round(zoom * 100)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0.5" 
                  max="3" 
                  step="0.01" 
                  value={zoom} 
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#004c99]"
                />
                <p className="text-[10px] text-gray-400 text-center uppercase mt-2 italic">Dica: Clique e arraste a foto para posicionar</p>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button type="button" 
                onClick={() => setCroppingImage(null)}
                className="flex-1 py-3 text-[10px] font-black uppercase text-gray-500 hover:bg-gray-200 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button type="button" 
                onClick={handleCropSave}
                className="flex-1 py-3 text-[10px] font-black uppercase bg-[#004c99] text-white rounded-xl shadow-lg hover:bg-[#003366] transition-all"
              >
                Confirmar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ElderlyForm;
