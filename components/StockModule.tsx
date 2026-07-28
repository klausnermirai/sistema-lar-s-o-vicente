import React, { useState, useEffect } from 'react';
import { 
  Package, Plus, Search, FileText, Download, Upload, 
  History, ClipboardList, CheckCircle, AlertTriangle, 
  Trash2, Edit, X, ChevronLeft, ChevronRight, Calendar, 
  User, ArrowUpDown, Copy, Printer, RefreshCw, FileSpreadsheet,
  Heart, TrendingUp, Truck
} from 'lucide-react';
import { ProductStockItem, StockMovement, Supplier, Donor } from '../types';
import { 
  fetchStockProducts, saveStockProduct, deleteStockProduct, 
  bootstrapStockProducts, fetchStockMovements, registerStockMovement,
  fetchSuppliers, saveSupplier, deleteSupplier,
  fetchDonors, saveDonor, deleteDonor,
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
  const [activeTab, setActiveTab] = useState<'estoque' | 'historico' | 'compras' | 'importar' | 'doacoes' | 'fornecedores' | 'doadores'>('estoque');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');
  const [selectedStatus, setSelectedStatus] = useState<string>('TODOS');
  
  // Suppliers management state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    phone: '',
    representative: '',
    email: ''
  });

  // Donors management state
  const [donors, setDonors] = useState<Donor[]>([]);
  const [isDonorModalOpen, setIsDonorModalOpen] = useState(false);
  const [selectedDonor, setSelectedDonor] = useState<Donor | null>(null);
  const [donorForm, setDonorForm] = useState({
    name: '',
    phone: ''
  });

  // Donation Report state variables
  const [donationStartDate, setDonationStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [donationEndDate, setDonationEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [donationTypeFilter, setDonationTypeFilter] = useState<'entrada' | 'saida' | 'todas'>('entrada');
  const [donationCategoryFilter, setDonationCategoryFilter] = useState<string>('TODAS');
  const [donationSearchQuery, setDonationSearchQuery] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Sorting
  const [sortField, setSortField] = useState<keyof ProductStockItem>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Dynamic categories state loaded from local storage and merged with products' categories
  const [categories, setCategories] = useState<string[]>(() => {
    const defaultCats = ['ALIMENTAÇÃO', 'HIGIENE', 'LIMPEZA', 'MEDICAMENTOS', 'DIALÍTICO', 'AMBULATORIAL', 'GERAL'];
    const saved = localStorage.getItem('ssvp_stock_categories');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        // ignore
      }
    }
    return defaultCats;
  });

  useEffect(() => {
    if (products.length > 0) {
      setCategories(prev => {
        const productCategories = products
          .map(p => (p.category || '').toUpperCase().trim())
          .filter(c => c && !prev.includes(c));
        if (productCategories.length > 0) {
          const updated = [...prev, ...productCategories];
          localStorage.setItem('ssvp_stock_categories', JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
    }
  }, [products]);

  const handleAddNewCategory = (catName: string) => {
    const formatted = catName.trim().toUpperCase();
    if (!formatted) return;
    if (categories.includes(formatted)) {
      alert('Esta categoria já existe!');
      return;
    }
    const updated = [...categories, formatted];
    setCategories(updated);
    localStorage.setItem('ssvp_stock_categories', JSON.stringify(updated));
  };

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductStockItem | null>(null);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementProduct, setMovementProduct] = useState<ProductStockItem | null>(null);

  const [singleItemCategory, setSingleItemCategory] = useState('');
  const [multiDraftCategory, setMultiDraftCategory] = useState('');

  useEffect(() => {
    if (movementProduct) {
      setSingleItemCategory(movementProduct.category || 'ALIMENTAÇÃO');
    }
  }, [movementProduct]);

  // Forms states
  const [productForm, setProductForm] = useState({
    name: '',
    unit: 'KG',
    category: 'ALIMENTAÇÃO',
    currentStock: 0,
    minStock: 0,
    estimatedCost: 0
  });

  const [movementForm, setMovementForm] = useState({
    type: 'entrada' as 'entrada' | 'saida',
    quantity: 1,
    notes: '',
    date: new Date().toISOString().split('T')[0],
    reason: 'compra' as 'compra' | 'doacao' | 'consumo' | 'descarte',
    price: 0,
    invoiceNumber: '',
    supplierId: '',
    donorId: '',
    donorName: '',
    donorPhone: ''
  });

  // Multi-item movement entry states
  const [isMultiMovementModalOpen, setIsMultiMovementModalOpen] = useState(false);
  const [multiMovementHeader, setMultiMovementHeader] = useState({
    date: new Date().toISOString().split('T')[0],
    invoiceNumber: '',
    supplierId: '',
    notes: '',
  });
  const [multiMovementItems, setMultiMovementItems] = useState<Array<{
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    category?: string;
  }>>([]);
  const [multiDraftItem, setMultiDraftItem] = useState({
    productId: '',
    quantity: 1,
    price: 0,
  });
  const [multiEditingItemId, setMultiEditingItemId] = useState<string | null>(null);

  const openMultiMovementModal = () => {
    setMultiMovementHeader({
      date: new Date().toISOString().split('T')[0],
      invoiceNumber: '',
      supplierId: '',
      notes: '',
    });
    setMultiMovementItems([]);
    setMultiDraftItem({
      productId: '',
      quantity: 1,
      price: 0,
    });
    setMultiDraftCategory('');
    setMultiEditingItemId(null);
    setIsMultiMovementModalOpen(true);
  };

  const handleAddMultiItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!multiDraftItem.productId) {
      alert('Favor selecionar um produto.');
      return;
    }
    const prod = products.find(p => p.id === multiDraftItem.productId);
    if (!prod) {
      alert('Produto não localizado.');
      return;
    }
    if (multiDraftItem.quantity <= 0) {
      alert('A quantidade deve ser maior que zero.');
      return;
    }

    // Save product category dynamically if it has been updated inside the entry modal
    const targetCategory = multiDraftCategory || prod.category || 'ALIMENTAÇÃO';
    if (targetCategory && targetCategory !== prod.category) {
      try {
        await saveStockProduct({
          ...prod,
          category: targetCategory
        });
        // Dynamically update the local products state so it appears updated immediately in lists
        setProducts(prev => prev.map(p => p.id === prod.id ? { ...p, category: targetCategory } : p));
      } catch (err) {
        console.error('Erro ao atualizar categoria do produto:', err);
      }
    }

    if (multiEditingItemId) {
      setMultiMovementItems(prev => prev.map(item => {
        if (item.id === multiEditingItemId) {
          return {
            ...item,
            productId: multiDraftItem.productId,
            productName: prod.name,
            quantity: multiDraftItem.quantity,
            price: multiDraftItem.price,
            category: targetCategory,
          };
        }
        return item;
      }));
      setMultiEditingItemId(null);
    } else {
      setMultiMovementItems(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substr(2, 9),
          productId: multiDraftItem.productId,
          productName: prod.name,
          quantity: multiDraftItem.quantity,
          price: multiDraftItem.price,
          category: targetCategory,
        }
      ]);
    }

    setMultiDraftItem({
      productId: '',
      quantity: 1,
      price: 0,
    });
    setMultiDraftCategory('');
  };

  const handleEditMultiItem = (itemId: string) => {
    const item = multiMovementItems.find(i => i.id === itemId);
    if (!item) return;
    const prod = products.find(p => p.id === item.productId);
    setMultiDraftItem({
      productId: item.productId,
      quantity: item.quantity,
      price: item.price,
    });
    setMultiDraftCategory(item.category || prod?.category || 'ALIMENTAÇÃO');
    setMultiEditingItemId(item.id);
  };

  const handleDeleteMultiItem = (itemId: string) => {
    setMultiMovementItems(prev => prev.filter(i => i.id !== itemId));
    if (multiEditingItemId === itemId) {
      setMultiEditingItemId(null);
      setMultiDraftItem({
        productId: '',
        quantity: 1,
        price: 0,
      });
      setMultiDraftCategory('');
    }
  };

  const handleSubmitMultiMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (multiMovementItems.length === 0) {
      alert('Adicione pelo menos um item à nota para realizar o registro.');
      return;
    }
    if (!multiMovementHeader.supplierId) {
      alert('Por favor, selecione um Fornecedor.');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const selectedSupp = suppliers.find(s => s.id === multiMovementHeader.supplierId);
      const supplierNameValue = selectedSupp ? selectedSupp.name : '';

      for (const item of multiMovementItems) {
        const payload = {
          productId: item.productId,
          quantity: Number(item.quantity) || 0,
          type: 'entrada' as const,
          notes: multiMovementHeader.notes.trim(),
          date: multiMovementHeader.date,
          userName: session.fullName || session.username,
          reason: 'compra' as const,
          price: Number(item.price) || 0,
          invoiceNumber: multiMovementHeader.invoiceNumber || undefined,
          supplierId: multiMovementHeader.supplierId,
          supplierName: supplierNameValue,
        };
        await registerStockMovement(payload);
      }

      setIsMultiMovementModalOpen(false);
      setRefetchTrigger(prev => prev + 1);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao salvar os itens da nota fiscal.');
    } finally {
      setLoading(false);
    }
  };

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
        const [prodsData, movsData, suppData, donorsData] = await Promise.all([
          fetchStockProducts(),
          fetchStockMovements(),
          fetchSuppliers().catch(() => []),
          fetchDonors().catch(() => [])
        ]);
        if (active) {
          setProducts(prodsData || []);
          setMovements(movsData || []);
          setSuppliers(suppData || []);
          setDonors(donorsData || []);
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
        minStock: Number(productForm.minStock) || 0,
        estimatedCost: Number(productForm.estimatedCost) || 0
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
      minStock: 0,
      estimatedCost: 0
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
      minStock: prod.minStock,
      estimatedCost: prod.estimatedCost || 0
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
      date: new Date().toISOString().split('T')[0],
      reason: type === 'entrada' ? 'compra' : 'consumo',
      price: 0,
      invoiceNumber: '',
      supplierId: '',
      donorId: '',
      donorName: '',
      donorPhone: ''
    });
    setIsMovementModalOpen(true);
  };

  // Submit Movement Log (Entrada/Saída)
  const handleMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementProduct) return;
    try {
      setError(null);
      
      const isPurchase = movementForm.type === 'entrada' && movementForm.reason === 'compra';
      const isDonation = movementForm.reason === 'doacao';

      let finalDonorId = movementForm.donorId;
      let finalDonorName = movementForm.donorName;
      let finalDonorPhone = movementForm.donorPhone;

      // Inline creation of a donor
      if (isDonation && movementForm.donorId === 'new') {
        if (!finalDonorName) {
          throw new Error('O nome do novo doador é obrigatório.');
        }
        const saved = await saveDonor({ name: finalDonorName, phone: finalDonorPhone });
        if (saved && saved.donor) {
          finalDonorId = saved.donor.id;
          finalDonorName = saved.donor.name;
          finalDonorPhone = saved.donor.phone;
        }
      } else if (isDonation && movementForm.donorId) {
        const found = donors.find(d => d.id === movementForm.donorId);
        if (found) {
          finalDonorName = found.name;
          finalDonorPhone = found.phone || '';
        }
      }

      const selectedSupp = isPurchase ? suppliers.find(s => s.id === movementForm.supplierId) : null;

      // Save product category dynamically if updated under Entrada configuration
      if (movementForm.type === 'entrada' && singleItemCategory && singleItemCategory !== movementProduct.category) {
        try {
          await saveStockProduct({
            ...movementProduct,
            category: singleItemCategory
          });
        } catch (err) {
          console.error('Erro ao atualizar categoria do produto:', err);
        }
      }

      const payload = {
        productId: movementProduct.id,
        quantity: Number(movementForm.quantity) || 0,
        type: movementForm.type,
        notes: movementForm.notes.trim(),
        date: movementForm.date,
        userName: session.fullName || session.username,
        reason: movementForm.reason,
        price: (isPurchase || isDonation) ? Number(movementForm.price) || 0 : undefined,
        invoiceNumber: isPurchase ? movementForm.invoiceNumber : undefined,
        supplierId: isPurchase ? movementForm.supplierId : undefined,
        supplierName: isPurchase && selectedSupp ? selectedSupp.name : undefined,
        donorId: isDonation ? finalDonorId || null : undefined,
        donorName: isDonation ? finalDonorName || null : undefined,
        donorPhone: isDonation ? finalDonorPhone || null : undefined
      };

      await registerStockMovement(payload);
      setIsMovementModalOpen(false);
      setMovementProduct(null);
      setRefetchTrigger(prev => prev + 1);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao registrar movimentação.');
    }
  };

  // Doadores CRUD logic
  const handleDonorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const payload = {
        id: selectedDonor ? selectedDonor.id : undefined,
        name: donorForm.name.trim(),
        phone: donorForm.phone.trim()
      };
      await saveDonor(payload);
      setIsDonorModalOpen(false);
      setSelectedDonor(null);
      setDonorForm({ name: '', phone: '' });
      setRefetchTrigger(prev => prev + 1);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao salvar doador.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditDonor = (donor: Donor) => {
    setSelectedDonor(donor);
    setDonorForm({
      name: donor.name || '',
      phone: donor.phone || ''
    });
    setIsDonorModalOpen(true);
  };

  const handleDeleteDonor = async (id: string) => {
    if (!confirm('Deseja realmente excluir este doador?')) return;
    try {
      setLoading(true);
      setError(null);
      await deleteDonor(id);
      setRefetchTrigger(prev => prev + 1);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao excluir doador.');
    } finally {
      setLoading(false);
    }
  };

  // Fornecedores CRUD logic
  const handleSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const payload = {
        id: selectedSupplier ? selectedSupplier.id : undefined,
        name: supplierForm.name.trim(),
        representative: supplierForm.representative.trim(),
        phone: supplierForm.phone.trim(),
        email: supplierForm.email.trim(),
        categories: selectedSupplier ? (selectedSupplier.categories || []) : []
      };
      await saveSupplier(payload);
      setIsSupplierModalOpen(false);
      setSelectedSupplier(null);
      setSupplierForm({ name: '', phone: '', representative: '', email: '' });
      setRefetchTrigger(prev => prev + 1);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao salvar fornecedor.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSupplier = (supp: Supplier) => {
    setSelectedSupplier(supp);
    setSupplierForm({
      name: supp.name || '',
      phone: supp.phone || '',
      representative: supp.representative || '',
      email: supp.email || ''
    });
    setIsSupplierModalOpen(true);
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm('Deseja realmente excluir este fornecedor?')) return;
    try {
      setLoading(true);
      setError(null);
      await deleteSupplier(id);
      setRefetchTrigger(prev => prev + 1);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao excluir fornecedor.');
    } finally {
      setLoading(false);
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

          {canEdit && (
            <button
              onClick={openMultiMovementModal}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all shadow-md hover:shadow-lg rounded-xl text-xs"
            >
              <Plus size={16} />
              Nova Entrada
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

              <button
                onClick={() => { setActiveTab('doacoes'); }}
                className={`flex items-center gap-2 py-4 px-3 font-semibold text-xs uppercase tracking-wider border-b-2 transition-all duration-150 ${
                  activeTab === 'doacoes' 
                    ? 'border-[#004c99] text-[#004c99]' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Heart size={16} className="text-rose-500 fill-rose-500/10" />
                Relatório de Doações
              </button>

              <button
                onClick={() => { setActiveTab('fornecedores'); }}
                className={`flex items-center gap-2 py-4 px-3 font-semibold text-xs uppercase tracking-wider border-b-2 transition-all duration-150 ${
                  activeTab === 'fornecedores' 
                    ? 'border-[#004c99] text-[#004c99]' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Truck size={16} className="text-blue-500" />
                Fornecedores
              </button>

              <button
                onClick={() => { setActiveTab('doadores'); }}
                className={`flex items-center gap-2 py-4 px-3 font-semibold text-xs uppercase tracking-wider border-b-2 transition-all duration-150 ${
                  activeTab === 'doadores' 
                    ? 'border-[#004c99] text-[#004c99]' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <User size={16} className="text-pink-500 font-bold" />
                Doadores
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
                      {categories.map(cat => (
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
                            <td className="p-4">
                              <div className="flex flex-wrap gap-1.5 items-center">
                                {mv.reason && (
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider inline-block border ${
                                    mv.reason === 'compra' 
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : mv.reason === 'doacao'
                                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                                      : mv.reason === 'consumo'
                                      ? 'bg-slate-100 text-slate-700 border-slate-200'
                                      : mv.reason === 'descarte'
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : 'bg-gray-50 text-gray-550 border-gray-200'
                                  }`}>
                                    {mv.reason === 'compra' ? 'Compra' : 
                                     mv.reason === 'doacao' ? 'Doação' : 
                                     mv.reason === 'consumo' ? 'Consumo' : 
                                     mv.reason === 'descarte' ? 'Descarte' : mv.reason}
                                  </span>
                                )}
                                <span className="text-slate-500 italic font-sans text-[11px]">
                                  {mv.notes || (!mv.reason ? 'Nenhuma observação declarada.' : '')}
                                </span>
                                {mv.reason === 'compra' && (mv.price || mv.invoiceNumber || mv.supplierName) && (
                                  <div className="w-full flex flex-wrap gap-x-2 gap-y-0.5 mt-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 font-mono text-[10px] rounded border border-emerald-100 max-w-fit">
                                    {mv.supplierName && <span><b>Fornecedor:</b> {mv.supplierName}</span>}
                                    {mv.price !== undefined && mv.price !== null && (
                                      <span>
                                        <b>Valor Unitário:</b> R$ {Number(mv.price).toFixed(2)}{' '}
                                        <span className="text-slate-450 font-sans font-medium text-[9px]">(Total: R$ {Number(mv.price * mv.quantity).toFixed(2)})</span>
                                      </span>
                                    )}
                                    {mv.invoiceNumber && <span><b>NF:</b> {mv.invoiceNumber}</span>}
                                  </div>
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

            </div>
          )}

          {/* TAB: DONATIONS PERIODIC REPORT */}
          {activeTab === 'doacoes' && (() => {
            const filteredDonations = movements.filter(mv => {
              if (mv.reason !== 'doacao') return false;

              if (donationTypeFilter === 'entrada' && mv.type !== 'entrada') return false;
              if (donationTypeFilter === 'saida' && mv.type !== 'saida') return false;

              if (donationCategoryFilter !== 'TODAS') {
                const prod = products.find(p => p.id === mv.productId);
                const cat = prod ? prod.category : 'GERAL';
                if (cat !== donationCategoryFilter) return false;
              }

              if (donationSearchQuery.trim()) {
                const query = donationSearchQuery.toLowerCase();
                const matchName = mv.productName.toLowerCase().includes(query);
                const matchNotes = mv.notes?.toLowerCase().includes(query) || false;
                const matchUser = mv.userName.toLowerCase().includes(query);
                const matchDonor = mv.donorName?.toLowerCase().includes(query) || false;
                if (!matchName && !matchNotes && !matchUser && !matchDonor) return false;
              }

              if (donationStartDate && mv.date < donationStartDate) return false;
              if (donationEndDate && mv.date > donationEndDate) return false;

              return true;
            });

            const sortedDonations = [...filteredDonations].sort((a, b) => b.date.localeCompare(a.date));

            const totalDonationsCount = filteredDonations.length;
            const totalItemsVolume = filteredDonations.reduce((acc, curr) => acc + curr.quantity, 0);
            const totalDonationCostValuation = filteredDonations.reduce((acc, curr) => acc + (curr.price || 0), 0);

            // Group by category to see most donated categories
            const categorySummary: { [cat: string]: { count: number, quantity: number } } = {};
            filteredDonations.forEach(mv => {
              const prod = products.find(p => p.id === mv.productId);
              const cat = prod ? prod.category : 'GERAL';
              if (!categorySummary[cat]) {
                categorySummary[cat] = { count: 0, quantity: 0 };
              }
              categorySummary[cat].count += 1;
              categorySummary[cat].quantity += mv.quantity;
            });

            const categoryLabels = Object.keys(categorySummary);
            const topCategoryName = categoryLabels.length > 0 
              ? categoryLabels.reduce((a, b) => categorySummary[a].quantity > categorySummary[b].quantity ? a : b) 
              : 'Nenhuma';

            // Group by product name to find most donated items
            const productSummary: { [name: string]: { quantity: number, unit: string } } = {};
            filteredDonations.forEach(mv => {
              const prod = products.find(p => p.id === mv.productId);
              const unit = prod ? prod.unit : 'Unid';
              if (!productSummary[mv.productName]) {
                productSummary[mv.productName] = { quantity: 0, unit };
              }
              productSummary[mv.productName].quantity += mv.quantity;
            });

            const topDonatedItems = Object.entries(productSummary)
              .sort((a, b) => b[1].quantity - a[1].quantity)
              .slice(0, 3);

            const handleExportDonationPDF = async () => {
              const { getHtmlPrintHeader, getHtmlPrintFooter, getHtmlPrintStyles, printHtml } = await import('../lib/pdfHelpers');
              
              const formattedStartDate = donationStartDate.split('-').reverse().join('/');
              const formattedEndDate = donationEndDate.split('-').reverse().join('/');
              const title = `Relatório Consolidado de Doações`;
              
              const headerHtml = await getHtmlPrintHeader(settings, title);
              const footerHtml = getHtmlPrintFooter();
              const styles = getHtmlPrintStyles();

              let tableRowsHtml = '';
              sortedDonations.forEach((mv) => {
                const prod = products.find(p => p.id === mv.productId);
                const cat = prod ? prod.category : 'GERAL';
                const formattedDate = mv.date.split('-').reverse().join('/');
                const donorValue = mv.donorName ? `${mv.donorName} ${mv.donorPhone ? `(${mv.donorPhone})` : ''}` : (mv.reason === 'doacao' ? 'Anônimo' : '—');
                const priceValue = mv.price ? `R$ ${mv.price.toFixed(2)}` : '—';
                tableRowsHtml += `
                  <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
                    <td style="padding: 10px; color: #1e293b; font-weight: 500;">${formattedDate}</td>
                    <td style="padding: 10px; color: #0f172a; font-weight: 600;">${mv.productName}</td>
                    <td style="padding: 10px; color: #334155;">${donorValue}</td>
                    <td style="padding: 10px; color: #475569;">${cat}</td>
                    <td style="padding: 10px; color: #0f172a; font-weight: 700; text-align: right;">${mv.quantity} ${prod?.unit || ''}</td>
                    <td style="padding: 10px; color: #0f172a; font-weight: 700; text-align: right;">${priceValue}</td>
                    <td style="padding: 10px; color: ${mv.type === 'entrada' ? '#15803d' : '#b91c1c'}; font-weight: bold; text-align: center;">
                      ${mv.type === 'entrada' ? 'RECEBIDA (ENTRADA)' : 'CONCEDIDA (SAÍDA)'}
                    </td>
                    <td style="padding: 10px; color: #475569;">${mv.userName}</td>
                    <td style="padding: 10px; color: #64748b; font-style: italic;">${mv.notes || '-'}</td>
                  </tr>
                `;
              });

              if (sortedDonations.length === 0) {
                tableRowsHtml = `
                  <tr>
                    <td colspan="9" style="padding: 30px; text-align: center; color: #64748b; font-style: italic;">
                      Nenhuma doação registrada no período selecionado ou com os filtros ativos.
                    </td>
                  </tr>
                `;
              }

              let categoriesHtml = '';
              Object.entries(categorySummary).forEach(([catName, stats]) => {
                categoriesHtml += `
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; flex: 1; min-width: 130px; margin-right: 8px; margin-bottom: 8px;">
                    <div style="font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase;">${catName}</div>
                    <div style="font-size: 14px; color: #1e3a8a; font-weight: 800; margin-top: 4px;">${stats.quantity} itens</div>
                    <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">${stats.count} registros</div>
                  </div>
                `;
              });

              if (categoriesHtml === '') {
                categoriesHtml = `<div style="color: #64748b; font-style: italic; font-size: 11px;">Sem doações registradas neste período</div>`;
              }

              let topProductsHtml = '';
              topDonatedItems.forEach(([prodName, stats]) => {
                topProductsHtml += `
                  <li style="font-size: 11px; margin-bottom: 4px; color: #1e293b;">
                    <strong>${prodName}</strong>: ${stats.quantity} ${stats.unit}
                  </li>
                `;
              });

              if (topProductsHtml === '') {
                topProductsHtml = `<div style="color: #64748b; font-style: italic; font-size: 11px;">Sem doações registradas</div>`;
              }

              const html = `
                <html>
                  <head>
                    <title>${title}</title>
                    <style>
                      ${styles}
                      body { font-family: system-ui, -apple-system, sans-serif; background-color: #ffffff; color: #1e293b; margin: 0; padding: 0; }
                      .report-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px; background: #ffffff; }
                      .report-title { font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; }
                    </style>
                  </head>
                  <body>
                    <div class="print-wrapper" style="padding: 24px;">
                      ${headerHtml}
                      
                      <!-- Filtros -->
                      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 20px; font-size: 11px;">
                        <div>
                          <strong>Período:</strong> ${formattedStartDate} a ${formattedEndDate} <br/>
                          <strong>Filtros adicionais:</strong> Categoria: ${donationCategoryFilter} | Tipo: ${donationTypeFilter === 'entrada' ? 'Apenas Doações Recebidas' : donationTypeFilter === 'saida' ? 'Apenas Doações Concedidas' : 'Todas'}
                        </div>
                        <div style="text-align: right;">
                          <strong>Lançamentos de Doação:</strong> ${totalDonationsCount} <br/>
                          <strong>Volume Total:</strong> ${totalItemsVolume} unidades <br/>
                          <strong>Valuation de Custo total:</strong> R$ ${totalDonationCostValuation.toFixed(2)}
                        </div>
                      </div>

                      <!-- Resumo de Estatísticas -->
                      <div style="display: flex; gap: 16px; margin-bottom: 24px;">
                        <div class="report-card" style="flex: 2;">
                          <h4 class="report-title">Volume de Doações por Categoria</h4>
                          <div style="display: flex; flex-wrap: wrap;">
                            ${categoriesHtml}
                          </div>
                        </div>

                        <div class="report-card" style="flex: 1;">
                          <h4 class="report-title">Principais Itens Doados</h4>
                          <ul style="margin: 0; padding-left: 16px; list-style-type: square;">
                            ${topProductsHtml}
                          </ul>
                        </div>
                      </div>

                      <h4 class="report-title">Relação Cronológica de Doações</h4>
                      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                        <thead>
                          <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-size: 10px; font-weight: bold; text-transform: uppercase; text-align: left; color: #475569;">
                            <th style="padding: 10px;">Data</th>
                            <th style="padding: 10px;">Item / Mantimento</th>
                            <th style="padding: 10px;">Doador</th>
                            <th style="padding: 10px;">Categoria</th>
                            <th style="padding: 10px; text-align: right;">Qtd</th>
                            <th style="padding: 10px; text-align: right;">Custo</th>
                            <th style="padding: 10px; text-align: center;">Movimentação</th>
                            <th style="padding: 10px;">Registrado Por</th>
                            <th style="padding: 10px;">Observações</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${tableRowsHtml}
                        </tbody>
                      </table>

                      <!-- Assinatura -->
                      <div style="margin-top: 50px; display: flex; justify-content: space-around; font-family: sans-serif; font-size: 10px; page-break-inside: avoid;">
                        <div style="text-align: center; border-top: 1px solid #94a3b8; width: 220px; padding-top: 6px; color: #475569;">
                          <strong>Assinatura do Responsável</strong><br/>
                          Controle de Almoxarifado / Estoque
                        </div>
                        <div style="text-align: center; border-top: 1px solid #94a3b8; width: 220px; padding-top: 6px; color: #475569;">
                          <strong>Responsável de Suprimentos</strong><br/>
                          Visto do Almoxarifado / Conferente
                        </div>
                      </div>

                      ${footerHtml}
                    </div>
                  </body>
                </html>
              `;

              printHtml(html);
            };

            return (
              <div className="p-6 flex flex-col gap-6">
                
                {/* Header Information and Action Row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
                  <div className="flex items-start gap-3">
                    <div className="bg-purple-50 p-3 rounded-2xl border border-purple-100 flex items-center justify-center">
                      <Heart className="text-purple-600 fill-purple-600/10" size={24} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                        Relatório Consolidado de Doações
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                        Selecione o intervalo de datas para calcular estatísticas e extrair a listagem de doações recebidas de insumos.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleExportDonationPDF}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-[#004c99] hover:bg-blue-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
                  >
                    <Printer size={14} />
                    Exportar Relatório PDF
                  </button>
                </div>

                {/* Filters Row */}
                <div className="bg-slate-50 rounded-2xl p-4 border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                  
                  {/* Start Date */}
                  <div className="flex flex-col gap-1.55">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                      Data Inicial:
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" size={14} />
                      <input
                        type="date"
                        value={donationStartDate}
                        onChange={(e) => setDonationStartDate(e.target.value)}
                        className="w-full border rounded-xl pl-8 pr-3 py-2 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:border-[#004c99]"
                      />
                    </div>
                  </div>

                  {/* End Date */}
                  <div className="flex flex-col gap-1.55">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                      Data Final:
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" size={14} />
                      <input
                        type="date"
                        value={donationEndDate}
                        onChange={(e) => setDonationEndDate(e.target.value)}
                        className="w-full border rounded-xl pl-8 pr-3 py-2 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:border-[#004c99]"
                      />
                    </div>
                  </div>

                  {/* Fluxo / Type Filter */}
                  <div className="flex flex-col gap-1.55">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                      Fluxo de Doações:
                    </label>
                    <select
                      value={donationTypeFilter}
                      onChange={(e) => setDonationTypeFilter(e.target.value as any)}
                      className="border rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:border-[#004c99]"
                    >
                      <option value="entrada">Apenas Recebidas (Entradas)</option>
                      <option value="saida">Apenas Concedidas (Saídas)</option>
                      <option value="todas">Todas as Doações</option>
                    </select>
                  </div>

                  {/* Category Filter */}
                  <div className="flex flex-col gap-1.55">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                      Categoria de Produtos:
                    </label>
                    <select
                      value={donationCategoryFilter}
                      onChange={(e) => setDonationCategoryFilter(e.target.value)}
                      className="border rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:border-[#004c99]"
                    >
                      <option value="TODAS">TODAS AS CATEGORIAS</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Search input */}
                  <div className="flex flex-col gap-1.55">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                      Pesquisa rápida:
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" size={14} />
                      <input
                        type="text"
                        placeholder="Ex: Arroz, operador, observação..."
                        value={donationSearchQuery}
                        onChange={(e) => setDonationSearchQuery(e.target.value)}
                        className="w-full border rounded-xl pl-8 pr-3 py-2 text-xs bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#004c99]"
                      />
                    </div>
                  </div>

                </div>

                {/* Dashboard Metrics Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  
                  {/* Total Movements Card */}
                  <div className="bg-white border rounded-2xl p-4 flex items-center justify-between shadow-xs">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                        Lançamentos no Período
                      </span>
                      <span className="text-2xl font-black text-slate-800 mt-1 block">
                        {totalDonationsCount}
                      </span>
                      <span className="text-[10px] text-slate-505 font-semibold block mt-1">
                        Movimentações registradas
                      </span>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-2xl text-[#004c99]">
                      <ClipboardList size={22} />
                    </div>
                  </div>

                  {/* Total Quantity Card */}
                  <div className="bg-white border rounded-2xl p-4 flex items-center justify-between shadow-xs">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                        Volume Total Doador
                      </span>
                      <span className="text-2xl font-black text-purple-705 mt-1 block">
                        {totalItemsVolume}
                      </span>
                      <span className="text-[10px] text-slate-505 font-semibold block mt-1">
                        Unidades, quilos ou pacotes
                      </span>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-2xl text-purple-600">
                      <TrendingUp size={22} />
                    </div>
                  </div>

                  {/* Valuation of Donations */}
                  <div className="bg-white border rounded-2xl p-4 flex items-center justify-between shadow-xs">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                        Custo Estimado Total
                      </span>
                      <span className="text-2xl font-black text-emerald-700 mt-1 block">
                        R$ {totalDonationCostValuation.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-slate-505 font-semibold block mt-1">
                        Valor total das doações recebidas
                      </span>
                    </div>
                    <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600">
                      <TrendingUp size={22} />
                    </div>
                  </div>

                  {/* Top Category of Donations */}
                  <div className="bg-white border rounded-2xl p-4 flex items-center justify-between shadow-xs">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                        Maior Volume Doador
                      </span>
                      <span className="text-base font-black text-slate-800 mt-2 block uppercase truncate max-w-[170px]">
                        {topCategoryName}
                      </span>
                      <span className="text-[10px] text-slate-505 font-semibold block mt-1">
                        Principal categoria atingida
                      </span>
                    </div>
                    <div className="bg-rose-50 p-3 rounded-2xl text-rose-500">
                      <Heart size={22} className="fill-rose-500/10" />
                    </div>
                  </div>

                </div>

                {/* Summary Panels (Top categories and Top products) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Volume por Categoria */}
                  <div className="border bg-slate-50/50 rounded-2xl p-5 flex flex-col gap-4">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Resumo da Distribuição Sanitária por Categoria
                    </h4>
                    
                    {Object.keys(categorySummary).length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-4">
                        Nenhum registro de doação para a seleção atual.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {Object.entries(categorySummary).map(([catName, stats]) => (
                          <div key={catName} className="bg-white border rounded-xl p-3 shadow-xs">
                            <span className="text-[9px] font-black text-slate-400 uppercase block truncate">
                              {catName}
                            </span>
                            <span className="text-base font-extrabold text-[#004c99] mt-1 block">
                              {stats.quantity} <span className="text-[10px] font-medium text-slate-500">vol</span>
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 mt-0.5 block">
                              {stats.count} registros
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Principais Produtos doados */}
                  <div className="border bg-slate-50/50 rounded-2xl p-5 flex flex-col gap-3 justify-center">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                      Principais Insumos Recebidos / Doados
                    </h4>
                    
                    {topDonatedItems.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-4">
                        Sem dados disponíveis.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {topDonatedItems.map(([name, stats], rank) => (
                          <div key={name} className="bg-white border rounded-xl px-4 py-2 flex items-center justify-between shadow-xs">
                            <div className="flex items-center gap-3">
                              <span className="font-extrabold text-[#004c99] text-xs font-mono bg-blue-50 w-5 h-5 flex items-center justify-center rounded-lg">
                                {rank + 1}
                              </span>
                              <span className="text-xs font-bold text-slate-700">{name}</span>
                            </div>
                            <span className="text-xs font-extrabold text-slate-800">
                              {stats.quantity} <span className="text-[10px] font-medium text-slate-500 lowercase">{stats.unit}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

                {/* Table list of movements */}
                <div className="border rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b">
                          <th className="p-4">Data</th>
                          <th className="p-4">Mantimento / Item</th>
                          <th className="p-4">Doador</th>
                          <th className="p-4">Categoria</th>
                          <th className="p-4 text-right">Qtd</th>
                          <th className="p-4 text-right">Valor Estimado</th>
                          <th className="p-4 text-center">Fluxo</th>
                          <th className="p-4">Operado por</th>
                          <th className="p-4">Observações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-slate-700">
                        {sortedDonations.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="p-8 text-center text-xs text-slate-400 italic bg-white">
                              Nenhum registro de doação localizado no período e com os filtros indicados.
                            </td>
                          </tr>
                        ) : (
                          sortedDonations.map((mv, idx) => {
                            const prod = products.find(p => p.id === mv.productId);
                            const cat = prod ? prod.category : 'GERAL';
                            const categoryStyle = cat === 'ALIMENTAÇÃO' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                  cat === 'HIGIENE' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                  cat === 'LIMPEZA' ? 'bg-green-50 text-green-700 border-green-200' :
                                                  cat === 'MEDICAMENTOS' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                  'bg-slate-100 text-slate-700 border-slate-200';
                            return (
                              <tr key={mv.id || idx} className="hover:bg-slate-50/50 bg-white transition-colors">
                                <td className="p-4 text-xs font-semibold text-slate-500">
                                  {mv.date.split('-').reverse().join('/')}
                                </td>
                                <td className="p-4 text-xs font-black text-slate-800">
                                  {mv.productName}
                                </td>
                                <td className="p-4 text-xs font-bold text-slate-700">
                                  {mv.donorName || (mv.reason === 'doacao' ? 'Anônimo' : '—')}
                                  {mv.donorPhone ? (
                                    <span className="block text-[10px] text-slate-400 font-mono font-medium">{mv.donorPhone}</span>
                                  ) : null}
                                </td>
                                <td className="p-4">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${categoryStyle}`}>
                                    {cat}
                                  </span>
                                </td>
                                <td className="p-4 text-xs font-black text-slate-800 text-right">
                                  {mv.quantity} <span className="text-[10px] font-medium text-slate-400 lowercase">{prod?.unit || 'un'}</span>
                                </td>
                                <td className="p-6 text-xs font-black text-emerald-700 text-right">
                                  {mv.price ? `R$ ${mv.price.toFixed(2)}` : '—'}
                                </td>
                                <td className="p-4 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
                                    mv.type === 'entrada' 
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}>
                                    {mv.type === 'entrada' ? 'Recebido' : 'Concedido'}
                                  </span>
                                </td>
                                <td className="p-4 text-xs text-slate-600 font-medium">
                                  {mv.userName}
                                </td>
                                <td className="p-4 text-xs text-slate-500 italic">
                                  {mv.notes || '—'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            );
          })()}

          {/* TAB: FORNECEDORES MANAGEMENT */}
          {activeTab === 'fornecedores' && (
            <div className="p-6 flex flex-col gap-6">
              
              {/* Header inside the suppliers tab */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-4 border rounded-2xl border-slate-100">
                <div className="flex items-center gap-3">
                  <Truck className="text-[#004c99]" size={24} />
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Cadastro de Fornecedores de Insumos</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Gerencie seus parceiros comerciais, representantes e veja de forma automatizada as categorias atendidas.
                    </p>
                  </div>
                </div>

                {canEdit && (
                  <button
                    onClick={() => {
                      setSelectedSupplier(null);
                      setSupplierForm({ name: '', phone: '', representative: '', email: '' });
                      setIsSupplierModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#004c99] hover:bg-blue-800 text-white rounded-xl text-xs font-semibold select-none cursor-pointer duration-100"
                  >
                    <Plus size={14} />
                    Novo Fornecedor
                  </button>
                )}
              </div>

              {/* Suppliers List */}
              {suppliers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center px-4">
                  <Truck className="text-slate-400 mb-3" size={48} />
                  <h4 className="text-sm font-bold text-slate-750">Nenhum fornecedor cadastrado</h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    Adicione os seus fornecedores para registrar notas, preços e mapear automaticamente categorias de produtos.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {suppliers
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(supp => (
                      <div key={supp.id} className="bg-white border hover:shadow-md transition-shadow rounded-2xl p-5 flex flex-col justify-between relative group">
                        
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-2 border-b pb-2">
                            <div>
                              <h4 className="font-bold text-slate-900 text-sm leading-tight">{supp.name}</h4>
                            </div>
                            
                            {canEdit && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleEditSupplier(supp)}
                                  className="text-slate-400 hover:text-[#004c99] p-1.5 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                                  title="Editar"
                                >
                                  <Edit size={14} />
                                </button>
                                {canDelete && (
                                  <button
                                    onClick={() => supp.id && handleDeleteSupplier(supp.id)}
                                    className="text-slate-400 hover:text-red-600 p-1.5 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                                    title="Excluir"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col gap-1.5 text-xs text-slate-655">
                            {supp.representative && (
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider w-1/3">Representante:</span>
                                <span className="text-slate-800 font-medium">{supp.representative}</span>
                              </div>
                            )}
                            {supp.phone && (
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider w-1/3">Telefone:</span>
                                <span className="text-slate-800 font-mono font-bold">{supp.phone}</span>
                              </div>
                            )}
                            {supp.email && (
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider w-1/3">E-mail:</span>
                                <span className="text-slate-800 break-all">{supp.email}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Categorias Atendidas:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {supp.categories && supp.categories.length > 0 ? (
                              supp.categories.map((cat: string) => {
                                const categoryStyle = cat === 'ALIMENTAÇÃO' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                      cat === 'HIGIENE' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                      cat === 'LIMPEZA' ? 'bg-green-50 text-green-700 border-green-200' :
                                                      'bg-slate-100 text-slate-700 border-slate-200';
                                return (
                                  <span key={cat} className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${categoryStyle}`}>
                                    {cat}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">Nenhuma compra registrada</span>
                            )}
                          </div>
                        </div>

                      </div>
                    ))}
                </div>
              )}

            </div>
          )}

          {/* SUPPLIER FORM MODAL */}
          {isSupplierModalOpen && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <header className="bg-slate-50 border-b px-6 py-4 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Truck className="text-[#004c99]" size={20} />
                    <h3 className="text-sm font-bold text-slate-800">
                      {selectedSupplier ? 'Editar Fornecedor' : 'Cadastrar Novo Fornecedor'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSupplierModalOpen(false)}
                    className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </header>
                
                <form onSubmit={handleSupplierSubmit} className="p-6 flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Razão Social / Nome do Fornecedor *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Comercial Alimentos S/A"
                      value={supplierForm.name}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, name: e.target.value }))}
                      className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-slate-50 focus:bg-white text-slate-850 font-medium"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Nome do Representante</label>
                    <input
                      type="text"
                      placeholder="Ex: João Silva"
                      value={supplierForm.representative}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, representative: e.target.value }))}
                      className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-slate-50 focus:bg-white text-slate-850 font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Telefone de Contato</label>
                      <input
                        type="text"
                        placeholder="Ex: (31) 98888-7777"
                        value={supplierForm.phone}
                        onChange={(e) => setSupplierForm(prev => ({ ...prev, phone: e.target.value }))}
                        className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-slate-50 focus:bg-white text-slate-850 font-medium"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">E-mail de Contato</label>
                      <input
                        type="email"
                        placeholder="Ex: joao@comercial.com"
                        value={supplierForm.email}
                        onChange={(e) => setSupplierForm(prev => ({ ...prev, email: e.target.value }))}
                        className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-slate-50 focus:bg-white text-slate-850 font-medium"
                      />
                    </div>
                  </div>

                  <footer className="flex gap-3 justify-end border-t pt-5 mt-3">
                    <button
                      type="button"
                      onClick={() => setIsSupplierModalOpen(false)}
                      className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-all shadow cursor-pointer"
                    >
                      Salvar
                    </button>
                  </footer>
                </form>
              </div>
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
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden">
            <header className="px-6 py-5 border-b bg-slate-50 flex items-center justify-between shrink-0">
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

            <form onSubmit={handleSaveProductSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 flex flex-col gap-4 overflow-y-auto flex-1">
              
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
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Categoria</label>
                    <button 
                      type="button"
                      onClick={() => {
                        const name = prompt('Digite o nome da nova categoria:');
                        if (name) handleAddNewCategory(name);
                      }}
                      className="text-[9px] text-[#004c99] hover:underline font-bold"
                    >
                      + Criar
                    </button>
                  </div>
                  <select
                    value={productForm.category}
                    onChange={(e) => setProductForm(prev => ({ ...prev, category: e.target.value }))}
                    className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-slate-50 text-slate-700"
                  >
                    {categories.map(cat => (
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

              {/* Estimated product unit cost */}
              <div className="flex flex-col gap-1.5 border-t pt-4">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Custo Unitário Estimado (R$)</label>
                <div className="flex gap-2">
                  <span className="flex items-center text-xs font-bold text-slate-450 bg-slate-100 px-2 rounded-xl">R$</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={productForm.estimatedCost || ''}
                    onChange={(e) => setProductForm(prev => ({ ...prev, estimatedCost: Number(e.target.value) || 0 }))}
                    placeholder="Ex: 12.50"
                    className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-slate-50 focus:bg-white text-slate-800 font-mono font-bold"
                  />
                </div>
                <span className="text-[9px] text-slate-450 leading-normal">
                  Defina o custo unitário sugerido por padrão para este produto. Este valor pode ser carregado como sugestão ao lançar doações.
                </span>
              </div>

              </div>

              <footer className="px-6 py-4 border-t bg-slate-50 flex gap-3 justify-end items-center shrink-0">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors bg-white"
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

      {/* MODAL 2B: REGISTER MULTI-ITEM ENTRADA (COMPRA DE NOTA FISCAL COM MÚLTIPLOS ITENS) */}
      {isMultiMovementModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl relative flex flex-col max-h-[95vh] overflow-hidden">
            <header className="px-6 py-4 border-b bg-slate-50 flex items-center justify-between shrink-0">
              <div className="flex flex-col">
                <h3 className="text-sm font-bold text-[#004c99] uppercase tracking-wider">
                  Registrar Nova Entrada de Compra (Lote / Nota Fiscal)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Preencha os dados da nota e adicione múltiplos itens na mesma movimentação.
                </p>
              </div>
              <button 
                onClick={() => setIsMultiMovementModalOpen(false)}
                className="p-1.5 text-slate-450 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 overflow-y-auto flex-1">
              {/* COL 1: HEADER & ADD ITEM FORM (5 cols) */}
              <div className="md:col-span-5 flex flex-col gap-4 border-r border-slate-100 pr-0 md:pr-6">
                
                {/* Section header: Invoice general info */}
                <div className="flex flex-col gap-3">
                  <h4 className="text-xs font-bold text-slate-705 uppercase tracking-wide border-b pb-1">
                    1. Dados da Nota / Recebimento
                  </h4>

                  {/* Date Input */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Data da Compra / Entrada *</label>
                    <input
                      type="date"
                      required
                      value={multiMovementHeader.date}
                      onChange={(e) => setMultiMovementHeader(prev => ({ ...prev, date: e.target.value }))}
                      className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-slate-50 text-slate-750 font-mono"
                    />
                  </div>

                  {/* Supplier Input */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Fornecedor *</label>
                    {suppliers.length === 0 ? (
                      <div className="text-[11px] text-amber-600 bg-amber-50 p-2.5 border border-amber-100 rounded-xl">
                        Nenhum fornecedor cadastrado. Cadastre primeiro na aba <b>Fornecedores</b>.
                      </div>
                    ) : (
                      <select
                        required
                        value={multiMovementHeader.supplierId}
                        onChange={(e) => setMultiMovementHeader(prev => ({ ...prev, supplierId: e.target.value }))}
                        className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-white text-slate-755 font-medium"
                      >
                        <option value="">Selecione o Fornecedor...</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {/* Invoice Number */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Nº da Nota Fiscal / Cupom</label>
                      <input
                        type="text"
                        placeholder="Ex: NF-58291"
                        value={multiMovementHeader.invoiceNumber}
                        onChange={(e) => setMultiMovementHeader(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                        className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-white text-slate-800 font-semibold font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Form to insert/add item to the current invoice list */}
                <div className="flex flex-col gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wide flex items-center justify-between">
                    <span>{multiEditingItemId ? '📝 Editar Item' : '➕ Adicionar Item'}</span>
                    {multiEditingItemId && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setMultiEditingItemId(null);
                          setMultiDraftItem({ productId: '', quantity: 1, price: 0 });
                        }}
                        className="text-[10px] text-red-500 hover:underline"
                      >
                        Cancelar Edição
                      </button>
                    )}
                  </h4>

                  {/* Select Product */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">Produto *</label>
                    <select
                      required
                      value={multiDraftItem.productId}
                      onChange={(e) => {
                        const pid = e.target.value;
                        const prod = products.find(p => p.id === pid);
                        setMultiDraftItem(prev => ({ 
                          ...prev, 
                          productId: pid,
                          price: prod?.estimatedCost || 0
                        }));
                        setMultiDraftCategory(prod?.category || 'ALIMENTAÇÃO');
                      }}
                      className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-white text-slate-750 font-medium"
                    >
                      <option value="">Selecione o Produto...</option>
                      {products
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                        ))
                      }
                    </select>
                  </div>

                  {/* Categoria do Item na Nota */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">Categoria do Item *</label>
                      <button 
                        type="button" 
                        onClick={() => {
                          const name = prompt('Digite o nome da nova categoria:');
                          if (name) handleAddNewCategory(name);
                        }}
                        className="text-[9px] text-[#004c99] hover:underline font-bold"
                      >
                        + Criar Categoria
                      </button>
                    </div>
                    <select
                      required
                      value={multiDraftCategory}
                      onChange={(e) => setMultiDraftCategory(e.target.value)}
                      className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-white text-slate-750 font-medium"
                    >
                      <option value="">Selecione a Categoria...</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Quantity */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Quantidade *</label>
                      <input
                        type="number"
                        required
                        min="0.01"
                        step="any"
                        placeholder="Ex: 10"
                        value={multiDraftItem.quantity}
                        onChange={(e) => setMultiDraftItem(prev => ({ ...prev, quantity: Number(e.target.value) || 0 }))}
                        className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-white text-slate-850 font-semibold font-mono"
                      />
                    </div>

                    {/* Unitary price */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Vlr Unitário (R$) *</label>
                      <input
                        type="number"
                        required
                        min="0.00"
                        step="0.01"
                        placeholder="Ex: 5.50"
                        value={multiDraftItem.price === 0 ? '' : multiDraftItem.price}
                        onChange={(e) => setMultiDraftItem(prev => ({ ...prev, price: Number(e.target.value) || 0 }))}
                        className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-white text-slate-850 font-semibold font-mono"
                      />
                    </div>
                  </div>

                  {multiDraftItem.productId && (
                    <div className="text-[10px] flex items-center justify-between text-slate-500 px-1 pt-1 border-t border-dashed border-slate-200">
                      <span>Total do Item:</span>
                      <span className="font-bold text-slate-750">
                        R$ {((multiDraftItem.price || 0) * (multiDraftItem.quantity || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleAddMultiItem}
                    className="w-full flex items-center justify-center gap-1.5 mt-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow transition-colors"
                  >
                    {multiEditingItemId ? 'Atualizar Item na Nota' : 'Incluir Item na Nota'}
                  </button>
                </div>

              </div>

              {/* COL 2: LIST OF ITEMS ALREADY IN THE INVOICE (7 cols) */}
              <div className="md:col-span-7 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b pb-1">
                  <h4 className="text-xs font-bold text-slate-705 uppercase tracking-wide">
                    2. Itens Cadastrados na Nota ({multiMovementItems.length})
                  </h4>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Valor Total Geral</span>
                    <span className="text-base font-black text-emerald-600">
                      R$ {multiMovementItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="flex-1 min-h-[250px] max-h-[365px] overflow-y-auto border border-slate-100 rounded-2xl bg-slate-50/30 p-2">
                  {multiMovementItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-2 text-slate-400">
                      <ClipboardList size={32} className="opacity-40" />
                      <p className="text-xs font-semibold animate-pulse">Nenhum produto incluído nesta nota ainda.</p>
                      <p className="text-[10px] max-w-[280px]">Utilize o formulário ao lado para selecionar o produto, preencher e incluí-lo.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {multiMovementItems.map((item) => (
                        <div 
                          key={item.id} 
                          className={`p-3 rounded-xl border flex items-center justify-between transition-all duration-150 ${
                            multiEditingItemId === item.id 
                              ? 'bg-amber-50 border-amber-200 shadow-sm' 
                              : 'bg-white border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-xs text-slate-800 break-words">
                                {item.productName}
                              </span>
                              {item.category && (
                                <span className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                                  {item.category}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] font-mono text-slate-500">
                              <span><b>Qtd:</b> {item.quantity}</span>
                              <span><b>Vlr Unit:</b> R$ {item.price.toFixed(2)}</span>
                              <span className="text-emerald-700 font-semibold bg-emerald-50 px-1 rounded">
                                <b>Subtotal:</b> R$ {(item.price * item.quantity).toFixed(2)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleEditMultiItem(item.id)}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
                              title="Editar este item"
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMultiItem(item.id)}
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                              title="Excluir este item"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes Input */}
                <div className="flex flex-col gap-1.5 mt-1 border-t pt-3">
                  <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Notas Adicionais / Lote Geral</label>
                  <input
                    type="text"
                    maxLength={150}
                    placeholder="Ex: Compra emergencial para cozinha, etc."
                    value={multiMovementHeader.notes}
                    onChange={(e) => setMultiMovementHeader(prev => ({ ...prev, notes: e.target.value }))}
                    className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-white text-slate-800"
                  />
                </div>

              </div>
            </div>

            <footer className="px-6 py-5 border-t bg-slate-50 flex gap-3 justify-end items-center">
              <button
                type="button"
                onClick={() => setIsMultiMovementModalOpen(false)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancelar Nota
              </button>
              <button
                type="button"
                onClick={handleSubmitMultiMovement}
                disabled={loading || multiMovementItems.length === 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-all shadow hover:shadow-md disabled:bg-slate-200 disabled:shadow-none disabled:text-slate-450 flex items-center gap-2"
              >
                <CheckCircle size={15} />
                Finalizar e Registrar Entrada ({multiMovementItems.length} {multiMovementItems.length === 1 ? 'item' : 'itens'})
              </button>
            </footer>

          </div>
        </div>
      )}

      {/* MODAL 2: REGISTER SINGLE MOVEMENT (ENTRADA / SAÍDA) */}
      {isMovementModalOpen && movementProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden">
            <header className="px-6 py-5 border-b bg-slate-50 flex items-center justify-between shrink-0">
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

            <form onSubmit={handleMovementSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 flex flex-col gap-4 overflow-y-auto flex-1">
              
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

              {/* Reason Selection */}
              <div className="flex flex-col gap-1.55">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                  {movementForm.type === 'entrada' ? 'Origem da Entrada' : 'Tipo de Saída'}
                </label>
                <select
                  value={movementForm.reason}
                  onChange={(e) => setMovementForm(prev => ({ ...prev, reason: e.target.value as any }))}
                  className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-slate-50 focus:bg-white text-slate-700 font-medium"
                >
                  {movementForm.type === 'entrada' ? (
                    <>
                      <option value="compra">Compra</option>
                      <option value="doacao">Doação</option>
                    </>
                  ) : (
                    <>
                      <option value="consumo">Consumo Interno</option>
                      <option value="doacao">Doação</option>
                      <option value="descarte">Descarte / Perda / Vencido</option>
                    </>
                  )}
                </select>
              </div>

              {/* Conditional Purchase Fields */}
              {movementForm.type === 'entrada' && movementForm.reason === 'compra' && (
                <div className="flex flex-col gap-4 border-l-2 border-emerald-500 pl-3 py-1 bg-emerald-50/20 rounded-r-xl">
                  
                  {/* Select Supplier */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Fornecedor *</label>
                    {suppliers.length === 0 ? (
                      <div className="text-[11px] text-amber-600 bg-amber-50 p-2 border border-amber-100 rounded-xl">
                        Nenhum fornecedor cadastrado. Cadastre primeiro na aba <b>Fornecedores</b>.
                      </div>
                    ) : (
                      <select
                        required
                        value={movementForm.supplierId}
                        onChange={(e) => setMovementForm(prev => ({ ...prev, supplierId: e.target.value }))}
                        className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-white text-slate-750 font-medium"
                      >
                        <option value="">Selecione o Fornecedor...</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Price Unitary */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Valor Unitário (R$) *</label>
                      <input
                        type="number"
                        required
                        min="0.00"
                        step="0.01"
                        placeholder="Ex: 5.50"
                        value={movementForm.price || ''}
                        onChange={(e) => setMovementForm(prev => ({ ...prev, price: Number(e.target.value) || 0 }))}
                        className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-white text-slate-800 font-semibold font-mono"
                      />
                      <span className="text-[9px] text-slate-450 font-bold mt-1">
                        Total calculado: R$ {((movementForm.price || 0) * (Number(movementForm.quantity) || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Invoice Number */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Nº da Nota Fiscal</label>
                      <input
                        type="text"
                        placeholder="Ex: 58291"
                        value={movementForm.invoiceNumber}
                        onChange={(e) => setMovementForm(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                        className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-white text-slate-800 font-semibold font-mono"
                      />
                    </div>
                  </div>

                </div>
              )}

              {/* Conditional Donation Fields */}
              {movementForm.reason === 'doacao' && (
                <div className="flex flex-col gap-4 border-l-2 border-rose-500 pl-3 py-1 bg-rose-50/10 rounded-r-xl">
                  
                  {/* Select Donor */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Doador (Opcional)</label>
                      {movementForm.donorId === 'new' && (
                        <button 
                          type="button" 
                          onClick={() => setMovementForm(prev => ({ ...prev, donorId: '', donorName: '', donorPhone: '' }))}
                          className="text-[10px] text-slate-500 hover:text-slate-800 underline block cursor-pointer"
                        >
                          Limpar / Cancelar novo
                        </button>
                      )}
                    </div>
                    <select
                      value={movementForm.donorId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMovementForm(prev => ({ 
                          ...prev, 
                          donorId: val,
                          donorName: val === 'new' ? '' : (donors.find(d => d.id === val)?.name || ''),
                          donorPhone: val === 'new' ? '' : (donors.find(d => d.id === val)?.phone || '')
                        }));
                      }}
                      className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-white text-slate-750 font-medium"
                    >
                      <option value="">Anônimo / Não Especificado</option>
                      <option value="new">+ Cadastrar Novo Doador...</option>
                      {donors.map(d => (
                        <option key={d.id} value={d.id}>{d.name} {d.phone ? `(${d.phone})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  {/* Inline New Donor Fields */}
                  {movementForm.donorId === 'new' && (
                    <div className="flex flex-col gap-3 border-t pt-3 mt-1 border-slate-150">
                      <div className="flex flex-col gap-1 text-left">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Nome do Novo Doador *</label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: João da Silva"
                          value={movementForm.donorName}
                          onChange={(e) => setMovementForm(prev => ({ ...prev, donorName: e.target.value.toUpperCase() }))}
                          className="border rounded-xl px-3 py-2 text-xs bg-white text-slate-800"
                        />
                      </div>
                      <div className="flex flex-col gap-1 text-left">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Telefone do Novo Doador</label>
                        <input
                          type="text"
                          placeholder="Ex: (11) 99999-8888"
                          value={movementForm.donorPhone}
                          onChange={(e) => setMovementForm(prev => ({ ...prev, donorPhone: e.target.value }))}
                          className="border rounded-xl px-3 py-2 text-xs bg-white text-slate-800 font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {/* Pricing / Cost for Donation */}
                  <div className="flex flex-col gap-1.5 border-t pt-3 mt-1 border-slate-100">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                      Valor de Custo do Produto (Doação)
                    </label>
                    <div className="flex gap-2">
                      <span className="flex items-center text-xs font-bold text-slate-550 bg-slate-100 px-2 rounded-xl">R$</span>
                      <input
                        type="number"
                        min="0.00"
                        step="0.01"
                        placeholder="0.00"
                        value={movementForm.price || ''}
                        onChange={(e) => setMovementForm(prev => ({ ...prev, price: Number(e.target.value) || 0 }))}
                        className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-white text-slate-800 font-semibold font-mono w-full"
                      />
                    </div>
                    
                    {/* Helper Auto-Calcs */}
                    <div className="flex flex-col gap-1 mt-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Sugestões de Custo:</span>
                      
                      {/* 1. Manually registered cost */}
                      {movementProduct.estimatedCost ? (
                        <button
                          type="button"
                          onClick={() => {
                            const unitCost = Number(movementProduct.estimatedCost) || 0;
                            const totalVal = unitCost * (Number(movementForm.quantity) || 1);
                            setMovementForm(prev => ({ ...prev, price: Number(totalVal.toFixed(2)) }));
                          }}
                          className="text-[10px] text-[#004c99] hover:underline text-left flex justify-between cursor-pointer"
                        >
                          <span>• Do cadastro do produto (R$ {movementProduct.estimatedCost.toFixed(2)}/unid):</span>
                          <span className="font-bold">R$ {(movementProduct.estimatedCost * (Number(movementForm.quantity) || 1)).toFixed(2)}</span>
                        </button>
                      ) : (
                        <span className="text-[9px] text-slate-450 italic">• Sem custo cadastrado no produto.</span>
                      )}

                      {/* 2. Last purchase cost */}
                      {(() => {
                        const purchases = movements.filter(m => m.productId === movementProduct.id && m.type === 'entrada' && m.reason === 'compra' && m.price && m.quantity);
                        if (purchases.length > 0) {
                          const sortedPurch = [...purchases].sort((a,b) => b.date.localeCompare(a.date));
                          const lastP = sortedPurch[0];
                          const unitCost = lastP.price || 0;
                          const totalVal = unitCost * (Number(movementForm.quantity) || 1);
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setMovementForm(prev => ({ ...prev, price: Number(totalVal.toFixed(2)) }));
                              }}
                              className="text-[10px] text-emerald-600 hover:underline text-left flex justify-between cursor-pointer"
                            >
                              <span>• Da última compra (R$ {unitCost.toFixed(2)}/unid em {lastP.date.split('-').reverse().join('/')}):</span>
                              <span className="font-bold">R$ {totalVal.toFixed(2)}</span>
                            </button>
                          );
                        }
                        return <span className="text-[9px] text-slate-450 italic">• Sem registro de compra anterior para este produto.</span>
                      })()}
                    </div>
                  </div>

                </div>
              )}

              {/* Category selection - only for entry/inflow movements */}
              {movementForm.type === 'entrada' && (
                <div className="flex flex-col gap-1.5 border-t border-dashed pt-4 mt-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">Categoria do Item *</label>
                    <button 
                      type="button" 
                      onClick={() => {
                        const name = prompt('Digite o nome da nova categoria:');
                        if (name) handleAddNewCategory(name);
                      }}
                      className="text-[9px] text-[#004c99] hover:underline font-bold"
                    >
                      + Criar Categoria
                    </button>
                  </div>
                  <select
                    value={singleItemCategory}
                    onChange={(e) => setSingleItemCategory(e.target.value)}
                    className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-slate-50 focus:bg-white text-slate-75 font-semibold text-slate-700"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <span className="text-[9px] text-slate-450 italic leading-snug">
                    * Nota: Alterar a categoria aqui atualizará a categoria deste produto no estoque permanente.
                  </span>
                </div>
              )}

              {/* Movement notes */}
              <div className="flex flex-col gap-1.5 mb-1">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Notas Adicionais / Lote</label>
                <input
                  type="text"
                  maxLength={150}
                  value={movementForm.notes}
                  onChange={(e) => setMovementForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Ex: Compra mensal, doador específico, etc."
                  className="border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004c99] bg-slate-50 focus:bg-white text-slate-800"
                />
              </div>

              </div>

              <footer className="px-6 py-4 border-t bg-slate-50 flex gap-3 justify-end items-center shrink-0">
                <button
                  type="button"
                  onClick={() => setIsMovementModalOpen(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 bg-white transition-colors"
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
