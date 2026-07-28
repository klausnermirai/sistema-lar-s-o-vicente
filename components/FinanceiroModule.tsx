import React, { useState, useEffect } from 'react';
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
  Info
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
  deleteDonation 
} from '../lib/api';
import { Benefactor, DonationCategory, FinanceDonation } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

interface FinanceiroModuleProps {
  session: any;
  settings: any;
}

type TabType = 'donations' | 'benefactors' | 'categories' | 'reports';

export const FinanceiroModule: React.FC<FinanceiroModuleProps> = ({ session, settings }) => {
  const [activeTab, setActiveTab] = useState<TabType>('donations');
  const [loading, setLoading] = useState(true);

  // Data States
  const [donations, setDonations] = useState<FinanceDonation[]>([]);
  const [benefactors, setBenefactors] = useState<Benefactor[]>([]);
  const [categories, setCategories] = useState<DonationCategory[]>([]);

  // Search/Filters
  const [donationSearch, setDonationSearch] = useState('');
  const [benefactorSearch, setBenefactorSearch] = useState('');
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState('Todas');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('Todas');

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

  const campaigns = ['Doação Espontânea', 'Telemarketing', 'Carnês', 'Mensalidade', 'Campanha de Natal', 'Outros'];
  const paymentMethods = ['PIX', 'Dinheiro', 'Transferência Bancária', 'Carnê', 'Boleto', 'Cartão de Crédito'];

  // Load Data
  const loadModuleData = async () => {
    setLoading(true);
    try {
      const [donationsData, benefactorsData, categoriesData] = await Promise.all([
        fetchDonations().catch(() => []),
        fetchBenefactors().catch(() => []),
        fetchDonationCategories().catch(() => [])
      ]);
      setDonations(donationsData);
      setBenefactors(benefactorsData);
      setCategories(categoriesData);
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
        <div className="flex items-center gap-2">
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
            className="flex items-center gap-1 bg-[#004c99] hover:bg-blue-800 text-white rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-all"
          >
            <Plus className="w-4 h-4 text-white" />
            Lançar Doação
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
            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-all"
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
                        filteredDonations.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50/50 transition-all font-medium text-xs">
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
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => item.id && handleDeleteBenefactorClick(item.id)}
                                className="p-1 text-red-650 hover:bg-red-55 rounded"
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
                          </div>
                        </div>

                        {item.notes && (
                          <div className="bg-gray-50/60 p-2.5 rounded-xl border border-gray-100 text-[10px] text-gray-500 italic mt-4 line-clamp-2">
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
                      {reportDonations.map((d) => (
                        <tr key={d.id} className="hover:bg-gray-50/50">
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
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                  placeholder="Se necessário, forneça informações adicionais, detalhes do carnê, etc."
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
    </div>
  );
};
