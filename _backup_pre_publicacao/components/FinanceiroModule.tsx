import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, 
  Users, 
  Tag, 
  FileText, 
  Plus, 
  Edit, 
  Trash2, 
  Calendar, 
  Search, 
  Filter, 
  TrendingUp, 
  PiggyBank, 
  Phone, 
  Mail, 
  Briefcase, 
  CreditCard,
  Download,
  Printer,
  ChevronRight,
  ChevronLeft,
  SlidersHorizontal,
  ArrowUpDown,
  RefreshCw,
  Info,
  BookOpen,
  Receipt,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Check,
  CalendarCheck,
  MessageSquare,
  Send,
  Copy,
  ExternalLink,
  HeartHandshake,
  Wallet,
  Landmark,
  ArrowDownRight,
  ArrowUpRight,
  Coins,
  Wrench,
  Utensils,
  ShoppingCart,
  Sparkles,
  X
} from 'lucide-react';
import { 
  fetchBenefactors, 
  saveBenefactor, 
  deleteBenefactor, 
  fetchDonationCategories, 
  saveDonationCategory, 
  deleteDonationCategory, 
  fetchDonations, 
  saveDonation, 
  deleteDonation,
  fetchCarnes,
  saveCarne,
  payCarneParcelas,
  deleteCarne,
  logCarneWhatsApp,
  fetchCaixinhaMovements,
  saveCaixinhaMovement,
  deleteCaixinhaMovement
} from '../lib/api';
import { 
  Benefactor, 
  DonationCategory, 
  FinanceDonation, 
  Carne, 
  CarneParcela, 
  CarneWhatsAppLog,
  CaixinhaMovement,
  CaixinhaCategory,
  CaixinhaMovementType
} from '../types';
import { getHtmlPrintHeader, getHtmlPrintFooter, getHtmlPrintStyles, printHtml } from '../lib/pdfHelpers';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

interface FinanceiroModuleProps {
  session: any;
  settings: any;
}

type TabType = 'donations' | 'carnes' | 'caixinha' | 'benefactors' | 'categories' | 'reports';

