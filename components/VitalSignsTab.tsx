import React, { useState } from 'react';
import { 
  Heart, 
  Activity, 
  Thermometer, 
  Droplets, 
  Bone, 
  Plus, 
  History, 
  ChevronDown, 
  Save, 
  Calendar, 
  User,
  AlertCircle
} from 'lucide-react';
import { Resident, VitalSignEntry } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface VitalSignsTabProps {
  resident: Resident;
  onSave: (entry: VitalSignEntry) => void;
}

const VitalSignsTab: React.FC<VitalSignsTabProps> = ({ resident, onSave }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formData, setFormData] = useState<Partial<VitalSignEntry>>({
    paSystolic: 120,
    paDiastolic: 80,
    fc: 70,
    fr: 16,
    temperature: 36.5,
    spo2: 98,
    hgtValue: 90,
    hgtType: 'jejum',
    weight: resident.per?.vitalSignsHistory?.[0]?.weight || '',
    height: resident.per?.vitalSignsHistory?.[0]?.height || '',
  });

  const history = resident.per?.vitalSignsHistory || [];
  const latest = history[0];
  const filteredHistory = history.filter(h => new Date(h.date).toISOString().split('T')[0] === selectedDate);

  const handleSave = () => {
    const newEntry: VitalSignEntry = {
      id: `VS-${Date.now()}`,
      date: new Date().toISOString(),
      paSystolic: Number(formData.paSystolic),
      paDiastolic: Number(formData.paDiastolic),
      fc: Number(formData.fc),
      fr: Number(formData.fr),
      temperature: Number(formData.temperature),
      spo2: Number(formData.spo2),
      hgtValue: Number(formData.hgtValue),
      hgtType: formData.hgtType as 'jejum' | 'pos-prandial',
      weight: formData.weight || '',
      height: formData.height || '',
      professionalName: 'Profissional logado' // Placeholder
    };
    onSave(newEntry);
    setIsRecording(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header com Ação */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Controle de Sinais Vitais</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Monitoramento clínico e biometria</p>
        </div>
        <button 
          onClick={() => setIsRecording(!isRecording)}
          className="bg-[#004c99] hover:bg-blue-800 text-white px-6 py-3 rounded-2xl flex items-center gap-2 shadow-lg transition-all font-black text-xs uppercase"
        >
          {isRecording ? <ChevronDown size={18} /> : <Plus size={18} />}
          <span>{isRecording ? 'Cancelar Registro' : 'Registrar Novos Sinais'}</span>
        </button>
      </div>

      {/* Formulário de Registro (AnimatePresence) */}
      <AnimatePresence>
        {isRecording && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white border-2 border-blue-100 rounded-[32px] p-8 shadow-xl space-y-8">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">PA Sistólica</label>
                  <input 
                    type="number"
                    value={formData.paSystolic}
                    onChange={(e) => setFormData({...formData, paSystolic: Number(e.target.value)})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">PA Diastólica</label>
                  <input 
                    type="number"
                    value={formData.paDiastolic}
                    onChange={(e) => setFormData({...formData, paDiastolic: Number(e.target.value)})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Freq. Cardíaca (BPM)</label>
                  <input 
                    type="number"
                    value={formData.fc}
                    onChange={(e) => setFormData({...formData, fc: Number(e.target.value)})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Freq. Resp (IPM)</label>
                  <input 
                    type="number"
                    value={formData.fr}
                    onChange={(e) => setFormData({...formData, fr: Number(e.target.value)})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Temperatura (°C)</label>
                  <input 
                    type="number"
                    step="0.1"
                    value={formData.temperature}
                    onChange={(e) => setFormData({...formData, temperature: Number(e.target.value)})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Saturação O2 (%)</label>
                  <input 
                    type="number"
                    value={formData.spo2}
                    onChange={(e) => setFormData({...formData, spo2: Number(e.target.value)})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Glicemia (Valor)</label>
                  <input 
                    type="number"
                    value={formData.hgtValue}
                    onChange={(e) => setFormData({...formData, hgtValue: Number(e.target.value)})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white transition-all outline-none"
                  />
                </div>
                <div className="col-span-1 md:col-span-2 lg:col-span-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Estado Glicemia</label>
                  <div className="flex gap-2">
                    {['jejum', 'pos-prandial'].map((type) => (
                      <button 
                        key={type}
                        onClick={() => setFormData({...formData, hgtType: type as any})}
                        className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all border ${formData.hgtType === type ? 'bg-[#004c99] text-white border-[#004c99]' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                      >
                        {type === 'jejum' ? 'Jejum' : 'Pós-P'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Peso (Kg)</label>
                  <input 
                    type="text"
                    placeholder="70.5"
                    value={formData.weight}
                    onChange={(e) => setFormData({...formData, weight: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Altura (cm)</label>
                  <input 
                    type="text"
                    placeholder="170"
                    value={formData.height}
                    onChange={(e) => setFormData({...formData, height: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white transition-all outline-none"
                  />
                </div>
              </div>
              
              <div className="flex justify-end pt-4 border-t border-dashed border-gray-100">
                <button 
                  onClick={handleSave}
                  className="bg-green-600 hover:bg-green-700 text-white px-10 py-4 rounded-2xl flex items-center gap-2 shadow-lg transition-all font-black text-xs uppercase"
                >
                  <Save size={18} />
                  Salvar Medições
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid de Conteúdo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bloco de Última Medição */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Activity size={20} />
                </div>
                <h3 className="text-sm font-black uppercase text-gray-800 tracking-widest">Última Verificação</h3>
              </div>
              {latest && (
                <span className="text-[10px] font-bold text-gray-400 uppercase">
                  Realizada em {new Date(latest.date).toLocaleDateString('pt-BR')} às {new Date(latest.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            {latest ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <div className="space-y-2 group">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Heart size={10} className="text-red-500" /> P.A.
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-gray-900 tracking-tighter">{latest.paSystolic}/{latest.paDiastolic}</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">mmHg</span>
                  </div>
                </div>

                <div className="space-y-2 group">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Activity size={10} className="text-blue-500" /> Freq. Card.
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-gray-900 tracking-tighter">{latest.fc}</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">BPM</span>
                  </div>
                </div>

                <div className="space-y-2 group">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Thermometer size={10} className="text-orange-500" /> Temp.
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-gray-900 tracking-tighter">{latest.temperature}°</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">C</span>
                  </div>
                </div>

                <div className="space-y-2 group">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Droplets size={10} className="text-purple-500" /> Glicemia
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-gray-900 tracking-tighter">{latest.hgtValue}</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">mg/dL</span>
                  </div>
                  <p className="text-[9px] font-black text-purple-600 uppercase tracking-widest">{latest.hgtType}</p>
                </div>

                <div className="space-y-2 group">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Activity size={10} className="text-teal-500" /> Sat. O2
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-gray-900 tracking-tighter">{latest.spo2}%</span>
                  </div>
                </div>

                <div className="space-y-2 group">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Bone size={10} className="text-gray-500" /> Peso / Alt.
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-gray-900 tracking-tighter">{latest.weight || '--'} kg</span>
                    <span className="text-gray-300 mx-1">/</span>
                    <span className="text-2xl font-black text-gray-900 tracking-tighter">{latest.height || '--'} cm</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <AlertCircle size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-xs font-black text-gray-400 uppercase">Nenhum registro encontrado</p>
              </div>
            )}
          </div>

          {/* Mini Gráfico ou Destaque Biométrico aqui no futuro */}
        </div>

        {/* Histórico por Data */}
        <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b bg-gray-50/50 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white shadow-sm rounded-xl text-gray-600">
                <History size={18} />
              </div>
              <h3 className="text-sm font-black uppercase text-gray-800 tracking-widest">Histórico Diário</h3>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black text-gray-400 uppercase">Filtrar por data:</label>
              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-[#004c99]"
              />
            </div>
          </div>
          <div className="flex-1 divide-y divide-gray-50 max-h-[600px] overflow-y-auto no-scrollbar">
            {filteredHistory.map((entry) => (
              <div key={entry.id} className="p-5 hover:bg-blue-50/10 cursor-default transition-all group">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar size={12} className="text-gray-400" />
                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
                      {new Date(entry.date).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="text-[10px] font-medium text-gray-400">
                      {new Date(entry.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="px-2 py-0.5 rounded-full bg-gray-100 text-[8px] font-black text-gray-400 uppercase group-hover:bg-blue-100 group-hover:text-blue-600 transition-all">
                    ID: {entry.id.slice(-4)}
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-gray-50/50 rounded-xl p-2 border border-gray-100">
                    <p className="text-[8px] font-black text-gray-400 uppercase mb-0.5">PA</p>
                    <p className="text-xs font-black text-gray-800">{entry.paSystolic}/{entry.paDiastolic}</p>
                  </div>
                  <div className="bg-gray-50/50 rounded-xl p-2 border border-gray-100">
                    <p className="text-[8px] font-black text-gray-400 uppercase mb-0.5">Glic.</p>
                    <p className="text-xs font-black text-gray-800">{entry.hgtValue}</p>
                  </div>
                  <div className="bg-gray-50/50 rounded-xl p-2 border border-gray-100">
                    <p className="text-[8px] font-black text-gray-400 uppercase mb-0.5">Temp.</p>
                    <p className="text-xs font-black text-gray-800">{entry.temperature}°</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <User size={10} className="text-gray-400" />
                  <span className="text-[9px] font-bold text-gray-400 uppercase">{entry.professionalName || 'S/ Assinatura'}</span>
                </div>
              </div>
            ))}
            {filteredHistory.length === 0 && (
              <div className="p-12 text-center opacity-20 flex flex-col items-center gap-2">
                <History size={32} />
                <span className="text-[9px] font-black uppercase">Histórico vazio para a data</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VitalSignsTab;
