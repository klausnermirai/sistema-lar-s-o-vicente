import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  User, 
  Building2, 
  Shield, 
  HeartHandshake, 
  Star, 
  ScanFace, 
  Users, 
  BookOpen, 
  Search, 
  Plus, 
  Camera, 
  CheckCircle2, 
  Clock, 
  Phone, 
  FileText, 
  Filter,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  LogOut,
  Keyboard,
  X,
  Monitor,
  Smartphone,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { Resident, GlobalVisitRecord } from '../types';
import { saveGlobalVisit, fetchGlobalVisits, clearAllBiometrics, saveRegisteredVisitor, fetchRegisteredVisitors } from '../lib/api';
import { FacialRecognitionCamera, UnifiedVisitor } from './FacialRecognitionCamera';
import { extractFaceFromCanvasOrVideo } from '../lib/faceRecognition';

interface VisitorPortalProps {
  institutionId: string;
  residents: Resident[];
  onVisitSaved: () => void;
  onSaveResident?: (resident: Resident) => void;
  accessLevel?: string;
}

type MainTab = 'portaria' | 'cadastrados' | 'historico';
type EntryMode = 'choice' | 'facial' | 'manual';
type ManualSubMode = 'menu' | 'residente' | 'instituicao' | 'ssvp' | 'orgao';