export const FinanceiroModule: React.FC<FinanceiroModuleProps> = ({ session, settings }) => {
  const [activeTab, setActiveTab] = useState<TabType>('donations');
  const [loading, setLoading] = useState(true);

  // Data States
  const [donations, setDonations] = useState<FinanceDonation[]>([]);
  const [benefactors, setBenefactors] = useState<Benefactor[]>([]);
  const [categories, setCategories] = useState<DonationCategory[]>([]);
  const [carnes, setCarnes] = useState<Carne[]>([]);
  const [caixinhaMovements, setCaixinhaMovements] = useState<CaixinhaMovement[]>([]);

  // Search/Filters
  const [donationSearch, setDonationSearch] = useState('');
  const [benefactorSearch, setBenefactorSearch] = useState('');
  const [carneSearch, setCarneSearch] = useState('');
  const [carneStatusFilter, setCarneStatusFilter] = useState<'todos' | 'em_dia' | 'em_atraso' | 'quitado' | 'cancelado' | 'ativo'>('todos');
  const [carneYearFilter, setCarneYearFilter] = useState<number>(0);
  const [carneSortBy, setCarneSortBy] = useState<'nome' | 'vencimento' | 'pendente' | 'status'>('nome');
  const [carnePage, setCarnePage] = useState<number>(1);
  const carnePerPage = 20;
  const [selectedCarneForDetails, setSelectedCarneForDetails] = useState<Carne | null>(null);
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState('Todas');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('Todas');

  // Caixinha Filters
  const [caixinhaStartDate, setCaixinhaStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // 1st of current month
    return d.toISOString().split('T')[0];
  });
  const [caixinhaEndDate, setCaixinhaEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [caixinhaTypeFilter, setCaixinhaTypeFilter] = useState<'todos' | 'entrada' | 'saida'>('todos');
  const [caixinhaCategoryFilter, setCaixinhaCategoryFilter] = useState<string>('todas');
  const [caixinhaSearch, setCaixinhaSearch] = useState<string>('');

  // Caixinha Form State
  const [showCaixinhaForm, setShowCaixinhaForm] = useState(false);
  const [editingCaixinhaMovement, setEditingCaixinhaMovement] = useState<CaixinhaMovement | null>(null);
  const [caixinhaForm, setCaixinhaForm] = useState<{
    type: CaixinhaMovementType;
    category: CaixinhaCategory;
    description: string;
    value: string;
    date: string;
    responsible: string;
    receiptNumber: string;
    notes: string;
  }>({
    type: 'saida',
    category: 'servico_sem_nota',
    description: '',
    value: '',
    date: new Date().toISOString().split('T')[0],
    responsible: '',
    receiptNumber: '',
    notes: ''
  });

  // Report Filters
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [reportCategory, setReportCategory] = useState('Todas');
  const [reportBenefactor, setReportBenefactor] = useState('Todos');

  // Form States (Modal-like or expandable)
  const [showDonationForm, setShowDonationForm] = useState(false);
  const [editingDonation, setEditingDonation] = useState<FinanceDonation | null>(null);
  const [donationForm, setDonationForm] = useState({
    benefactorId: '',
    categoryId: '',
    value: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'PIX',
    campaign: 'Doação Espontânea',
    notes: ''
  });

  const [showBenefactorForm, setShowBenefactorForm] = useState(false);
  const [editingBenefactor, setEditingBenefactor] = useState<Benefactor | null>(null);
  const [benefactorForm, setBenefactorForm] = useState({
    name: '',
    type: 'pf' as 'pf' | 'pj',
    cpfCnpj: '',
    phone: '',
    email: '',
    defaultCategory: '',
    notes: ''
  });

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<DonationCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: ''
  });

  // Carnê Form State
  const [showCarneForm, setShowCarneForm] = useState(false);
  const [carneForm, setCarneForm] = useState({
    benefactorId: '',
    ano: new Date().getFullYear(),
    valorParcela: '',
    categoryId: '',
    notes: ''
  });

  // Carnê Baixa Modal State
  const [selectedCarneForBaixa, setSelectedCarneForBaixa] = useState<Carne | null>(null);
  const [selectedParcelasNumbers, setSelectedParcelasNumbers] = useState<number[]>([]);
  const [baixaForm, setBaixaForm] = useState({
    dataPagamento: new Date().toISOString().split('T')[0],
    formaPagamento: 'PIX',
    notes: ''
  });
  const [isSubmittingBaixa, setIsSubmittingBaixa] = useState(false);

  // WhatsApp Modal State
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppCarne, setWhatsAppCarne] = useState<Carne | null>(null);
  const [whatsAppBenefactor, setWhatsAppBenefactor] = useState<Benefactor | null>(null);
  const [whatsAppType, setWhatsAppType] = useState<'agradecimento' | 'lembrete'>('lembrete');
  const [whatsAppSelectedParcelaNum, setWhatsAppSelectedParcelaNum] = useState<number>(1);
  const [whatsAppCustomText, setWhatsAppCustomText] = useState<string>('');
  const [whatsAppCopied, setWhatsAppCopied] = useState<boolean>(false);
  const [isLoggingWhatsApp, setIsLoggingWhatsApp] = useState<boolean>(false);

  // Helper formatting for phone numbers
  const formatPhoneNumber = (rawPhone?: string) => {
    if (!rawPhone) return '';
    const digits = rawPhone.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 10 || digits.length === 11) {
      return '55' + digits;
    }
    return digits;
  };

  const getDisplayPhone = (rawPhone?: string) => {
    if (!rawPhone) return 'Não cadastrado';
    const digits = rawPhone.replace(/\D/g, '');
    if (!digits) return 'Não cadastrado';
    
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    } else if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 13 && digits.startsWith('55')) {
      return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    } else if (digits.length === 12 && digits.startsWith('55')) {
      return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
    }
    return rawPhone;
  };

  const generateWhatsAppText = (carne: Carne, bName: string, type: 'agradecimento' | 'lembrete', pNum: number) => {
    const p = (carne.parcelas || []).find(item => item.numero === pNum) || carne.parcelas?.[0];
    const valor = p ? (Number(p.valor) || Number(carne.valorParcela) || 0) : Number(carne.valorParcela) || 0;
    const valorFormatted = `R$ ${valor.toFixed(2).replace('.', ',')}`;
    const dateFormatted = p && p.dataPagamento ? new Date(p.dataPagamento + 'T12:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
    const mesRef = p ? p.mesReferencia : `Folha ${pNum}/${carne.ano}`;

    if (type === 'agradecimento') {
      return `Olá, ${bName}. O Lar São Vicente de Paulo agradece carinhosamente por sua contribuição de ${valorFormatted}, recebida em ${dateFormatted}. Seu gesto voluntário é muito importante para a continuidade do nosso trabalho. Que Deus lhe abençoe!`;
    } else {
      return `Olá, ${bName}. Passamos para lembrar, com carinho, sobre a contribuição voluntária do carnê do Lar São Vicente de Paulo, referente a ${mesRef}. Caso deseje e possa contribuir, seu apoio será muito bem-vindo. Esta mensagem é apenas um lembrete, não se trata de cobrança. Agradecemos por caminhar conosco!`;
    }
  };

  const handleOpenWhatsAppModal = (carne: Carne, initialType: 'agradecimento' | 'lembrete' = 'lembrete') => {
    setWhatsAppCarne(carne);
    
    // Find benefactor from list
    const b = benefactors.find(x => x.id === carne.benefactorId || x.name.trim().toLowerCase() === carne.benefactorName.trim().toLowerCase());
    setWhatsAppBenefactor(b || { name: carne.benefactorName, type: 'pf' });

    const paidList = (carne.parcelas || []).filter(p => p.pago);
    const unpaidList = (carne.parcelas || []).filter(p => !p.pago);

    let type = initialType;
    if (type === 'agradecimento' && paidList.length === 0) {
      type = 'lembrete';
    } else if (type === 'lembrete' && unpaidList.length === 0) {
      type = 'agradecimento';
    }
    setWhatsAppType(type);

    let initNum = 1;
    if (type === 'agradecimento' && paidList.length > 0) {
      initNum = paidList[paidList.length - 1].numero;
    } else if (type === 'lembrete' && unpaidList.length > 0) {
      initNum = unpaidList[0].numero;
    } else if (carne.parcelas && carne.parcelas.length > 0) {
      initNum = carne.parcelas[0].numero;
    }
    setWhatsAppSelectedParcelaNum(initNum);

    const bName = b?.name || carne.benefactorName;
    const initialText = generateWhatsAppText(carne, bName, type, initNum);
    setWhatsAppCustomText(initialText);
    setWhatsAppCopied(false);
    setShowWhatsAppModal(true);
  };

  const handleTypeChangeInWhatsAppModal = (newType: 'agradecimento' | 'lembrete') => {
    if (!whatsAppCarne) return;
    setWhatsAppType(newType);

    const paidList = (whatsAppCarne.parcelas || []).filter(p => p.pago);
    const unpaidList = (whatsAppCarne.parcelas || []).filter(p => !p.pago);

    let newNum = whatsAppSelectedParcelaNum;
    if (newType === 'agradecimento' && paidList.length > 0) {
      if (!paidList.some(p => p.numero === newNum)) {
        newNum = paidList[paidList.length - 1].numero;
      }
    } else if (newType === 'lembrete' && unpaidList.length > 0) {
      if (!unpaidList.some(p => p.numero === newNum)) {
        newNum = unpaidList[0].numero;
      }
    }
    setWhatsAppSelectedParcelaNum(newNum);

    const bName = whatsAppBenefactor?.name || whatsAppCarne.benefactorName;
    const text = generateWhatsAppText(whatsAppCarne, bName, newType, newNum);
    setWhatsAppCustomText(text);
  };

  const handleParcelaChangeInWhatsAppModal = (newNum: number) => {
    if (!whatsAppCarne) return;
    setWhatsAppSelectedParcelaNum(newNum);
    const bName = whatsAppBenefactor?.name || whatsAppCarne.benefactorName;
    const text = generateWhatsAppText(whatsAppCarne, bName, whatsAppType, newNum);
    setWhatsAppCustomText(text);
  };

  const handleSendWhatsAppMessage = async () => {
    if (!whatsAppCarne || !whatsAppBenefactor) return;

    const rawPhone = whatsAppBenefactor.phone;
    const cleanPhone = formatPhoneNumber(rawPhone);

    if (!cleanPhone || cleanPhone.length < 10) {
      alert('Atenção: O benfeitor não possui um número de telefone válido cadastrado.');
      return;
    }

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsAppCustomText)}`;
    
    // Open WhatsApp
    window.open(waUrl, '_blank');

    // Register log in backend
    setIsLoggingWhatsApp(true);
    try {
      if (whatsAppCarne.id) {
        await logCarneWhatsApp(whatsAppCarne.id, {
          messageType: whatsAppType,
          parcelaNumero: whatsAppSelectedParcelaNum,
          textPreview: whatsAppCustomText,
          phone: cleanPhone
        });
        await loadModuleData();
      }
    } catch (error) {
      console.error('Error logging WhatsApp message:', error);
    } finally {
      setIsLoggingWhatsApp(false);
    }
  };

  const campaigns = ['Doação Espontânea', 'Telemarketing', 'Mensalidade', 'Campanha de Natal', 'Outros'];
  const paymentMethods = ['PIX', 'Dinheiro', 'Transferência Bancária', 'Boleto', 'Cartão de Crédito', 'Cartão de Débito', 'Outros'];

  // Load Data
  const loadModuleData = async () => {
    setLoading(true);
    try {
      const [donationsData, benefactorsData, categoriesData, carnesData, caixinhaData] = await Promise.all([
        fetchDonations().catch(() => []),
        fetchBenefactors().catch(() => []),
        fetchDonationCategories().catch(() => []),
        fetchCarnes().catch(() => []),
        fetchCaixinhaMovements().catch(() => [])
      ]);
      setDonations(donationsData);
      setBenefactors(benefactorsData);
      setCategories(categoriesData);
      setCarnes(carnesData);
      setCaixinhaMovements(caixinhaData);

      // Sync selectedCarneForDetails if open
      if (selectedCarneForDetails) {
        const updated = carnesData.find((c: Carne) => c.id === selectedCarneForDetails.id);
        if (updated) setSelectedCarneForDetails(updated);
      }
    } catch (error) {
      console.error('Error loading finance module data:', error);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadModuleData();
  }, [session?.institutionId]);

  // Operations: Donation
  const handleSaveDonationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!donationForm.categoryId) {
      alert('Selecione uma categoria de doação.');
      return;
    }
    const valFloat = parseFloat(donationForm.value);
    if (isNaN(valFloat) || valFloat <= 0) {
      alert('Informe um valor de doação válido maior que zero.');
      return;
    }

    const selectedCategory = categories.find(c => c.id === donationForm.categoryId);
    const selectedBenefactor = benefactors.find(b => b.id === donationForm.benefactorId);

    const donationData: FinanceDonation = {
      id: editingDonation?.id,
      benefactorId: donationForm.benefactorId || undefined,
      benefactorName: selectedBenefactor ? selectedBenefactor.name : 'Doação Anônima / Geral',
      categoryId: donationForm.categoryId,
      categoryName: selectedCategory ? selectedCategory.name : 'Não categorizada',
      value: valFloat,
      date: donationForm.date,
      paymentMethod: donationForm.paymentMethod,
      campaign: donationForm.campaign,
      notes: donationForm.notes,
      institutionId: session?.institutionId || session?.cnpj
    };

    try {
      await saveDonation(donationData);
      setShowDonationForm(false);
      setEditingDonation(null);
      setDonationForm({
        benefactorId: '',
        categoryId: '',
        value: '',
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'PIX',
        campaign: 'Doação Espontânea',
        notes: ''
      });
      loadModuleData();
    } catch (err) {
      alert('Erro ao salvar doação.');
    }
  };

  const handleEditDonationClick = (item: FinanceDonation) => {
    setEditingDonation(item);
    setDonationForm({
      benefactorId: item.benefactorId || '',
      categoryId: item.categoryId || '',
      value: item.value.toString(),
      date: item.date,
      paymentMethod: item.paymentMethod || 'PIX',
      campaign: item.campaign || 'Doação Espontânea',
      notes: item.notes || ''
    });
    setShowDonationForm(true);
  };

  const handleDeleteDonationClick = async (id: string) => {
    if (!window.confirm('Tem certeza de que deseja excluir este registro de doação?')) return;
    try {
      await deleteDonation(id);
      loadModuleData();
    } catch (err) {
      alert('Erro ao excluir doação.');
    }
  };

  // Operations: Benefactor
  const handleSaveBenefactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!benefactorForm.name.trim()) {
      alert('Nome do benfeitor é obrigatório.');
      return;
    }
    const benefactorData: Benefactor = {
      id: editingBenefactor?.id,
      name: benefactorForm.name,
      type: benefactorForm.type,
      cpfCnpj: benefactorForm.cpfCnpj,
      phone: benefactorForm.phone,
      email: benefactorForm.email,
      defaultCategory: benefactorForm.defaultCategory || undefined,
      notes: benefactorForm.notes,
      institutionId: session?.institutionId || session?.cnpj
    };

    try {
      await saveBenefactor(benefactorData);
      setShowBenefactorForm(false);
      setEditingBenefactor(null);
      setBenefactorForm({
        name: '',
        type: 'pf',
        cpfCnpj: '',
        phone: '',
        email: '',
        defaultCategory: '',
        notes: ''
      });
      loadModuleData();
    } catch (err) {
      alert('Erro ao salvar benfeitor.');
    }
  };

  const handleEditBenefactorClick = (item: Benefactor) => {
    setEditingBenefactor(item);
    setBenefactorForm({
      name: item.name,
      type: item.type,
      cpfCnpj: item.cpfCnpj || '',
      phone: item.phone || '',
      email: item.email || '',
      defaultCategory: item.defaultCategory || '',
      notes: item.notes || ''
    });
    setShowBenefactorForm(true);
  };

  const handleDeleteBenefactorClick = async (id: string) => {
    if (!window.confirm('Tem certeza de que deseja inativar este benfeitor?')) return;
    try {
      await deleteBenefactor(id);
      loadModuleData();
    } catch (err) {
      alert('Erro ao excluir benfeitor.');
    }
  };

  // Operations: Category
  const handleSaveCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      alert('Nome da categoria é obrigatório.');
      return;
    }
    const categoryData: DonationCategory = {
      id: editingCategory?.id,
      name: categoryForm.name,
      description: categoryForm.description,
      institutionId: session?.institutionId || session?.cnpj
    };

    try {
      await saveDonationCategory(categoryData);
      setShowCategoryForm(false);
      setEditingCategory(null);
      setCategoryForm({
        name: '',
        description: ''
      });
      loadModuleData();
    } catch (err) {
      alert('Erro ao salvar categoria.');
    }
  };

  const handleEditCategoryClick = (item: DonationCategory) => {
    setEditingCategory(item);
    setCategoryForm({
      name: item.name,
      description: item.description || ''
    });
    setShowCategoryForm(true);
  };

  const handleDeleteCategoryClick = async (id: string) => {
    if (!window.confirm('Deseja excluir esta categoria? As doações vinculadas a ela mudarão para sem categoria.')) return;
    try {
      await deleteDonationCategory(id);
      loadModuleData();
    } catch (err) {
      alert('Erro ao excluir categoria.');
    }
  };

  // Operations: Carnês
  const handleSaveCarneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carneForm.benefactorId) {
      alert('Selecione um benfeitor para emitir o carnê.');
      return;
    }
    const val = parseFloat(carneForm.valorParcela.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      alert('Informe um valor de parcela válido maior que zero.');
      return;
    }

    const selectedBenefactor = benefactors.find(b => b.id === carneForm.benefactorId);
    const selectedCat = categories.find(c => c.id === carneForm.categoryId);

    const carnePayload: Partial<Carne> = {
      benefactorId: carneForm.benefactorId,
      benefactorName: selectedBenefactor ? selectedBenefactor.name : 'Benfeitor Desconhecido',
      ano: Number(carneForm.ano) || new Date().getFullYear(),
      valorParcela: val,
      totalParcelas: 12,
      categoryId: carneForm.categoryId || selectedBenefactor?.defaultCategory || '',
      categoryName: selectedCat ? selectedCat.name : 'Carnês de mensalidade',
      status: 'ativo',
      notes: carneForm.notes
    };

    try {
      await saveCarne(carnePayload);
      setShowCarneForm(false);
      setCarneForm({
        benefactorId: '',
        ano: new Date().getFullYear(),
        valorParcela: '',
        categoryId: '',
        notes: ''
      });
      loadModuleData();
    } catch (err) {
      alert('Erro ao salvar carnê.');
    }
  };

  const handleOpenBaixaModal = (carne: Carne) => {
    setSelectedCarneForBaixa(carne);
    const firstUnpaid = carne.parcelas.find(p => !p.pago);
    if (firstUnpaid) {
      setSelectedParcelasNumbers([firstUnpaid.numero]);
    } else {
      setSelectedParcelasNumbers([]);
    }
    setBaixaForm({
      dataPagamento: new Date().toISOString().split('T')[0],
      formaPagamento: 'PIX',
      notes: ''
    });
  };

  const handleToggleParcelaSelection = (numero: number, isAlreadyPaid: boolean) => {
    if (isAlreadyPaid) return;
    setSelectedParcelasNumbers(prev => 
      prev.includes(numero) ? prev.filter(n => n !== numero) : [...prev, numero]
    );
  };

  const handleSelectAllUnpaidParcelas = () => {
    if (!selectedCarneForBaixa) return;
    const unpaid = selectedCarneForBaixa.parcelas.filter(p => !p.pago).map(p => p.numero);
    setSelectedParcelasNumbers(unpaid);
  };

  const handleClearParcelaSelection = () => {
    setSelectedParcelasNumbers([]);
  };

  const handleConfirmBaixaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCarneForBaixa || selectedParcelasNumbers.length === 0) {
      alert('Selecione ao menos uma folha/parcela pendente para dar baixa.');
      return;
    }

    setIsSubmittingBaixa(true);
    try {
      await payCarneParcelas(selectedCarneForBaixa.id!, {
        numeros: selectedParcelasNumbers,
        dataPagamento: baixaForm.dataPagamento,
        formaPagamento: baixaForm.formaPagamento,
        notes: baixaForm.notes,
        categoryId: selectedCarneForBaixa.categoryId
      });

      setSelectedCarneForBaixa(null);
      setSelectedParcelasNumbers([]);
      await loadModuleData();
    } catch (err) {
      alert('Erro ao processar baixa de parcelas do carnê.');
    } finally {
      setIsSubmittingBaixa(false);
    }
  };

  const handleCancelCarne = async (id: string) => {
    if (!window.confirm('Tem certeza de que deseja cancelar este carnê? As doações baixadas anteriormente continuarão no histórico financeiro.')) return;
    try {
      await deleteCarne(id);
      loadModuleData();
    } catch (err) {
      alert('Erro ao cancelar carnê.');
    }
  };

  // Operations: Caixinha (Petty Cash)
  const handleOpenNewCaixinhaModal = (defaultType: CaixinhaMovementType = 'saida', defaultCat: CaixinhaCategory = 'servico_sem_nota') => {
    setEditingCaixinhaMovement(null);
    setCaixinhaForm({
      type: defaultType,
      category: defaultCat,
      description: '',
      value: '',
      date: new Date().toISOString().split('T')[0],
      responsible: session?.name || session?.username || '',
      receiptNumber: '',
      notes: ''
    });
    setShowCaixinhaForm(true);
  };

  const handleEditCaixinhaClick = (item: any) => {
    const original = caixinhaMovements.find(m => m.id === item.originalId || m.id === item.id);
    if (!original) return;
    setEditingCaixinhaMovement(original);
    setCaixinhaForm({
      type: original.type,
      category: original.category,
      description: original.description,
      value: original.value.toString(),
      date: original.date,
      responsible: original.responsible || '',
      receiptNumber: original.receiptNumber || '',
      notes: original.notes || ''
    });
    setShowCaixinhaForm(true);
  };

  const handleDeleteCaixinhaClick = async (id: string) => {
    if (!window.confirm('Tem certeza de que deseja excluir este lançamento da caixinha?')) return;
    try {
      await deleteCaixinhaMovement(id);
      loadModuleData();
    } catch (err) {
      alert('Erro ao excluir lançamento da caixinha.');
    }
  };

  const handleSaveCaixinhaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caixinhaForm.description.trim()) {
      alert('Informe a descrição / finalidade do lançamento.');
      return;
    }
    const valFloat = parseFloat(caixinhaForm.value.replace(',', '.'));
    if (isNaN(valFloat) || valFloat <= 0) {
      alert('Informe um valor válido maior que zero.');
      return;
    }

    const payload: CaixinhaMovement = {
      id: editingCaixinhaMovement?.id,
      type: caixinhaForm.type,
      category: caixinhaForm.category,
      description: caixinhaForm.description.trim(),
      value: valFloat,
      date: caixinhaForm.date,
      responsible: caixinhaForm.responsible.trim(),
      receiptNumber: caixinhaForm.receiptNumber.trim(),
      notes: caixinhaForm.notes.trim(),
      institutionId: session?.institutionId || session?.cnpj
    };

    try {
      await saveCaixinhaMovement(payload);
      setShowCaixinhaForm(false);
      setEditingCaixinhaMovement(null);
      loadModuleData();
    } catch (err) {
      alert('Erro ao salvar movimentação da caixinha.');
    }
  };

  // Unified Caixinha Ledger Computation
  const {
    allCaixinhaItems,
    filteredCaixinhaItems,
    saldoGeralEmMaos,
    saldoAnteriorPeriodo,
    totalEntradasPeriodo,
    totalSaidasPeriodo,
    totalDepositosBancariosPeriodo,
    totalServicosSemNotaPeriodo,
    totalOutrasDespesasPeriodo,
    saldoFinalPeriodo
  } = useMemo(() => {
    // 1. Convert Cash Donations into Caixinha Inflows
    const donationCashEntries = donations
      .filter(d => d.paymentMethod && d.paymentMethod.toLowerCase().includes('dinheiro'))
      .map(d => {
        const isCarne = d.campaign?.toLowerCase().includes('carnê') || d.notes?.toLowerCase().includes('parcela');
        const cat: CaixinhaCategory = isCarne ? 'carne_dinheiro' : 'doacao_dinheiro';
        const catLabel = isCarne ? 'Carnê em Dinheiro' : 'Doação em Dinheiro';
        return {
          id: `donation-${d.id}`,
          originalId: d.id,
          type: 'entrada' as CaixinhaMovementType,
          category: cat,
          categoryLabel: catLabel,
          description: `Doação em Dinheiro: ${d.benefactorName || 'Anônimo'} - ${d.categoryName}${d.notes ? ` (${d.notes})` : ''}`,
          value: Number(d.value) || 0,
          date: d.date,
          responsible: d.notes || d.benefactorName || 'Recepção / Tesouraria',
          receiptNumber: '',
          notes: d.notes || '',
          isFromDonation: true,
          createdAt: d.date
        };
      });

    // 2. Manual Caixinha Movements
    const manualEntries = caixinhaMovements.map(m => {
      let catLabel = 'Outros';
      switch (m.category) {
        case 'servico_sem_nota': catLabel = 'Serviço sem Nota Fiscal'; break;
        case 'deposito_bancario': catLabel = 'Depósito Bancário'; break;
        case 'despesa_miuda': catLabel = 'Despesa Miúda / Suprimentos'; break;
        case 'alimentacao_diaria': catLabel = 'Alimentação / Diárias'; break;
        case 'entrada_avulsa': catLabel = 'Entrada / Reforço em Dinheiro'; break;
        case 'doacao_dinheiro': catLabel = 'Doação em Dinheiro'; break;
        case 'carne_dinheiro': catLabel = 'Carnê em Dinheiro'; break;
        default: catLabel = 'Outras Movimentações'; break;
      }
      return {
        id: m.id,
        originalId: m.id,
        type: m.type,
        category: m.category,
        categoryLabel: catLabel,
        description: m.description,
        value: Number(m.value) || 0,
        date: m.date,
        responsible: m.responsible || '',
        receiptNumber: m.receiptNumber || '',
        notes: m.notes || '',
        isFromDonation: false,
        createdAt: m.createdAt || m.date
      };
    });

    // Combine all and sort chronological ascending for balance accumulation
    const combined = [...donationCashEntries, ...manualEntries].sort((a, b) => {
      const dateCmp = (a.date || '').localeCompare(b.date || '');
      if (dateCmp !== 0) return dateCmp;
      return (a.id || '').localeCompare(b.id || '');
    });

    // Compute running balance across all history
    let running = 0;
    const withRunningBalance = combined.map(item => {
      if (item.type === 'entrada') {
        running += item.value;
      } else {
        running -= item.value;
      }
      return {
        ...item,
        runningBalance: running
      };
    });

    // Overall current balance in hand
    const saldoGeralEmMaos = running;

    // Period metrics
    let saldoAnterior = 0;
    let totalEntradas = 0;
    let totalSaidas = 0;
    let totalDepositos = 0;
    let totalServicos = 0;
    let totalOutras = 0;

    combined.forEach(item => {
      const itemDate = item.date;
      if (caixinhaStartDate && itemDate < caixinhaStartDate) {
        if (item.type === 'entrada') {
          saldoAnterior += item.value;
        } else {
          saldoAnterior -= item.value;
        }
      } else if ((!caixinhaStartDate || itemDate >= caixinhaStartDate) && (!caixinhaEndDate || itemDate <= caixinhaEndDate)) {
        if (item.type === 'entrada') {
          totalEntradas += item.value;
        } else {
          totalSaidas += item.value;
          if (item.category === 'deposito_bancario') {
            totalDepositos += item.value;
          } else if (item.category === 'servico_sem_nota') {
            totalServicos += item.value;
          } else {
            totalOutras += item.value;
          }
        }
      }
    });

    const saldoFinalPeriodo = saldoAnterior + totalEntradas - totalSaidas;

    // Filter items for display
    const filtered = withRunningBalance
      .filter(item => {
        if (caixinhaStartDate && item.date < caixinhaStartDate) return false;
        if (caixinhaEndDate && item.date > caixinhaEndDate) return false;
        if (caixinhaTypeFilter !== 'todos' && item.type !== caixinhaTypeFilter) return false;
        if (caixinhaCategoryFilter !== 'todas' && item.category !== caixinhaCategoryFilter) return false;
        if (caixinhaSearch) {
          const q = caixinhaSearch.toLowerCase();
          const matchDesc = item.description.toLowerCase().includes(q);
          const matchResp = (item.responsible || '').toLowerCase().includes(q);
          const matchRec = (item.receiptNumber || '').toLowerCase().includes(q);
          const matchCat = (item.categoryLabel || '').toLowerCase().includes(q);
          if (!matchDesc && !matchResp && !matchRec && !matchCat) return false;
        }
        return true;
      })
      .reverse(); // Most recent first for UI

    return {
      allCaixinhaItems: withRunningBalance,
      filteredCaixinhaItems: filtered,
      saldoGeralEmMaos,
      saldoAnteriorPeriodo: saldoAnterior,
      totalEntradasPeriodo: totalEntradas,
      totalSaidasPeriodo: totalSaidas,
      totalDepositosBancariosPeriodo: totalDepositos,
      totalServicosSemNotaPeriodo: totalServicos,
      totalOutrasDespesasPeriodo: totalOutras,
      saldoFinalPeriodo
    };
  }, [donations, caixinhaMovements, caixinhaStartDate, caixinhaEndDate, caixinhaTypeFilter, caixinhaCategoryFilter, caixinhaSearch]);

  // PDF Generator for Caixinha
  const handlePrintCaixinhaPdf = async () => {
    const title = "RELATÓRIO DE CONTROLE DA CAIXINHA (FUNDO FIXO EM DINHEIRO)";
    const headerHtml = await getHtmlPrintHeader(settings, title);

    const startFormatted = caixinhaStartDate ? new Date(caixinhaStartDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'Início';
    const endFormatted = caixinhaEndDate ? new Date(caixinhaEndDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'Hoje';

    // Build the items in chronological order for the report table
    const reportItems = [...filteredCaixinhaItems].reverse();

    const rowsHtml = reportItems.map((item, idx) => {
      const isEntrada = item.type === 'entrada';
      const valorFormatted = formatCurrency(item.value);
      const saldoFormatted = formatCurrency(item.runningBalance);
      const itemDate = new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR');
      
      return `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
          <td style="text-align: center; font-weight: bold;">${itemDate}</td>
          <td style="text-align: center; font-weight: bold; color: ${isEntrada ? '#059669' : '#dc2626'};">
            ${isEntrada ? 'ENTRADA (+)' : 'SAÍDA (-)'}
          </td>
          <td>${item.categoryLabel || item.category}</td>
          <td>
            <strong>${item.description}</strong>
            ${item.receiptNumber ? `<br/><span style="font-size: 8px; color: #666;">Doc/Recibo: ${item.receiptNumber}</span>` : ''}
          </td>
          <td>${item.responsible || '-'}</td>
          <td style="text-align: right; color: #059669; font-weight: bold;">
            ${isEntrada ? valorFormatted : '-'}
          </td>
          <td style="text-align: right; color: #dc2626; font-weight: bold;">
            ${!isEntrada ? valorFormatted : '-'}
          </td>
          <td style="text-align: right; font-weight: bold; color: #004c99;">
            ${saldoFormatted}
          </td>
        </tr>
      `;
    }).join('');

    const html = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            ${getHtmlPrintStyles()}
            .highlight-card {
              border: 2px solid #004c99;
              background-color: #f0f7ff;
              border-radius: 8px;
              padding: 12px 16px;
              margin-bottom: 16px;
              break-inside: avoid;
            }
            .kpi-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin-top: 10px;
            }
            .kpi-box {
              background: #ffffff;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              padding: 8px 10px;
              text-align: center;
            }
            .kpi-box.main {
              border: 2px solid #059669;
              background-color: #ecfdf5;
            }
            .kpi-label {
              font-size: 9px;
              text-transform: uppercase;
              font-weight: bold;
              color: #4b5563;
              display: block;
              margin-bottom: 3px;
            }
            .kpi-value {
              font-size: 13px;
              font-weight: bold;
              color: #111827;
            }
            .kpi-value.green { color: #059669; font-size: 14px; }
            .kpi-value.red { color: #dc2626; }
            .kpi-value.blue { color: #004c99; }
          </style>
        </head>
        <body>
          ${headerHtml}

          <div class="highlight-card">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #bfdbfe; padding-bottom: 6px; margin-bottom: 8px;">
              <div>
                <strong style="font-size: 13px; text-transform: uppercase; color: #004c99;">Demonstrativo do Fundo Fixo (Caixinha)</strong>
                <div style="font-size: 10px; color: #4b5563; margin-top: 2px;">
                  Período de Apuração: <strong>${startFormatted}</strong> a <strong>${endFormatted}</strong>
                </div>
              </div>
              <div style="text-align: right; font-size: 9px; color: #6b7280;">
                Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <div class="kpi-grid">
              <div class="kpi-box">
                <span class="kpi-label">Saldo Anterior ao Período</span>
                <span class="kpi-value blue">${formatCurrency(saldoAnteriorPeriodo)}</span>
              </div>
              <div class="kpi-box">
                <span class="kpi-label">(+) Entradas no Período</span>
                <span class="kpi-value green">+ ${formatCurrency(totalEntradasPeriodo)}</span>
              </div>
              <div class="kpi-box">
                <span class="kpi-label">(-) Saídas / Despesas</span>
                <span class="kpi-value red">- ${formatCurrency(totalSaidasPeriodo)}</span>
              </div>
              <div class="kpi-box main">
                <span class="kpi-label" style="color: #065f46;">(=) SALDO ATUAL DA CAIXINHA</span>
                <span class="kpi-value green" style="font-weight: 900;">${formatCurrency(saldoGeralEmMaos)}</span>
              </div>
            </div>

            <div style="margin-top: 10px; font-size: 9px; color: #374151; display: flex; justify-content: space-between; background: #ffffff; padding: 6px 10px; border-radius: 4px; border: 1px dashed #93c5fd;">
              <span><strong>Detalhamento das Saídas:</strong> Depósitos em Banco: <strong>${formatCurrency(totalDepositosBancariosPeriodo)}</strong> | Serviços s/ Nota e Despesas Miúdas: <strong>${formatCurrency(totalServicosSemNotaPeriodo + totalOutrasDespesasPeriodo)}</strong></span>
              <span>Saldo Projetado do Período: <strong>${formatCurrency(saldoFinalPeriodo)}</strong></span>
            </div>
          </div>

          <h2 class="section-title" style="margin-top: 15px; margin-bottom: 8px;">Extrato Cronológico de Movimentações da Caixinha</h2>
          
          <table style="width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 6px;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="width: 70px; text-align: center;">Data</th>
                <th style="width: 75px; text-align: center;">Tipo</th>
                <th style="width: 110px;">Categoria</th>
                <th>Descrição / Finalidade</th>
                <th style="width: 120px;">Responsável / Favorecido</th>
                <th style="width: 80px; text-align: right;">Entrada (R$)</th>
                <th style="width: 80px; text-align: right;">Saída (R$)</th>
                <th style="width: 85px; text-align: right;">Saldo (R$)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml.length > 0 ? rowsHtml : `
                <tr>
                  <td colspan="8" style="text-align: center; padding: 20px; color: #9ca3af; font-weight: bold;">
                    Nenhuma movimentação registrada no período selecionado.
                  </td>
                </tr>
              `}
            </tbody>
            <tfoot>
              <tr style="background-color: #e5e7eb; font-weight: bold;">
                <td colspan="5" style="text-align: right; text-transform: uppercase;">Totais do Período:</td>
                <td style="text-align: right; color: #059669;">+ ${formatCurrency(totalEntradasPeriodo)}</td>
                <td style="text-align: right; color: #dc2626;">- ${formatCurrency(totalSaidasPeriodo)}</td>
                <td style="text-align: right; color: #004c99;">${formatCurrency(saldoFinalPeriodo)}</td>
              </tr>
            </tfoot>
          </table>

          <div style="display: flex; justify-content: space-around; margin-top: 40px; page-break-inside: avoid; break-inside: avoid;">
            <div style="text-align: center; width: 220px;">
              <div style="border-top: 1px solid #000; padding-top: 5px; font-weight: bold; font-size: 10px;">
                Responsável pelo Caixa (Tesouraria)
              </div>
              <div style="font-size: 8px; color: #666;">Conferido e conferente</div>
            </div>
            <div style="text-align: center; width: 220px;">
              <div style="border-top: 1px solid #000; padding-top: 5px; font-weight: bold; font-size: 10px;">
                Diretoria / Presidência
              </div>
              <div style="font-size: 8px; color: #666;">Aprovado</div>
            </div>
          </div>

          ${getHtmlPrintFooter()}
        </body>
      </html>
    `;

    printHtml(html);
  };


  // Link Benefactor default category on select
  const handleBenefactorSelectInForm = (bId: string) => {
    const b = benefactors.find(x => x.id === bId);
    if (b && b.defaultCategory) {
      setDonationForm(prev => ({ ...prev, benefactorId: bId, categoryId: b.defaultCategory || '' }));
    } else {
      setDonationForm(prev => ({ ...prev, benefactorId: bId }));
    }
  };

  // Filters & Calculations
  const filteredDonations = donations.filter(d => {
    const matchesSearch = 
      (d.benefactorName || '').toLowerCase().includes(donationSearch.toLowerCase()) ||
      (d.notes || '').toLowerCase().includes(donationSearch.toLowerCase());
    const matchesCampaign = selectedCampaignFilter === 'Todas' || d.campaign === selectedCampaignFilter;
    const matchesCategory = selectedCategoryFilter === 'Todas' || d.categoryId === selectedCategoryFilter;
    return matchesSearch && matchesCampaign && matchesCategory;
  });

  const filteredBenefactors = benefactors.filter(b => {
    const matchesSearch = 
      b.name.toLowerCase().includes(benefactorSearch.toLowerCase()) ||
      (b.cpfCnpj || '').includes(benefactorSearch) ||
      (b.phone || '').includes(benefactorSearch) ||
      (b.email || '').toLowerCase().includes(benefactorSearch.toLowerCase());
    return matchesSearch;
  });

  // Helper for dynamic carnê status
  const getCarneCalculatedStatus = (carne: Carne): 'quitado' | 'cancelado' | 'em_atraso' | 'em_dia' => {
    if (carne.status === 'cancelado') return 'cancelado';
    if (!carne.parcelas || carne.parcelas.length === 0) return 'em_dia';
    const allPaid = carne.parcelas.every(p => p.pago);
    if (allPaid) return 'quitado';

    const todayStr = new Date().toISOString().split('T')[0];
    const hasLate = carne.parcelas.some(p => !p.pago && p.vencimento && p.vencimento < todayStr);
    if (hasLate) return 'em_atraso';

    return 'em_dia';
  };

  const getCarneNextDueDate = (carne: Carne): string | null => {
    if (!carne.parcelas || carne.status === 'cancelado') return null;
    const unpaid = carne.parcelas.find(p => !p.pago);
    return unpaid ? unpaid.vencimento || null : null;
  };

  const filteredCarnes = useMemo(() => {
    return carnes.filter(c => {
      const matchesSearch = 
        (c.benefactorName || '').toLowerCase().includes(carneSearch.toLowerCase()) ||
        (c.notes || '').toLowerCase().includes(carneSearch.toLowerCase());

      const calcStatus = getCarneCalculatedStatus(c);
      let matchesStatus = true;
      if (carneStatusFilter === 'em_dia') {
        matchesStatus = calcStatus === 'em_dia';
      } else if (carneStatusFilter === 'em_atraso') {
        matchesStatus = calcStatus === 'em_atraso';
      } else if (carneStatusFilter === 'quitado') {
        matchesStatus = calcStatus === 'quitado';
      } else if (carneStatusFilter === 'cancelado') {
        matchesStatus = calcStatus === 'cancelado';
      } else if (carneStatusFilter === 'ativo') {
        matchesStatus = c.status === 'ativo';
      }

      const matchesYear = !carneYearFilter || carneYearFilter === 0 || c.ano === Number(carneYearFilter);
      return matchesSearch && matchesStatus && matchesYear;
    }).sort((a, b) => {
      if (carneSortBy === 'nome') {
        return (a.benefactorName || '').localeCompare(b.benefactorName || '');
      } else if (carneSortBy === 'vencimento') {
        const nextA = getCarneNextDueDate(a) || '9999-12-31';
        const nextB = getCarneNextDueDate(b) || '9999-12-31';
        return nextA.localeCompare(nextB);
      } else if (carneSortBy === 'pendente') {
        const pendingA = (a.parcelas || []).filter(p => !p.pago).reduce((acc, p) => acc + (Number(p.valor) || Number(a.valorParcela) || 0), 0);
        const pendingB = (b.parcelas || []).filter(p => !p.pago).reduce((acc, p) => acc + (Number(p.valor) || Number(b.valorParcela) || 0), 0);
        return pendingB - pendingA;
      } else if (carneSortBy === 'status') {
        return getCarneCalculatedStatus(a).localeCompare(getCarneCalculatedStatus(b));
      }
      return 0;
    });
  }, [carnes, carneSearch, carneStatusFilter, carneYearFilter, carneSortBy]);

  const totalCarnesCount = filteredCarnes.length;
  const totalPagesCarnes = Math.max(1, Math.ceil(totalCarnesCount / carnePerPage));
  const paginatedCarnes = useMemo(() => {
    const start = (carnePage - 1) * carnePerPage;
    return filteredCarnes.slice(start, start + carnePerPage);
  }, [filteredCarnes, carnePage, carnePerPage]);

  // Carnês Metrics
  const totalCarnesAtivos = carnes.filter(c => c.status === 'ativo').length;
  const totalCarnesEmAtraso = carnes.filter(c => getCarneCalculatedStatus(c) === 'em_atraso').length;
  const totalCarnesQuitados = carnes.filter(c => c.status === 'quitado').length;
  let totalParcelasGeral = 0;
  let totalParcelasQuitadas = 0;
  let valorPrevistoGeral = 0;
  let valorArrecadadoGeral = 0;

  carnes.forEach(c => {
    if (c.status !== 'cancelado') {
      (c.parcelas || []).forEach(p => {
        totalParcelasGeral++;
        valorPrevistoGeral += Number(p.valor) || Number(c.valorParcela) || 0;
        if (p.pago) {
          totalParcelasQuitadas++;
          valorArrecadadoGeral += Number(p.valor) || Number(c.valorParcela) || 0;
        }
      });
    }
  });
  const valorPendenteGeral = valorPrevistoGeral - valorArrecadadoGeral;

  // Report logic
  const reportDonations = donations.filter(d => {
    const dDate = new Date(d.date);
    const sDate = reportStartDate ? new Date(reportStartDate) : null;
    const eDate = reportEndDate ? new Date(reportEndDate) : null;
    
    // Normalize times
    if (sDate) sDate.setHours(0,0,0,0);
    if (eDate) eDate.setHours(23,59,59,999);
    
    const matchesStart = !sDate || dDate >= sDate;
    const matchesEnd = !eDate || dDate <= eDate;
    const matchesCategory = reportCategory === 'Todas' || d.categoryId === reportCategory;
    const matchesBenefactor = reportBenefactor === 'Todos' || d.benefactorId === reportBenefactor;

    return matchesStart && matchesEnd && matchesCategory && matchesBenefactor;
  });

  const reportTotalAmount = reportDonations.reduce((acc, d) => acc + d.value, 0);
  const reportCount = reportDonations.length;
  const reportAverage = reportCount > 0 ? reportTotalAmount / reportCount : 0;

  // Pie chart by Category
  const reportByCategoryData = React.useMemo(() => {
    const map: Record<string, number> = {};
    reportDonations.forEach(d => {
      const name = d.categoryName || 'Outras';
      map[name] = (map[name] || 0) + d.value;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [reportDonations]);

  // Bar chart by Month/Day
  const reportTimelineData = React.useMemo(() => {
    const map: Record<string, number> = {};
    reportDonations.forEach(d => {
      // Group by YYYY-MM
      const dateLabel = d.date.substring(0, 7); 
      map[dateLabel] = (map[dateLabel] || 0) + d.value;
    });
    
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => a.name.localeCompare(b.name));
  }, [reportDonations]);

  const COLORS = ['#004c99', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const handlePrintReport = () => {
    window.print();
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#004c99]">
            <DollarSign className="w-6 h-6 stroke-[3]" />
            <h1 className="text-xl font-black uppercase tracking-tight">Gestão de Doações Financeiras</h1>
          </div>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">
            Controle de captação, benfeitores e relatórios de fluxo de caixa de caridade
          </p>
        </div>

        {/* Quick action triggers */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setEditingDonation(null);
              setDonationForm({
                benefactorId: '',
                categoryId: '',
                value: '',
                date: new Date().toISOString().split('T')[0],
                paymentMethod: 'PIX',
                campaign: 'Doação Espontânea',
                notes: ''
              });
              setShowDonationForm(true);
            }}
            className="flex items-center gap-1 bg-[#004c99] hover:bg-blue-800 text-white rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-all shadow-sm"
          >
            <Plus className="w-4 h-4 text-white" />
            Lançar Doação
          </button>
          
          <button
            onClick={() => {
              setCarneForm({
                benefactorId: '',
                ano: new Date().getFullYear(),
                valorParcela: '',
                categoryId: '',
                notes: ''
              });
              setShowCarneForm(true);
            }}
            className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-all shadow-sm"
          >
            <BookOpen className="w-4 h-4 text-white" />
            Novo Carnê
          </button>

          <button
            onClick={() => handleOpenNewCaixinhaModal('saida', 'servico_sem_nota')}
            className="flex items-center gap-1 bg-rose-650 hover:bg-rose-750 text-white rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-all shadow-sm"
          >
            <Wallet className="w-4 h-4 text-white" />
            Saída da Caixinha
          </button>

          <button
            onClick={() => {
              setEditingBenefactor(null);
              setBenefactorForm({
                name: '',
                type: 'pf',
                cpfCnpj: '',
                phone: '',
                email: '',
                defaultCategory: '',
                notes: ''
              });
              setShowBenefactorForm(true);
            }}
            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-all shadow-sm"
          >
            <Plus className="w-4 h-4 text-white" />
            Novo Benfeitor
          </button>
        </div>
      </div>

      {/* Primary Sub Tabs */}
      <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('donations')}
          className={`flex items-center gap-2 px-5 py-3 rounded-lg text-xs font-bold uppercase transition-all whitespace-nowrap ${
            activeTab === 'donations'
              ? 'bg-[#004c99] text-white shadow-md'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <DollarSign size={16} />
          Lançamentos de Doação
        </button>

        <button
          onClick={() => setActiveTab('carnes')}
          className={`flex items-center gap-2 px-5 py-3 rounded-lg text-xs font-bold uppercase transition-all whitespace-nowrap ${
            activeTab === 'carnes'
              ? 'bg-[#004c99] text-white shadow-md'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <BookOpen size={16} />
          Controle de Carnês
          {carnes.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'carnes' ? 'bg-white text-[#004c99]' : 'bg-amber-100 text-amber-800'}`}>
              {carnes.filter(c => c.status === 'ativo').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('caixinha')}
          className={`flex items-center gap-2 px-5 py-3 rounded-lg text-xs font-bold uppercase transition-all whitespace-nowrap ${
            activeTab === 'caixinha'
              ? 'bg-[#004c99] text-white shadow-md'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <Wallet size={16} />
          Controle da Caixinha
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === 'caixinha'
              ? 'bg-white text-[#004c99]'
              : saldoGeralEmMaos >= 0
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {formatCurrency(saldoGeralEmMaos)}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('benefactors')}
          className={`flex items-center gap-2 px-5 py-3 rounded-lg text-xs font-bold uppercase transition-all whitespace-nowrap ${
            activeTab === 'benefactors'
              ? 'bg-[#004c99] text-white shadow-md'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <Users size={16} />
          Cadastro de Benfeitores
        </button>


        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-5 py-3 rounded-lg text-xs font-bold uppercase transition-all whitespace-nowrap ${
            activeTab === 'categories'
              ? 'bg-[#004c99] text-white shadow-md'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <Tag size={16} />
          Categorias de Campanhas
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-5 py-3 rounded-lg text-xs font-bold uppercase transition-all whitespace-nowrap ${
            activeTab === 'reports'
              ? 'bg-[#004c99] text-white shadow-md'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <FileText size={16} />
          Gráficos & Relatórios
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-10 h-10 border-4 border-blue-100 border-t-[#004c99] rounded-full animate-spin"></div>
          <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest mt-4">Carregando dados financeiros...</p>
        </div>
      ) : (
        <>
          {/* TAB: DONATIONS */}
          {activeTab === 'donations' && (
            <div className="space-y-6">
              {/* Filters line */}
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-96">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </span>
                  <input
                    type="text"
                    value={donationSearch}
                    onChange={(e) => setDonationSearch(e.target.value)}
                    placeholder="Filtrar por nome do benfeitor ou notas..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#004c99] bg-gray-50"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Campanha:</span>
                    <select
                      value={selectedCampaignFilter}
                      onChange={(e) => setSelectedCampaignFilter(e.target.value)}
                      className="text-xs font-bold bg-gray-100 border-0 rounded-lg px-2.5 py-1.5 text-gray-750 focus:outline-none"
                    >
                      <option value="Todas">Todas</option>
                      {campaigns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Categoria:</span>
                    <select
                      value={selectedCategoryFilter}
                      onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                      className="text-xs font-bold bg-gray-100 border-0 rounded-lg px-2.5 py-1.5 text-gray-750 focus:outline-none"
                    >
                      <option value="Todas">Todas</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Table list */}
              <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-55/70 border-b border-gray-100">
                        <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">Benfeitor</th>
                        <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">Categoria</th>
                        <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">Campanha</th>
                        <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">Data</th>
                        <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">Método de Pgto</th>
                        <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-wider text-right">Valor</th>
                        <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-wider text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredDonations.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-12 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">
                            Nenhum lançamento de doação encontrado
                          </td>
                        </tr>
                      ) : (
                        filteredDonations.map((item, index) => (
                          <tr key={item.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'} hover:bg-blue-50/30 transition-all font-medium text-xs`}>
                            <td className="p-4">
                              <span className="font-extrabold text-[#004c99]">{item.benefactorName}</span>
                              {item.notes && <p className="text-[10px] text-gray-400 italic mt-0.5">{item.notes}</p>}
                            </td>
                            <td className="p-4 text-gray-600 font-bold">{item.categoryName}</td>
                            <td className="p-4">
                              <span className="px-2 py-0.5 bg-blue-50 text-[#004c99] rounded text-[10px] font-extrabold uppercase">
                                {item.campaign || 'Nenhuma'}
                              </span>
                            </td>
                            <td className="p-4 text-gray-500 font-bold">
                              {new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </td>
                            <td className="p-4 text-gray-500">{item.paymentMethod || 'PIX'}</td>
                            <td className="p-4 text-right font-black text-emerald-600 text-sm">
                              {formatCurrency(item.value)}
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleEditDonationClick(item)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                  title="Editar"
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  onClick={() => item.id && handleDeleteDonationClick(item.id)}
                                  className="p-1.5 text-red-650 hover:bg-red-50 rounded-lg transition-all"
                                  title="Apagar"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: CARNÊS */}
          {activeTab === 'carnes' && (
            <div className="space-y-6">
              {/* Metrics Summary Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Carnês Ativos</span>
                    <span className="text-xl font-black text-gray-800">{totalCarnesAtivos} <span className="text-xs font-semibold text-gray-400">/ {carnes.length} total</span></span>
                    <p className="text-[10px] text-red-600 font-bold mt-0.5">{totalCarnesEmAtraso} em atraso • {totalCarnesQuitados} quitados</p>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Folhas Quitadas</span>
                    <span className="text-xl font-black text-gray-800">{totalParcelasQuitadas} <span className="text-xs font-semibold text-gray-400">/ {totalParcelasGeral}</span></span>
                    <p className="text-[10px] text-blue-600 font-bold mt-0.5">
                      {totalParcelasGeral > 0 ? ((totalParcelasQuitadas / totalParcelasGeral) * 100).toFixed(1) : 0}% de progresso
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-blue-50 rounded-2xl text-[#004c99]">
                    <PiggyBank size={24} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Arrecadado via Carnê</span>
                    <span className="text-lg font-black text-emerald-600">{formatCurrency(valorArrecadadoGeral)}</span>
                    <p className="text-[10px] text-gray-400 font-medium mt-0.5">Lançados no caixa</p>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-purple-50 rounded-2xl text-purple-600">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Pendente a Arrecadar</span>
                    <span className="text-lg font-black text-amber-600">{formatCurrency(valorPendenteGeral)}</span>
                    <p className="text-[10px] text-gray-400 font-medium mt-0.5">Previsto: {formatCurrency(valorPrevistoGeral)}</p>
                  </div>
                </div>
              </div>

              {/* Advanced Filter, Search, Sort and Actions Bar */}
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </span>
                  <input
                    type="text"
                    value={carneSearch}
                    onChange={(e) => {
                      setCarneSearch(e.target.value);
                      setCarnePage(1);
                    }}
                    placeholder="Buscar benfeitor por nome ou observação..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#004c99] bg-gray-50"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5">
                    <Filter size={13} className="text-gray-400" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Situação:</span>
                    <select
                      value={carneStatusFilter}
                      onChange={(e) => {
                        setCarneStatusFilter(e.target.value as any);
                        setCarnePage(1);
                      }}
                      className="text-xs font-bold bg-transparent border-0 text-gray-750 focus:outline-none"
                    >
                      <option value="todos">Todas</option>
                      <option value="em_dia">Em Dia</option>
                      <option value="em_atraso">Em Atraso</option>
                      <option value="quitado">Quitados</option>
                      <option value="cancelado">Cancelados</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5">
                    <Calendar size={13} className="text-gray-400" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Ano:</span>
                    <select
                      value={carneYearFilter}
                      onChange={(e) => {
                        setCarneYearFilter(Number(e.target.value));
                        setCarnePage(1);
                      }}
                      className="text-xs font-bold bg-transparent border-0 text-gray-750 focus:outline-none"
                    >
                      <option value={0}>Todos os Anos</option>
                      {[2024, 2025, 2026, 2027, 2028].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5">
                    <ArrowUpDown size={13} className="text-gray-400" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Ordem:</span>
                    <select
                      value={carneSortBy}
                      onChange={(e) => {
                        setCarneSortBy(e.target.value as any);
                        setCarnePage(1);
                      }}
                      className="text-xs font-bold bg-transparent border-0 text-gray-750 focus:outline-none"
                    >
                      <option value="nome">Nome do Benfeitor</option>
                      <option value="vencimento">Próximo Vencimento</option>
                      <option value="pendente">Maior Pendência</option>
                      <option value="status">Situação</option>
                    </select>
                  </div>

                  {(carneSearch || carneStatusFilter !== 'todos' || carneYearFilter !== 0 || carneSortBy !== 'nome') && (
                    <button
                      onClick={() => {
                        setCarneSearch('');
                        setCarneStatusFilter('todos');
                        setCarneYearFilter(0);
                        setCarneSortBy('nome');
                        setCarnePage(1);
                      }}
                      className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all"
                    >
                      <RefreshCw size={12} />
                      Limpar
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setCarneForm({
                        benefactorId: '',
                        ano: new Date().getFullYear(),
                        valorParcela: '',
                        categoryId: '',
                        notes: ''
                      });
                      setShowCarneForm(true);
                    }}
                    className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-all shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Emitir Carnê
                  </button>
                </div>
              </div>

              {/* Compact Paginated Table */}
              <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
                {filteredCarnes.length === 0 ? (
                  <div className="p-12 text-center flex flex-col items-center justify-center">
                    <BookOpen size={48} className="text-gray-200 mb-3" />
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Nenhum carnê encontrado</p>
                    <p className="text-[11px] text-gray-400 mt-1 max-w-sm">
                      Ajuste os filtros de busca ou utilize o botão acima para emitir um novo carnê.
                    </p>
                    <button
                      onClick={() => setShowCarneForm(true)}
                      className="mt-4 bg-[#004c99] hover:bg-blue-800 text-white rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-all"
                    >
                      Emitir Novo Carnê
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50/80 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                            <th className="p-4">Benfeitor</th>
                            <th className="p-4">Carnê / Ano</th>
                            <th className="p-4">Valor Mensal</th>
                            <th className="p-4">Folhas Quitadas</th>
                            <th className="p-4">Arrecadado / Pendente</th>
                            <th className="p-4">Próx. Vencimento</th>
                            <th className="p-4 text-center">Situação</th>
                            <th className="p-4 text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-xs font-medium">
                          {paginatedCarnes.map((carne, idx) => {
                            const paidParcelas = (carne.parcelas || []).filter(p => p.pago);
                            const paidCount = paidParcelas.length;
                            const percentPaid = Math.round((paidCount / 12) * 100);
                            const calcStatus = getCarneCalculatedStatus(carne);
                            const nextDue = getCarneNextDueDate(carne);
                            
                            const totalCarneValue = (Number(carne.valorParcela) || 0) * 12;
                            const totalPaidValue = paidParcelas.reduce((acc, p) => acc + (Number(p.valor) || Number(carne.valorParcela) || 0), 0);
                            const pendingValue = totalCarneValue - totalPaidValue;

                            const lateCount = (carne.parcelas || []).filter(p => !p.pago && p.vencimento && p.vencimento < new Date().toISOString().split('T')[0]).length;

                            return (
                              <tr key={carne.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/30 transition-all`}>
                                <td className="p-4">
                                  <span className="font-black text-gray-850 block">{carne.benefactorName}</span>
                                  {carne.categoryName && (
                                    <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                                      {carne.categoryName}
                                    </span>
                                  )}
                                  {carne.notes && <p className="text-[10px] text-gray-400 italic mt-0.5 truncate max-w-xs">{carne.notes}</p>}
                                </td>

                                <td className="p-4">
                                  <span className="px-2 py-0.5 bg-blue-50 text-[#004c99] rounded-md text-[10px] font-black uppercase">
                                    Carnê {carne.ano}
                                  </span>
                                </td>

                                <td className="p-4">
                                  <span className="font-black text-[#004c99] block">{formatCurrency(carne.valorParcela)} / mês</span>
                                  <span className="text-[10px] text-gray-400 font-semibold">Anual: {formatCurrency(totalCarneValue)}</span>
                                </td>

                                <td className="p-4">
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-gray-800">{paidCount} / 12</span>
                                    <div className="w-16 bg-gray-200 h-2 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full ${calcStatus === 'quitado' ? 'bg-emerald-500' : 'bg-[#004c99]'}`}
                                        style={{ width: `${percentPaid}%` }}
                                      />
                                    </div>
                                    <span className="text-[10px] text-gray-400 font-bold">{percentPaid}%</span>
                                  </div>
                                </td>

                                <td className="p-4">
                                  <span className="font-black text-emerald-600 block">{formatCurrency(totalPaidValue)}</span>
                                  <span className="text-[10px] text-amber-600 font-bold">Pendente: {formatCurrency(pendingValue)}</span>
                                </td>

                                <td className="p-4 font-bold text-gray-600">
                                  {calcStatus === 'quitado' ? (
                                    <span className="text-emerald-600 text-[10px] font-black uppercase">Quitado</span>
                                  ) : calcStatus === 'cancelado' ? (
                                    <span className="text-gray-400 text-[10px] font-bold">Cancelado</span>
                                  ) : nextDue ? (
                                    <span className={nextDue < new Date().toISOString().split('T')[0] ? 'text-red-600 font-black' : 'text-gray-700'}>
                                      {new Date(nextDue + 'T12:00:00').toLocaleDateString('pt-BR')}
                                    </span>
                                  ) : 'N/A'}
                                </td>

                                <td className="p-4 text-center">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    calcStatus === 'quitado'
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      : calcStatus === 'cancelado'
                                      ? 'bg-gray-100 text-gray-600 border border-gray-200'
                                      : calcStatus === 'em_atraso'
                                      ? 'bg-red-100 text-red-800 border border-red-200'
                                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                                  }`}>
                                    {calcStatus === 'quitado' && <CheckCircle2 size={12} />}
                                    {calcStatus === 'em_atraso' && <AlertCircle size={12} />}
                                    {calcStatus === 'em_dia' && <Check size={12} />}
                                    {calcStatus === 'quitado' && 'Quitado'}
                                    {calcStatus === 'cancelado' && 'Cancelado'}
                                    {calcStatus === 'em_atraso' && `Em Atraso (${lateCount})`}
                                    {calcStatus === 'em_dia' && 'Em Dia'}
                                  </span>
                                </td>

                                <td className="p-4 text-center">
                                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                    <button
                                      onClick={() => {
                                        setSelectedCarneForDetails(carne);
                                        handleOpenBaixaModal(carne);
                                      }}
                                      className="flex items-center gap-1 px-3 py-1.5 bg-[#004c99] hover:bg-blue-800 text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition-all shadow-sm"
                                    >
                                      <CalendarCheck size={13} />
                                      Ver Detalhes / Baixa
                                    </button>

                                    <button
                                      onClick={() => handleOpenWhatsAppModal(carne, calcStatus === 'quitado' ? 'agradecimento' : 'lembrete')}
                                      title="Enviar mensagem via WhatsApp"
                                      className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition-all shadow-sm"
                                    >
                                      <MessageSquare size={13} />
                                      Enviar WhatsApp
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Bar */}
                    <div className="p-4 bg-gray-50/80 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold text-gray-500">
                      <div>
                        Mostrando <span className="font-black text-gray-800">{Math.min((carnePage - 1) * carnePerPage + 1, totalCarnesCount)}</span> a <span className="font-black text-gray-800">{Math.min(carnePage * carnePerPage, totalCarnesCount)}</span> de <span className="font-black text-gray-800">{totalCarnesCount}</span> carnês
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCarnePage(prev => Math.max(1, prev - 1))}
                          disabled={carnePage === 1}
                          className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-xs font-bold"
                        >
                          <ChevronLeft size={14} /> Anterior
                        </button>

                        <div className="flex items-center gap-1 px-2">
                          {Array.from({ length: totalPagesCarnes }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === totalPagesCarnes || Math.abs(p - carnePage) <= 1)
                            .map((p, index, array) => {
                              const showEllipsis = index > 0 && p - array[index - 1] > 1;
                              return (
                                <React.Fragment key={p}>
                                  {showEllipsis && <span className="text-gray-400 text-xs">...</span>}
                                  <button
                                    onClick={() => setCarnePage(p)}
                                    className={`w-7 h-7 rounded-lg text-xs font-black transition-all ${
                                      carnePage === p
                                        ? 'bg-[#004c99] text-white shadow-sm'
                                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                                    }`}
                                  >
                                    {p}
                                  </button>
                                </React.Fragment>
                              );
                            })}
                        </div>

                        <button
                          onClick={() => setCarnePage(prev => Math.min(totalPagesCarnes, prev + 1))}
                          disabled={carnePage === totalPagesCarnes}
                          className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-xs font-bold"
                        >
                          Próximo <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB: CAIXINHA (Fundo Fixo / Dinheiro) */}
          {activeTab === 'caixinha' && (
            <div className="space-y-6">
              {/* Top Highlight Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Main Hero Card: Saldo Atual em Mãos */}
                <div className="lg:col-span-2 bg-gradient-to-br from-blue-900 via-[#004c99] to-indigo-900 rounded-3xl p-6 text-white shadow-lg flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-36 h-36 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
                  
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-wider text-blue-200 flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-emerald-400" />
                        Saldo Atual da Caixinha (Em Mãos)
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        saldoGeralEmMaos >= 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}>
                        {saldoGeralEmMaos >= 0 ? 'Fundo Positivo' : 'Caixa Negativo'}
                      </span>
                    </div>

                    <div className="mt-3">
                      <span className="text-3xl sm:text-4xl font-black tracking-tight text-white block">
                        {formatCurrency(saldoGeralEmMaos)}
                      </span>
                      <p className="text-[11px] text-blue-200 mt-1 font-medium leading-relaxed">
                        Dinheiro físico em tesouraria para pagamentos imediatos de serviços sem nota e pequenas despesas.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/15 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleOpenNewCaixinhaModal('saida', 'servico_sem_nota')}
                      className="flex-1 min-w-[130px] bg-rose-600 hover:bg-rose-700 text-white rounded-xl py-2 px-3 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    >
                      <ArrowDownRight size={14} />
                      Nova Saída
                    </button>
                    <button
                      onClick={() => handleOpenNewCaixinhaModal('saida', 'deposito_bancario')}
                      className="flex-1 min-w-[130px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2 px-3 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    >
                      <Landmark size={14} />
                      Depósito Banco
                    </button>
                    <button
                      onClick={() => handleOpenNewCaixinhaModal('entrada', 'entrada_avulsa')}
                      className="flex-1 min-w-[130px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2 px-3 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    >
                      <ArrowUpRight size={14} />
                      Reforço Caixa
                    </button>
                  </div>
                </div>

                {/* Card 2: Saldo Anterior */}
                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-gray-400">
                    <span className="text-[10px] font-black uppercase tracking-widest">Saldo Anterior</span>
                    <Coins size={18} className="text-blue-500" />
                  </div>
                  <div className="mt-2">
                    <span className="text-xl font-black text-gray-800 block">
                      {formatCurrency(saldoAnteriorPeriodo)}
                    </span>
                    <span className="text-[10px] text-gray-400 font-semibold block mt-1">
                      Antes de {caixinhaStartDate ? new Date(caixinhaStartDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'Início'}
                    </span>
                  </div>
                  <div className="mt-3 pt-2 border-t border-gray-50 text-[10px] text-gray-500 font-medium">
                    Base inicial de cálculo do período selecionado.
                  </div>
                </div>

                {/* Card 3: Total Entradas */}
                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-emerald-600">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Entradas no Período</span>
                    <ArrowUpRight size={18} />
                  </div>
                  <div className="mt-2">
                    <span className="text-xl font-black text-emerald-600 block">
                      + {formatCurrency(totalEntradasPeriodo)}
                    </span>
                    <span className="text-[10px] text-gray-400 font-semibold block mt-1">
                      Doações, carnês e reforços em dinheiro
                    </span>
                  </div>
                  <div className="mt-3 pt-2 border-t border-gray-50 text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    Entradas automáticas em dinheiro
                  </div>
                </div>

                {/* Card 4: Total Saídas */}
                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-rose-600">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Saídas no Período</span>
                    <ArrowDownRight size={18} />
                  </div>
                  <div className="mt-2">
                    <span className="text-xl font-black text-rose-600 block">
                      - {formatCurrency(totalSaidasPeriodo)}
                    </span>
                    <span className="text-[10px] text-gray-400 font-semibold block mt-1">
                      Depósitos e despesas sem nota
                    </span>
                  </div>
                  <div className="mt-3 pt-2 border-t border-gray-50 text-[10px] text-gray-500 font-medium">
                    Depósitos: <strong className="text-gray-700">{formatCurrency(totalDepositosBancariosPeriodo)}</strong>
                  </div>
                </div>
              </div>

              {/* Filter and Actions Bar */}
              <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  {/* Date Range Selection with quick buttons */}
                  <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                    <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2">
                      <Calendar size={14} className="text-gray-400" />
                      <span className="text-[10px] font-black uppercase text-gray-400">De:</span>
                      <input
                        type="date"
                        value={caixinhaStartDate}
                        onChange={(e) => setCaixinhaStartDate(e.target.value)}
                        className="bg-transparent text-xs font-bold text-gray-700 focus:outline-none"
                      />
                      <span className="text-[10px] font-black uppercase text-gray-400 ml-1">Até:</span>
                      <input
                        type="date"
                        value={caixinhaEndDate}
                        onChange={(e) => setCaixinhaEndDate(e.target.value)}
                        className="bg-transparent text-xs font-bold text-gray-700 focus:outline-none"
                      />
                    </div>

                    {/* Quick period buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          const now = new Date();
                          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                          const today = now.toISOString().split('T')[0];
                          setCaixinhaStartDate(firstDay);
                          setCaixinhaEndDate(today);
                        }}
                        className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-[10px] font-black uppercase transition-all"
                      >
                        Mês Atual
                      </button>
                      <button
                        onClick={() => {
                          const now = new Date();
                          const past30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                          const today = now.toISOString().split('T')[0];
                          setCaixinhaStartDate(past30);
                          setCaixinhaEndDate(today);
                        }}
                        className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-[10px] font-black uppercase transition-all"
                      >
                        Últimos 30d
                      </button>
                      <button
                        onClick={() => {
                          const now = new Date();
                          const firstYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
                          const today = now.toISOString().split('T')[0];
                          setCaixinhaStartDate(firstYear);
                          setCaixinhaEndDate(today);
                        }}
                        className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-[10px] font-black uppercase transition-all"
                      >
                        Ano Atual
                      </button>
                    </div>
                  </div>

                  {/* Actions (Print PDF + New Entry) */}
                  <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                    <button
                      onClick={handlePrintCaixinhaPdf}
                      className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm"
                      title="Gerar Relatório do Período em PDF"
                    >
                      <Printer size={15} className="text-[#004c99]" />
                      <span>Imprimir Relatório (PDF)</span>
                    </button>

                    <button
                      onClick={() => handleOpenNewCaixinhaModal('saida', 'servico_sem_nota')}
                      className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm"
                    >
                      <Plus size={15} />
                      <span>Nova Saída / Despesa</span>
                    </button>
                  </div>
                </div>

                {/* Sub-Filters: Type, Category, and Search */}
                <div className="pt-3 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-3">
                  <div className="relative w-full md:w-80">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <Search className="h-4 w-4 text-gray-400" />
                    </span>
                    <input
                      type="text"
                      value={caixinhaSearch}
                      onChange={(e) => setCaixinhaSearch(e.target.value)}
                      placeholder="Buscar por descrição, responsável ou recibo..."
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#004c99] bg-gray-50"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-start md:justify-end">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Tipo:</span>
                      <select
                        value={caixinhaTypeFilter}
                        onChange={(e) => setCaixinhaTypeFilter(e.target.value as any)}
                        className="text-xs font-bold bg-gray-100 border-0 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none"
                      >
                        <option value="todos">Todos (Entradas e Saídas)</option>
                        <option value="entrada">Apenas Entradas (+)</option>
                        <option value="saida">Apenas Saídas (-)</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Categoria:</span>
                      <select
                        value={caixinhaCategoryFilter}
                        onChange={(e) => setCaixinhaCategoryFilter(e.target.value)}
                        className="text-xs font-bold bg-gray-100 border-0 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none"
                      >
                        <option value="todas">Todas as Categorias</option>
                        <option value="servico_sem_nota">Serviços sem Nota Fiscal</option>
                        <option value="deposito_bancario">Depósitos Bancários</option>
                        <option value="despesa_miuda">Despesas Miúdas / Suprimentos</option>
                        <option value="alimentacao_diaria">Alimentação / Diárias</option>
                        <option value="doacao_dinheiro">Doações em Dinheiro</option>
                        <option value="carne_dinheiro">Carnês em Dinheiro</option>
                        <option value="entrada_avulsa">Entradas Avulsas / Reforço</option>
                        <option value="outro">Outras</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Table / Extrato Cronológico da Caixinha */}
              <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
                <div className="p-4 bg-gray-50/70 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet size={16} className="text-[#004c99]" />
                    <h3 className="text-xs font-black uppercase text-gray-700 tracking-wider">
                      Extrato de Movimentações da Caixinha ({filteredCaixinhaItems.length} registros)
                    </h3>
                  </div>
                  <div className="text-[11px] font-bold text-gray-500">
                    Saldo Projetado no Final do Período: <strong className="text-[#004c99]">{formatCurrency(saldoFinalPeriodo)}</strong>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="p-3.5 text-[10px] font-black text-gray-400 uppercase tracking-wider text-center w-24">Data</th>
                        <th className="p-3.5 text-[10px] font-black text-gray-400 uppercase tracking-wider text-center w-28">Fluxo</th>
                        <th className="p-3.5 text-[10px] font-black text-gray-400 uppercase tracking-wider">Categoria</th>
                        <th className="p-3.5 text-[10px] font-black text-gray-400 uppercase tracking-wider">Descrição / Finalidade</th>
                        <th className="p-3.5 text-[10px] font-black text-gray-400 uppercase tracking-wider">Responsável / Favorecido</th>
                        <th className="p-3.5 text-[10px] font-black text-gray-400 uppercase tracking-wider text-right w-28">Valor (R$)</th>
                        <th className="p-3.5 text-[10px] font-black text-gray-400 uppercase tracking-wider text-right w-28">Saldo Acumulado</th>
                        <th className="p-3.5 text-[10px] font-black text-gray-400 uppercase tracking-wider text-center w-24">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredCaixinhaItems.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-12 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">
                            Nenhuma movimentação de caixinha encontrada para os filtros selecionados.
                          </td>
                        </tr>
                      ) : (
                        filteredCaixinhaItems.map((item, index) => {
                          const isEntrada = item.type === 'entrada';
                          
                          // Badge styling
                          let catBadgeBg = 'bg-gray-100 text-gray-700';
                          if (item.category === 'servico_sem_nota') catBadgeBg = 'bg-amber-50 text-amber-800 border border-amber-200';
                          else if (item.category === 'deposito_bancario') catBadgeBg = 'bg-blue-50 text-blue-800 border border-blue-200';
                          else if (item.category === 'despesa_miuda') catBadgeBg = 'bg-rose-50 text-rose-800 border border-rose-200';
                          else if (item.category === 'alimentacao_diaria') catBadgeBg = 'bg-orange-50 text-orange-800 border border-orange-200';
                          else if (item.category === 'doacao_dinheiro' || item.category === 'carne_dinheiro' || item.category === 'entrada_avulsa') {
                            catBadgeBg = 'bg-emerald-50 text-emerald-800 border border-emerald-200';
                          }

                          return (
                            <tr key={item.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'} hover:bg-blue-50/30 transition-all font-medium text-xs`}>
                              {/* Data */}
                              <td className="p-3.5 text-center font-bold text-gray-600 whitespace-nowrap">
                                {new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                              </td>

                              {/* Tipo / Fluxo */}
                              <td className="p-3.5 text-center whitespace-nowrap">
                                {isEntrada ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                                    <ArrowUpRight size={12} />
                                    Entrada
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800">
                                    <ArrowDownRight size={12} />
                                    Saída
                                  </span>
                                )}
                              </td>

                              {/* Categoria */}
                              <td className="p-3.5 whitespace-nowrap">
                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${catBadgeBg}`}>
                                  {item.categoryLabel || item.category}
                                </span>
                              </td>

                              {/* Descrição */}
                              <td className="p-3.5">
                                <span className="font-extrabold text-gray-800 block">{item.description}</span>
                                {item.receiptNumber && (
                                  <span className="text-[10px] text-gray-400 block mt-0.5">
                                    Recibo/Comprovante: <strong className="text-gray-600">{item.receiptNumber}</strong>
                                  </span>
                                )}
                                {item.notes && !item.receiptNumber && (
                                  <span className="text-[10px] text-gray-400 italic block mt-0.5">{item.notes}</span>
                                )}
                              </td>

                              {/* Responsável */}
                              <td className="p-3.5 text-gray-600 font-semibold">
                                {item.responsible || '-'}
                              </td>

                              {/* Valor */}
                              <td className={`p-3.5 text-right font-black whitespace-nowrap ${
                                isEntrada ? 'text-emerald-600' : 'text-rose-600'
                              }`}>
                                {isEntrada ? '+' : '-'} {formatCurrency(item.value)}
                              </td>

                              {/* Saldo Acumulado */}
                              <td className="p-3.5 text-right font-black text-[#004c99] whitespace-nowrap">
                                {formatCurrency(item.runningBalance)}
                              </td>

                              {/* Ações */}
                              <td className="p-3.5 text-center whitespace-nowrap">
                                {item.isFromDonation ? (
                                  <span 
                                    className="px-2 py-0.5 bg-blue-50 text-[#004c99] rounded text-[10px] font-bold cursor-pointer hover:bg-blue-100"
                                    onClick={() => setActiveTab('donations')}
                                    title="Lançamento originado do módulo de Doações"
                                  >
                                    Doação Sistema
                                  </span>
                                ) : (
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => handleEditCaixinhaClick(item)}
                                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                      title="Editar Lançamento"
                                    >
                                      <Edit size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteCaixinhaClick(item.originalId || item.id)}
                                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                      title="Excluir Lançamento"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {filteredCaixinhaItems.length > 0 && (
                      <tfoot>
                        <tr className="bg-gray-100 font-black text-xs border-t-2 border-gray-200">
                          <td colSpan={5} className="p-3.5 text-right uppercase tracking-wider text-gray-600">
                            Totais do Período Filtrado:
                          </td>
                          <td className="p-3.5 text-right text-gray-800 whitespace-nowrap">
                            <span className="text-emerald-600 block">+{formatCurrency(totalEntradasPeriodo)}</span>
                            <span className="text-rose-600 block">-{formatCurrency(totalSaidasPeriodo)}</span>
                          </td>
                          <td className="p-3.5 text-right text-[#004c99] whitespace-nowrap text-sm font-black">
                            {formatCurrency(saldoFinalPeriodo)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: BENEFACTORS */}
          {activeTab === 'benefactors' && (
            <div className="space-y-6">
              {/* Filters line */}
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-96">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </span>
                  <input
                    type="text"
                    value={benefactorSearch}
                    onChange={(e) => setBenefactorSearch(e.target.value)}
                    placeholder="Buscar benfeitor por nome, CPF/CNPJ, fone..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#004c99] bg-gray-50"
                  />
                </div>
              </div>

              {/* Grid of benefactors */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredBenefactors.length === 0 ? (
                  <div className="col-span-full bg-white rounded-3xl p-12 text-center border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nenhum benfeitor cadastrado</p>
                  </div>
                ) : (
                  filteredBenefactors.map((item) => {
                    const linkedCat = categories.find(c => c.id === item.defaultCategory);
                    const benefactorCarne = carnes.find(c => c.benefactorId === item.id && c.status === 'ativo');
                    const paidCount = benefactorCarne ? benefactorCarne.parcelas.filter(p => p.pago).length : 0;

                    return (
                      <div key={item.id} className="bg-white rounded-3xl p-6 border border-gray-150/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group">
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500"></div>
                        
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-[9px] font-black tracking-widest text-[#004c99] uppercase bg-blue-55/70 rounded px-1.5 py-0.5">
                                {item.type === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                              </span>
                              <h3 className="text-sm font-black text-gray-800 mt-2 line-clamp-1">{item.name}</h3>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleEditBenefactorClick(item)}
                                className="p-1 text-blue-650 hover:bg-blue-55 rounded"
                                title="Editar"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => item.id && handleDeleteBenefactorClick(item.id)}
                                className="p-1 text-red-650 hover:bg-red-55 rounded"
                                title="Excluir"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          <div className="text-[11px] space-y-1.5 text-gray-650">
                            {item.cpfCnpj && (
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-gray-400 uppercase text-[9px] w-16">CPF/CNPJ:</span>
                                <span className="font-mono text-gray-700">{item.cpfCnpj}</span>
                              </div>
                            )}

                            {item.phone && (
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-gray-400 uppercase text-[9px] w-16"><Phone size={10} className="inline mr-1" /> Fone:</span>
                                <span>{item.phone}</span>
                              </div>
                            )}

                            {item.email && (
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-gray-400 uppercase text-[9px] w-16"><Mail size={10} className="inline mr-1" /> Email:</span>
                                <span className="truncate">{item.email}</span>
                              </div>
                            )}

                            {linkedCat && (
                              <div className="flex items-center gap-2 pt-1 border-t border-gray-50 mt-1">
                                <span className="font-extrabold text-gray-400 uppercase text-[9px] w-16">Vínculo:</span>
                                <span className="font-bold text-gray-750 bg-gray-55/65 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <Tag size={10} /> {linkedCat.name}
                                </span>
                              </div>
                            )}

                            {/* Carnê Status Badge & Action */}
                            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                              {benefactorCarne ? (
                                <div className="flex items-center gap-1.5">
                                  <BookOpen size={13} className="text-amber-600" />
                                  <span className="text-[10px] font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full">
                                    Carnê {benefactorCarne.ano}: {paidCount}/12 pagas
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[10px] font-bold text-gray-400 italic">
                                  Sem carnê ativo
                                </span>
                              )}

                              {benefactorCarne ? (
                                <button
                                  onClick={() => handleOpenBaixaModal(benefactorCarne)}
                                  className="text-[10px] font-extrabold text-[#004c99] hover:underline"
                                >
                                  Dar Baixa
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setCarneForm({
                                      benefactorId: item.id || '',
                                      ano: new Date().getFullYear(),
                                      valorParcela: '',
                                      categoryId: item.defaultCategory || '',
                                      notes: ''
                                    });
                                    setShowCarneForm(true);
                                  }}
                                  className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg transition-all"
                                >
                                  + Emitir Carnê
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {item.notes && (
                          <div className="bg-gray-50/60 p-2.5 rounded-xl border border-gray-100 text-[10px] text-gray-500 italic mt-3 line-clamp-2">
                            {item.notes}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB: CATEGORIES */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-black uppercase text-gray-450 tracking-wider flex items-center gap-2">
                    <Tag className="w-4 h-4 text-blue-650" />
                    Categorias Cadastradas
                  </h2>
                  <button
                    onClick={() => {
                      setEditingCategory(null);
                      setCategoryForm({ name: '', description: '' });
                      setShowCategoryForm(true);
                    }}
                    className="flex items-center gap-1 bg-[#004c99] hover:bg-blue-800 text-white rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-all"
                  >
                    <Plus className="w-4.5 h-4.5 text-white" />
                    Nova Categoria
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categories.map((item) => (
                    <div key={item.id} className="p-4 border border-gray-150 rounded-2xl flex items-start justify-between bg-gray-50/20 hover:bg-gray-50/60 transition-all">
                      <div className="space-y-1">
                        <h4 className="font-extrabold text-xs text-gray-800 uppercase">{item.name}</h4>
                        <p className="text-[11px] text-gray-500 font-medium">
                          {item.description || 'Nenhuma descrição informada.'}
                        </p>
                      </div>

                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => handleEditCategoryClick(item)}
                          className="p-1.5 text-blue-650 hover:bg-blue-50 rounded"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => item.id && handleDeleteCategoryClick(item.id)}
                          className="p-1.5 text-red-650 hover:bg-red-50 rounded"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: REPORTS & CHARTS */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              {/* Dynamic Query Controls */}
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                <h2 className="text-xs font-black uppercase text-[#004c99] tracking-wider flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filtrar Relatório Financeiro
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1.5">Data Início</label>
                    <input
                      type="date"
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl p-2.5 text-xs font-medium focus:outline-none focus:border-[#004c99] bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1.5">Data Fim</label>
                    <input
                      type="date"
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl p-2.5 text-xs font-medium focus:outline-none focus:border-[#004c99] bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1.5">Categoria de Doação</label>
                    <select
                      value={reportCategory}
                      onChange={(e) => setReportCategory(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl p-2.5 text-xs font-medium focus:outline-none focus:border-[#004c99] bg-gray-50"
                    >
                      <option value="Todas">Todas as categorias</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1.5">Benfeitor</label>
                    <select
                      value={reportBenefactor}
                      onChange={(e) => setReportBenefactor(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl p-2.5 text-xs font-medium focus:outline-none focus:border-[#004c99] bg-gray-50"
                    >
                      <option value="Todos">Todos os benfeitores</option>
                      {benefactors.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={handlePrintReport}
                    className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimir Relatório
                  </button>
                </div>
              </div>

              {/* Stats Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Arrecadação Total</span>
                    <h3 className="text-2xl font-black text-emerald-600 font-mono">
                      {formatCurrency(reportTotalAmount)}
                    </h3>
                  </div>
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                    <PiggyBank className="w-6 h-6 stroke-[2]" />
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Lançamentos de Doação</span>
                    <h3 className="text-2xl font-black text-blue-650 font-mono">
                      {reportCount}
                    </h3>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-650">
                    <TrendingUp className="w-6 h-6 stroke-[2]" />
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Média por Lançamento</span>
                    <h3 className="text-2xl font-black text-amber-500 font-mono">
                      {formatCurrency(reportAverage)}
                    </h3>
                  </div>
                  <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500">
                    <DollarSign className="w-6 h-6 stroke-[2]" />
                  </div>
                </div>
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category Pie Chart */}
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                  <h3 className="text-xs font-black uppercase text-gray-450 tracking-wider flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-[#004c99] rounded-full inline-block"></span>
                    Distribuição por Categoria
                  </h3>
                  
                  {reportByCategoryData.length === 0 ? (
                    <div className="h-[250px] flex items-center justify-center text-xs font-bold text-gray-400 uppercase">
                      Sem dados suficientes para gerar gráfico de categorias
                    </div>
                  ) : (
                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={reportByCategoryData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {reportByCategoryData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Timeline Bar Chart */}
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                  <h3 className="text-xs font-black uppercase text-gray-450 tracking-wider flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block"></span>
                    Evolução do Fluxo de Caixa (Mensal)
                  </h3>

                  {reportTimelineData.length === 0 ? (
                    <div className="h-[250px] flex items-center justify-center text-xs font-bold text-gray-400 uppercase">
                      Sem dados suficientes para gerar gráfico cronológico
                    </div>
                  ) : (
                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={reportTimelineData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" />
                          <YAxis tickFormatter={(val) => `R$${val}`} />
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]}>
                            {reportTimelineData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#10b981' : '#059669'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>

              {/* Printed Output details table (visible on screen too) */}
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                <h3 className="text-xs font-black uppercase text-gray-450 tracking-wider">
                  Detalhamento dos Lançamentos do Período ({reportDonations.length} itens)
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-medium border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-150">
                        <th className="p-3 font-black text-gray-400 uppercase tracking-widest">Data</th>
                        <th className="p-3 font-black text-gray-400 uppercase tracking-widest">Benfeitor</th>
                        <th className="p-3 font-black text-gray-400 uppercase tracking-widest">Categoria</th>
                        <th className="p-3 font-black text-gray-400 uppercase tracking-widest">Campanha</th>
                        <th className="p-3 font-black text-gray-400 uppercase tracking-widest">Método</th>
                        <th className="p-3 font-black text-gray-400 uppercase tracking-widest text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {reportDonations.map((d, index) => (
                        <tr key={d.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'} hover:bg-blue-50/30 transition-colors`}>
                          <td className="p-3 text-gray-500 font-mono">{new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                          <td className="p-3 font-bold text-gray-800">{d.benefactorName}</td>
                          <td className="p-3 text-gray-600">{d.categoryName}</td>
                          <td className="p-3 text-gray-500">{d.campaign || '-'}</td>
                          <td className="p-3 text-gray-500">{d.paymentMethod || 'PIX'}</td>
                          <td className="p-3 text-right font-black text-emerald-600 font-mono">{formatCurrency(d.value)}</td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50/50 font-black">
                        <td colSpan={5} className="p-3 text-right uppercase text-[10px] text-gray-400 tracking-wider">Total do Período:</td>
                        <td className="p-3 text-right text-emerald-650 font-mono text-sm">{formatCurrency(reportTotalAmount)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: DONATION REGISTER FORM */}
      {showDonationForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-100 shadow-2xl flex flex-col p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-black uppercase text-gray-750 flex items-center gap-2">
                <DollarSign className="text-[#004c99]" />
                {editingDonation ? 'Editar Registro de Doação' : 'Lançar Nova Doação Financeira'}
              </h3>
              <button
                onClick={() => setShowDonationForm(false)}
                className="text-gray-400 hover:text-gray-700 font-extrabold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDonationSubmit} className="space-y-4 text-xs font-medium">
              {/* Alerta de Carnê Ativo do Benfeitor Selecionado */}
              {(() => {
                if (!donationForm.benefactorId) return null;
                const activeCarne = carnes.find(c => c.benefactorId === donationForm.benefactorId && c.status === 'ativo');
                if (!activeCarne) return null;
                const pendingCount = activeCarne.parcelas.filter(p => !p.pago).length;
                if (pendingCount === 0) return null;

                return (
                  <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-amber-900 shadow-sm">
                    <div className="flex items-center gap-2">
                      <BookOpen size={18} className="text-amber-600 shrink-0" />
                      <div>
                        <p className="font-extrabold text-xs">Este benfeitor possui Carnê {activeCarne.ano} Ativo</p>
                        <p className="text-[10px] text-amber-700 font-medium">Possui {pendingCount} folha(s) pendente(s) no carnê.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDonationForm(false);
                        setEditingDonation(null);
                        handleOpenBaixaModal(activeCarne);
                      }}
                      className="text-[10px] font-black uppercase bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-xl transition-all shadow-sm shrink-0"
                    >
                      Dar Baixa no Carnê ➔
                    </button>
                  </div>
                );
              })()}

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Benfeitor</label>
                <select
                  value={donationForm.benefactorId}
                  onChange={(e) => handleBenefactorSelectInForm(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#004c99] bg-gray-50 font-semibold"
                >
                  <option value="">Doação Geral / Anônima</option>
                  {benefactors.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.type === 'pf' ? 'PF' : 'PJ'})</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1 italic">
                  Selecione do cadastro ou mantenha em branco para doações espontâneas anônimas.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Categoria</label>
                  <select
                    value={donationForm.categoryId}
                    onChange={(e) => setDonationForm(prev => ({ ...prev, categoryId: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#004c99] bg-gray-50 focus:ring-1 focus:ring-blue-100"
                    required
                  >
                    <option value="">Selecione uma categoria...</option>
                    {categories.filter(c => !c.name.toLowerCase().includes('carnê') && !c.name.toLowerCase().includes('carne')).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Valor da Doação (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={donationForm.value}
                    onChange={(e) => setDonationForm(prev => ({ ...prev, value: e.target.value }))}
                    placeholder="0,00"
                    className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#004c99] bg-gray-50 font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Data</label>
                  <input
                    type="date"
                    value={donationForm.date}
                    onChange={(e) => setDonationForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#004c99] bg-gray-50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Meio de Recebimento</label>
                  <select
                    value={donationForm.paymentMethod}
                    onChange={(e) => setDonationForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#004c99] bg-gray-50 font-bold"
                  >
                    {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Campanha de Captação</label>
                <select
                  value={donationForm.campaign}
                  onChange={(e) => setDonationForm(prev => ({ ...prev, campaign: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#004c99] bg-gray-50 font-bold"
                >
                  {campaigns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Observações / Descrição</label>
                <textarea
                  value={donationForm.notes}
                  onChange={(e) => setDonationForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Se necessário, forneça informações adicionais da doação."
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#004c99] bg-gray-50 font-semibold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowDonationForm(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-black uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#004c99] hover:bg-blue-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md"
                >
                  Salvar Registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BENEFACTOR REGISTER FORM */}
      {showBenefactorForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-100 shadow-2xl flex flex-col p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-black uppercase text-gray-750 flex items-center gap-2">
                <Users className="text-emerald-600" />
                {editingBenefactor ? 'Editar Benfeitor' : 'Cadastrar Novo Benfeitor'}
              </h3>
              <button
                onClick={() => setShowBenefactorForm(false)}
                className="text-gray-400 hover:text-gray-700 font-extrabold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBenefactorSubmit} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Nome Completo / Razão Social</label>
                <input
                  type="text"
                  value={benefactorForm.name}
                  onChange={(e) => setBenefactorForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome do Doador ou Empresa"
                  className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#004c99] bg-gray-50 font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Tipo de Cadastro</label>
                  <select
                    value={benefactorForm.type}
                    onChange={(e) => setBenefactorForm(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#004c99] bg-gray-50"
                  >
                    <option value="pf">Pessoa Física</option>
                    <option value="pj">Pessoa Jurídica (Empresa)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">CPF ou CNPJ</label>
                  <input
                    type="text"
                    value={benefactorForm.cpfCnpj}
                    onChange={(e) => setBenefactorForm(prev => ({ ...prev, cpfCnpj: e.target.value }))}
                    placeholder="Apenas números"
                    className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#004c99] bg-gray-50 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Telefone</label>
                  <input
                    type="text"
                    value={benefactorForm.phone}
                    onChange={(e) => setBenefactorForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(00) 00000-0000"
                    className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#004c99] bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Email</label>
                  <input
                    type="email"
                    value={benefactorForm.email}
                    onChange={(e) => setBenefactorForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="exemplo@email.com"
                    className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#004c99] bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Categoria Preferencial / Vínculo padrão</label>
                <select
                  value={benefactorForm.defaultCategory}
                  onChange={(e) => setBenefactorForm(prev => ({ ...prev, defaultCategory: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#004c99] bg-gray-50 font-bold"
                >
                  <option value="">Nenhuma padrão vinculada</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <p className="text-[10px] text-gray-400 mt-1 italic">
                  Quando o benfeitor for selecionado na tela de lançamento, esta categoria será preenchida automaticamente.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Observações Internas</label>
                <textarea
                  value={benefactorForm.notes}
                  onChange={(e) => setBenefactorForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Histórico de contato, preferências individuais, etc."
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#004c99] bg-gray-50 font-semibold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowBenefactorForm(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-black uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md"
                >
                  Salvar Benfeitor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CATEGORY REGISTER FORM */}
      {showCategoryForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-gray-100 shadow-2xl flex flex-col p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-black uppercase text-gray-750 flex items-center gap-2">
                <Tag className="text-blue-650" />
                {editingCategory ? 'Editar Categoria' : 'Criar Nova Categoria de Doação'}
              </h3>
              <button
                onClick={() => setShowCategoryForm(false)}
                className="text-gray-400 hover:text-gray-700 font-extrabold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCategorySubmit} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Título/Nome da Categoria</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Doações por carnê, Emendas Parlamentares..."
                  className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#004c99] bg-gray-50 font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Descrição/Finalidade</label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Insira detalhes rápidos da finalidade do uso"
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#004c99] bg-gray-50 font-semibold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCategoryForm(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-black uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#004c99] hover:bg-blue-800 text-white rounded-xl text-xs font-black uppercase tracking-wider"
                >
                  Salvar Categoria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW CARNÊ FORM */}
      {showCarneForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-gray-100 shadow-2xl flex flex-col p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-black uppercase text-gray-800 flex items-center gap-2">
                <BookOpen className="text-amber-600" />
                Emitir Novo Carnê de Benfeitor (12 Folhas)
              </h3>
              <button
                onClick={() => setShowCarneForm(false)}
                className="text-gray-400 hover:text-gray-700 font-extrabold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCarneSubmit} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">
                  Selecione o Benfeitor *
                </label>
                <select
                  value={carneForm.benefactorId}
                  onChange={(e) => {
                    const bId = e.target.value;
                    const b = benefactors.find(x => x.id === bId);
                    setCarneForm(prev => ({
                      ...prev,
                      benefactorId: bId,
                      categoryId: b?.defaultCategory || prev.categoryId
                    }));
                  }}
                  className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#004c99] bg-gray-50 font-bold"
                  required
                >
                  <option value="">-- Escolha um Benfeitor Cadastrado --</option>
                  {benefactors.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.cpfCnpj ? `(${b.cpfCnpj})` : ''}
                    </option>
                  ))}
                </select>
                {benefactors.length === 0 && (
                  <p className="text-[10px] text-amber-600 font-bold mt-1">
                    Nenhum benfeitor cadastrado. Cadastre um benfeitor antes de gerar o carnê.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">
                    Ano do Carnê *
                  </label>
                  <input
                    type="number"
                    value={carneForm.ano}
                    onChange={(e) => setCarneForm(prev => ({ ...prev, ano: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#004c99] bg-gray-50 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">
                    Valor por Folha / Mês (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={carneForm.valorParcela}
                    onChange={(e) => setCarneForm(prev => ({ ...prev, valorParcela: e.target.value }))}
                    placeholder="Ex: 50.00"
                    className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#004c99] bg-gray-50 font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">
                  Categoria da Receita
                </label>
                <select
                  value={carneForm.categoryId}
                  onChange={(e) => setCarneForm(prev => ({ ...prev, categoryId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#004c99] bg-gray-50 font-bold"
                >
                  <option value="">Carnês de mensalidade (Padrão)</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">
                  Observações do Carnê
                </label>
                <textarea
                  value={carneForm.notes}
                  onChange={(e) => setCarneForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Ex: Entregue presencialmente na sede, cobrança via mensalista..."
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#004c99] bg-gray-50 font-semibold"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100 text-[11px] text-amber-800 space-y-1">
                <p className="font-extrabold flex items-center gap-1">
                  <Info size={14} /> O sistema criará 12 folhas mensais de cobrança
                </p>
                <p className="text-[10px] text-amber-700">
                  O valor total previsto do carnê será de <span className="font-black">R$ {((parseFloat(carneForm.valorParcela || '0') || 0) * 12).toFixed(2)}</span>. Conforme o benfeitor for pagando (uma ou mais folhas), você poderá dar baixa facilmente.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCarneForm(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-black uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md"
                >
                  Gerar Carnê (12 Folhas)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BAIXA DE PARCELAS / FOLHAS DO CARNÊ */}
      {selectedCarneForBaixa && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-gray-100 shadow-2xl flex flex-col p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <span className="text-[9px] font-black text-amber-800 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded-md">
                  Carnê {selectedCarneForBaixa.ano}
                </span>
                <h3 className="text-sm font-black uppercase text-gray-800 mt-1">
                  Baixa de Folhas - {selectedCarneForBaixa.benefactorName}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenWhatsAppModal(selectedCarneForBaixa)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all"
                >
                  <MessageSquare size={14} />
                  <span>Enviar WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCarneForBaixa(null)}
                  className="text-gray-400 hover:text-gray-700 font-extrabold text-sm p-1"
                >
                  ✕
                </button>
              </div>
            </div>

            <form onSubmit={handleConfirmBaixaSubmit} className="space-y-4 text-xs font-medium">
              {/* Header info bar */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-gray-100 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Valor por Folha</span>
                  <span className="text-sm font-black text-[#004c99]">R$ {selectedCarneForBaixa.valorParcela.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Folhas Já Quitando</span>
                  <span className="text-sm font-black text-emerald-600">
                    {selectedCarneForBaixa.parcelas.filter(p => p.pago).length} de 12
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Pendentes</span>
                  <span className="text-sm font-black text-amber-600">
                    {12 - selectedCarneForBaixa.parcelas.filter(p => p.pago).length} folha(s)
                  </span>
                </div>
              </div>

              {/* Selection Header */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                    Selecione as Folhas para Dar Baixa:
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllUnpaidParcelas}
                      className="text-[10px] font-bold text-[#004c99] hover:underline"
                    >
                      Marcar todas pendentes
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={handleClearParcelaSelection}
                      className="text-[10px] font-bold text-gray-400 hover:underline"
                    >
                      Limpar
                    </button>
                  </div>
                </div>

                {/* Grid of 12 Folhas with Checkboxes */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {selectedCarneForBaixa.parcelas.map((p) => {
                    const isSelected = selectedParcelasNumbers.includes(p.numero);
                    return (
                      <div
                        key={p.numero}
                        onClick={() => handleToggleParcelaSelection(p.numero, p.pago)}
                        className={`p-3 rounded-2xl border text-left cursor-pointer transition-all select-none flex flex-col justify-between ${
                          p.pago
                            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800 opacity-80 cursor-not-allowed'
                            : isSelected
                            ? 'bg-blue-50 border-[#004c99] ring-2 ring-blue-200 text-[#004c99]'
                            : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider">
                            Mês {p.numero}
                          </span>
                          <input
                            type="checkbox"
                            checked={p.pago || isSelected}
                            disabled={p.pago}
                            onChange={() => handleToggleParcelaSelection(p.numero, p.pago)}
                            className="rounded border-gray-300 text-[#004c99] focus:ring-[#004c99]"
                          />
                        </div>

                        <div className="mt-2">
                          <span className="text-xs font-black block">
                            R$ {p.valor.toFixed(2)}
                          </span>
                          <span className="text-[9px] font-bold text-gray-400 block">
                            {p.pago ? `Quitada (${p.formaPagamento || 'PIX'})` : isSelected ? 'Selecionada' : 'Pendente'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total Summary box */}
              <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider block">
                    Resumo do Lançamento
                  </span>
                  <span className="text-xs font-bold text-[#004c99]">
                    {selectedParcelasNumbers.length} folha(s) selecionada(s)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider block">
                    Valor Total a Baixar
                  </span>
                  <span className="text-base font-black text-emerald-600">
                    R$ {(selectedParcelasNumbers.length * selectedCarneForBaixa.valorParcela).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Payment details inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">
                    Data do Pagamento *
                  </label>
                  <input
                    type="date"
                    value={baixaForm.dataPagamento}
                    onChange={(e) => setBaixaForm(prev => ({ ...prev, dataPagamento: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:border-[#004c99] bg-gray-50 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">
                    Forma de Pagamento *
                  </label>
                  <select
                    value={baixaForm.formaPagamento}
                    onChange={(e) => setBaixaForm(prev => ({ ...prev, formaPagamento: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:border-[#004c99] bg-gray-50 font-bold"
                  >
                    {paymentMethods.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">
                  Anotações / Recibo da Baixa
                </label>
                <input
                  type="text"
                  value={baixaForm.notes}
                  onChange={(e) => setBaixaForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Ex: Pago via PIX pelo benfeitor, número do comprovante..."
                  className="w-full border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:border-[#004c99] bg-gray-50 font-semibold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setSelectedCarneForBaixa(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-black uppercase tracking-wider"
                  disabled={isSubmittingBaixa}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBaixa || selectedParcelasNumbers.length === 0}
                  className={`px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md flex items-center gap-1.5 ${
                    (isSubmittingBaixa || selectedParcelasNumbers.length === 0) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isSubmittingBaixa ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Processando Baixa...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Confirmar Baixa de {selectedParcelasNumbers.length} Folha(s)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: COMUNICAÇÃO VIA WHATSAPP */}
      {showWhatsAppModal && whatsAppCarne && whatsAppBenefactor && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[160] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-gray-100 shadow-2xl flex flex-col p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-50 rounded-2xl text-emerald-600">
                  <MessageSquare size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-gray-850">
                    Enviar WhatsApp - Benfeitor
                  </h3>
                  <p className="text-xs text-gray-400 font-bold">
                    {whatsAppBenefactor.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWhatsAppModal(false)}
                className="text-gray-400 hover:text-gray-700 font-extrabold text-sm p-1"
              >
                ✕
              </button>
            </div>

            {/* Benefactor Phone Status Info */}
            {(() => {
              const rawPhone = whatsAppBenefactor.phone;
              const cleanPhone = formatPhoneNumber(rawPhone);
              const hasValidPhone = cleanPhone && cleanPhone.length >= 10;

              return (
                <div className="space-y-4 text-xs font-medium">
                  {/* Phone Badge / Warning */}
                  {!hasValidPhone ? (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />
                        <div>
                          <span className="font-extrabold block text-xs">Telefone Não Cadastrado</span>
                          <span className="text-[10px] text-amber-700 font-semibold block">
                            O benfeitor não possui número com DDD válido.
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowWhatsAppModal(false);
                          setEditingBenefactor(whatsAppBenefactor);
                          setBenefactorForm({
                            name: whatsAppBenefactor.name || '',
                            type: whatsAppBenefactor.type || 'pf',
                            cpfCnpj: whatsAppBenefactor.cpfCnpj || '',
                            phone: whatsAppBenefactor.phone || '',
                            email: whatsAppBenefactor.email || '',
                            defaultCategory: whatsAppBenefactor.defaultCategory || '',
                            notes: whatsAppBenefactor.notes || ''
                          });
                          setShowBenefactorForm(true);
                        }}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex-shrink-0 shadow-sm"
                      >
                        Editar Cadastro
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-2xl flex items-center justify-between text-emerald-900">
                      <div className="flex items-center gap-2">
                        <Phone size={15} className="text-emerald-600" />
                        <span className="text-xs font-bold">
                          Destinatário: <span className="font-black text-emerald-950">{getDisplayPhone(rawPhone)}</span>
                        </span>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-200/60 text-emerald-800 px-2 py-0.5 rounded-md">
                        Validade do Número OK
                      </span>
                    </div>
                  )}

                  {/* Selecting Communication Type */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1.5">
                      1. Selecione o Tipo de Mensagem:
                    </label>

                    {(() => {
                      const paidParcelas = (whatsAppCarne.parcelas || []).filter(p => p.pago);
                      const unpaidParcelas = (whatsAppCarne.parcelas || []).filter(p => !p.pago);

                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleTypeChangeInWhatsAppModal('agradecimento')}
                            disabled={paidParcelas.length === 0}
                            className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                              whatsAppType === 'agradecimento'
                                ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200 text-emerald-900'
                                : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
                            } ${paidParcelas.length === 0 ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1 text-emerald-700">
                                <HeartHandshake size={14} /> Agradecimento
                              </span>
                              {whatsAppType === 'agradecimento' && <Check size={14} className="text-emerald-600 stroke-[3]" />}
                            </div>
                            <span className="text-[10px] text-gray-400 font-semibold mt-1">
                              {paidParcelas.length > 0 ? `${paidParcelas.length} folha(s) quitada(s)` : 'Nenhuma folha paga ainda'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleTypeChangeInWhatsAppModal('lembrete')}
                            disabled={unpaidParcelas.length === 0}
                            className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                              whatsAppType === 'lembrete'
                                ? 'bg-blue-50 border-[#004c99] ring-2 ring-blue-200 text-[#004c99]'
                                : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
                            } ${unpaidParcelas.length === 0 ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1 text-[#004c99]">
                                <Info size={14} /> Lembrete Amigável
                              </span>
                              {whatsAppType === 'lembrete' && <Check size={14} className="text-[#004c99] stroke-[3]" />}
                            </div>
                            <span className="text-[10px] text-gray-400 font-semibold mt-1">
                              {unpaidParcelas.length > 0 ? `${unpaidParcelas.length} folha(s) pendente(s)` : 'Todas as folhas quitadas'}
                            </span>
                          </button>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Selecting Parcela */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">
                      2. Selecione a Parcela / Mês de Referência:
                    </label>
                    <select
                      value={whatsAppSelectedParcelaNum}
                      onChange={(e) => handleParcelaChangeInWhatsAppModal(Number(e.target.value))}
                      className="w-full border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:border-[#004c99] bg-gray-50 font-bold"
                    >
                      {whatsAppType === 'agradecimento' ? (
                        (whatsAppCarne.parcelas || []).filter(p => p.pago).map(p => (
                          <option key={p.numero} value={p.numero}>
                            Folha {p.numero}/12 ({p.mesReferencia}) - R$ {p.valor.toFixed(2)} [Paga em {p.dataPagamento ? new Date(p.dataPagamento + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/A'}]
                          </option>
                        ))
                      ) : (
                        (whatsAppCarne.parcelas || []).filter(p => !p.pago).map(p => (
                          <option key={p.numero} value={p.numero}>
                            Folha {p.numero}/12 ({p.mesReferencia}) - R$ {p.valor.toFixed(2)} [Pendente]
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Message Editor */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider">
                        3. Mensagem para Revisão e Envio:
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const bName = whatsAppBenefactor?.name || whatsAppCarne.benefactorName;
                          const defaultTxt = generateWhatsAppText(whatsAppCarne, bName, whatsAppType, whatsAppSelectedParcelaNum);
                          setWhatsAppCustomText(defaultTxt);
                        }}
                        className="text-[10px] font-bold text-[#004c99] hover:underline"
                      >
                        Restaurar Modelo Padrão
                      </button>
                    </div>

                    <textarea
                      value={whatsAppCustomText}
                      onChange={(e) => setWhatsAppCustomText(e.target.value)}
                      rows={5}
                      className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#004c99] bg-gray-50 font-medium text-xs leading-relaxed"
                    />

                    {/* Prohibited words warning */}
                    {['dívida', 'divida', 'cobrança', 'cobranca', 'inadimplente', 'valor devido', 'débito', 'debito'].some(w => whatsAppCustomText.toLowerCase().includes(w)) && (
                      <div className="mt-1.5 p-2 bg-red-50 border border-red-100 rounded-xl text-[10px] text-red-800 font-bold flex items-center gap-1.5">
                        <AlertCircle size={13} className="text-red-600 flex-shrink-0" />
                        <span>Atenção: evite utilizar palavras de cobrança ou dívida. O lembrete deve sempre reforçar que a contribuição é espontânea e voluntária.</span>
                      </div>
                    )}
                  </div>

                  {/* Informative footer note */}
                  <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-100 text-[10px] text-gray-600 space-y-1">
                    <p className="font-extrabold text-[#004c99] flex items-center gap-1">
                      <Info size={13} /> Ao clicar em "Abrir no WhatsApp", o aplicativo/navegador será aberto com esta mensagem preenchida para seu envio manual.
                    </p>
                    <p className="text-gray-500">
                      O sistema registrará internamente apenas que a mensagem foi gerada e preparada, sem afirmar entrega ou leitura.
                    </p>
                  </div>

                  {/* Previous Communication History (If exists) */}
                  {whatsAppCarne.whatsappLogs && whatsAppCarne.whatsappLogs.length > 0 && (
                    <div className="pt-2 border-t border-gray-100">
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-2">
                        Histórico de Comunicações deste Carnê:
                      </span>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                        {whatsAppCarne.whatsappLogs.map((log: CarneWhatsAppLog) => (
                          <div key={log.id} className="p-2 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between text-[10px]">
                            <div>
                              <span className="font-black text-gray-800 uppercase">
                                {log.messageType === 'agradecimento' ? 'Agradecimento' : 'Lembrete Amigável'}
                              </span>
                              <span className="text-gray-400 block">
                                {new Date(log.date).toLocaleString('pt-BR')} por {log.userResponsible}
                              </span>
                            </div>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-black rounded-md uppercase text-[9px]">
                              Preparada
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(whatsAppCustomText);
                        setWhatsAppCopied(true);
                        setTimeout(() => setWhatsAppCopied(false), 2000);
                      }}
                      className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                    >
                      <Copy size={13} />
                      {whatsAppCopied ? 'Texto Copiado!' : 'Copiar Texto'}
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowWhatsAppModal(false)}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-black uppercase tracking-wider"
                      >
                        Cancelar
                      </button>

                      <button
                        type="button"
                        onClick={handleSendWhatsAppMessage}
                        disabled={!hasValidPhone || isLoggingWhatsApp}
                        className={`px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md flex items-center gap-1.5 transition-all ${
                          (!hasValidPhone || isLoggingWhatsApp) ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <Send size={14} />
                        <span>Abrir no WhatsApp</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      )}

      {/* MODAL: CAIXINHA MOVEMENT FORM */}
      {showCaixinhaForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2 text-[#004c99]">
                <Wallet className="w-5 h-5" />
                <h3 className="text-base font-black uppercase tracking-tight">
                  {editingCaixinhaMovement ? 'Editar Movimentação da Caixinha' : 'Novo Lançamento na Caixinha'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowCaixinhaForm(false);
                  setEditingCaixinhaMovement(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCaixinhaSubmit} className="space-y-4 mt-5">
              {/* Type Switcher (Entrada vs Saída) */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                  Tipo de Movimentação *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCaixinhaForm(prev => ({ ...prev, type: 'saida', category: 'servico_sem_nota' }))}
                    className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 border-2 transition-all ${
                      caixinhaForm.type === 'saida'
                        ? 'bg-rose-50 border-rose-600 text-rose-700 shadow-xs'
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <ArrowDownRight size={16} className={caixinhaForm.type === 'saida' ? 'text-rose-600' : 'text-gray-400'} />
                    Saída (-) / Despesa
                  </button>

                  <button
                    type="button"
                    onClick={() => setCaixinhaForm(prev => ({ ...prev, type: 'entrada', category: 'entrada_avulsa' }))}
                    className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 border-2 transition-all ${
                      caixinhaForm.type === 'entrada'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-700 shadow-xs'
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <ArrowUpRight size={16} className={caixinhaForm.type === 'entrada' ? 'text-emerald-600' : 'text-gray-400'} />
                    Entrada (+) / Reforço
                  </button>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                  Categoria / Finalidade *
                </label>
                <select
                  value={caixinhaForm.category}
                  onChange={(e) => setCaixinhaForm(prev => ({ ...prev, category: e.target.value as any }))}
                  required
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-[#004c99]"
                >
                  {caixinhaForm.type === 'saida' ? (
                    <>
                      <option value="servico_sem_nota">Serviço sem Nota Fiscal (Pedreiro, Jardineiro, Frete, Diária, etc.)</option>
                      <option value="deposito_bancario">Depósito Bancário (Envio de dinheiro para conta corrente do banco)</option>
                      <option value="despesa_miuda">Despesa Miúda / Suprimentos Urgentes</option>
                      <option value="alimentacao_diaria">Alimentação / Lanche de Voluntários / Diárias</option>
                      <option value="outro">Outra Saída em Dinheiro</option>
                    </>
                  ) : (
                    <>
                      <option value="entrada_avulsa">Reforço de Caixa / Entrada em Dinheiro</option>
                      <option value="doacao_dinheiro">Doação Avulsa em Dinheiro</option>
                      <option value="carne_dinheiro">Carnê / Parcela em Dinheiro</option>
                      <option value="outro">Outra Entrada em Dinheiro</option>
                    </>
                  )}
                </select>
              </div>

              {/* Valor & Data */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                    Valor (R$) *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs font-bold text-gray-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={caixinhaForm.value}
                      onChange={(e) => setCaixinhaForm(prev => ({ ...prev, value: e.target.value }))}
                      required
                      placeholder="0,00"
                      className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-black text-gray-800 focus:outline-none focus:border-[#004c99]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                    Data da Movimentação *
                  </label>
                  <input
                    type="date"
                    value={caixinhaForm.date}
                    onChange={(e) => setCaixinhaForm(prev => ({ ...prev, date: e.target.value }))}
                    required
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-[#004c99]"
                  />
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                  Descrição / Motivo Detalhado *
                </label>
                <input
                  type="text"
                  value={caixinhaForm.description}
                  onChange={(e) => setCaixinhaForm(prev => ({ ...prev, description: e.target.value }))}
                  required
                  placeholder={
                    caixinhaForm.category === 'servico_sem_nota'
                      ? 'Ex: Pagamento da capina do pátio ao Sr. João (diária)'
                      : caixinhaForm.category === 'deposito_bancario'
                      ? 'Ex: Depósito do excesso de dinheiro no Banco do Brasil - Ag 1234'
                      : 'Ex: Compra de lâmpadas e fita isolante para manutenção'
                  }
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:border-[#004c99]"
                />
              </div>

              {/* Responsável / Favorecido & Nº Recibo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                    Responsável / Favorecido
                  </label>
                  <input
                    type="text"
                    value={caixinhaForm.responsible}
                    onChange={(e) => setCaixinhaForm(prev => ({ ...prev, responsible: e.target.value }))}
                    placeholder="Ex: João da Silva / Tesouraria"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:border-[#004c99]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                    Nº Recibo / Comprovante (opcional)
                  </label>
                  <input
                    type="text"
                    value={caixinhaForm.receiptNumber}
                    onChange={(e) => setCaixinhaForm(prev => ({ ...prev, receiptNumber: e.target.value }))}
                    placeholder="Ex: Recibo nº 42 / Comprovante 981"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:border-[#004c99]"
                  />
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                  Observações Extras (opcional)
                </label>
                <textarea
                  rows={2}
                  value={caixinhaForm.notes}
                  onChange={(e) => setCaixinhaForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Informações adicionais sobre o pagamento ou autorização..."
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:border-[#004c99] resize-none"
                ></textarea>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowCaixinhaForm(false);
                    setEditingCaixinhaMovement(null);
                  }}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-6 py-2.5 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all ${
                    caixinhaForm.type === 'saida' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {editingCaixinhaMovement ? 'Atualizar Lançamento' : 'Confirmar Lançamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
