import React, { useState, useEffect } from 'react';
import { 
  Package, Plus, Search, FileText, Download, Upload, 
  History, ClipboardList, CheckCircle, AlertTriangle, 
  Trash2, Edit, X, ChevronLeft, ChevronRight, Calendar, 
  User, ArrowUpDown, Copy, Printer, RefreshCw, FileSpreadsheet
} from 'lucide-react';
import { ProductStockItem, StockMovement } from '../types';
import { 
  fetchStockProducts, saveStockProduct, deleteStockProduct, 
  bootstrapStockProducts, fetchStockMovements, registerStockMovement,
  Session
} from '../lib/api';
import { defaultStockItems } from './defaultStockData';

interface StockModuleProps {
  session: Session;
  settings?: any;
}

const STOCK_CATEGORIES = ['ALIMENTAÇÃO', 'HIGIENE', 'LIMPEZA', 'MEDICAMENTOS', 'DIALÍTICO', 'AMBULATORIAL', 'GERAL'];

export const StockModule: React.FC<StockModuleProps> = ({ session, settings }) => {
  const [products, setProducts] = useState<ProductStockItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [activeTab, setActiveTab] = useState<'estoque' | 'historico' | 'compras' | 'importar'>('estoque');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');
  const [selectedStatus, setSelectedStatus] = useState<string>('TODOS');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Sorting
  const [sortField, setSortField] = useState<keyof ProductStockItem>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductStockItem | null>(null);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementProduct, setMovementProduct] = useState<ProductStockItem | null>(null);

  // Forms states
  const [productForm, setProductForm] = useState({
    name: '',
    unit: 'KG',
    category: 'ALIMENTAÇÃO',
    currentStock: 0,
    minStock: 0
  });

  const [movementForm, setMovementForm] = useState({
    type: 'entrada' as 'entrada' | 'saida',
    quantity: 1,
    notes: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Bulk Import CSV Text area state
  const [csvText, setCsvText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Refetch controller
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  // Fetch initial data
  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [prodsData, movsData] = await Promise.all([
          fetchStockProducts(),
          fetchStockMovements()
        ]);
        if (active) {
          setProducts(prodsData || []);
          setMovements(movsData || []);
        }
      } catch (err: any) {
        console.error('Error fetching stock:', err);
        if (active) setError('Não foi possível carregar os dados do estoque.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => { active = false; };
  }, [refetchTrigger]);

  // Is Admin or Manager checks (has edit permission)
  const canEdit = session?.accessLevel === 'administrador' || session?.accessLevel === 'gerencial' || session?.accessLevel === 'nutricionista' || session?.accessLevel === 'enfermeira' || session?.accessLevel === 'auxiliar_administrativo';
  const canDelete = session?.accessLevel === 'administrador' || session?.accessLevel === 'gerencial' || session?.accessLevel === 'auxiliar_administrativo';

  // Toggle Sorting
  const handleSort = (field: keyof ProductStockItem) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // Sort and filter products
  const filteredProducts = products
    .filter(prod => {
      const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            prod.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'TODAS' || prod.category === selectedCategory;
      const matchesStatus = selectedStatus === 'TODOS' || prod.status === selectedStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    })
    .sort((a, b) => {
      let comparison = 0;
      const valA = a[sortField];
      const valB = b[sortField];

      if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = valA.localeCompare(valB, 'pt-BR');
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

  // Paginated Products
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Quick stats calculations
  const totalItemsCount = products.length;
  const criticalItemsCount = products.filter(p => p.status === 'Comprar').length;
  const alertItemsCount = products.filter(p => p.status === 'Alerta').length;
  const safeItemsCount = products.filter(p => p.status === 'Disponível').length;

  // Save product details
  const handleSaveProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name) return;
    try {
      setError(null);
      const payload = {
        ...(selectedProduct ? { id: selectedProduct.id } : {}),
        name: productForm.name.toUpperCase().trim(),
        unit: productForm.unit.toUpperCase().trim(),
        category: productForm.category.toUpperCase().trim(),
        currentStock: Number(productForm.currentStock) || 0,
        minStock: Number(productForm.minStock) || 0
      };

      await saveStockProduct(payload);
      setIsProductModalOpen(false);
      setSelectedProduct(null);
      setRefetchTrigger(prev => prev + 1);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao salvar produto em estoque.');
    }
  };

  // Delete product
  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja remover "${name}" do estoque?`)) return;
    try {
      setError(null);
      await deleteStockProduct(id);
      setRefetchTrigger(prev => prev + 1);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao excluir produto.');
    }
  };

  // Open Add Product Modal
  const openAddProductModal = () => {
    setSelectedProduct(null);
    setProductForm({
      name: '',
      unit: 'KG',
      category: 'ALIMENTAÇÃO',
      currentStock: 0,
      minStock: 0
    });
    setIsProductModalOpen(true);
  };

  // Open Edit Product Modal
  const openEditProductModal = (prod: ProductStockItem) => {
    setSelectedProduct(prod);
    setProductForm({
      name: prod.name,
      unit: prod.unit,
      category: prod.category || 'ALIMENTAÇÃO',
      currentStock: prod.currentStock,
      minStock: prod.minStock
    });
    setIsProductModalOpen(true);
  };

  // Open Movement Modals
  const openMovementModal = (prod: ProductStockItem, type: 'entrada' | 'saida') => {
    setMovementProduct(prod);
    setMovementForm({
      type,
      quantity: 1,
      notes: '',
      date: new Date().toISOString().split('T')[0]
    });
    setIsMovementModalOpen(true);
  };

  // Submit Movement Log (Entrada/Saída)
  const handleMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementProduct) return;
    try {
      setError(null);
      const payload = {
        productId: movementProduct.id,
        quantity: Number(movementForm.quantity) || 0,
        type: movementForm.type,
        notes: movementForm.notes.trim(),
        date: movementForm.date,
        userName: session.fullName || session.username
      };

      await registerStockMovement(payload);
      setIsMovementModalOpen(false);
      setMovementProduct(null);
      setRefetchTrigger(prev => prev + 1);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao registrar movimentação.');
    }
  };

  // Bootstrap Default CSV Catalog
  const handleBootstrapCatalog = async () => {
    if (!confirm('Esta ação irá carregar os itens padrão do estoque. Deseja prosseguir?')) return;
    try {
      setLoading(true);
      setError(null);
      // Construct item payloads
      const itemsPayload = defaultStockItems.map(item => ({
        name: item.name,
        unit: item.unit,
        category: item.category,
        currentStock: item.currentStock,
        minStock: item.minStock
      }));

      await bootstrapStockProducts(itemsPayload);
      setRefetchTrigger(prev => prev + 1);
      alert('Catálogo inicial carregado com sucesso!');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao carregar catálogo inicial.');
    } finally {
      setLoading(false);
    }
  };

  // Custom CSV Catalog parsing
  const handleImportCsvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) return;
    try {
      setImportStatus('Processando linhas...');
      const lines = csvText.split('\n');
      const importedProducts: any[] = [];
      
      // Index headers
      // Nome do serviço ou produto,Unidade de medida,Tipo do produto,Estoque atual,Estoque mínimo,Situação
      let headerIndices = { name: 0, unit: 1, category: 2, currentStock: 3, minStock: 4 };

      // Basic simple CSV split regex honoring quotes
      const parseCsvLine = (line: string) => {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(cur.trim());
            cur = '';
          } else {
            cur += char;
          }
        }
        result.push(cur.trim());
        return result;
      };

      let startIdx = 0;
      // Check if header is present
      const firstLineParts = parseCsvLine(lines[0]);
      if (firstLineParts[0].toLowerCase().includes('nome') || firstLineParts[0].toLowerCase().includes('produto')) {
        startIdx = 1;
      }

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const columns = parseCsvLine(line);
        if (columns.length < 2) continue;

        const name = columns[0].toUpperCase().replace(/"/g, '');
        const unit = (columns[1] || 'UN').toUpperCase();
        const category = (columns[2] || 'ALIMENTAÇÃO').toUpperCase();
        
        // Handle decimal replacement like "7,5" to 7.5
        const cleanNumber = (val: string) => {
          if (!val) return 0;
          return Number(val.replace(',', '.')) || 0;
        };

        const currentStock = cleanNumber(columns[3]);
        const minStock = cleanNumber(columns[4]);

        importedProducts.push({
          name,
          unit,
          category,
          currentStock,
          minStock
        });
      }

      if (importedProducts.length === 0) {
        setImportStatus('Nenhum dado válido encontrado.');
        return;
      }

      setImportStatus(`Importando ${importedProducts.length} itens no Firestore via lote...`);
      await bootstrapStockProducts(importedProducts);
      setImportStatus(`Sucesso! ${importedProducts.length} itens cadastrados ou atualizados.`);
      setCsvText('');
      setRefetchTrigger(prev => prev + 1);
    } catch (err: any) {
      console.error(err);
      setImportStatus(`Erro ao importar: ${err.message}`);
    }
  };

  // Copy shopping list to clipboard
  const handleCopyShoppingList = () => {
    const listToBuy = products.filter(p => p.status === 'Comprar' || p.status === 'Alerta');
    if (listToBuy.length === 0) {
      alert('Nenhum item precisa ser comprado!');
      return;
    }
    const template = listToBuy.map(p => {
      const needed = Math.max(0, p.minStock - p.currentStock) || 'Verificar';
      return `${p.name} (${p.category}) - Estoque: ${p.currentStock} ${p.unit} (Mín: ${p.minStock} ${p.unit}) - Situação: ${p.status}`;
    }).join('\n');

    navigator.clipboard.writeText(`LISTA DE COMPRAS - INSTITUIÇÃO\nGerado em: ${new Date().toLocaleDateString('pt-BR')}\n\n${template}`);
    alert('Lista de compras copiada para a área de transferência!');
  };

  // Printable layout for shopping list
  const handlePrintShoppingList = () => {
    window.print();
  };

  return (
    <div id="stock-screen-container" className="h-full bg-slate-50 flex flex-col overflow-y-auto pb-10 print:bg-white print:p-0">
      
      {/* Visual Title Header (Hide in Print Mode) */}
      <div className="bg-white border-b px-8 py-6 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="text-[#004c99]" size={28} />
            Controle de Estoque e Compras
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Gestão de suprimentos, registro de movimentações e monitoramento de níveis mínimos.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            onClick={() => setRefetchTrigger(prev => prev + 1)}
            className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 duration-150 rounded-xl text-xs font-semibold"
            title="Atualizar dados"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Sincronizar
          </button>
          
          {canEdit && (
            <button
              onClick={openAddProductModal}
              className="flex items-center gap-2 px-4 py-2 bg-[#004c99] hover:bg-blue-800 text-white font-semibold transition-all shadow-md hover:shadow-lg rounded-xl text-xs"
            >
              <Plus size={16} />
              Novo Produto
            </button>
          )}

          {canEdit && products.length === 0 && (
            <button
              onClick={handleBootstrapCatalog}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold transition-all shadow-md rounded-xl text-xs"
            >
              <FileSpreadsheet size={16} />
              Carregar Catálogo Base
            </button>
          )}
        </div>
      </div>

      {/* Main Container Wrapper */}
      <div className="max-w-7xl mx-auto w-full px-8 flex flex-col gap-6 print:px-0 print:py-0">
        
        {/* Error warning */}
        {error && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 text-amber-800 text-xs rounded-r-lg flex items-center gap-3 shadow-sm print:hidden">
            <AlertTriangle className="text-amber-500 shrink-0" size={18} />
            <div className="flex-1 font-medium">{error}</div>
            <button onClick={() => setError(null)} className="text-amber-500 hover:text-amber-700">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Dashboard Core Stats Panel (Hide in Print unless Shopping list Tab is Active) */}
        <section className={`grid grid-cols-2 lg:grid-cols-4 gap-4 print:hidden ${activeTab === 'compras' ? 'print:hidden' : ''}`}>
          
          {/* Total catalog items */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="bg-blue-50 text-[#004c99] p-3 rounded-xl">
              <Package size={24} />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Catálogo de Itens</span>
              <span className="text-2xl font-black text-slate-800">{loading ? '...' : totalItemsCount}</span>
            </div>
          </div>

          {/* Comprar Critical */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="bg-red-50 text-red-600 p-3 rounded-xl">
              <AlertTriangle size={24} />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Comprar Urgente</span>
              <span className="text-2xl font-black text-red-600">{loading ? '...' : criticalItemsCount}</span>
            </div>
          </div>

          {/* Alert Stocks */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="bg-amber-50 text-amber-600 p-3 rounded-xl">
              <AlertTriangle size={24} />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Nível de Alerta</span>
              <span className="text-2xl font-black text-amber-600">{loading ? '...' : alertItemsCount}</span>
            </div>
          </div>

          {/* Safe standing */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
              <CheckCircle size={24} />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Estoque Adequado</span>
              <span className="text-2xl font-black text-emerald-600">{loading ? '...' : safeItemsCount}</span>
            </div>
          </div>

        </section>

        {/* Outer Panel Card containing core tabs */}
        <div className="bg-white border text-slate-800 rounded-3xl overflow-hidden shadow-sm flex flex-col mb-10 print:border-none print:shadow-none">
          
          {/* Tab Navigation header */}
          <div className="border-b bg-slate-50 px-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
            <nav className="flex gap-4">
              <button
                onClick={() => { setActiveTab('estoque'); setCurrentPage(1); }}
                className={`flex items-center gap-2 py-4 px-3 font-semibold text-xs uppercase tracking-wider border-b-2 transition-all duration-150 ${
                  activeTab === 'estoque' 
                    ? 'border-[#004c99] text-[#004c99]' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Package size={16} />
                Controle de Estoque
              </button>
              
              <button
                onClick={() => { setActiveTab('compras'); }}
                className={`flex items-center gap-2 py-4 px-3 font-semibold text-xs uppercase tracking-wider border-b-2 transition-all duration-150 ${
                  activeTab === 'compras' 
                    ? 'border-[#004c99] text-[#004c99]' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <ClipboardList size={16} />
                Lista de Compras
                {(criticalItemsCount + alertItemsCount) > 0 && (
                  <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[9px] font-black leading-none">
                    {criticalItemsCount + alertItemsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => { setActiveTab('historico'); }}
                className={`flex items-center gap-2 py-4 px-3 font-semibold text-xs uppercase tracking-wider border-b-2 transition-all duration-150 ${
                  activeTab === 'historico' 
                    ? 'border-[#004c99] text-[#004c99]' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <History size={16} />
                Histórico de Movimentações
              </button>

              {canEdit && (
                <button
                  onClick={() => { setActiveTab('importar'); }}
                  className={`flex items-center gap-2 py-4 px-3 font-semibold text-xs uppercase tracking-wider border-b-2 transition-all duration-150 ${
                    activeTab === 'importar' 
                      ? 'border-[#004c99] text-[#004c99]' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Upload size={16} />
                  Importar CSV / Catálogo
                </button>
              )}
            </nav>

            <span className="text-slate-400 font-mono text-[10px] uppercase font-bold">
              Modulo de Abastecimento Geral
            </span>
          </div>

          {/* TAB 1: STOCK INVENTORY CONTROL */}
          {activeTab === 'estoque' && (
            <div className="p-6 flex flex-col gap-6 print:hidden">
              
              {/* Quick Search and Filter Panels */}
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                
                {/* Search query input */}
                <div className="relative w-full md:w-80">
                  <span className="absolute left-3 top-2.5 text-slate-400"><Search size={16} /></span>
                  <input
                    type="text"
                    placeholder="Pesquisar produto..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="w-full pl-9 pr-4 py-2 border rounded-xl text-xs bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:border-[#004c99] transition-colors"
                  />
                </div>

                {/* Select filters */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  
                  {/* Category select filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Categoria:</span>
                    <select
                      value={selectedCategory}
                      onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
                      className="border rounded-xl px-3 py-1.5 text-xs bg-slate-50 text-slate-700 font-medium focus:outline-none focus:border-[#004c99]"
                    >
                      <option value="TODAS">Todas</option>
                      {STOCK_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Status select filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Status:</span>
                    <select
                      value={selectedStatus}
                      onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
                      className="border rounded-xl px-3 py-1.5 text-xs bg-slate-50 text-slate-700 font-medium focus:outline-none focus:border-[#004c99]"
                    >
                      <option value="TODOS">Todos</option>
                      <option value="Disponível">Disponível</option>
                      <option value="Alerta">Alerta</option>
                      <option value="Comprar">Comprar</option>
                    </select>
                  </div>

                </div>

              </div>

              {/* Table rendering panel */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-8 h-8 rounded-full border-4 border-[#004c99] border-t-transparent animate-spin"></div>
                  <span className="text-xs text-slate-400 font-medium">Carregando dados do estoque...</span>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-2xl border text-center px-4">
                  <Package className="text-slate-300 mb-3" size={48} />
                  <h4 className="text-sm font-bold text-slate-750">Nenhum produto cadastrado!</h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    Insira produtos manualmente usando o botão acima ou carregue o catálogo na aba de importação.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                  <table className="w-full border-collapse text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 font-bold text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-100">
                      <tr>
                        <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('name')}>
                          <div className="flex items-center gap-1">
                            Produto / Serviço
                            <ArrowUpDown size={11} className="text-slate-400" />
                          </div>
                        </th>
                        <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('category')}>
                          <div className="flex items-center gap-1">
                            Categoria
                            <ArrowUpDown size={11} className="text-slate-400" />
                          </div>
                        </th>
                        <th className="p-4 text-center">UM</th>
                        <th className="p-4 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('currentStock')}>
                          <div className="flex items-center justify-center gap-1">
                            Estoque Atual
                            <ArrowUpDown size={11} className="text-slate-400" />
                          </div>
                        </th>
                        <th className="p-4 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('minStock')}>
                          <div className="flex items-center justify-center gap-1">
                            Estoque Mínimo
                            <ArrowUpDown size={11} className="text-slate-400" />
                          </div>
                        </th>
                        <th className="p-4 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('status')}>
                          <div className="flex items-center justify-center gap-1">
                            Situação
                            <ArrowUpDown size={11} className="text-slate-400" />
                          </div>
                        </th>
                        <th className="p-4 text-center">Entrada / Saída</th>
                        <th className="p-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedProducts.map(prod => {
                        const isCritical = prod.status === 'Comprar';
                        const isAlert = prod.status === 'Alerta';

                        return (
                          <tr key={prod.id} className="hover:bg-slate-50 transition-colors font-medium">
                            <td className="p-4 font-bold text-slate-800">{prod.name}</td>
                            <td className="p-4">
                              <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide">
                                {prod.category}
                              </span>
                            </td>
                            <td className="p-4 text-center text-slate-500 font-mono font-bold">{prod.unit}</td>
                            <td className="p-4 text-center font-mono font-black text-slate-900 text-sm">
                              {prod.currentStock}
                            </td>
                            <td className="p-4 text-center font-mono text-slate-500">
                              {prod.minStock}
                            </td>
                            <td className="p-4 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-block text-center min-w-20 ${
                                isCritical 
                                  ? 'bg-red-50 text-red-600 border border-red-200 shadow-sm' 
                                  : isAlert 
                                    ? 'bg-amber-50 text-amber-600 border border-amber-200' 
                                    : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                              }`}>
                                {prod.status}
                              </span>
                            </td>
                            {/* Movement Fast Buttons */}
                            <td className="p-4">
                              <div className="flex justify-center items-center gap-1.5">
                                {canEdit ? (
                                  <>
                                    <button
                                      onClick={() => openMovementModal(prod, 'entrada')}
                                      className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors rounded-lg font-black text-[10px] uppercase"
                                      title="Lançar Entrada"
                                    >
                                      + Entrada
                                    </button>
                                    <button
                                      onClick={() => openMovementModal(prod, 'saida')}
                                      disabled={prod.currentStock <= 0}
                                      className={`px-2 py-1 transition-colors rounded-lg font-black text-[10px] uppercase ${
                                        prod.currentStock <= 0 
                                          ? 'bg-slate-100 text-slate-350 cursor-not-allowed' 
                                          : 'bg-amber-50 hover:bg-amber-100 text-amber-705'
                                      }`}
                                      title="Lançar Saída"
                                    >
                                      - Saída
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-slate-350 font-semibold text-[10px]">Sem permissão</span>
                                )}
                              </div>
                            </td>
                            {/* Fast Action edit details */}
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-1.5">
                                {canEdit && (
                                  <button
                                    onClick={() => openEditProductModal(prod)}
                                    className="p-1.5 bg-slate-50 hover:bg-slate-100 transition-colors text-slate-600 hover:text-[#004c99] rounded-lg"
                                    title="Editar produto"
                                  >
                                    <Edit size={14} />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    onClick={() => handleDeleteProduct(prod.id, prod.name)}
                                    className="p-1.5 bg-red-50 hover:bg-red-100 transition-colors text-red-500 hover:text-red-750 rounded-lg"
                                    title="Deletar produto"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Render Pagination controls */}
              {!loading && totalPages > 1 && (
                <div className="flex items-center justify-between border-t pt-4">
                  <span className="text-xs text-slate-400 font-semibold font-mono">
                    Mostrando {paginatedProducts.length} de {filteredProducts.length} itens (Pág {currentPage}/{totalPages})
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 transition-colors rounded-lg disabled:cursor-not-allowed disabled:text-slate-300"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 transition-colors rounded-lg disabled:cursor-not-allowed disabled:text-slate-300"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: EXCLUSIV shopping order listing WITH PDF PRINT & CLIPBOARD */}
          {activeTab === 'compras' && (
            <div className="p-6 flex flex-col gap-6">
              
              {/* Header inside the shopping lists */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-4 border rounded-2xl border-slate-100 print:hidden">
                <div className="flex items-center gap-3">
                  <ClipboardList className="text-[#004c99]" size={24} />
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Ordem de Compra Reativa de Insumos</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Contém todos os produtos atualmente classificados em estado de **Comprar** ou **Alerta**.
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={handleCopyShoppingList}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-250 text-slate-650 rounded-xl text-xs font-semibold select-none cursor-pointer duration-100"
                  >
                    <Copy size={14} />
                    Copiar Lista (WhatsApp)
                  </button>

                  <button
                    onClick={handlePrintShoppingList}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#004c99] hover:bg-blue-800 text-white rounded-xl text-xs font-semibold select-none cursor-pointer duration-100"
                  >
                    <Printer size={14} />
                    Imprimir Ordem
                  </button>
                </div>
              </div>

              {/* PRINT HEADERS - EXCLUSIV FOR PHYSICAL PAPERS */}
              <div className="hidden print:block text-center border-b pb-4 mb-6">
                <h1 className="text-xl font-bold uppercase tracking-tight text-slate-950">Ordem de Abastecimento Geral</h1>
                <p className="text-xs text-slate-500 font-mono mt-1">
                  Gerado em: {new Date().toLocaleString('pt-BR')} | Solicitante: {session.fullName || session.username}
                </p>
                <p className="text-xs text-slate-500 font-semibold font-sans mt-0.5 uppercase tracking-wider">
                  {settings?.reportConfig?.institutionName || 'SSVP - Obras Unidas'}
                </p>
              </div>

              {/* Shopping List Table */}
              {products.filter(p => p.status === 'Comprar' || p.status === 'Alerta').length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center px-4">
                  <CheckCircle className="text-emerald-500 mb-3" size={48} />
                  <h4 className="text-sm font-bold text-slate-750">Seu estoque está em dia!</h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    Não há produtos em estado crítico ou abaixo do estoque mínimo de segurança.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-100 rounded-2xl print:border-none">
                  <table className="w-full border-collapse text-left text-xs text-slate-700">
                    <thead className="bg-[#004c99] text-white font-bold text-[10px] uppercase tracking-wider">
                      <tr>
                        <th className="p-4 print:text-black print:bg-slate-100">Insumo / Fornecimento</th>
                        <th className="p-4 print:text-black print:bg-slate-100">Categoria</th>
                        <th className="p-4 text-center print:text-black print:bg-slate-100">U.M.</th>
                        <th className="p-4 text-center print:text-black print:bg-slate-100">Estoque Atual</th>
                        <th className="p-4 text-center print:text-black print:bg-slate-100">Estoque Mínimo</th>
                        <th className="p-4 text-center print:text-black print:bg-slate-100 font-bold">Quantidade p/ Comprar</th>
                        <th className="p-4 text-right print:text-black print:bg-slate-100 print:hidden">Situação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {products
                        .filter(p => p.status === 'Comprar' || p.status === 'Alerta')
                        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
                        .map(prod => {
                          const isCritical = prod.status === 'Comprar';
                          const quantityToBuy = Math.max(1, prod.minStock - prod.currentStock);

                          return (
                            <tr key={prod.id} className="hover:bg-slate-50 transition-colors font-medium">
                              <td className="p-4 font-black text-slate-900 text-sm print:font-extrabold">{prod.name}</td>
                              <td className="p-4">
                                <span className="bg-slate-150 text-slate-705 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase">
                                  {prod.category}
                                </span>
                              </td>
                              <td className="p-4 text-center text-slate-500 font-mono font-bold">{prod.unit}</td>
                              <td className="p-4 text-center font-mono font-black text-red-650">{prod.currentStock}</td>
                              <td className="p-4 text-center font-mono text-slate-500">{prod.minStock}</td>
                              <td className="p-4 text-center">
                                <span className="bg-red-50 text-red-650 border border-red-200 font-mono font-black text-sm px-3 py-1 rounded-lg">
                                  {quantityToBuy} {prod.unit}
                                </span>
                              </td>
                              <td className="p-4 text-right print:hidden">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                  isCritical ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                                }`}>
                                  {prod.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Printable approval blocks */}
              <div className="hidden print:block mt-16 font-sans">
                <div className="grid grid-cols-2 gap-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="w-64 border-b border-black h-8"></div>
                    <span className="text-[10px] uppercase font-bold text-slate-700 mt-2">Assinatura do Responsável</span>
                    <span className="text-[9px] text-slate-500 font-mono">Nutricionista / Supervisor</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-64 border-b border-black h-8"></div>
                    <span className="text-[10px] uppercase font-bold text-slate-700 mt-2">Autorização de Despesa</span>
                    <span className="text-[9px] text-slate-500 font-mono">Administração / Presidência</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: AUDIT MOVEMENTS HISTORY LOGS */}
          {activeTab === 'historico' && (
            <div className="p-6 flex flex-col gap-6">
              
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-8 h-8 rounded-full border-4 border-[#004c99] border-t-transparent animate-spin"></div>
                  <span className="text-xs text-slate-400 font-medium">Carregando histórico...</span>
                </div>
              ) : movements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-2xl border border-slate-100 text-center px-4">
                  <History className="text-slate-350 mb-3" size={48} />
                  <h4 className="text-sm font-bold text-slate-750">Nenhuma movimentação registrada!</h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    Cada entrada ou saída efetuada na aba "Controle" gerará um registro auditável instantaneamente aqui.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                  <table className="w-full border-collapse text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 font-bold text-slate-500 uppercase tracking-wider text-[10px] border-b">
                      <tr>
                        <th className="p-4">Data / Hora</th>
                        <th className="p-4">Produto</th>
                        <th className="p-4 text-center">Tipo</th>
                        <th className="p-4 text-center">Quantidade</th>
                        <th className="p-4">Operador</th>
                        <th className="p-4">Motivo / Notas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {movements.map((mv, idx) => {
                        const isEntrada = mv.type === 'entrada';
                        return (
                          <tr key={mv.id || idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-mono text-slate-500 text-[11px]">
                              {mv.date ? new Date(mv.date + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem data'}
                            </td>
                            <td className="p-4 font-bold text-slate-800">{mv.productName || 'Produto Desconhecido'}</td>
                            <td className="p-4 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-block text-center min-w-20 ${
                                isEntrada 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                  : 'bg-amber-50 text-amber-705 border border-amber-100'
                              }`}>
                                {isEntrada ? '▲ ENTRADA' : '▼ SAÍDA'}
                              </span>
                            </td>
                            <td className="p-4 text-center font-mono font-black text-slate-900 text-sm">
                              {isEntrada ? '+' : '-'}{mv.quantity}
                            </td>
                            <td className="p-4 font-semibold text-slate-650 flex items-center gap-1.5 mt-1.5 border-transparent">
                              <User size={12} className="text-slate-400" />
                              {mv.userName}
                            </td>
                            <td className="p-4 text-slate-500 italic font-sans text-[11px]">
                              {mv.notes || 'Nenhuma observação declarada.'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          )}

          {/* TAB 4: BOOTSTRAP AND CSV FILE BULK IMPORTER */}
          {activeTab === 'importar' && canEdit && (
            <div className="p-6 flex flex-col gap-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Information sidebar box */}
                <div className="bg-slate-50 rounded-2xl p-6 border flex flex-col gap-4">
                  <h3 className="text-sm font-bold text-slate-800">Diretrizes de Formatação CSV</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Você pode colar o conteúdo das células de estoque para fazer um upload rápido.
                    Sua planilha **obrigatoriamente** deve possuir o seguinte layout ordenado (com ou sem cabeçalho):
                  </p>
                  
                  <div className="bg-slate-800 text-slate-200 p-4 rounded-xl font-mono text-[10px] tracking-tight leading-relaxed select-all">
                    Nome do produto,Unidade,Categoria,Estoque atual,Estoque mínimo,Situação<br />
                    MANDIOCA,KG,ALIMENTAÇÃO,7.5,2,Disponível<br />
                    ARROZ 5KG,PCT,ALIMENTAÇÃO,120,40,Disponível<br />
                    AGRIAO,MÇ,ALIMENTAÇÃO,0,5,Comprar
                  </div>

                  <p className="text-xs text-slate-500 italic">
                    *Nota: Valores decimais de estoque são aceitos com ponto ou vírgula (ex: "7,5" ou "7.5").
                  </p>

                  <div className="border-t pt-4 mt-2 flex flex-col gap-2">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Ações Rápidas</h4>
                    <button
                      type="button"
                      onClick={handleBootstrapCatalog}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#004c99] to-blue-800 text-white hover:opacity-90 duration-150 shadow rounded-xl text-xs font-semibold"
                    >
                      <RefreshCw size={14} />
                      Carregar Excel / Catálogo Padrão (Mirai)
                    </button>
                  </div>
                </div>

                {/* Main upload text form */}
                <form onSubmit={handleImportCsvSubmit} className="flex flex-col gap-4">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Cole as linhas CSV abaixo:
                  </label>
                  <textarea
                    rows={12}
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    placeholder="Cole seu texto de planilha exportada aqui..."
                    className="w-full border rounded-2xl p-4 font-mono text-[10px] bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:border-[#004c99] transition-colors leading-relaxed"
                  />

                  {importStatus && (
                    <div className="bg-blue-50 text-[#004c99] p-3 text-xs rounded-xl font-bold font-mono">
                      {importStatus}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!csvText.trim()}
                    className={`w-full py-3 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow transition-all duration-150 ${
                      !csvText.trim() 
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' 
                        : 'bg-[#004c99] hover:bg-blue-800 text-white'
                    }`}
                  >
                    <Upload size={14} />
                    Importar e Mesclar Lote de Itens
                  </button>
                </form>

              </div>

            </div>
          )}

        </div>

      </div>

      {/* MODAL 1: ADD OR EDIT PRODUCT DETAILS */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl relative overflow-hidden flex flex-col">
            <header className="px-6 py-5 border-b bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider block">
                {selectedProduct ? 'Editar Item do Estoque' : 'Cadastrar Novo Insumo'}
              </h3>
              <button 
                onClick={() => setIsProductModalOpen(false)}
                className="p-1 text-slate-450 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </header>

            <form onSubmit={handleSaveProductSubmit} className="p-6 flex flex-col gap-4">
              
              {/* Product name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Nome do Produto</label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: ARROZ 5KG, ÁGUA SANITÁRIA, etc."
                  className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-slate-50 focus:bg-white text-slate-800"
                />
              </div>

              {/* Category selector */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Categoria</label>
                  <select
                    value={productForm.category}
                    onChange={(e) => setProductForm(prev => ({ ...prev, category: e.target.value }))}
                    className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-slate-50 text-slate-700"
                  >
                    {STOCK_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Unidade de Medida (UM)</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={productForm.unit}
                    onChange={(e) => setProductForm(prev => ({ ...prev, unit: e.target.value }))}
                    placeholder="Ex: KG, PÇ, PCT, L"
                    className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-slate-50 focus:bg-white text-slate-800 text-center font-mono font-bold"
                  />
                </div>
              </div>

              {/* Quantities level check */}
              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Estoque Atual</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="any"
                    value={productForm.currentStock}
                    onChange={(e) => setProductForm(prev => ({ ...prev, currentStock: Number(e.target.value) || 0 }))}
                    className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-slate-50 focus:bg-white text-slate-800 text-center font-mono font-bold"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Estoque Mínimo</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="any"
                    value={productForm.minStock}
                    onChange={(e) => setProductForm(prev => ({ ...prev, minStock: Number(e.target.value) || 0 }))}
                    className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-slate-50 focus:bg-white text-slate-800 text-center font-mono font-bold"
                  />
                </div>
              </div>

              <footer className="flex gap-3 justify-end border-t pt-5 mt-3">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#004c99] hover:bg-blue-800 text-white font-semibold rounded-xl text-xs transition-colors shadow"
                >
                  Salvar Alterações
                </button>
              </footer>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REGISTER SINGLE MOVEMENT (ENTRADA / SAÍDA) */}
      {isMovementModalOpen && movementProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl relative overflow-hidden flex flex-col">
            <header className="px-6 py-5 border-b bg-slate-50 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Registrar {movementForm.type === 'entrada' ? 'Entrada' : 'Saída'}
              </h3>
              <button 
                onClick={() => setIsMovementModalOpen(false)}
                className="p-1 text-slate-450 hover:text-slate-705 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </header>

            <form onSubmit={handleMovementSubmit} className="p-6 flex flex-col gap-4">
              
              <div className="bg-slate-50 p-4 border rounded-xl flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Produto Selecionado</span>
                <span className="text-sm font-bold text-slate-800 mt-1">{movementProduct.name}</span>
                <div className="flex justify-between text-xs text-slate-500 mt-2 border-t pt-2 border-slate-200">
                  <span>Estoque Atual: <b>{movementProduct.currentStock} {movementProduct.unit}</b></span>
                  <span>Mínimo: <b>{movementProduct.minStock} {movementProduct.unit}</b></span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Quantity input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Quantidade</label>
                  <input
                    type="number"
                    required
                    min={0.01}
                    step="any"
                    value={movementForm.quantity}
                    onChange={(e) => setMovementForm(prev => ({ ...prev, quantity: Number(e.target.value) || 0 }))}
                    className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-slate-50 focus:bg-white text-slate-850 font-bold font-mono text-center"
                  />
                </div>

                {/* Date input */}
                <div className="flex flex-col gap-1.55">
                  <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Data do Lançamento</label>
                  <input
                    type="date"
                    required
                    value={movementForm.date}
                    onChange={(e) => setMovementForm(prev => ({ ...prev, date: e.target.value }))}
                    className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-slate-50 text-slate-700 text-center font-mono"
                  />
                </div>
              </div>

              {/* Movement notes */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Motivo / Notas do Lote</label>
                <input
                  type="text"
                  maxLength={150}
                  value={movementForm.notes}
                  onChange={(e) => setMovementForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Ex: Compra mensal, doação, consumo diário"
                  className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-slate-50 focus:bg-white text-slate-800"
                />
              </div>

              <footer className="flex gap-3 justify-end border-t pt-5 mt-3">
                <button
                  type="button"
                  onClick={() => setIsMovementModalOpen(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-white font-semibold rounded-xl text-xs transition-all shadow ${
                    movementForm.type === 'entrada' 
                      ? 'bg-emerald-600 hover:bg-emerald-700' 
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  Registrar {movementForm.type === 'entrada' ? 'Entrada' : 'Saída'}
                </button>
              </footer>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default StockModule;
