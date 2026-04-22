import React from 'react';
import { X, User, Home, Users, FileDown, Printer } from 'lucide-react';
import { Resident, InstitutionSettings } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface RoomMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  residents: Resident[];
  settings: InstitutionSettings | null;
}

const RoomMappingModal: React.FC<RoomMappingModalProps> = ({ 
  isOpen, 
  onClose, 
  residents, 
  settings 
}) => {
  if (!isOpen) return null;

  const roomsMaleCount = Number(settings?.roomsMale || 0);
  const roomsFemaleCount = Number(settings?.roomsFemale || 0);

  const totalRoomsCount = roomsMaleCount + roomsFemaleCount;

  // Calculate room list
  const getRoomIdentifiers = (count: number, residentsList: Resident[]) => {
    const normalize = (s: string) => {
      const match = s.match(/\d+/);
      if (!match) return s.toUpperCase();
      return `Q${match[0].padStart(2, '0')}`;
    };

    // 1. Generate base sequence up to total capacity
    const baseRooms = Array.from({ length: count }, (_, i) => normalize((i + 1).toString()));
    
    // 2. Add rooms actually occupied that aren't in the base sequence
    const occupiedRooms = Array.from(new Set(residentsList.map(r => r.room ? normalize(r.room) : '').filter(Boolean)));
    
    // Combine and sort them
    const allRooms = Array.from(new Set([...baseRooms, ...occupiedRooms]));
    
    // Sorting helper
    const getNum = (s: string) => {
      const match = s.match(/\d+/);
      return match ? parseInt(match[0], 10) : 9999;
    };
    
    return allRooms.sort((a, b) => getNum(a) - getNum(b));
  };

  const allRoomIds = getRoomIdentifiers(totalRoomsCount, residents);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const instName = settings?.name || 'SSVP';
    const date = new Date().toLocaleDateString('pt-BR');

    doc.setFontSize(18);
    doc.text('Mapeamento Geral de Leitos - ' + instName, 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${date}`, 14, 28);

    let yOffset = 40;

    const normalize = (s: string) => {
      const match = s.match(/\d+/);
      if (!match) return s.toUpperCase();
      return `Q${match[0].padStart(2, '0')}`;
    };

    const rows = [];
    for (const roomId of allRoomIds) {
      const occupants = residents
        .filter(r => r.room && normalize(r.room) === roomId)
        .map(r => `${r.name} (${r.gender?.charAt(0) || '?'}) - ${r.bedNumber || 'N/D'}`)
        .join(', ');
      
      rows.push([roomId, occupants || 'Disponível', occupants ? 'Ocupado' : 'Livre']);
    }

    autoTable(doc, {
      startY: yOffset,
      head: [['Quarto', 'Residentes (Gênero) / Leito', 'Status']],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: [71, 85, 105] }, // Slate 600
      styles: { fontSize: 9 }
    });

    doc.save(`mapeamento_geral_leitos_${instName.toLowerCase().replace(/\s+/g, '_')}.pdf`);
  };

  const normalize = (s: string) => {
    const match = s.match(/\d+/);
    if (!match) return s.toUpperCase();
    return `Q${match[0].padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      <div className="relative bg-white w-full max-w-6xl max-h-[90vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-slate-600 text-white rounded-xl">
                <Users size={20} />
              </div>
              <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Mapeamento de Leitos</h2>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-11">Visão geral total da ocupação institucional</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-slate-600 text-slate-600 hover:bg-slate-50 rounded-2xl transition-all font-black text-[10px] uppercase shadow-md"
            >
              <FileDown size={18} />
              Exportar PDF
            </button>
            <button 
              onClick={onClose}
              className="p-3 hover:bg-gray-100 rounded-2xl text-gray-400 hover:text-gray-900 transition-all"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div id="mapping-content" className="flex-1 overflow-y-auto p-8 bg-gray-50/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {allRoomIds.map(roomId => {
              const residentsInRoom = residents.filter(r => 
                r.room && normalize(r.room) === roomId
              );
              
              return (
                <div key={roomId} className="bg-white border-2 border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all hover:border-slate-200 group">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                        <Home size={14} className="text-slate-600" />
                      </div>
                      <span className="text-[10px] font-black text-gray-900 uppercase tracking-tighter">Quarto {roomId}</span>
                    </div>
                    <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${residentsInRoom.length > 0 ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>
                      {residentsInRoom.length > 0 ? `${residentsInRoom.length} Ocupado` : 'Disponível'}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {residentsInRoom.length > 0 ? (
                      residentsInRoom.map(res => {
                        const isFemale = (res.gender || '').toLowerCase().startsWith('fem');
                        const colorClass = isFemale ? "text-rose-600" : "text-blue-600";
                        const bgColorClass = isFemale ? "bg-rose-50" : "bg-blue-50";
                        const borderColorClass = isFemale ? "border-rose-100" : "border-blue-100";
                        
                        return (
                          <div key={res.id} className={`flex items-center gap-2 p-2 ${bgColorClass} border ${borderColorClass} rounded-xl group-hover:bg-white transition-colors`}>
                            <div className={`p-1.5 rounded-lg ${isFemale ? 'bg-rose-100/50' : 'bg-blue-100/50'}`}>
                              <User size={12} className={colorClass} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[10px] font-bold ${colorClass} truncate uppercase`}>{res.name}</p>
                              <p className="text-[8px] font-black text-gray-400 uppercase">Leito: {res.bedNumber || '-'}</p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="h-10 border-2 border-dashed border-gray-100 rounded-xl flex items-center justify-center">
                        <p className="text-[8px] font-black text-gray-300 uppercase italic">Vago</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Footer info */}
          <div className="mt-12 p-6 border-t border-gray-100">
            <p className="text-[10px] font-black text-gray-400 uppercase text-center italic">
              * O MAPEAMENTO É SINCRONIZADO AUTOMATICAMENTE COM O CAMPO "QUARTO/ALA" DO RESIDENTE (FORMATO: Q01, Q02, ETC).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomMappingModal;
