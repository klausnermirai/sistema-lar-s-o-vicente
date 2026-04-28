import React, { useState } from 'react';
import { User, Building2, Shield, HeartHandshake, Star } from 'lucide-react';
import { Resident, GlobalVisitRecord } from '../types';
import { saveGlobalVisit } from '../lib/api';

interface VisitorPortalProps {
  institutionId: string;
  residents: Resident[];
  onVisitSaved: () => void;
  onSaveResident?: (resident: Resident) => void;
}

type Mode = 'menu' | 'residente' | 'instituicao' | 'ssvp' | 'orgao';

export const VisitorPortal: React.FC<VisitorPortalProps> = ({ institutionId, residents, onVisitSaved, onSaveResident }) => {
  const [mode, setMode] = useState<Mode>('menu');
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  
  // Form state
  const [comments, setComments] = useState('');
  const [phone, setPhone] = useState('');
  
  // Form state (Orgao Fiscalizador)
  const [agencyName, setAgencyName] = useState('');
  
  // Form state (SSVP)
  const [conferenceName, setConferenceName] = useState('');
  
  // Form state (Residente)
  const [residentId, setResidentId] = useState('');
  const [residentSearchTerm, setResidentSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [visitorType, setVisitorType] = useState('new'); // 'new' or relative config
  const [visitorName, setVisitorName] = useState('');
  const [kinship, setKinship] = useState('');
  const [saveRelativeInfo, setSaveRelativeInfo] = useState(false);

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleModeSelect = (newMode: Mode) => {
    setMode(newMode);
    speakText('Bem vindo ao Lar São Vicente de Paulo! O registro de sua visita é muito importante. Vamos começar!');
  };

  const handleReset = () => {
    setMode('menu');
    setRating(0);
    setComments('');
    setPhone('');
    setAgencyName('');
    setConferenceName('');
    setResidentId('');
    setResidentSearchTerm('');
    setShowSuggestions(false);
    setVisitorType('new');
    setVisitorName('');
    setKinship('');
    setSaveRelativeInfo(false);
  };

  const handleSave = async () => {
    if (mode === 'residente' && (!residentId || (visitorType === 'new' && (!visitorName || !kinship)))) return;
    if (mode === 'ssvp' && (!conferenceName || !visitorName)) return;
    if (mode === 'orgao' && (!agencyName || !visitorName)) return;
    if (mode === 'instituicao' && !visitorName) return;

    let finalVisitorName = visitorName;
    let finalKinship = kinship;

    if (mode === 'residente' && visitorType !== 'new') {
      const parts = visitorType.split('||'); // Format: name||kinship
      if (parts.length === 2) {
        finalVisitorName = parts[0];
        finalKinship = parts[1];
      }
    }

    const payload: Partial<GlobalVisitRecord> = {
      institutionId,
      type: mode === 'orgao' ? 'orgao_fiscalizador' : mode === 'residente' ? 'residente' : mode,
      date: new Date().toISOString(),
      rating,
      comments,
      phone,
      agencyName: mode === 'orgao' ? agencyName : undefined,
      conferenceName: mode === 'ssvp' ? conferenceName : undefined,
      residentId: mode === 'residente' ? residentId : undefined,
      visitorName: finalVisitorName,
      kinship: mode === 'residente' ? finalKinship : undefined,
    };

    try {
      await saveGlobalVisit(payload as any);

      if (mode === 'residente' && onSaveResident) {
        const resident = residents.find(r => r.id === residentId);
        if (resident) {
          let updatedResident = { ...resident };
          
          // Save relative info if requested
          if (saveRelativeInfo && visitorType === 'new') {
            const newRelative = {
              id: 'rel_' + Date.now().toString(),
              name: finalVisitorName,
              kinship: finalKinship,
              phone: phone,
              observation: '',
              isResponsible: false
            };
            updatedResident.relatives = [...(updatedResident.relatives || []), newRelative];
          }

          // Always add to the resident's visit records
          const newVisit = {
            id: 'visit_' + Date.now().toString(),
            date: new Date().toISOString().split('T')[0],
            visitorName: finalVisitorName,
            visitorDoc: kinship || 'Membro da Família', // Using this field to store kinship if doc not available
            timeIn: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            timeOut: '',
            observation: comments || 'Visita registrada pelo Portal do Visitante'
          };
          updatedResident.visitRecords = [...(updatedResident.visitRecords || []), newVisit];

          await onSaveResident(updatedResident);
        }
      }

      alert('Registro de visita salvo com sucesso! Agradecemos o contato.');
      speakText('Muito obrigado pela sua visita, volte sempre!');
      handleReset();
      onVisitSaved();
    } catch (err) {
      console.error(err);
      alert('Houve um erro ao registrar a visita. Tente novamente.');
    }
  };

  const selectedResident = residents.find(r => r.id === residentId);

  return (
    <div className="flex h-full flex-col bg-gray-50/50">
      <div className="p-8 text-center max-w-4xl mx-auto w-full mt-4 flex-1">
        
        {mode === 'menu' ? (
          <div className="animate-in fade-in zoom-in duration-300">
            <h2 className="text-3xl font-black text-gray-800 uppercase tracking-widest mb-2">Bem-vindo(a)</h2>
            <p className="text-gray-500 mb-12">Por favor, selecione abaixo o seu perfil de visitante para registrar a presença.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button onClick={() => handleModeSelect('residente')} className="bg-white p-8 rounded-[30px] shadow-sm border border-gray-100 hover:border-blue-300 hover:bg-blue-50/30 transition-all group text-left">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-[#004c99] mb-6 group-hover:scale-110 transition-transform">
                  <User size={32} />
                </div>
                <h3 className="text-xl font-black text-[#004c99] uppercase tracking-widest mb-2">Visitar um Residente</h3>
                <p className="text-sm font-bold text-gray-400">Sou familiar, amigo(a) ou conhecido(a) de um residente.</p>
              </button>

              <button onClick={() => handleModeSelect('instituicao')} className="bg-white p-8 rounded-[30px] shadow-sm border border-gray-100 hover:border-blue-300 hover:bg-blue-50/30 transition-all group text-left">
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-700 mb-6 group-hover:scale-110 transition-transform">
                  <Building2 size={32} />
                </div>
                <h3 className="text-xl font-black text-emerald-700 uppercase tracking-widest mb-2">Visita à Instituição</h3>
                <p className="text-sm font-bold text-gray-400">Estou aqui para conhecer o espaço, doar ou conversar institucionalmente.</p>
              </button>

              <button onClick={() => handleModeSelect('ssvp')} className="bg-white p-8 rounded-[30px] shadow-sm border border-gray-100 hover:border-blue-300 hover:bg-blue-50/30 transition-all group text-left">
                <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-700 mb-6 group-hover:scale-110 transition-transform">
                  <HeartHandshake size={32} />
                </div>
                <h3 className="text-xl font-black text-purple-700 uppercase tracking-widest mb-2">Membro da SSVP</h3>
                <p className="text-sm font-bold text-gray-400">Represento uma Conferência, Conselho Central ou Metropolitano.</p>
              </button>
              
              <button onClick={() => handleModeSelect('orgao')} className="bg-white p-8 rounded-[30px] shadow-sm border border-gray-100 hover:border-blue-300 hover:bg-blue-50/30 transition-all group text-left">
                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-700 mb-6 group-hover:scale-110 transition-transform">
                  <Shield size={32} />
                </div>
                <h3 className="text-xl font-black text-orange-700 uppercase tracking-widest mb-2">Órgão Fiscalizador</h3>
                <p className="text-sm font-bold text-gray-400">Vigilância Sanitária, Ministério Público, Bombeiros, etc.</p>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white p-10 rounded-[40px] shadow-sm border border-gray-100 text-left animate-in slide-in-from-right-8 duration-300">
            <h2 className="text-2xl font-black text-[#004c99] uppercase tracking-widest mb-8 border-b pb-4">
              {mode === 'residente' && 'Visita a Residente'}
              {mode === 'instituicao' && 'Visita Institucional'}
              {mode === 'ssvp' && 'Registro de Membro SSVP'}
              {mode === 'orgao' && 'Registro de Órgão Fiscalizador'}
            </h2>

            <div className="space-y-6">
              {mode !== 'residente' && (
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase mb-2">Seu Nome</label>
                  <input type="text" className="w-full border p-4 rounded-2xl bg-gray-50" value={visitorName} onChange={e => setVisitorName(e.target.value)} placeholder="Como podemos te chamar?" />
                </div>
              )}

              {mode === 'orgao' && (
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase mb-2">Qual órgão você representa?</label>
                  <input type="text" className="w-full border p-4 rounded-2xl bg-gray-50" value={agencyName} onChange={e => setAgencyName(e.target.value)} placeholder="Ex: Vigilância Sanitária" />
                </div>
              )}

              {mode === 'ssvp' && (
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase mb-2">De qual Conferência / Conselho faz parte?</label>
                  <input type="text" className="w-full border p-4 rounded-2xl bg-gray-50" value={conferenceName} onChange={e => setConferenceName(e.target.value)} placeholder="Ex: Conferência São Vicente" />
                </div>
              )}

              {mode === 'residente' && (
                <>
                  <div className="relative">
                    <label className="block text-xs font-black text-gray-500 uppercase mb-2">Qual residente você vai visitar?</label>
                    <input 
                      type="text" 
                      className="w-full border p-4 rounded-2xl bg-gray-50 mb-2 focus:ring-2 focus:ring-[#004c99] outline-none transition-all" 
                      value={residentSearchTerm} 
                      onChange={e => {
                        setResidentSearchTerm(e.target.value);
                        if (residentId) setResidentId(''); // clear selection if typing
                        if (e.target.value.length >= 3) {
                          setShowSuggestions(true);
                        } else {
                          setShowSuggestions(false);
                        }
                      }}
                      onFocus={() => {
                         if (residentSearchTerm.length >= 3 && !residentId) setShowSuggestions(true);
                      }}
                      placeholder="Digite o nome do residente (mínimo 3 letras)" 
                    />
                    {showSuggestions && residentSearchTerm.length >= 3 && !residentId && (
                      <div className="absolute top-[88px] left-0 w-full mt-1 bg-white border border-gray-100 rounded-2xl shadow-2xl z-50 max-h-48 overflow-y-auto">
                         {residents.filter(r => r.name.toLowerCase().includes(residentSearchTerm.toLowerCase())).length > 0 ? (
                           residents.filter(r => r.name.toLowerCase().includes(residentSearchTerm.toLowerCase())).map(r => (
                             <button
                               key={r.id}
                               onClick={() => {
                                 setResidentId(r.id);
                                 setResidentSearchTerm(r.name);
                                 setShowSuggestions(false);
                                 setVisitorType('new');
                               }}
                               className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-50 last:border-0 transition-colors"
                             >
                               <span className="font-bold text-gray-800 uppercase tracking-tight">{r.name}</span>
                             </button>
                           ))
                         ) : (
                           <div className="px-4 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest text-center">Nenhum residente encontrado com este nome</div>
                         )}
                      </div>
                    )}
                  </div>
                  
                  {selectedResident && (
                    <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100 animate-in fade-in">
                      <label className="block text-[10px] font-black uppercase text-[#004c99] mb-4">Você já está cadastrado?</label>
                      <select className="w-full border p-4 rounded-2xl bg-white mb-4" value={visitorType} onChange={e => setVisitorType(e.target.value)}>
                        <option value="new">Ainda não fui cadastrado</option>
                        {(selectedResident.relatives || []).map((rel, idx) => (
                           <option key={idx} value={`${rel.name}||${rel.kinship}`}>{rel.name} ({rel.kinship})</option>
                        ))}
                      </select>
                      
                      {visitorType === 'new' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div>
                             <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Seu Nome</label>
                             <input type="text" className="w-full border p-3 rounded-xl" value={visitorName} onChange={e => setVisitorName(e.target.value)} />
                           </div>
                           <div>
                             <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Relação/Parentesco</label>
                             <input type="text" className="w-full border p-3 rounded-xl" value={kinship} onChange={e => setKinship(e.target.value)} placeholder="Ex: Filho, Vizinha" />
                           </div>
                           <div className="md:col-span-2 pt-2">
                             <label className="flex items-center gap-2 cursor-pointer group">
                               <input type="checkbox" className="w-4 h-4 rounded text-[#004c99]" checked={saveRelativeInfo} onChange={e => setSaveRelativeInfo(e.target.checked)} />
                               <span className="text-xs font-bold text-gray-600 group-hover:text-gray-900 transition-colors">Desejo gravar meu nome e grau de parentesco na ficha do residente</span>
                             </label>
                           </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-2">Telefone para Contato (Opcional)</label>
                <input type="text" className="w-full border p-4 rounded-2xl bg-gray-50" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-2">Como você avalia nossa entidade?</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      className="p-2 transition-all focus:outline-none"
                      onMouseEnter={() => setHoveredStar(star)}
                      onMouseLeave={() => setHoveredStar(0)}
                      onClick={() => setRating(star)}
                    >
                      <Star
                        size={36}
                        className={`transition-all ${star <= (hoveredStar || rating) ? 'fill-yellow-400 text-yellow-400 scale-110 drop-shadow-md' : 'text-gray-300'}`}
                        weight={star <= (hoveredStar || rating) ? 'fill' : 'regular'}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-2">Deixe um comentário (opcional)</label>
                <textarea 
                  rows={4} 
                  className="w-full border p-4 rounded-2xl bg-gray-50 resize-none no-scrollbar"
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  placeholder="Deixe uma sugestão, elogio, ou apenas registre o motivo..."
                />
              </div>

              <div className="flex gap-4 pt-6">
                <button onClick={handleReset} className="w-1/3 py-4 rounded-2xl bg-gray-100 text-gray-500 font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-colors">
                  Voltar
                </button>
                <button onClick={handleSave} className="w-2/3 py-4 rounded-2xl bg-[#004c99] text-white font-black text-[10px] uppercase tracking-widest hover:bg-blue-800 transition-colors shadow-md">
                  Registrar Visita
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
};