export const VisitorPortal: React.FC<VisitorPortalProps> = ({ 
  institutionId, 
  residents, 
  onVisitSaved, 
  onSaveResident,
  accessLevel
}) => {
  const normalizedAccessLevel = String(accessLevel || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const isAdministrative = ['administrador', 'gerencial', 'auxiliar_administrativo'].includes(normalizedAccessLevel);
  const canManageBiometrics = ['administrador', 'gerencial'].includes(normalizedAccessLevel);
  const [activeTab, setActiveTab] = useState<MainTab>('portaria');
  const [entryMode, setEntryMode] = useState<EntryMode>('choice');
  const [globalVisits, setGlobalVisits] = useState<GlobalVisitRecord[]>([]);
  const [registeredVisitorsList, setRegisteredVisitorsList] = useState<any[]>([]);
  const [isLoadingVisits, setIsLoadingVisits] = useState<boolean>(false);

  // Modo Manual State
  const [manualMode, setManualMode] = useState<ManualSubMode>('menu');
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comments, setComments] = useState('');
  const [phone, setPhone] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [conferenceName, setConferenceName] = useState('');
  const [residentId, setResidentId] = useState('');
  const [residentSearchTerm, setResidentSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [visitorType, setVisitorType] = useState('new');
  const [visitorName, setVisitorName] = useState('');
  const [kinship, setKinship] = useState('');
  const [saveRelativeInfo, setSaveRelativeInfo] = useState(false);

  // Modal de Captura de Foto para Visitante da Lista
  const [captureModalVisitor, setCaptureModalVisitor] = useState<UnifiedVisitor | null>(null);
  const captureVideoRef = useRef<HTMLVideoElement | null>(null);
  const [captureStreamActive, setCaptureStreamActive] = useState<boolean>(false);
  const [capturedThumb, setCapturedThumb] = useState<string | null>(null);
  const [capturedDescriptor, setCapturedDescriptor] = useState<number[] | null>(null);

  // Busca e Filtros na Lista de Visitantes
  const [visitorSearch, setVisitorSearch] = useState('');
  const [filterBiometricOnly, setFilterBiometricOnly] = useState<'all' | 'with_face' | 'without_face'>('all');

  // Controle de Tela Cheia (Fullscreen API para Totem/Tablet)
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const enterFullscreen = () => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (e) {
      console.warn('Erro ao solicitar tela cheia:', e);
    }
  };

  const exitFullscreen = () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch (e) {
      console.warn('Erro ao sair de tela cheia:', e);
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  };

  const handleOpenFacialMode = () => {
    setEntryMode('facial');
    enterFullscreen();
  };

  const handleCloseFacialMode = () => {
    setEntryMode('choice');
  };

  // Carregar visitas globais e visitantes cadastrados permanentemente
  const loadVisits = useCallback(async () => {
    if (!institutionId) return;
    setIsLoadingVisits(true);
    try {
      const [visitsData, regVisitorsData] = await Promise.all([
        fetchGlobalVisits(institutionId).catch(() => []),
        fetchRegisteredVisitors(institutionId).catch(() => [])
      ]);
      if (Array.isArray(visitsData)) {
        setGlobalVisits(visitsData);
      }
      if (Array.isArray(regVisitorsData)) {
        setRegisteredVisitorsList(regVisitorsData);
      }
    } catch (err) {
      console.warn('Erro ao buscar dados da portaria:', err);
    } finally {
      setIsLoadingVisits(false);
    }
  }, [institutionId]);

  useEffect(() => {
    loadVisits();
  }, [loadVisits]);

  // Unifica todos os visitantes conhecidos da instituição (registered_visitors + Parentes de residentes + Visitas já registradas)
  const unifiedVisitorsList = useMemo<UnifiedVisitor[]>(() => {
    const map = new Map<string, UnifiedVisitor>();

    // 1. Visitantes da base permanente de cadastrados (registered_visitors)
    registeredVisitorsList.forEach(v => {
      if (v.name) {
        const key = `reg_${(v.type || 'geral')}_${v.name.toLowerCase().trim()}_${v.residentId || ''}`;
        map.set(key, {
          id: v.id || key,
          name: v.name,
          document: v.document,
          phone: v.phone,
          type: v.type || 'residente',
          residentId: v.residentId,
          residentName: v.residentName,
          linkedResidents: Array.isArray(v.linkedResidents) && v.linkedResidents.length > 0
            ? v.linkedResidents
            : (v.residentId ? [{ residentId: v.residentId, residentName: v.residentName || '' }] : []),
          kinship: v.kinship,
          agencyName: v.agencyName,
          conferenceName: v.conferenceName,
          photoUrl: v.photoUrl,
          faceDescriptor: v.faceDescriptor,
          sourceType: 'custom'
        });
      }
    });

    // 2. Parentes / Familiares de todos os residentes
    residents.forEach(res => {
      (res.relatives || []).filter(rel => !rel.deceased).forEach(rel => {
        const key = `rel_${res.id}_${rel.name.toLowerCase().trim()}`;
        const existing = map.get(key);
        map.set(key, {
          id: rel.id || existing?.id || key,
          name: rel.name,
          document: rel.document || existing?.document,
          phone: rel.phone || existing?.phone,
          type: 'residente',
          residentId: res.id,
          residentName: res.name,
          linkedResidents: [{ residentId: res.id, residentName: res.name }],
          kinship: rel.kinship || existing?.kinship,
          photoUrl: rel.photoUrl || existing?.photoUrl,
          faceDescriptor: rel.faceDescriptor || existing?.faceDescriptor,
          sourceType: 'relative'
        });
      });
    });

    // 3. Visitantes de visitas passadas (se não já existirem)
    globalVisits.forEach(v => {
      if (v.visitorName) {
        const key = `global_${v.type}_${v.visitorName.toLowerCase().trim()}_${v.residentId || ''}`;
        const existing = map.get(key);
        const res = residents.find(r => r.id === v.residentId);
        if (!existing) {
          map.set(key, {
            id: v.id || key,
            name: v.visitorName,
            document: v.visitorDoc,
            phone: v.phone,
            type: v.type,
            residentId: v.residentId,
            residentName: res ? res.name : v.residentName,
            linkedResidents: v.residentId ? [{ residentId: v.residentId, residentName: res ? res.name : (v.residentName || '') }] : [],
            kinship: v.kinship,
            agencyName: v.agencyName,
            conferenceName: v.conferenceName,
            photoUrl: v.photoUrl,
            faceDescriptor: v.faceDescriptor,
            sourceType: 'global'
          });
        } else {
          // Preserva a foto / descritor caso o visitante ainda não possuísse
          if (!existing.photoUrl && v.photoUrl) existing.photoUrl = v.photoUrl;
          if (!existing.faceDescriptor && v.faceDescriptor) existing.faceDescriptor = v.faceDescriptor;
        }
      }
    });

    return Array.from(map.values());
  }, [residents, globalVisits, registeredVisitorsList]);

  const facialVisitorsList = useMemo(
    () => unifiedVisitorsList.filter(v => {
      const hasResidentLink = (Array.isArray(v.linkedResidents) && v.linkedResidents.length > 0) || !!v.residentId;
      const hasValidBiometry = Array.isArray(v.faceDescriptor) && v.faceDescriptor.length === 128;
      return v.type === 'residente' && v.sourceType !== 'global' && hasResidentLink && hasValidBiometry;
    }),
    [unifiedVisitorsList]
  );

  // Handler de confirmação de entrada (Reconhecimento Facial ou Manual)
  const handleConfirmEntry = async (visitData: {
    visitorName: string;
    visitorDoc?: string;
    type: 'residente' | 'instituicao' | 'ssvp' | 'orgao_fiscalizador';
    residentId?: string;
    residentName?: string;
    kinship?: string;
    agencyName?: string;
    conferenceName?: string;
    photoUrl?: string;
    faceDescriptor?: number[];
    matchedVia: 'facial' | 'manual';
    facialConfidence?: number;
    comments?: string;
  }) => {
    if (visitData.matchedVia === 'facial' && !visitData.residentId) {
      throw new Error('Entrada por reconhecimento facial exige residente vinculado.');
    }

    const now = new Date();
    const timeIn = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toISOString().split('T')[0];

    const payload: Partial<GlobalVisitRecord> = {
      institutionId,
      type: visitData.type,
      date: now.toISOString(),
      timeIn,
      rating: 5,
      comments: visitData.comments || `Entrada registrada via ${visitData.matchedVia === 'facial' ? 'Reconhecimento Facial' : 'Portaria Manual'}`,
      visitorName: visitData.visitorName,
      visitorDoc: visitData.visitorDoc,
      residentId: visitData.residentId,
      residentName: visitData.residentName,
      kinship: visitData.kinship,
      agencyName: visitData.agencyName,
      conferenceName: visitData.conferenceName,
      photoUrl: undefined, // Privacidade / LGPD: Nenhuma foto de passagem na portaria é salva no registro
      faceDescriptor: undefined,
      matchedVia: visitData.matchedVia,
      facialConfidence: visitData.facialConfidence
    };

    await saveGlobalVisit(payload as any);

    // Se a visita for a um residente específico, adiciona também na ficha clínica do residente (sem salvar foto de passagem)
    if (visitData.residentId && onSaveResident) {
      const resident = residents.find(r => r.id === visitData.residentId);
      if (resident) {
        const newVisitRecord = {
          id: 'visit_' + Date.now().toString(),
          date: dateStr,
          visitorName: visitData.visitorName,
          visitorDoc: visitData.visitorDoc || visitData.kinship || 'Familiar / Visitante',
          timeIn,
          timeOut: '',
          observation: visitData.comments || 'Entrada via Portaria',
          photoUrl: undefined,
          faceDescriptor: undefined,
          matchedVia: visitData.matchedVia,
          facialConfidence: visitData.facialConfidence
        };

        const updatedResident = {
          ...resident,
          visitRecords: [...(resident.visitRecords || []), newVisitRecord]
        };
        await onSaveResident(updatedResident);
      }
    }

    onVisitSaved();
    await loadVisits();
  };

  // Handler para atualizar a biometria facial de um visitante
  const handleUpdateVisitorFace = async (visitor: UnifiedVisitor, photoUrl: string, faceDescriptor: number[]) => {
    // 1. Salva na coleção permanente de cadastrados no Firestore
    try {
      await saveRegisteredVisitor(institutionId, {
        id: visitor.id || `vis_${Date.now()}`,
        name: visitor.name,
        phone: visitor.phone || '',
        document: visitor.document || '',
        type: visitor.type,
        residentId: visitor.residentId || null,
        residentName: visitor.residentName || null,
        linkedResidents: Array.isArray(visitor.linkedResidents) && visitor.linkedResidents.length > 0
          ? visitor.linkedResidents
          : (visitor.residentId ? [{ residentId: visitor.residentId, residentName: visitor.residentName || '' }] : []),
        kinship: visitor.kinship || null,
        agencyName: visitor.agencyName || null,
        conferenceName: visitor.conferenceName || null,
        photoUrl,
        faceDescriptor
      });
    } catch (err) {
      console.warn('Erro ao salvar em registered_visitors:', err);
    }

    // 2. Se for parente vinculado a residente, atualiza na ficha do residente
    if (visitor.sourceType === 'relative' && visitor.residentId && onSaveResident) {
      const resident = residents.find(r => r.id === visitor.residentId);
      if (resident) {
        let updatedRelatives = [...(resident.relatives || [])];
        const existingRelIdx = updatedRelatives.findIndex(rel => 
          rel.id === visitor.id || rel.name.toLowerCase().trim() === visitor.name.toLowerCase().trim()
        );

        if (existingRelIdx >= 0) {
          updatedRelatives[existingRelIdx] = {
            ...updatedRelatives[existingRelIdx],
            photoUrl,
            faceDescriptor
          };
        } else {
          updatedRelatives.push({
            id: 'rel_' + Date.now().toString(),
            name: visitor.name,
            kinship: visitor.kinship || 'Familiar',
            phone: visitor.phone || '',
            observation: 'Cadastrado pela Portaria',
            isResponsible: false,
            photoUrl,
            faceDescriptor
          });
        }

        await onSaveResident({
          ...resident,
          relatives: updatedRelatives
        });
      }
    }

    await loadVisits();
  };

  // Handler de Cadastro Rápido de Novo Visitante
  const handleRegisterQuickVisitor = async (newVisitor: UnifiedVisitor) => {
    // 1. Salva na coleção permanente de visitantes no Firestore
    try {
      await saveRegisteredVisitor(institutionId, {
        id: newVisitor.id,
        name: newVisitor.name,
        phone: newVisitor.phone || '',
        document: newVisitor.document || '',
        type: newVisitor.type,
        residentId: newVisitor.residentId || null,
        residentName: newVisitor.residentName || null,
        linkedResidents: Array.isArray(newVisitor.linkedResidents) && newVisitor.linkedResidents.length > 0
          ? newVisitor.linkedResidents
          : (newVisitor.residentId ? [{ residentId: newVisitor.residentId, residentName: newVisitor.residentName || '' }] : []),
        kinship: newVisitor.kinship || null,
        agencyName: newVisitor.agencyName || null,
        conferenceName: newVisitor.conferenceName || null,
        photoUrl: newVisitor.photoUrl || null,
        faceDescriptor: newVisitor.faceDescriptor || null
      });
    } catch (err) {
      console.warn('Erro ao salvar em registered_visitors:', err);
    }

    // O cadastro facial é operacional da Portaria e não altera automaticamente o prontuário social (resident.relatives).

    await loadVisits();
  };

  // Handler para zerar todas as fotos e biometrias faciais da instituição
  const handleClearAllBiometrics = async () => {
    try {
      await clearAllBiometrics(institutionId, true);
      
      // Atualiza residentes na memória / Firestore removendo fotos e biometrias faciais
      if (onSaveResident) {
        for (const resident of residents) {
          let updated = false;
          let newRelatives = resident.relatives;
          let newVisitRecords = resident.visitRecords;

          if (Array.isArray(resident.relatives) && resident.relatives.some(r => r.faceDescriptor || r.photoUrl)) {
            newRelatives = resident.relatives.map(r => {
              const { faceDescriptor, photoUrl, ...rest } = r;
              return rest;
            });
            updated = true;
          }

          if (Array.isArray(resident.visitRecords) && resident.visitRecords.some(r => r.faceDescriptor || r.photoUrl)) {
            newVisitRecords = resident.visitRecords.map(r => {
              const { faceDescriptor, photoUrl, ...rest } = r;
              return rest;
            });
            updated = true;
          }

          if (updated) {
            await onSaveResident({
              ...resident,
              relatives: newRelatives,
              visitRecords: newVisitRecords
            });
          }
        }
      }

      await loadVisits();
    } catch (err) {
      console.error('Erro ao zerar fotos e biometrias:', err);
      throw err;
    }
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleManualModeSelect = (newMode: ManualSubMode) => {
    setManualMode(newMode);
    speakText('Bem vindo ao Lar São Vicente de Paulo! Vamos registrar a visita.');
  };

  const handleResetManual = () => {
    setManualMode('menu');
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

  const handleSaveManual = async () => {
    if (manualMode === 'residente' && (!residentId || (visitorType === 'new' && (!visitorName || !kinship)))) return;
    if (manualMode === 'ssvp' && (!conferenceName || !visitorName)) return;
    if (manualMode === 'orgao' && (!agencyName || !visitorName)) return;
    if (manualMode === 'instituicao' && !visitorName) return;

    let finalVisitorName = visitorName;
    let finalKinship = kinship;

    if (manualMode === 'residente' && visitorType !== 'new') {
      const parts = visitorType.split('||');
      if (parts.length === 2) {
        finalVisitorName = parts[0];
        finalKinship = parts[1];
      }
    }

    const selRes = residents.find(r => r.id === residentId);

    await handleConfirmEntry({
      visitorName: finalVisitorName,
      type: manualMode === 'orgao' ? 'orgao_fiscalizador' : manualMode === 'residente' ? 'residente' : manualMode,
      residentId: manualMode === 'residente' ? residentId : undefined,
      residentName: selRes ? selRes.name : undefined,
      kinship: manualMode === 'residente' ? finalKinship : undefined,
      agencyName: manualMode === 'orgao' ? agencyName : undefined,
      conferenceName: manualMode === 'ssvp' ? conferenceName : undefined,
      matchedVia: 'manual',
      comments: comments || 'Visita registrada por Digitação Manual na Portaria'
    });

    if (manualMode === 'residente' && saveRelativeInfo && visitorType === 'new' && onSaveResident && selRes) {
      const newRelative: Relative = {
        id: 'rel_' + Date.now().toString(),
        name: finalVisitorName,
        kinship: finalKinship,
        phone: phone,
        observation: '',
        isResponsible: false
      };
      await onSaveResident({
        ...selRes,
        relatives: [...(selRes.relatives || []), newRelative]
      });
    }

    alert('Registro de visita salvo com sucesso!');
    speakText('Muito obrigado pela sua visita, entrada registrada com sucesso!');
    handleResetManual();
    setEntryMode('choice');
  };

  // Câmera no Modal de Captura Avulsa
  const startModalCamera = async () => {
    setCapturedThumb(null);
    setCapturedDescriptor(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      if (captureVideoRef.current) {
        captureVideoRef.current.srcObject = stream;
        captureVideoRef.current.play();
        setCaptureStreamActive(true);
      }
    } catch (err) {
      console.error(err);
      alert('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  };

  const stopModalCamera = () => {
    if (captureVideoRef.current && captureVideoRef.current.srcObject) {
      const tracks = (captureVideoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(t => t.stop());
    }
    setCaptureStreamActive(false);
  };

  const handleTakeModalSnapshot = () => {
    if (!captureVideoRef.current) return;
    const result = extractFaceFromCanvasOrVideo(captureVideoRef.current);
    if (!result.detected || !result.thumbnailDataUrl || !result.descriptor) {
      alert('Nenhum rosto foi detectado com clareza. Centralize o rosto e tente novamente.');
      return;
    }
    setCapturedThumb(result.thumbnailDataUrl);
    setCapturedDescriptor(result.descriptor);
    stopModalCamera();
  };

  const handleSaveModalFace = async () => {
    if (!captureModalVisitor || !capturedThumb || !capturedDescriptor) return;
    try {
      await handleUpdateVisitorFace(captureModalVisitor, capturedThumb, capturedDescriptor);
      alert(`Foto e biometria facial atualizadas para ${captureModalVisitor.name}!`);
      setCaptureModalVisitor(null);
      setCapturedThumb(null);
      setCapturedDescriptor(null);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar biometria facial.');
    }
  };

  const filteredUnifiedVisitors = unifiedVisitorsList.filter(v => {
    const matchesSearch = 
      v.name.toLowerCase().includes(visitorSearch.toLowerCase()) ||
      (v.residentName && v.residentName.toLowerCase().includes(visitorSearch.toLowerCase())) ||
      (v.document && v.document.includes(visitorSearch)) ||
      (v.phone && v.phone.includes(visitorSearch));

    if (!matchesSearch) return false;
    if (filterBiometricOnly === 'with_face') return !!v.faceDescriptor;
    if (filterBiometricOnly === 'without_face') return !v.faceDescriptor;
    return true;
  });

  const selectedResident = residents.find(r => r.id === residentId);

  const isFacialMode = activeTab === 'portaria' && entryMode === 'facial';

  return (
    <div className="flex h-full flex-col bg-gray-50/50">
      
      {/* Barra de Navegação Superior (Mais compacta no modo facial) */}
      <div className={`bg-white border-b border-gray-200 shadow-sm transition-all ${
        isFacialMode ? 'px-4 py-2 sm:py-2.5' : 'px-6 py-4'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase text-[#004c99] tracking-widest block">
              {isAdministrative ? 'Gestão da Portaria & Acesso' : 'Portal de Portaria & Acesso'}
            </span>
            <h1 className={`${isFacialMode ? 'text-lg sm:text-xl' : 'text-2xl'} font-black text-gray-800 uppercase tracking-tight`}>
              Módulo de Visitantes & Portaria
            </h1>
            {!isAdministrative && (
              <p className="text-[10px] font-bold uppercase text-gray-400 mt-1">
                Conta operacional vinculada exclusivamente a esta unidade
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
            <button
              type="button"
              onClick={() => {
                setActiveTab('portaria');
                setEntryMode('choice');
              }}
              className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'portaria'
                  ? 'bg-[#004c99] text-white shadow-md shadow-blue-900/20 scale-105'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
            >
              <User size={15} />
              Registro de Entrada
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('cadastrados')}
              className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'cadastrados'
                  ? 'bg-[#004c99] text-white shadow-md shadow-blue-900/20 scale-105'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
            >
              <Users size={15} />
              Banco de Visitantes ({unifiedVisitorsList.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('historico')}
              className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'historico'
                  ? 'bg-[#004c99] text-white shadow-md shadow-blue-900/20 scale-105'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
            >
              <BookOpen size={15} />
              Livro de Portaria ({globalVisits.length})
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className={`flex-1 w-full mx-auto transition-all ${
        isFacialMode 
          ? 'p-2 sm:p-3 lg:p-4 max-w-[1600px] flex flex-col justify-start overflow-hidden' 
          : 'p-4 sm:p-6 lg:p-8 max-w-7xl'
      }`}>
        
        {/* ABA PRINCIPAL: REGISTRO DE ENTRADA NA PORTARIA */}
        {activeTab === 'portaria' && (
          <div className="space-y-3 sm:space-y-4">
            
            {/* TELA DE ESCOLHA INICIAL: 2 BOTÕES GRANDES (CÂMERA DESLIGADA) */}
            {entryMode === 'choice' && (
              <div className="max-w-4xl mx-auto text-center py-6 animate-in fade-in zoom-in duration-300">
                <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-[#004c99] rounded-full text-xs font-black uppercase tracking-widest mb-4">
                  Portaria & Recepção
                </span>
                <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tight mb-2">
                  Como deseja registrar a entrada?
                </h2>
                <p className="text-gray-500 mb-5 max-w-xl mx-auto text-sm font-medium">
                  Use o reconhecimento facial para familiares e visitantes vinculados a residentes. SSVP, fiscalização e demais acessos continuam pelo registro manual.
                </p>

                {!isFullscreen && (
                  <button
                    type="button"
                    onClick={enterFullscreen}
                    className="mb-6 inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-black text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg transition-all"
                  >
                    <Maximize2 size={17} />
                    Iniciar Portaria em Tela Cheia
                  </button>
                )}

                {/* Banner com Orientação de Uso */}
                <div className="mb-8 p-3.5 bg-blue-50/80 rounded-2xl border border-blue-100 max-w-2xl mx-auto flex items-center justify-center gap-3 text-xs font-bold text-blue-950">
                  <Monitor size={18} className="text-[#004c99] shrink-0" />
                  <span>
                    💡 <strong>Orientação para a Recepção:</strong> Utilize preferencialmente a tela no <strong>Modo Paisagem (Horizontal)</strong> para enquadramento completo e sem rolagem de tela.
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* BOTÃO 1: ENTRADA MANUAL (DIGITAÇÃO) */}
                  <button
                    type="button"
                    onClick={() => {
                      handleResetManual();
                      setEntryMode('manual');
                    }}
                    className="bg-white p-8 sm:p-10 rounded-[36px] shadow-sm border-2 border-gray-100 hover:border-blue-400 hover:shadow-xl hover:bg-blue-50/20 transition-all text-left group flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-18 h-18 bg-blue-100 text-[#004c99] rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
                        <Keyboard size={36} />
                      </div>
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-1">
                        Modo Tradicional • Sem Câmera
                      </span>
                      <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight mb-2 group-hover:text-[#004c99] transition-colors">
                        Registro Manual
                      </h3>
                      <p className="text-xs font-bold text-gray-500 leading-relaxed">
                        Para familiares, SSVP, fiscalização, visitas institucionais e demais acessos.
                      </p>
                    </div>

                    <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-black uppercase tracking-wider text-[#004c99]">
                      <span>Abrir Digitação Manual</span>
                      <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
                    </div>
                  </button>

                  {/* BOTÃO 2: RECONHECIMENTO FACIAL (CÂMERA) */}
                  <button
                    type="button"
                    onClick={handleOpenFacialMode}
                    className="bg-white p-8 sm:p-10 rounded-[36px] shadow-sm border-2 border-emerald-100 hover:border-emerald-500 hover:shadow-xl hover:bg-emerald-50/20 transition-all text-left group flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-18 h-18 bg-emerald-100 text-emerald-700 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
                        <ScanFace size={36} />
                      </div>
                      <span className="text-[10px] font-black uppercase text-emerald-700 tracking-widest block mb-1">
                        IA Local • Rápido • Modo Totem
                      </span>
                      <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight mb-2 group-hover:text-emerald-700 transition-colors">
                        Reconhecimento Facial
                      </h3>
                      <p className="text-xs font-bold text-gray-500 leading-relaxed">
                        Exclusivo para familiares e visitantes previamente vinculados a residentes.
                      </p>
                    </div>

                    <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-black uppercase tracking-wider text-emerald-700">
                      <span className="flex items-center gap-1.5">
                        <ScanFace size={14} /> Iniciar Reconhecimento
                      </span>
                      <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
                    </div>
                  </button>

                </div>
              </div>
            )}

            {/* MODO 1: RECONHECIMENTO FACIAL ATIVO (MODO TOTEM EM TELA CHEIA IMERSIVA) */}
            {entryMode === 'facial' && (
              <div className="fixed inset-0 z-[9999] bg-slate-900 text-slate-100 flex flex-col overflow-y-auto custom-scrollbar p-3 sm:p-5 animate-in fade-in duration-200">
                {/* Barra de Topo do Totem Portaria */}
                <div className="flex items-center justify-between bg-slate-800/90 backdrop-blur-md border border-slate-700/60 px-4 py-2.5 rounded-2xl shadow-xl mb-3 shrink-0 gap-2">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleCloseFacialMode}
                      className="px-3.5 py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border border-rose-500/30"
                      title="Sair do Modo Portaria e voltar ao sistema"
                    >
                      <LogOut size={15} />
                      Sair da Portaria
                    </button>

                    <div className="hidden sm:flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span className="text-xs font-black uppercase text-slate-200 tracking-wider">
                        Totem de Portaria • Reconhecimento Facial
                      </span>
                    </div>
                  </div>

                  <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-blue-950/60 text-blue-300 rounded-xl border border-blue-800/50 text-[11px] font-bold">
                    <Monitor size={14} />
                    <span>Modo Paisagem (Horizontal) Ativo</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Botão de Alternar Tela Cheia */}
                    <button
                      type="button"
                      onClick={toggleFullscreen}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border border-slate-600"
                      title={isFullscreen ? "Sair da Tela Cheia" : "Expandir em Tela Cheia"}
                    >
                      {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                      <span className="hidden sm:inline">{isFullscreen ? 'Janela' : 'Tela Cheia'}</span>
                    </button>
                  </div>
                </div>

                {/* Aviso para telas estreitas (Modo Retrato / Mobile) */}
                <div className="md:hidden mb-2 bg-amber-950/80 border border-amber-600/40 text-amber-200 px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-2">
                  <Smartphone size={15} className="rotate-90 text-amber-400 shrink-0" />
                  <span>Dica: Gire o tablet para o <strong>Modo Paisagem (Horizontal)</strong> para enquadramento perfeito.</span>
                </div>

                {/* Conteúdo Principal do Terminal Facial */}
                <div className="flex-1 w-full max-w-[1600px] mx-auto flex flex-col justify-start">
                  <FacialRecognitionCamera
                    institutionId={institutionId}
                    residents={residents}
                    registeredVisitors={facialVisitorsList}
                    onConfirmEntry={handleConfirmEntry}
                    onUpdateVisitorFace={handleUpdateVisitorFace}
                    onRegisterQuickVisitor={handleRegisterQuickVisitor}
                    onResetBiometrics={canManageBiometrics ? handleClearAllBiometrics : undefined}
                    onUseManual={() => {
                      handleResetManual();
                      setEntryMode('manual');
                    }}
                    onEntryCompleted={() => setEntryMode('choice')}
                  />
                </div>
              </div>
            )}

            {/* MODO 2: REGISTRO MANUAL DE ENTRADA */}
            {entryMode === 'manual' && (
              <div className="max-w-4xl mx-auto space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setEntryMode('choice')}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2"
                  >
                    <ArrowLeft size={16} />
                    Voltar ao Início da Portaria
                  </button>
                  <span className="text-xs font-bold text-blue-800 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                    Modo de Digitação Manual
                  </span>
                </div>

                {manualMode === 'menu' ? (
                  <div className="bg-white p-8 sm:p-10 rounded-[36px] shadow-sm border border-gray-100 text-center animate-in zoom-in-95 duration-200">
                    <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight mb-2">
                      Selecione o Tipo de Visita
                    </h3>
                    <p className="text-gray-500 mb-8 text-xs font-bold">
                      Escolha o perfil do visitante para prosseguir com a identificação manual:
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button onClick={() => handleManualModeSelect('residente')} className="p-6 rounded-2xl bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 transition-all text-left flex items-center gap-4 group">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-[#004c99] shrink-0 group-hover:scale-110 transition-transform">
                          <User size={24} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-gray-900 uppercase">Visita a Residente</h4>
                          <p className="text-[11px] font-bold text-gray-400">Familiar, amigo ou conhecido de um idoso</p>
                        </div>
                      </button>

                      <button onClick={() => handleManualModeSelect('instituicao')} className="p-6 rounded-2xl bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-300 transition-all text-left flex items-center gap-4 group">
                        <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-700 shrink-0 group-hover:scale-110 transition-transform">
                          <Building2 size={24} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-gray-900 uppercase">Visita Institucional</h4>
                          <p className="text-[11px] font-bold text-gray-400">Doações, reuniões ou conhecimento do espaço</p>
                        </div>
                      </button>

                      <button onClick={() => handleManualModeSelect('ssvp')} className="p-6 rounded-2xl bg-gray-50 hover:bg-purple-50 border border-gray-200 hover:border-purple-300 transition-all text-left flex items-center gap-4 group">
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-700 shrink-0 group-hover:scale-110 transition-transform">
                          <HeartHandshake size={24} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-gray-900 uppercase">Membro da SSVP</h4>
                          <p className="text-[11px] font-bold text-gray-400">Conferência, Conselho Particular ou Central</p>
                        </div>
                      </button>

                      <button onClick={() => handleManualModeSelect('orgao')} className="p-6 rounded-2xl bg-gray-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-300 transition-all text-left flex items-center gap-4 group">
                        <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-orange-700 shrink-0 group-hover:scale-110 transition-transform">
                          <Shield size={24} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-gray-900 uppercase">Órgão Fiscalizador</h4>
                          <p className="text-[11px] font-bold text-gray-400">Vigilância Sanitária, MP, Bombeiros</p>
                        </div>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-8 sm:p-10 rounded-[36px] shadow-sm border border-gray-100 text-left animate-in slide-in-from-right-8 duration-300">
                    <h2 className="text-2xl font-black text-[#004c99] uppercase tracking-widest mb-6 border-b pb-4">
                      {manualMode === 'residente' && 'Visita a Residente'}
                      {manualMode === 'instituicao' && 'Visita Institucional'}
                      {manualMode === 'ssvp' && 'Registro de Membro SSVP'}
                      {manualMode === 'orgao' && 'Registro de Órgão Fiscalizador'}
                    </h2>

                    <div className="space-y-6">
                      {manualMode !== 'residente' && (
                        <div>
                          <label className="block text-xs font-black text-gray-500 uppercase mb-2">Nome do Visitante *</label>
                          <input type="text" className="w-full border p-4 rounded-2xl bg-gray-50 font-bold" value={visitorName} onChange={e => setVisitorName(e.target.value)} placeholder="Como podemos te chamar?" />
                        </div>
                      )}

                      {manualMode === 'orgao' && (
                        <div>
                          <label className="block text-xs font-black text-gray-500 uppercase mb-2">Qual órgão você representa?</label>
                          <input type="text" className="w-full border p-4 rounded-2xl bg-gray-50 font-bold" value={agencyName} onChange={e => setAgencyName(e.target.value)} placeholder="Ex: Vigilância Sanitária" />
                        </div>
                      )}

                      {manualMode === 'ssvp' && (
                        <div>
                          <label className="block text-xs font-black text-gray-500 uppercase mb-2">De qual Conferência / Conselho faz parte?</label>
                          <input type="text" className="w-full border p-4 rounded-2xl bg-gray-50 font-bold" value={conferenceName} onChange={e => setConferenceName(e.target.value)} placeholder="Ex: Conferência São Vicente" />
                        </div>
                      )}

                      {manualMode === 'residente' && (
                        <>
                          <div className="relative">
                            <label className="block text-xs font-black text-gray-500 uppercase mb-2">Qual residente você vai visitar? *</label>
                            <input 
                              type="text" 
                              className="w-full border p-4 rounded-2xl bg-gray-50 mb-2 focus:ring-2 focus:ring-[#004c99] outline-none font-bold transition-all" 
                              value={residentSearchTerm} 
                              onChange={e => {
                                setResidentSearchTerm(e.target.value);
                                if (residentId) setResidentId('');
                                if (e.target.value.length >= 2) {
                                  setShowSuggestions(true);
                                } else {
                                  setShowSuggestions(false);
                                }
                              }}
                              onFocus={() => {
                                if (residentSearchTerm.length >= 2 && !residentId) setShowSuggestions(true);
                              }}
                              placeholder="Digite o nome do residente..." 
                            />
                            {showSuggestions && residentSearchTerm.length >= 2 && !residentId && (
                              <div className="absolute top-[88px] left-0 w-full mt-1 bg-white border border-gray-100 rounded-2xl shadow-2xl z-50 max-h-48 overflow-y-auto">
                                {residents.filter(r => r.name.toLowerCase().includes(residentSearchTerm.toLowerCase())).length > 0 ? (
                                  residents.filter(r => r.name.toLowerCase().includes(residentSearchTerm.toLowerCase())).map(r => (
                                    <button
                                      key={r.id}
                                      type="button"
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
                              <select className="w-full border p-4 rounded-2xl bg-white mb-4 font-bold" value={visitorType} onChange={e => setVisitorType(e.target.value)}>
                                <option value="new">Ainda não fui cadastrado</option>
                                {(selectedResident.relatives || []).filter(rel => !rel.deceased).map((rel, idx) => (
                                  <option key={idx} value={`${rel.name}||${rel.kinship}`}>{rel.name} ({rel.kinship})</option>
                                ))}
                              </select>
                              
                              {visitorType === 'new' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Seu Nome *</label>
                                    <input type="text" className="w-full border p-3 rounded-xl font-bold" value={visitorName} onChange={e => setVisitorName(e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Parentesco / Relação *</label>
                                    <input type="text" className="w-full border p-3 rounded-xl font-bold" value={kinship} onChange={e => setKinship(e.target.value)} placeholder="Ex: Filho, Amiga" />
                                  </div>
                                  <div className="md:col-span-2 pt-2">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                      <input type="checkbox" className="w-4 h-4 rounded text-[#004c99]" checked={saveRelativeInfo} onChange={e => setSaveRelativeInfo(e.target.checked)} />
                                      <span className="text-xs font-bold text-gray-600 group-hover:text-gray-900 transition-colors">Desejo gravar meu nome e parentesco na ficha do residente</span>
                                    </label>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-black text-gray-500 uppercase mb-2">Telefone para Contato (Opcional)</label>
                          <input type="text" className="w-full border p-4 rounded-2xl bg-gray-50 font-bold" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
                        </div>
                        <div>
                          <label className="block text-xs font-black text-gray-500 uppercase mb-2">Observação da Visita (Opcional)</label>
                          <input type="text" className="w-full border p-4 rounded-2xl bg-gray-50 font-bold" value={comments} onChange={e => setComments(e.target.value)} placeholder="Ex: Entrega de pertences" />
                        </div>
                      </div>

                      <div className="flex gap-4 pt-6">
                        <button type="button" onClick={handleResetManual} className="w-1/3 py-4 rounded-2xl bg-gray-100 text-gray-600 font-black text-xs uppercase tracking-wider hover:bg-gray-200 transition-colors">
                          Voltar
                        </button>
                        <button type="button" onClick={handleSaveManual} className="w-2/3 py-4 rounded-2xl bg-[#004c99] text-white font-black text-xs uppercase tracking-widest hover:bg-blue-800 transition-colors shadow-lg">
                          Confirmar Entrada
                        </button>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* ABA 2: BANCO DE VISITANTES CADASTRADOS COM STATUS BIOMÉTRICO */}
        {activeTab === 'cadastrados' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  value={visitorSearch}
                  onChange={(e) => setVisitorSearch(e.target.value)}
                  placeholder="Buscar por visitante, residente ou documento..."
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#004c99]/20"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setFilterBiometricOnly('all')}
                  className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                    filterBiometricOnly === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Todos ({unifiedVisitorsList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterBiometricOnly('with_face')}
                  className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                    filterBiometricOnly === 'with_face' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  <ScanFace size={12} /> Com Biometria
                </button>
                <button
                  type="button"
                  onClick={() => setFilterBiometricOnly('without_face')}
                  className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                    filterBiometricOnly === 'without_face' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  Pendente de Foto
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('Deseja realmente apagar e zerar todas as fotos e cadastros de reconhecimento facial? Isso removerá todas as fotos e registros de teste do Livro de Portaria e do Banco de Visitantes.')) {
                      try {
                        await handleClearAllBiometrics();
                        alert('Fotos e biometrias faciais completamente removidas com sucesso!');
                      } catch (e) {
                        alert('Erro ao apagar fotos e biometrias.');
                      }
                    }
                  }}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                  title="Apaga todas as fotos e cadastros biométricos da instituição"
                >
                  <X size={12} /> Apagar Fotos & Biometrias
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUnifiedVisitors.map((v) => (
                <div key={v.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:border-blue-200 transition-all flex flex-col justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 border-2 border-gray-100 shrink-0 flex items-center justify-center relative">
                      {v.photoUrl ? (
                        <img src={v.photoUrl} alt={v.name} className="w-full h-full object-cover" />
                      ) : (
                        <User size={28} className="text-gray-300" />
                      )}
                      {v.faceDescriptor && (
                        <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center text-white" title="Biometria Ativa">
                          <CheckCircle2 size={10} />
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight truncate">{v.name}</h4>
                      <p className="text-[10px] font-bold text-[#004c99] uppercase tracking-wider mt-0.5">
                        {v.type === 'residente' && `Familiar de: ${v.residentName || 'Residente'} (${v.kinship || 'Parentesco'})`}
                        {v.type === 'ssvp' && `SSVP: ${v.conferenceName || 'Conferência'}`}
                        {v.type === 'orgao_fiscalizador' && `Órgão: ${v.agencyName || 'Fiscal'}`}
                        {v.type === 'instituicao' && 'Visita Institucional'}
                      </p>
                      {v.phone && (
                        <p className="text-[10px] text-gray-400 font-medium mt-1 flex items-center gap-1">
                          <Phone size={10} /> {v.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${
                      v.faceDescriptor ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {v.faceDescriptor ? 'Biometria Cadastrada' : 'Sem Biometria Facial'}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setCaptureModalVisitor(v);
                        startModalCamera();
                      }}
                      className="px-3 py-1.5 bg-[#004c99] hover:bg-blue-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1"
                    >
                      <Camera size={12} />
                      {v.faceDescriptor ? 'Atualizar Foto' : 'Capturar Face'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA 3: LIVRO DE PORTARIA / HISTÓRICO */}
        {activeTab === 'historico' && (
          <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Livro de Portaria</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                  Histórico de entradas registradas na instituição
                </p>
              </div>
              <span className="px-3 py-1 bg-blue-50 text-[#004c99] text-xs font-black uppercase rounded-full">
                Total: {globalVisits.length} registros
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-100 text-[9px] font-black uppercase text-gray-400 tracking-widest">
                  <tr>
                    <th className="py-4 px-6">Data / Hora</th>
                    <th className="py-4 px-6">Visitante</th>
                    <th className="py-4 px-6">Tipo / Destino</th>
                    <th className="py-4 px-6">Identificação</th>
                    <th className="py-4 px-6">Observações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {globalVisits.length > 0 ? (
                    globalVisits.map((visit) => (
                      <tr key={visit.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span className="font-bold text-gray-900">
                            {new Date(visit.date).toLocaleDateString('pt-BR')}
                          </span>
                          <span className="text-[10px] text-gray-400 block font-medium">
                            {visit.timeIn || new Date(visit.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden shrink-0 border border-gray-200 flex items-center justify-center">
                              {visit.photoUrl ? (
                                <img src={visit.photoUrl} alt={visit.visitorName} className="w-full h-full object-cover" />
                              ) : (
                                <User size={14} className="text-gray-400" />
                              )}
                            </div>
                            <div>
                              <p className="font-black text-gray-900 uppercase tracking-tight">{visit.visitorName || 'Anônimo'}</p>
                              {visit.phone && <p className="text-[9px] text-gray-400 font-medium">{visit.phone}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="font-bold text-[#004c99] block uppercase">
                            {visit.type === 'residente' && (visit.residentName ? `Residente: ${visit.residentName}` : 'Residente')}
                            {visit.type === 'ssvp' && (visit.conferenceName || 'Membro SSVP')}
                            {visit.type === 'orgao_fiscalizador' && (visit.agencyName || 'Órgão')}
                            {visit.type === 'instituicao' && 'Institucional'}
                          </span>
                          {visit.kinship && <span className="text-[10px] text-gray-400 block">({visit.kinship})</span>}
                        </td>
                        <td className="py-4 px-6">
                          {visit.matchedVia === 'facial' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider rounded-lg border border-emerald-100">
                              <ScanFace size={12} /> Facial ({visit.facialConfidence || 95}%)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 text-[10px] font-black uppercase tracking-wider rounded-lg">
                              Manual
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 max-w-xs">
                          <p className="text-gray-600 truncate">{visit.comments || '—'}</p>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-400 font-bold uppercase text-[10px] tracking-widest">
                        Nenhum registro de visita encontrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Modal de Captura Facial Avulsa */}
      {captureModalVisitor && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">Captura Facial</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                  Visitante: {captureModalVisitor.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopModalCamera();
                  setCaptureModalVisitor(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-gray-900 rounded-3xl overflow-hidden aspect-video relative flex items-center justify-center">
              {capturedThumb ? (
                <img src={capturedThumb} alt="Rosto Capturado" className="w-full h-full object-cover" />
              ) : (
                <video
                  ref={captureVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
              )}
            </div>

            <div className="flex gap-3 pt-2">
              {capturedThumb ? (
                <>
                  <button
                    type="button"
                    onClick={startModalCamera}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl text-xs font-black uppercase tracking-wider"
                  >
                    Tirar Outra
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveModalFace}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/30"
                  >
                    Salvar Biometria
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleTakeModalSnapshot}
                  className="w-full py-3.5 bg-[#004c99] hover:bg-blue-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-2"
                >
                  <Camera size={16} /> Capturar Foto Agora
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
