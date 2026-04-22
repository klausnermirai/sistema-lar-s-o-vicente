
import React, { useState, ReactNode, useEffect } from 'react';
import { 
  BarChart3, 
  Calendar, 
  ChevronRight, 
  CircleAlert, 
  CircleCheck, 
  Download, 
  Filter, 
  Info, 
  LayoutDashboard, 
  LogOut,
  MoreVertical, 
  Search,
  Settings,
  ShieldCheck,
  User,
  UserPlus,
  Trash2,
  Wallet,
  Database,
  Upload,
  X,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  fetchAmendmentCategories, 
  saveAmendmentCategory, 
  deleteAmendmentCategory,
  fetchAmendmentGrants,
  saveAmendmentGrant,
  deleteAmendmentGrant,
  bulkBootstrapAmendments
} from '../lib/amendmentService';

export interface Grant {
  id: string;
  name: string;
  color: string;
  totalValue: number;
  periodMonths: number;
  allocations: { categoryId: string, amount: number }[];
  startMonth: number; // 0 for April, etc.
  type: 'Emenda parlamentar' | 'Subvenção municipal' | 'Emenda Impositiva (vereadores)';
  nature: 'Custeio' | 'Investimento';
  accountability: 'Direta com o município' | 'Via São Paulo Sem Papel';
  status: 'Oficiada' | 'Em Elaboração' | 'Paga';
  institutionId?: string;
}

export interface Category {
  id: string;
  name: string;
  monthlyAverage: number;
  institutionId?: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'juridica', name: 'ACESSORIA JURÍDICA', monthlyAverage: 1621 },
  { id: 'combustivel', name: 'COMBUSTÍVEL', monthlyAverage: 500 },
  { id: 'energia', name: 'ENERGIA ELÉTRICA', monthlyAverage: 6000 },
  { id: 'gas', name: 'GÁS DE COZINHA', monthlyAverage: 2500 },
  { id: 'alimentos', name: 'GÊNEROS ALIMENTÍCIOS', monthlyAverage: 4000 },
  { id: 'carne', name: 'GÊNEROS ALIMENTÍCIOS (CARNE)', monthlyAverage: 10000 },
  { id: 'manutencao_predial_e_reparos_1776632341134', name: 'MANUTENÇÃO PREDIAL E REPAROS', monthlyAverage: 2000 },
  { id: 'manutencao_veicular_1776632361088', name: 'MANUTENÇÃO VEICULAR', monthlyAverage: 400 },
  { id: 'copa', name: 'MATERIAL DE COPA E COZINHA', monthlyAverage: 1600 },
  { id: 'escritorio', name: 'MATERIAL DE ESCRITÓRIO', monthlyAverage: 400 },
  { id: 'limpeza', name: 'MATERIAL DE LIMPEZA', monthlyAverage: 4500 },
  { id: 'higiene', name: 'PRODUTOS DE HIGIÊNE PESSOAL', monthlyAverage: 1500 },
  { id: 'salarios', name: 'SALÁRIOS', monthlyAverage: 85000 },
  { id: 'contabeis', name: 'SERVIÇOS CONTÁBEIS', monthlyAverage: 2149 },
  { id: 'fotovoltaico', name: 'SISTEMA FOTOVOLTAICO', monthlyAverage: 0 },
  { id: 'sistemas__1776633200266', name: 'SISTEMAS ', monthlyAverage: 450 },
  { id: 'uniformes', name: 'UNIFORMES', monthlyAverage: 1000 },
  { id: 'agua', name: 'ÁGUA E ESGOTO', monthlyAverage: 2250 },
];

export const MONTHS = [
  'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO', 'JANEIRO', 'FEVEREIRO', 'MARÇO'
];

interface PlanningEmendasModuleProps {
  institutionId: string;
}

