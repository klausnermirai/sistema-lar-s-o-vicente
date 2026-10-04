import React, { useState, useEffect, useRef } from 'react';
import { Users, Plus, Upload, Search, Edit2, Archive, CheckCircle2, AlertCircle, FileSpreadsheet, Clock } from 'lucide-react';
import { Employee, User, OperationalShift } from '../types';
import Papa from 'papaparse';
import { apiFetch } from '../lib/api';

interface EmployeesModuleProps {
  session: any;
  settings: any;
}

export const EmployeesModule: React.FC<EmployeesModuleProps> = ({ session, settings }) => {
  const [activeTab, setActiveTab] = useState<'funcionarios' | 'turnos'>('funcionarios');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<OperationalShift[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isShiftFormOpen, setIsShiftFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editingShift, setEditingShift] = useState<OperationalShift | null>(null);

  // CSV Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "summary">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch('/api/employees', {
        headers: { 'Authorization': `Bearer ${session.id}` }
      });
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
    setIsLoading(false);
  };

  const loadShifts = async () => {
    try {
      const response = await apiFetch(`/api/shifts?institutionId=${session.institutionId || session.cnpj}`, {
        headers: { 'Authorization': `Bearer ${session.id}` }
      });
      if (response.ok) {
        const data = await response.json();
        setShifts(data);
      }
    } catch (err) {
      console.error('Error fetching shifts', err);
    }
  };

  useEffect(() => {
    fetchEmployees();
    loadShifts();
  }, []);

  const handleSave = async (emp: Partial<Employee>) => {
    try {
      const response = await apiFetch('/api/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.id}`
        },
        body: JSON.stringify(emp)
      });
      if (response.ok) {
        alert('Funcionário salvo com sucesso!');
        setIsFormOpen(false);
        setEditingEmployee(null);
        fetchEmployees();
      }
    } catch (err) {
      alert('Erro ao salvar.');
    }
  };

  const handleArchive = async (id: string) => {
    if(!window.confirm('Deseja inativar este funcionário?')) return;
    try {
      const res = await apiFetch(`/api/employees/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.id}` }
      });
      if (res.ok) fetchEmployees();
    } catch {
      alert('Erro ao inativar.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data.map((row: any) => ({
          ...row,
          status: row.status ? row.status.toLowerCase() : 'ativo',
          criarUsuarioSistema: ['sim', 'true', '1'].includes(String(row.criarUsuarioSistema).toLowerCase()),
        }));
        setImportData(parsed);
        setImportStep('preview');
      },
      error: (error) => {
        alert('Erro ao ler CSV: ' + error.message);
      }
    });
    
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmImport = async () => {
    const validData = importData.filter(d => d.nomeCompleto && d.funcao);
    if(validData.length === 0) {
      alert('Nenhum registro válido para importar.');
      return;
    }

    try {
      const response = await apiFetch('/api/employees/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.id}`
        },
        body: JSON.stringify(validData)
      });
      if (response.ok) {
        setImportStep('summary');
        fetchEmployees();
      } else {
        alert('Erro ao importar CSV.');
      }
    } catch(err) {
      alert('Erro na requisição bulk.');
    }
  };

  const filteredEmployees = employees.filter(e => 
    (e.nomeCompleto || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.funcao && e.funcao.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#004c99] flex items-center gap-2">
            <Users size={28} /> Funcionários (RH)
          </h1>
          <p className="text-sm text-gray-500 mt-1">Gestão institucional de profissionais</p>
        </div>
        <div className="flex gap-3">
          {activeTab === 'funcionarios' && (
            <>
              <input 
                type="file" 
                accept=".csv" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
              />
              <button 
                onClick={() => {
                  setImportData([]);
                  setImportStep('upload');
                  setIsImportModalOpen(true);
                }}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all text-sm font-bold flex items-center gap-2 shadow-sm"
              >
                <Upload size={16} /> Importar CSV
              </button>
              <button 
                onClick={() => {
                  setEditingEmployee(null);
                  setIsFormOpen(true);
                }}
                className="px-4 py-2 bg-[#004c99] text-white rounded-xl hover:bg-blue-800 transition-all text-sm font-bold flex items-center gap-2 shadow-md"
              >
                <Plus size={16} /> Novo Funcionário
              </button>
            </>
          )}

          {activeTab === 'turnos' && (
            <button 
              onClick={() => {
                setEditingShift(null);
                setIsShiftFormOpen(true);
              }}
              className="px-4 py-2 bg-[#004c99] text-white rounded-xl hover:bg-blue-800 transition-all text-sm font-bold flex items-center gap-2 shadow-md"
            >
              <Plus size={16} /> Configurar Turno
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('funcionarios')}
          className={`pb-4 px-2 text-sm font-bold uppercase tracking-widest transition-all ${
            activeTab === 'funcionarios' 
            ? 'border-b-4 border-[#004c99] text-[#004c99]' 
            : 'text-gray-400 hover:text-gray-600 border-b-4 border-transparent'
          }`}
        >
          <div className="flex items-center gap-2"><Users size={16} /> Quadro de Funcionários</div>
        </button>
        <button
          onClick={() => setActiveTab('turnos')}
          className={`pb-4 px-2 text-sm font-bold uppercase tracking-widest transition-all ${
            activeTab === 'turnos' 
            ? 'border-b-4 border-[#004c99] text-[#004c99]' 
            : 'text-gray-400 hover:text-gray-600 border-b-4 border-transparent'
          }`}
        >
          <div className="flex items-center gap-2"><Clock size={16} /> Horários e Turnos</div>
        </button>
      </div>

      {activeTab === 'funcionarios' && (
        <div className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Buscar por nome ou função..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border-gray-200 rounded-xl text-sm focus:ring-[#004c99] focus:border-[#004c99]"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Carregando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#004c99] text-white">
                <tr>
                  <th className="p-4 font-semibold rounded-tl-2xl">Nome Completo</th>
                  <th className="p-4 font-semibold">Função</th>
                  <th className="p-4 font-semibold">Registro</th>
                  <th className="p-4 font-semibold">Vínculo / Carga Horária</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold text-center rounded-tr-2xl">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map(emp => (
                  <tr key={emp.id} className="border-b last:border-none hover:bg-blue-50/50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-gray-900">{emp.nomeCompleto}</div>
                      {emp.email && <div className="text-xs text-gray-500">{emp.email}</div>}
                    </td>
                    <td className="p-4">
                      <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-semibold">
                        {emp.funcao}
                      </span>
                    </td>
                    <td className="p-4">
                      {emp.conselhoProfissional ? (
                        <div className="text-xs">
                          {emp.conselhoProfissional} - {emp.numeroRegistro} {emp.ufRegistro ? `(${emp.ufRegistro})` : ''}
                        </div>
                      ) : <span className="text-gray-400 text-xs">-</span>}
                    </td>
                    <td className="p-4 text-xs text-gray-600">
                      <div>{emp.vinculo || '-'}</div>
                      {emp.cargaHorariaSemanal && <div className="text-gray-400">{emp.cargaHorariaSemanal}h/sem</div>}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${emp.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="p-4 flex items-center justify-center gap-2">
                      <button 
                        onClick={() => { setEditingEmployee(emp); setIsFormOpen(true); }}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleArchive(emp.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        title="Inativar/Arquivar"
                      >
                        <Archive size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">Nenhum funcionário encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        </div>
      )}

      {activeTab === 'turnos' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shifts.map(shift => (
              <div key={shift.id} className={`bg-white p-6 rounded-2xl shadow-sm border ${shift.defineInicioDoDiaOperacional ? 'border-[#004c99] ring-2 ring-[#004c99]/20' : 'border-gray-200'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">{shift.nomeTurno}</h3>
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">{shift.setor}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-bold uppercase rounded ${shift.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {shift.status}
                  </span>
                </div>
                
                <div className="flex gap-4 mb-4">
                  <div className="flex-1 bg-gray-50 p-3 rounded-xl border border-gray-100 flex flex-col items-center">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Início</span>
                    <span className="text-lg font-black text-[#004c99]">{shift.horarioInicio}</span>
                  </div>
                  <div className="flex-1 bg-gray-50 p-3 rounded-xl border border-gray-100 flex flex-col items-center">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Fim</span>
                    <span className="text-lg font-black text-[#004c99]">{shift.horarioFim}</span>
                  </div>
                </div>

                {shift.defineInicioDoDiaOperacional && (
                  <div className="bg-blue-50 text-[#004c99] text-xs font-bold uppercase tracking-widest p-2 rounded-lg text-center mb-4">
                    Inicia o Dia Operacional
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
                  <button 
                    onClick={() => {
                      setEditingShift(shift);
                      setIsShiftFormOpen(true);
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors font-bold uppercase text-[10px] tracking-widest flex items-center gap-1"
                  >
                    <Edit2 size={14} /> Editar
                  </button>
                  <button 
                    onClick={async () => {
                      if(window.confirm('Tem certeza que deseja inativar este turno?')) {
                        try {
                          await apiFetch(`/api/shifts/${shift.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${session.id}` }});
                          loadShifts();
                        } catch(e) { alert('Erro ao inativar'); }
                      }
                    }}
                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors font-bold uppercase text-[10px] tracking-widest flex items-center gap-1"
                  >
                    <Archive size={14} /> Inativar
                  </button>
                </div>
              </div>
            ))}
            
            {shifts.length === 0 && (
              <div className="col-span-full bg-white p-12 rounded-2xl border-2 border-dashed border-gray-200 text-center flex flex-col items-center justify-center text-gray-500">
                <Clock size={48} className="mb-4 text-gray-300" />
                <p className="text-lg font-bold">Nenhum turno configurado</p>
                <p className="text-sm mt-1 mb-6">Configure os turnos operacionais para uso no modo tablet.</p>
                <button 
                  onClick={() => setIsShiftFormOpen(true)}
                  className="px-6 py-3 bg-[#004c99] text-white rounded-xl hover:bg-blue-800 transition-all text-sm font-bold shadow-md flex items-center gap-2 uppercase tracking-widest"
                >
                  <Plus size={16} /> Criar Primeiro Turno
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isFormOpen && (
        <EmployeeFormModal 
          employee={editingEmployee}
          onClose={() => setIsFormOpen(false)}
          onSave={handleSave}
        />
      )}

      {isShiftFormOpen && (
        <ShiftFormModal 
          shift={editingShift}
          onClose={() => setIsShiftFormOpen(false)}
          onSave={async (shiftData) => {
            try {
              await apiFetch('/api/shifts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.id}` },
                body: JSON.stringify({ ...shiftData, institutionId: session.institutionId || session.cnpj })
              });
              loadShifts();
              setIsShiftFormOpen(false);
            } catch(e) {
              alert('Erro ao salvar turno');
            }
          }}
        />
      )}

      {isImportModalOpen && (
        <div className="fixed inset-0 bg-blue-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b bg-gradient-to-r from-[#004c99] to-blue-700 text-white flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FileSpreadsheet size={24} /> Importar Funcionários via CSV
              </h2>
              <button onClick={() => setIsImportModalOpen(false)} className="text-white/80 hover:text-white transition-colors">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {importStep === 'upload' && (
                <div className="text-center py-12">
                  <FileSpreadsheet size={48} className="mx-auto text-blue-200 mb-4" />
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Importação em Lote</h3>
                  <p className="text-gray-500 mb-6 max-w-md mx-auto">
                    Faça o upload do seu arquivo CSV com os dados dos funcionários.
                    As colunas obrigatórias são 'nomeCompleto' e 'funcao'.
                  </p>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-3 bg-[#004c99] text-white rounded-xl hover:bg-blue-800 transition-all font-bold shadow-md inline-flex items-center gap-2"
                  >
                    <Upload size={20} /> Selecionar Arquivo CSV
                  </button>
                </div>
              )}

              {importStep === 'preview' && (
                <div>
                  <h3 className="font-bold text-gray-900 mb-4">Pré-visualização (Total: {importData.length} registros)</h3>
                  
                  <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex gap-3 mb-6 relative overflow-hidden">
                    <AlertCircle size={24} className="text-orange-500 shrink-0" />
                    <div className="text-sm text-orange-900 z-10">
                       <p className="font-bold">Aviso de Importação</p>
                       <p className="mt-1">
                         Nesta etapa as duplicidades ainda não são mescladas (o sistema vai sempre criar novos registros caso você clique em "Confirmar Importação"). Verifique bem se os dados abaixo estão corretos.
                       </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto border rounded-xl">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="p-3 font-semibold border-b">Nome</th>
                          <th className="p-3 font-semibold border-b">Função</th>
                          <th className="p-3 font-semibold border-b">Email</th>
                          <th className="p-3 font-semibold border-b">Conselho</th>
                          <th className="p-3 font-semibold border-b">Criar Usuário?</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importData.slice(0, 15).map((row, i) => {
                          const isValid = row.nomeCompleto && row.funcao;
                          const isDuplicate = employees.some(e => e.nomeCompleto.toLowerCase() === row.nomeCompleto?.toLowerCase() || (e.email && row.email && e.email === row.email));
                          return (
                            <tr key={i} className={`border-b last:border-0 ${!isValid ? 'bg-red-50' : isDuplicate ? 'bg-yellow-50' : ''}`}>
                              <td className="p-3 font-bold flex items-center gap-2">
                                {isDuplicate && <AlertCircle size={14} className="text-yellow-600" title="Possível duplicidade com registro existente" />}
                                {row.nomeCompleto || '-'}
                              </td>
                              <td className="p-3">{row.funcao || '-'}</td>
                              <td className="p-3 text-gray-500">{row.email || '-'}</td>
                              <td className="p-3 text-gray-500">{row.conselhoProfissional ? `${row.conselhoProfissional}-${row.numeroRegistro}` : '-'}</td>
                              <td className="p-3 text-center">
                                {row.criarUsuarioSistema ? <CheckCircle2 size={16} className="text-green-500 mx-auto" /> : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {importData.length > 15 && <p className="text-xs text-gray-500 text-center mt-3">Mostrando apenas os primeiros 15 registros.</p>}
                  
                  <div className="flex justify-end gap-3 mt-6">
                    <button onClick={() => setImportStep('upload')} className="px-6 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
                      Voltar
                    </button>
                    <button onClick={handleConfirmImport} className="px-6 py-2.5 bg-[#004c99] text-white rounded-xl hover:bg-blue-800 transition-all text-sm font-bold shadow-md flex items-center gap-2">
                       Confirmar Importação
                    </button>
                  </div>
                </div>
              )}

              {importStep === 'summary' && (
                <div className="text-center py-12">
                  <CheckCircle2 size={64} className="mx-auto text-green-500 mb-6" />
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Importação Concluída!</h3>
                  <p className="text-gray-600 mb-8">
                    Os funcionários foram cadastrados com sucesso. <br/>
                    Se houver funcionários com <span className="font-bold">Sugerido para Usuário</span> configurado, vá na aba de <span className="font-bold cursor-pointer text-[#004c99]" onClick={() => setIsImportModalOpen(false)}>Configurações &gt; Acesso</span> para gerar a senha e efetivar o acesso deles.
                  </p>
                  <button onClick={() => setIsImportModalOpen(false)} className="px-8 py-3 bg-[#004c99] text-white rounded-xl hover:bg-blue-800 transition-all font-bold shadow-md text-lg">
                    Concluir
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const EmployeeFormModal = ({ employee, onClose, onSave }: { employee: Employee | null, onClose: () => void, onSave: (emp: Partial<Employee>) => void }) => {
  const [formData, setFormData] = useState<Partial<Employee>>(employee || {
    nomeCompleto: '',
    funcao: '',
    status: 'ativo'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nomeCompleto?.trim() || !formData.funcao?.trim()) {
      alert('Nome completo e função são obrigatórios.');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-blue-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b bg-gradient-to-r from-[#004c99] to-blue-700 text-white flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users size={24} /> {employee ? 'Editar Funcionário' : 'Novo Funcionário'}
          </h2>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Dados Pessoais */}
          <div>
             <h3 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-widest border-b pb-2">Identificação</h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Nome Completo *</label>
                  <input type="text" required value={formData.nomeCompleto || ''} onChange={e => setFormData({...formData, nomeCompleto: e.target.value})} className="w-full p-2 border rounded-xl text-sm focus:ring-[#004c99] focus:border-[#004c99] bg-gray-50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Nome de Exibição</label>
                  <input type="text" value={formData.nomeExibicao || ''} onChange={e => setFormData({...formData, nomeExibicao: e.target.value})} className="w-full p-2 border rounded-xl text-sm focus:ring-[#004c99] focus:border-[#004c99] bg-gray-50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                  <input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-2 border rounded-xl text-sm focus:ring-[#004c99] focus:border-[#004c99] bg-gray-50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Telefone</label>
                  <input type="text" value={formData.telefone || ''} onChange={e => setFormData({...formData, telefone: e.target.value})} className="w-full p-2 border rounded-xl text-sm focus:ring-[#004c99] focus:border-[#004c99] bg-gray-50" />
                </div>
             </div>
          </div>

          {/* Dados Profissionais */}
          <div>
             <h3 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-widest border-b pb-2">Profissional</h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Função *</label>
                  <input type="text" required value={formData.funcao || ''} onChange={e => setFormData({...formData, funcao: e.target.value})} className="w-full p-2 border rounded-xl text-sm focus:ring-[#004c99] focus:border-[#004c99] bg-gray-50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Área Profissional</label>
                  <input type="text" value={formData.areaProfissional || ''} onChange={e => setFormData({...formData, areaProfissional: e.target.value})} className="w-full p-2 border rounded-xl text-sm focus:ring-[#004c99] focus:border-[#004c99] bg-gray-50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Conselho (Ex: CRM, CRESS)</label>
                  <input type="text" value={formData.conselhoProfissional || ''} onChange={e => setFormData({...formData, conselhoProfissional: e.target.value})} className="w-full p-2 border rounded-xl text-sm focus:ring-[#004c99] focus:border-[#004c99] bg-gray-50" />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Nº Registro</label>
                    <input type="text" value={formData.numeroRegistro || ''} onChange={e => setFormData({...formData, numeroRegistro: e.target.value})} className="w-full p-2 border rounded-xl text-sm focus:ring-[#004c99] focus:border-[#004c99] bg-gray-50" />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">UF</label>
                    <input type="text" maxLength={2} value={formData.ufRegistro || ''} onChange={e => setFormData({...formData, ufRegistro: e.target.value.toUpperCase()})} className="w-full p-2 border rounded-xl text-sm focus:ring-[#004c99] focus:border-[#004c99] bg-gray-50 uppercase" />
                  </div>
                </div>
             </div>
          </div>

          {/* Setup / RH */}
          <div>
             <h3 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-widest border-b pb-2">Institucional</h3>
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Vínculo</label>
                  <input type="text" value={formData.vinculo || ''} onChange={e => setFormData({...formData, vinculo: e.target.value})} className="w-full p-2 border rounded-xl text-sm focus:ring-[#004c99] focus:border-[#004c99] bg-gray-50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Carga Horária (Semanal)</label>
                  <input type="number" value={formData.cargaHorariaSemanal || ''} onChange={e => setFormData({...formData, cargaHorariaSemanal: e.target.value})} className="w-full p-2 border rounded-xl text-sm focus:ring-[#004c99] focus:border-[#004c99] bg-gray-50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Data Admissão</label>
                  <input type="date" value={formData.dataAdmissao || ''} onChange={e => setFormData({...formData, dataAdmissao: e.target.value})} className="w-full p-2 border rounded-xl text-sm focus:ring-[#004c99] focus:border-[#004c99] bg-gray-50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Status *</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as 'ativo'|'inativo'})} className="w-full p-2 border rounded-xl text-sm focus:ring-[#004c99] focus:border-[#004c99] bg-gray-50 font-semibold shadow-sm">
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Observações</label>
                  <input type="text" value={formData.observacoes || ''} onChange={e => setFormData({...formData, observacoes: e.target.value})} className="w-full p-2 border rounded-xl text-sm focus:ring-[#004c99] focus:border-[#004c99] bg-gray-50" />
                </div>
             </div>
          </div>
          
          <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex gap-3">
             <AlertCircle size={24} className="text-orange-500 shrink-0" />
             <div className="text-sm text-orange-900">
               <p className="font-bold">Acesso ao Sistema</p>
               <p className="mt-1 text-xs">Vincule ao usuário existente em Configurações &gt; Controle de Acesso.</p>
             </div>
          </div>
        </form>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all">Cancelar</button>
          <button onClick={handleSubmit} className="px-6 py-2.5 bg-[#004c99] text-white rounded-xl hover:bg-blue-800 transition-all text-sm font-bold shadow-md flex items-center gap-2">
            <CheckCircle2 size={18} /> Salvar Funcionário
          </button>
        </div>
      </div>
    </div>
  );
};

const ShiftFormModal = ({ shift, onClose, onSave }: { shift: OperationalShift | null, onClose: () => void, onSave: (s: Partial<OperationalShift>) => void }) => {
  const [formData, setFormData] = useState<Partial<OperationalShift>>({
    nomeTurno: '',
    horarioInicio: '',
    horarioFim: '',
    setor: 'Saúde e Cuidados',
    ordem: 1,
    status: 'ativo',
    defineInicioDoDiaOperacional: false,
    observacoes: ''
  });

  useEffect(() => {
    if (shift) setFormData(shift);
  }, [shift]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nomeTurno || !formData.horarioInicio || !formData.horarioFim) {
      alert('Preencha os campos obrigatórios (Nome e Horários).');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-blue-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="text-xl font-black text-[#004c99] tracking-tighter uppercase">{shift ? 'Editar Turno' : 'Novo Turno'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
        </div>

        <form className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nome do Turno *</label>
              <input type="text" value={formData.nomeTurno} onChange={e => setFormData({...formData, nomeTurno: e.target.value})} className="w-full p-3 border rounded-xl text-sm focus:ring-[#004c99] focus:border-[#004c99] bg-gray-50 uppercase font-black" placeholder="Ex: Turno da Manhã" />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Horário Início *</label>
              <input type="time" value={formData.horarioInicio as string | undefined} onChange={e => setFormData({...formData, horarioInicio: e.target.value})} className="w-full p-3 border rounded-xl text-lg font-bold text-[#004c99] bg-blue-50 focus:ring-[#004c99] focus:border-[#004c99]" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Horário Fim *</label>
              <input type="time" value={formData.horarioFim as string | undefined} onChange={e => setFormData({...formData, horarioFim: e.target.value})} className="w-full p-3 border rounded-xl text-lg font-bold text-[#004c99] bg-blue-50 focus:ring-[#004c99] focus:border-[#004c99]" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Setor</label>
              <input type="text" value={formData.setor as string | undefined} onChange={e => setFormData({...formData, setor: e.target.value})} className="w-full p-3 border rounded-xl text-sm bg-gray-50 focus:ring-[#004c99] focus:border-[#004c99]" placeholder="Ex: Saúde e Cuidados" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Ordem (Exibição)</label>
              <input type="number" value={formData.ordem as number | undefined} onChange={e => setFormData({...formData, ordem: parseInt(e.target.value) || 1})} className="w-full p-3 border rounded-xl text-sm bg-gray-50 focus:ring-[#004c99] focus:border-[#004c99]" />
            </div>

            <div className="col-span-1 sm:col-span-2">
              <label className="flex items-center gap-3 p-4 border rounded-xl bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors">
                <input type="checkbox" checked={formData.defineInicioDoDiaOperacional as boolean | undefined} onChange={e => setFormData({...formData, defineInicioDoDiaOperacional: e.target.checked})} className="w-5 h-5 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]" />
                <div>
                  <span className="block text-sm font-bold text-gray-900 uppercase tracking-tight">Define o Início do Dia Operacional</span>
                  <span className="block text-xs text-gray-500">Marque se este turno é o primeiro do dia para relatórios (Ex: 05:40)</span>
                </div>
              </label>
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
              <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as 'ativo'|'inativo'})} className="w-full p-3 border rounded-xl text-sm bg-gray-50 focus:ring-[#004c99] focus:border-[#004c99]">
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>
        </form>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all">Cancelar</button>
          <button onClick={handleSubmit} className="px-6 py-2.5 bg-[#004c99] text-white rounded-xl hover:bg-blue-800 transition-all text-sm font-bold shadow-md flex items-center gap-2">
            <CheckCircle2 size={18} /> Salvar Turno
          </button>
        </div>
      </div>
    </div>
  );
};