export const PlanningEmendasModule: React.FC<PlanningEmendasModuleProps> = ({ institutionId }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrant, setSelectedGrant] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'dashboard' | 'analysis' | 'categories' | 'grants'>('dashboard');
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [detailsGrantId, setDetailsGrantId] = useState<string | null>(null);
  const [editingGrantId, setEditingGrantId] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatValue, setNewCatValue] = useState('');
  const [newGrant, setNewGrant] = useState<Partial<Grant>>({
    type: 'Emenda parlamentar',
    nature: 'Custeio',
    accountability: 'Direta com o município',
    status: 'Oficiada',
    startMonth: 0,
    periodMonths: 12,
    allocations: [],
    color: '#3b82f6',
    totalValue: 0,
    name: ''
  });

  useEffect(() => {
    loadData();
  }, [institutionId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const fetchedCats = await fetchAmendmentCategories(institutionId);
      const fetchedGrants = await fetchAmendmentGrants(institutionId);
      
      if (fetchedCats.length === 0) {
        // Bootstrap if empty for this institution
        // const boot = await bulkBootstrapAmendments(institutionId, DEFAULT_CATEGORIES, []);
        // setCategories(DEFAULT_CATEGORIES);
        // For now just set state and save later as needed, or use the bootstrap
        setCategories(DEFAULT_CATEGORIES);
      } else {
        setCategories(fetchedCats);
      }
      setGrants(fetchedGrants);
    } catch (err) {
      console.error("Error loading amendment data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (name: string, monthlyAverage: number) => {
    try {
      const id = 'new_' + Date.now();
      const newCat = { id, name, monthlyAverage };
      const saved = await saveAmendmentCategory(institutionId, newCat);
      setCategories(prev => [...prev, saved]);
    } catch (error) {
      console.error("Erro ao adicionar categoria:", error);
    }
  };

  const updateCategory = async (id: string, field: keyof Category, value: string | number) => {
    try {
      const target = categories.find(c => c.id === id);
      if (!target) return;
      const updatedCat = { ...target, [field]: value };
      const saved = await saveAmendmentCategory(institutionId, updatedCat);
      setCategories(prev => prev.map(c => c.id === id ? saved : c));
    } catch (error) {
      console.error("Update failed", error);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta categoria? Isso pode afetar as análises se houver emendas alocadas nela.")) return;
    try {
      await deleteAmendmentCategory(id);
      setCategories(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error("Erro ao excluir categoria:", error);
    }
  };

  const handleSaveGrant = async () => {
    if (!newGrant.name || (newGrant.totalValue || 0) <= 0 || (newGrant.allocations || []).length === 0) {
      alert("Por favor, preencha todos os campos obrigatórios e defina o plano de aplicação.");
      return;
    }

    try {
      const grantData: Grant = {
        id: editingGrantId || `grant_${Date.now()}`,
        name: newGrant.name!,
        color: newGrant.color || '#3b82f6',
        totalValue: newGrant.totalValue!,
        periodMonths: newGrant.periodMonths!,
        startMonth: newGrant.startMonth!,
        allocations: newGrant.allocations!,
        type: newGrant.type as any,
        nature: newGrant.nature as any,
        accountability: newGrant.accountability as any,
        status: newGrant.status as any,
      };

      const saved = await saveAmendmentGrant(institutionId, grantData);
      if (editingGrantId) {
        setGrants(prev => prev.map(g => g.id === editingGrantId ? saved : g));
      } else {
        setGrants(prev => [...prev, saved]);
      }
      
      setIsGrantModalOpen(false);
      setEditingGrantId(null);
      setNewGrant({
        type: 'Emenda parlamentar',
        nature: 'Custeio',
        accountability: 'Direta com o município',
        status: 'Oficiada',
        startMonth: 0,
        periodMonths: 12,
        allocations: [],
        color: '#3b82f6',
        totalValue: 0,
        name: ''
      });
    } catch (error) {
      console.error("Erro ao salvar emenda:", error);
      alert("Erro ao salvar emenda.");
    }
  };

  const handleEditGrant = (grant: Grant) => {
    setEditingGrantId(grant.id);
    setNewGrant(grant);
    setIsGrantModalOpen(true);
  };

  const handleDeleteGrant = async (grantId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta emenda?")) return;
    try {
      await deleteAmendmentGrant(grantId);
      setGrants(prev => prev.filter(g => g.id !== grantId));
    } catch (error) {
      console.error("Erro ao excluir emenda:", error);
    }
  };

  const handleResetToOfficialData = async () => {
    if (!confirm("Isso apagará todas as emendas e categorias atuais para carregar os dados oficiais. Continuar?")) return;

    try {
      const grantsToBootstrap = [
        {
          periodMonths: 12,
          allocations: [{ amount: 100000, categoryId: "fotovoltaico" }],
          accountability: "Direta com o município",
          type: "Emenda parlamentar",
          nature: "Investimento",
          status: "Paga",
          startMonth: 0,
          name: "SPSP - T. COIMBRA (36444-4)",
          id: "coimbra_36444",
          color: "#84cc16",
          totalValue: 100000
        },
        {
          color: "#3b82f6",
          totalValue: 76540.1,
          status: "Paga",
          nature: "Custeio",
          startMonth: 0,
          name: "SUB. ESTADUAL (108237-X)",
          id: "est_108237",
          type: "Subvenção municipal",
          accountability: "Direta com o município",
          allocations: [
            { categoryId: "agua", amount: 29280 },
            { categoryId: "gas", amount: 43200 },
            { categoryId: "alimentos", amount: 4060.1 }
          ],
          periodMonths: 9
        },
        {
          accountability: "Direta com o município",
          allocations: [{ amount: 17520, categoryId: "salarios" }],
          periodMonths: 9,
          id: "fed_108238",
          name: "SUB. FEDERAL (108238-8)",
          startMonth: 0,
          nature: "Custeio",
          status: "Paga",
          type: "Emenda parlamentar",
          totalValue: 17520,
          color: "#10b981"
        },
        {
          color: "#ef4444",
          totalValue: 18000,
          periodMonths: 9,
          allocations: [
            { amount: 3000, categoryId: "combustivel" },
            { amount: 3000, categoryId: "escritorio" },
            { amount: 12000, categoryId: "uniformes" }
          ],
          accountability: "Direta com o município",
          type: "Emenda parlamentar",
          name: "SUB. FEDERAL (108488-7)",
          status: "Paga",
          nature: "Custeio",
          startMonth: 0,
          id: "fed_108488"
        },
        {
          type: "Emenda Impositiva (vereadores)",
          status: "Paga",
          nature: "Custeio",
          startMonth: 0,
          name: "EMENDA IMPOSITIVA (34018-9)",
          id: "imp_34018",
          periodMonths: 9,
          accountability: "Direta com o município",
          allocations: [{ amount: 362500, categoryId: "salarios" }],
          color: "#8b5cf6",
          totalValue: 362500
        },
        {
          periodMonths: 12,
          allocations: [
            { amount: 20000, categoryId: "juridica" },
            { amount: 30000, categoryId: "contabeis" }
          ],
          accountability: "Via São Paulo Sem Papel",
          type: "Emenda parlamentar",
          id: "lombar_39324",
          name: "EMENDA MIGUEL LOMBARDI (39324-X)",
          status: "Paga",
          nature: "Custeio",
          startMonth: 0,
          totalValue: 50000,
          color: "#f43f5e"
        },
        {
          id: "mun_108236",
          name: "SUB. MUNICIPAL (108236-1)",
          status: "Paga",
          nature: "Custeio",
          startMonth: 0,
          type: "Emenda parlamentar",
          allocations: [{ amount: 181755, categoryId: "salarios" }],
          accountability: "Direta com o município",
          periodMonths: 9,
          totalValue: 181755,
          color: "#f59e0b"
        },
        {
          color: "#6366f1",
          totalValue: 100000,
          name: "SPSP - RAFAEL SILVA (42897-3)",
          startMonth: 0,
          nature: "Custeio",
          status: "Paga",
          id: "rafael_42897",
          type: "Emenda parlamentar",
          accountability: "Direta com o município",
          allocations: [{ amount: 100000, categoryId: "salarios" }],
          periodMonths: 12
        },
        {
          color: "#06b6d4",
          totalValue: 105000,
          accountability: "Via São Paulo Sem Papel",
          allocations: [
            { amount: 19175.91, categoryId: "energia" },
            { amount: 11394.8, categoryId: "carne" },
            { amount: 4412.9, categoryId: "copa" },
            { amount: 62933.34, categoryId: "limpeza" },
            { amount: 7083.05, categoryId: "higiene" }
          ],
          periodMonths: 12,
          name: "SPSP - ROGÉRIO SANTOS (42183-9)",
          startMonth: 0,
          status: "Paga",
          nature: "Custeio",
          id: "rogerio_42183",
          type: "Emenda parlamentar"
        }
      ];
      
      await bulkBootstrapAmendments(institutionId, DEFAULT_CATEGORIES, grantsToBootstrap);
      await loadData();
      alert("Dados oficiais carregados com sucesso!");
    } catch (error) {
      console.error("Erro ao resetar dados:", error);
      alert("Erro ao resetar dados.");
    }
  };

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      try {
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        // Skip header
        const dataLines = lines.slice(1);
        
        const grantsMap: Record<string, any> = {};

        dataLines.forEach(line => {
          // simple csv split handling quotes
          const regex = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g;
          const parts = line.match(regex)?.map(p => p.replace(/"/g, '')) || [];
          
          if (parts.length < 5) return;

          const [grantId, grantName, catId, catName, amount] = parts;
          
          if (!grantsMap[grantId]) {
            grantsMap[grantId] = {
              id: grantId,
              name: grantName,
              color: '#' + Math.floor(Math.random()*16777215).toString(16), // Random color for new ones
              totalValue: 0,
              periodMonths: 12, // Default
              startMonth: 0,
              allocations: [],
              type: 'Emenda parlamentar',
              nature: 'Custeio',
              accountability: 'Direta com o município',
              status: 'Paga'
            };
          }

          const val = parseFloat(amount) || 0;
          grantsMap[grantId].allocations.push({ categoryId: catId, amount: val });
          grantsMap[grantId].totalValue += val;
        });

        const grantsToUpload = Object.values(grantsMap);
        
        if (confirm(`Foram identificadas ${grantsToUpload.length} emendas no arquivo. Deseja importar e substituir os dados atuais?`)) {
          setLoading(true);
          await bulkBootstrapAmendments(institutionId, categories, grantsToUpload);
          await loadData();
          alert("Importação concluída com sucesso!");
        }
      } catch (error) {
        console.error("Erro ao processar CSV:", error);
        alert("Erro ao processar arquivo. Verifique o formato.");
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  };

  const filteredCategories = categories.filter(cat => 
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getGrantsForCategoryAndMonth = (catId: string, monthIdx: number) => {
    return grants.filter(grant => 
      (grant.allocations || []).some(a => a.categoryId === catId && a.amount > 0) && 
      monthIdx >= grant.startMonth && 
      monthIdx < grant.startMonth + grant.periodMonths
    );
  };

  const totalMonthlyExpense = categories.reduce((acc, cat) => acc + cat.monthlyAverage, 0);
  
  const analysis = React.useMemo(() => {
    const monthlyGaps: Record<string, number[]> = {};
    const categoryStatus: Record<string, { totalGap: number, totalAnnualCost: number, totalAllocatedRaw: number, monthsUncovered: number[] }> = {};

    categories.forEach(cat => {
      monthlyGaps[cat.id] = new Array(12).fill(cat.monthlyAverage);
      categoryStatus[cat.id] = { 
        totalGap: 0, 
        totalAnnualCost: cat.monthlyAverage * 12,
        totalAllocatedRaw: 0,
        monthsUncovered: [] 
      };
    });

    grants.forEach(grant => {
      (grant.allocations || []).forEach(alloc => {
        if (categoryStatus[alloc.categoryId]) {
          categoryStatus[alloc.categoryId].totalAllocatedRaw += alloc.amount;
        }
      });
    });

    grants.forEach(grant => {
      (grant.allocations || []).forEach(alloc => {
        if (!monthlyGaps[alloc.categoryId]) return;
        
        let remaining = alloc.amount;
        const start = grant.startMonth;
        const end = Math.min(12, grant.startMonth + grant.periodMonths);

        for (let m = start; m < end && remaining > 0; m++) {
          const gap = monthlyGaps[alloc.categoryId][m];
          const deduct = Math.min(remaining, gap);
          monthlyGaps[alloc.categoryId][m] -= deduct;
          remaining -= deduct;
        }
      });
    });

    categories.forEach(cat => {
      const status = categoryStatus[cat.id];
      status.totalGap = Math.max(0, status.totalAnnualCost - status.totalAllocatedRaw);
      
      monthlyGaps[cat.id]?.forEach((gap, mIdx) => {
        if (gap > 0) {
          status.monthsUncovered.push(mIdx);
        }
      });
    });

    const sortedGaps = Object.entries(categoryStatus)
      .map(([id, data]) => ({
        id,
        name: categories.find(c => c.id === id)?.name || '',
        ...data
      }))
      .sort((a, b) => b.totalGap - a.totalGap);

    const totalNeeded = sortedGaps.reduce((acc, g) => acc + g.totalGap, 0);
    const totalAllocated = grants.reduce((acc, g) => acc + (g.totalValue || 0), 0);

    return { sortedGaps, totalNeeded, totalAllocated, monthlyGaps };
  }, [categories, grants]);

  const getMonthlyCoverage = (monthIdx: number) => {
    if (categories.length === 0) return 0;
    let coveredCount = 0;
    categories.forEach(cat => {
      if (getGrantsForCategoryAndMonth(cat.id, monthIdx).length > 0) {
        coveredCount++;
      }
    });
    return (coveredCount / categories.length) * 100;
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Lar São Vicente', 15, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('RELATÓRIO DE ANÁLISE DE GAPS E CAPTAÇÃO', 15, 30);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 50, 30);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.text('Resumo Financeiro (12 Meses)', 15, 55);
    
    autoTable(doc, {
      startY: 60,
      head: [['Potencial Total de Captação', 'Gasto Mensal Médio Total']],
      body: [[
        analysis.totalNeeded.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        totalMonthlyExpense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      ]],
      theme: 'plain',
      headStyles: { fillColor: [241, 245, 249], textColor: [100, 116, 139], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 14, fontStyle: 'bold', textColor: [37, 99, 235] }
    });

    doc.text('Prioridades e Lacunas por Categoria', 15, (doc as any).lastAutoTable.finalY + 20);
    
    const tableData = analysis.sortedGaps.map((gap, idx) => [
      idx + 1,
      gap.name,
      gap.totalAnnualCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      gap.totalAllocatedRaw.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      gap.totalGap.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      `${gap.monthsUncovered.length} meses`
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 25,
      head: [['#', 'Categoria', 'Custo 12 Meses', 'Já Destinado', 'Disponível', 'Meses em Aberto']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' },
        5: { halign: 'center' }
      }
    });

    doc.save('relatorio-analise-gaps-lar-sao-vicente.pdf');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 font-sans selection:bg-blue-100">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sub-navigation Sidebar (Dentro do módulo) */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 sticky top-8">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 px-3 flex-shrink-0">Menu de Emendas</h3>
            <nav className="space-y-1">
              <NavItem 
                icon={<LayoutDashboard size={18} />} 
                label="Dashboard" 
                active={activeView === 'dashboard'} 
                onClick={() => setActiveView('dashboard')}
              />
              <NavItem 
                icon={<Search size={18} />} 
                label="Análise de Gaps" 
                active={activeView === 'analysis'}
                onClick={() => setActiveView('analysis')}
              />
              <NavItem 
                icon={<Wallet size={18} />} 
                label="Gerenciar Emendas" 
                active={activeView === 'grants'}
                onClick={() => setActiveView('grants')}
              />
              <NavItem 
                icon={<Settings size={18} />} 
                label="Categorias" 
                active={activeView === 'categories'}
                onClick={() => setActiveView('categories')}
              />
              <NavItem 
                icon={<ShieldCheck size={18} />} 
                label="Configurações" 
                active={activeView === 'settings'}
                onClick={() => setActiveView('settings')}
              />
            </nav>

            <div className="mt-10 overflow-hidden flex-1 flex flex-col">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 px-3 flex-shrink-0">Painel de Emendas</h3>
              <div className="flex-1 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar space-y-2">
                {grants.length === 0 && (
                  <div className="px-3 py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Nenhuma Emenda</p>
                  </div>
                )}
                {grants.map(grant => (
                  <button 
                    key={grant.id}
                    onClick={() => setDetailsGrantId(grant.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left group/btn ${
                      selectedGrant === grant.id 
                      ? 'bg-blue-50 ring-1 ring-blue-100 shadow-sm' 
                      : 'hover:bg-slate-50 border border-transparent hover:border-slate-100'
                    }`}
                  >
                    <div className="relative">
                      <div className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm transition-transform group-hover/btn:scale-110" style={{ backgroundColor: grant.color }}></div>
                      {grant.status === 'Paga' && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 border-2 border-white rounded-full"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold truncate transition-colors ${
                        selectedGrant === grant.id ? 'text-blue-700' : 'text-slate-600'
                      }`}>{grant.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className={`w-1 h-1 rounded-full ${
                          grant.status === 'Paga' ? 'bg-emerald-500' :
                          grant.status === 'Em Elaboração' ? 'bg-blue-500' :
                          'bg-amber-500'
                        }`} />
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">{grant.status}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 mt-6">
              <div className="flex items-center gap-2 mb-2 text-blue-600">
                <Info size={14} />
                <span className="text-[10px] font-bold uppercase">Status Atual</span>
              </div>
              <p className="text-xs text-slate-500 mb-3">Cobertura atual das despesas planejadas.</p>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-1000" 
                  style={{ width: `${getMonthlyCoverage(0).toFixed(0)}%` }}
                ></div>
              </div>
              <p className="text-right text-[10px] font-bold text-slate-700 mt-1">{getMonthlyCoverage(0).toFixed(0)}% Coberto (Abril)</p>
            </div>
          </div>
        </div>

        {/* Local Main Content */}
        <div className="flex-1 overflow-hidden">
          {activeView === 'dashboard' ? (
            <>
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Planejamento de Emendas</h2>
                  <p className="text-slate-500 text-sm">Visualize a destinação das subvenções em cada categoria de gasto.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm text-slate-600">
                    <Download size={16} /> Exportar PDF
                  </button>
                  <button 
                    onClick={() => setIsGrantModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-xl text-sm font-bold text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                  >
                    Nova Emenda
                  </button>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatCard 
                  title="Total Despesa Mensal" 
                  value={totalMonthlyExpense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} 
                  trend="+2.4%" 
                  icon={<Wallet className="text-blue-500" />}
                />
                <StatCard 
                  title="Categorias Gerenciadas" 
                  value={`${new Set(grants.flatMap(g => (g.allocations || []).map(a => a.categoryId))).size}`} 
                  trend="Ativa" 
                  icon={<CircleCheck className="text-emerald-500" />}
                />
                <StatCard 
                  title="Categorias em Aberto" 
                  value={`${categories.length - new Set(grants.flatMap(g => (g.allocations || []).map(a => a.categoryId))).size}`} 
                  trend="Atenção" 
                  icon={<CircleAlert className="text-amber-500" />}
                />
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-12">
                <div className="p-6 border-bottom border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Buscar categoria..." 
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button className="px-4 py-1.5 text-xs font-bold bg-white rounded-lg shadow-sm text-slate-800">Timeline</button>
                    <button className="px-4 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-600">Lista</button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <div className="min-w-[1000px]">
                    <div className="grid grid-cols-[250px_1fr] bg-slate-50 border-y border-slate-200">
                      <div className="p-4 border-r border-slate-200 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Categoria</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Média</span>
                      </div>
                      <div className="grid grid-cols-12 divide-x divide-slate-200">
                        {MONTHS.map(month => (
                          <div key={month} className="p-4 text-center">
                            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tighter">{month.substring(0,3)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100">
                      <AnimatePresence>
                        {filteredCategories.map((cat, idx) => (
                          <motion.div 
                            key={cat.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            className="grid grid-cols-[250px_1fr] hover:bg-slate-50/50 transition-colors group"
                          >
                            <div className="p-4 border-r border-slate-200 flex flex-col justify-center">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-700 truncate">{cat.name}</span>
                              </div>
                              <span className="text-[11px] font-mono font-medium text-slate-500">
                                {cat.monthlyAverage.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-12 divide-x divide-slate-100 relative">
                              {MONTHS.map((_, mIdx) => {
                                const grantsActive = getGrantsForCategoryAndMonth(cat.id, mIdx);
                                const hasGrant = grantsActive.length > 0;

                                return (
                                  <div key={mIdx} className="h-16 flex items-center justify-center p-1 relative min-w-[70px]">
                                    {hasGrant ? (
                                      <div className="flex flex-col gap-0.5 w-full px-1">
                                        {grantsActive.map(g => (
                                          <motion.div 
                                            key={g.id}
                                            layoutId={`grant-${g.id}-${cat.id}-${mIdx}`}
                                            className={`h-3 w-full rounded-sm opacity-90 relative cursor-pointer hover:opacity-100 transition-all ${
                                              selectedGrant && g.id !== selectedGrant ? 'opacity-20' : 'z-10'
                                            }`}
                                            style={{ backgroundColor: g.color }}
                                            title={`${g.name} (${g.status})`}
                                          />
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="w-1.5 h-1.5 rounded-full bg-slate-100"></div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : activeView === 'analysis' ? (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="max-w-4xl">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Análise para Próxima Emenda</h2>
                  <p className="text-slate-500 text-sm">Identificamos as categorias com maiores lacunas de financiamento.</p>
                </div>
                <button onClick={handleExportPDF} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
                  <Download size={14} /> Exportar PDF
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Wallet size={120} />
                  </div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Potencial de Captação (12 meses)</h4>
                  <p className="text-4xl font-black text-blue-600 mb-4">
                    {analysis.totalNeeded.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Valor necessário para cobrir todos os meses em que não há emenda vinculada.
                  </p>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Database size={120} />
                  </div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Já Destinado</h4>
                  <p className="text-4xl font-black text-emerald-600 mb-4">
                    {analysis.totalAllocated.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Soma de todos os recursos alocados nas emendas cadastradas.
                  </p>
                </div>

                <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
                  <div className="flex items-center gap-2 mb-6 text-blue-400">
                    <Info size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Destaque</span>
                  </div>
                  <p className="text-sm font-medium leading-relaxed mb-6">
                    Priorize as categorias com maior custo anual liberando recursos próprios.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 bg-slate-50 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Gaps por Categoria</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {analysis.sortedGaps.map((gap, idx) => (
                    <div key={gap.id} className="p-6 hover:bg-slate-50 transition-all">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-sm">
                            {idx + 1}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{gap.name}</p>
                              {gap.totalAllocatedRaw > gap.totalAnnualCost && (
                                <span className="text-[8px] font-black bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full uppercase">Alocação Excedente</span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                              {gap.monthsUncovered.length} Meses descobertos
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-8">
                          <div className="text-right">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Custo 12 Meses</p>
                            <p className="text-xs font-bold text-slate-600">
                              {gap.totalAnnualCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">Já Destinado</p>
                            <p className="text-xs font-bold text-blue-600">
                              {gap.totalAllocatedRaw.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Disponível para Destinar</p>
                            <p className="text-sm font-black text-emerald-600">
                              {gap.totalGap.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : activeView === 'grants' ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl">
              <div className="mb-8 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Gerenciamento de Emendas</h2>
                </div>
                <button 
                  onClick={() => {
                    setEditingGrantId(null);
                    setNewGrant({
                      type: 'Emenda parlamentar',
                      nature: 'Custeio',
                      accountability: 'Direta com o município',
                      status: 'Oficiada',
                      startMonth: 0,
                      periodMonths: 12,
                      allocations: [],
                      color: '#3b82f6',
                      totalValue: 0,
                      name: ''
                    });
                    setIsGrantModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 rounded-2xl text-sm font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-200"
                >
                  <Plus size={18} /> Nova Emenda
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {grants.map(grant => (
                  <div 
                    key={grant.id} 
                    onClick={() => setDetailsGrantId(grant.id)}
                    className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col group hover:shadow-xl transition-all duration-300 cursor-pointer"
                  >
                    <div className="p-6 relative">
                      <div className="absolute top-0 right-0 p-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleEditGrant(grant); }} 
                          className="p-2 bg-white rounded-lg border border-slate-100 text-slate-400 hover:text-blue-500"
                        >
                          <Settings size={14} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteGrant(grant.id); }} 
                          className="p-2 bg-white rounded-lg border border-slate-100 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: grant.color }} />
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${grant.status === 'Paga' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                          {grant.status}
                        </span>
                      </div>
                      <h3 className="font-black text-slate-800 mb-1 leading-tight">{grant.name}</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{grant.type}</p>
                    </div>
                    <div className="px-6 py-4 bg-slate-50 border-y border-slate-100 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 mb-0.5">Valor Total</p>
                        <p className="text-sm font-black text-slate-800 tabular-nums">{grant.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 mb-0.5">Vigência</p>
                        <p className="text-sm font-black text-slate-800">{grant.periodMonths} meses</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : activeView === 'settings' ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl">
               <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-800">Configurações do Módulo</h2>
                <p className="text-slate-500 text-sm">Opções administrativas para o planejamento de emendas.</p>
              </div>
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Dados e Backup</h3>
                <p className="text-sm text-slate-500 mb-6">Você pode restaurar o banco de dados para os valores padrão oficiais (conforme o PDF compartilhado).</p>
                <button 
                  onClick={handleResetToOfficialData}
                  className="w-full py-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl font-black uppercase tracking-widest hover:bg-red-100 transition-all flex items-center justify-center gap-3"
                >
                  <Database size={20} /> Reiniciar para Dados Oficiais
                </button>

                <div className="mt-8 pt-8 border-t border-slate-100">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Importação via Arquivo</h3>
                  <p className="text-sm text-slate-500 mb-6">Utilize um arquivo CSV para atualizar massivamente as distribuições de emendas.</p>
                  
                  <input 
                    type="file" 
                    id="csv-upload" 
                    accept=".csv" 
                    className="hidden" 
                    onChange={handleCsvUpload}
                  />
                  
                  <label 
                    htmlFor="csv-upload"
                    className="w-full py-4 bg-blue-50 border border-blue-100 text-blue-600 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-100 transition-all flex items-center justify-center gap-3 cursor-pointer"
                  >
                    <Upload size={20} /> Importar Arquivo CSV
                  </label>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-800">Gerenciamento de Categorias</h2>
              </div>
              
              <div className="mb-6 p-6 bg-white rounded-3xl border-2 border-dashed border-slate-200 flex items-center gap-4">
                <div className="flex-1">
                  <input type="text" placeholder="Nova Categoria" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm" />
                </div>
                <div className="w-48">
                  <input type="number" placeholder="Média Mensal" value={newCatValue} onChange={(e) => setNewCatValue(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm" />
                </div>
                <button onClick={() => { handleAddCategory(newCatName, parseFloat(newCatValue) || 0); setNewCatName(''); setNewCatValue(''); }} disabled={!newCatName} className="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-100">
                  <Plus size={14} /> Adicionar
                </button>
              </div>
              
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
                  {categories.map((cat) => (
                    <CategoryEditRow 
                      key={cat.id} 
                      category={cat} 
                      onUpdate={updateCategory}
                      onDelete={handleDeleteCategory}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Modals and Overlays */}
      <AnimatePresence>
        {isGrantModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsGrantModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-lg font-bold">{editingGrantId ? 'Editar Emenda' : 'Cadastrar Emenda'}</h3>
                <button onClick={() => setIsGrantModalOpen(false)}><X size={20} /></button>
              </div>
              <div className="p-8 overflow-y-auto space-y-6 flex-1">
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="Nome" value={newGrant.name} onChange={(e) => setNewGrant(prev => ({ ...prev, name: e.target.value }))} className="w-full px-4 py-2 border rounded-xl" />
                  <input type="number" placeholder="Valor" value={newGrant.totalValue || ''} onChange={(e) => setNewGrant(prev => ({ ...prev, totalValue: parseFloat(e.target.value) || 0 }))} className="w-full px-4 py-2 border rounded-xl" />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-400">PLANO DE APLICAÇÃO</p>
                  <div className="space-y-2">
                    {categories.map(cat => {
                      const allocation = (newGrant.allocations || []).find(a => a.categoryId === cat.id);
                      return (
                        <div key={cat.id} className="flex items-center gap-4 p-2 bg-slate-50 rounded-xl">
                          <span className="flex-1 text-xs font-bold">{cat.name}</span>
                          <input 
                            type="number" 
                            placeholder="R$" 
                            className="w-32 px-2 py-1 border rounded text-xs" 
                            disabled={!allocation}
                            value={allocation?.amount || ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setNewGrant(prev => ({
                                ...prev,
                                allocations: (prev.allocations || []).map(a => a.categoryId === cat.id ? { ...a, amount: val } : a)
                              }));
                            }}
                          />
                          <button 
                            onClick={() => {
                              const current = newGrant.allocations || [];
                              if (allocation) {
                                setNewGrant(prev => ({ ...prev, allocations: current.filter(a => a.categoryId !== cat.id) }));
                              } else {
                                setNewGrant(prev => ({ ...prev, allocations: [...current, { categoryId: cat.id, amount: 0 }] }));
                              }
                            }}
                            className={`w-6 h-6 rounded flex items-center justify-center ${allocation ? 'bg-blue-600 text-white' : 'bg-slate-200'}`}
                          >
                            {allocation ? <CircleCheck size={14} /> : <Plus size={14} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="p-6 border-t flex justify-end gap-2">
                <button onClick={() => setIsGrantModalOpen(false)} className="px-4 py-2 text-slate-400">Cancelar</button>
                <button onClick={handleSaveGrant} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold">Salvar</button>
              </div>
            </motion.div>
          </div>
        )}

        {detailsGrantId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDetailsGrantId(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-3xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header com cor da emenda */}
              <div className="p-8 pb-12 border-b border-slate-100 flex items-start justify-between relative overflow-hidden">
                <div 
                  className="absolute top-0 left-0 w-2 h-full opacity-80" 
                  style={{ backgroundColor: grants.find(g => g.id === detailsGrantId)?.color }} 
                />
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 shadow-inner">
                    <LayoutDashboard size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 leading-tight">
                      {grants.find(g => g.id === detailsGrantId)?.name}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Detalhamento do Plano de Aplicação</p>
                  </div>
                </div>
                <button onClick={() => setDetailsGrantId(null)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto flex-1 space-y-8 bg-slate-50/30">
                {/* Resumo cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Valor do Repasse</p>
                    <p className="text-xl font-black text-slate-800">
                      {grants.find(g => g.id === detailsGrantId)?.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Vigência Planejada</p>
                    <p className="text-xl font-black text-slate-800">
                      {grants.find(g => g.id === detailsGrantId)?.periodMonths} Meses
                    </p>
                  </div>
                  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Status do Ciclo</p>
                    <p className={`text-xl font-black ${grants.find(g => g.id === detailsGrantId)?.status === 'Paga' ? 'text-blue-600' : 'text-amber-600'}`}>
                      {grants.find(g => g.id === detailsGrantId)?.status}
                    </p>
                  </div>
                </div>

                {/* Tabela de Destinação */}
                <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                  <div className="grid grid-cols-[1fr_120px_120px_120px] bg-slate-50 p-4 border-b border-slate-200">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Categoria de Gasto</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Custo Mensal (Lar)</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Valor Destinado (Emenda)</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Cobertura (Meses)</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {grants.find(g => g.id === detailsGrantId)?.allocations
                      .filter(a => a.amount > 0)
                      .map(alloc => {
                        const cat = categories.find(c => c.id === alloc.categoryId);
                        return (
                          <div key={alloc.categoryId} className="grid grid-cols-[1fr_120px_120px_120px] items-center p-5 hover:bg-slate-50 transition-colors">
                            <div>
                              <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{cat?.name}</p>
                              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">ID Interno: {cat?.id}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs font-mono font-bold text-slate-400">
                                {cat?.monthlyAverage.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-black text-slate-800">
                                {alloc.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </p>
                            </div>
                            <div className="text-center">
                              <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-600 uppercase">
                                {cat?.monthlyAverage && cat.monthlyAverage > 0 
                                  ? (alloc.amount / cat.monthlyAverage).toFixed(1) 
                                  : '0.0'} Meses
                              </span>
                            </div>
                          </div>
                        );
                      })
                    }
                  </div>
                  <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-500" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Sistema de Transparência e Eficiência de Recursos</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

function CategoryEditRow({ category, onUpdate, onDelete }: any) {
  const [localName, setLocalName] = useState(category.name);
  const [localValue, setLocalValue] = useState(category.monthlyAverage.toString());

  useEffect(() => {
    setLocalName(category.name);
    setLocalValue(category.monthlyAverage.toString());
  }, [category.name, category.monthlyAverage]);

  return (
    <div className="grid grid-cols-[1fr_200px_80px] items-center hover:bg-slate-50 transition-colors group">
      <div className="p-4 px-8">
        <input 
          type="text" 
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={() => onUpdate(category.id, 'name', localName)}
          className="w-full bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-1 focus:ring-blue-500/20 rounded-lg py-2"
        />
      </div>
      <div className="p-4 px-8 text-right">
        <input 
          type="number" 
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={() => onUpdate(category.id, 'monthlyAverage', parseFloat(localValue) || 0)}
          className="w-32 bg-transparent border-none text-right text-sm font-mono font-bold text-slate-700 focus:ring-1 focus:ring-blue-500/20 rounded-lg py-2"
        />
      </div>
      <div className="p-4 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onDelete(category.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick }: { icon: ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${
        active ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
      }`}
    >
      {icon}
      <span className="text-sm">{label}</span>
      {active && <ChevronRight size={14} className="ml-auto" />}
    </button>
  );
}

function StatCard({ title, value, trend, icon }: { title: string, value: string, trend: string, icon: ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-slate-50 rounded-2xl">{icon}</div>
        <span className={`text-[10px] font-extrabold px-2 py-1 rounded-full ${trend === 'Ativa' ? 'bg-emerald-50 text-emerald-600' : trend === 'Atenção' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>{trend}</span>
      </div>
      <div>
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</h4>
        <p className="text-2xl font-black text-slate-800 tracking-tight tabular-nums">{value}</p>
      </div>
    </div>
  );
}
