import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Camera, 
  CameraOff, 
  RefreshCw, 
  CheckCircle2, 
  UserCheck, 
  UserPlus, 
  AlertCircle, 
  Sparkles, 
  ScanFace, 
  Shield, 
  User, 
  Building2, 
  HeartHandshake, 
  ChevronRight, 
  X,
  Volume2,
  VolumeX,
  Search,
  Monitor,
  Smartphone
} from 'lucide-react';
import { Resident, Relative, GlobalVisitRecord } from '../types';
import { 
  extractFaceFromCanvasOrVideo, 
  findBestFaceMatch, 
  calculateFaceSimilarity,
  FaceDetectionResult 
} from '../lib/faceRecognition';

export interface UnifiedVisitor {
  id: string;
  name: string;
  document?: string;
  phone?: string;
  type: 'residente' | 'instituicao' | 'ssvp' | 'orgao_fiscalizador';
  residentId?: string;
  residentName?: string;
  linkedResidents?: { residentId: string; residentName: string }[];
  kinship?: string;
  agencyName?: string;
  conferenceName?: string;
  photoUrl?: string;
  faceDescriptor?: number[];
  sourceType: 'relative' | 'global' | 'custom';
}

interface FacialRecognitionCameraProps {
  institutionId: string;
  residents: Resident[];
  registeredVisitors: UnifiedVisitor[];
  onConfirmEntry: (visitData: {
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
  }) => Promise<void>;
  onUpdateVisitorFace: (visitor: UnifiedVisitor, photoUrl: string, faceDescriptor: number[]) => Promise<void>;
  onRegisterQuickVisitor: (newVisitor: UnifiedVisitor) => Promise<void>;
  onResetBiometrics?: () => Promise<void>;
  onEntryCompleted?: () => void;
}

export const FacialRecognitionCamera: React.FC<FacialRecognitionCameraProps> = ({
  institutionId,
  residents,
  registeredVisitors,
  onConfirmEntry,
  onUpdateVisitorFace,
  onRegisterQuickVisitor,
  onResetBiometrics,
  onEntryCompleted
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [streamActive, setStreamActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  
  // Detecção e Reconhecimento
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastDetection, setLastDetection] = useState<FaceDetectionResult | null>(null);
  const lastSeenFaceTimestampRef = useRef<number | null>(null);
  const lastValidThumbRef = useRef<string | null>(null);
  const lastValidDescRef = useRef<number[] | null>(null);

  const [matchedVisitor, setMatchedVisitor] = useState<UnifiedVisitor | null>(null);
  const [matchConfidence, setMatchConfidence] = useState<number>(0);
  const [confirmedSuccess, setConfirmedSuccess] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [selectedThreshold, setSelectedThreshold] = useState<number>(75);
  const [bestCandidatePreview, setBestCandidatePreview] = useState<{ name: string; similarity: number } | null>(null);
  const [isResettingBiometrics, setIsResettingBiometrics] = useState<boolean>(false);

  // Controle de Ciclo de Varredura (4.0 segundos) e Estado de Não Reconhecido
  const scanStartTimeRef = useRef<number | null>(null);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanSecondsLeft, setScanSecondsLeft] = useState<number>(4.0);
  const stableMatchVisitorIdRef = useRef<string | null>(null);
  const stableMatchCountRef = useRef<number>(0);
  const entryInProgressRef = useRef<boolean>(false);
  const [selectedMatchedResidentId, setSelectedMatchedResidentId] = useState<string>('');
  const [unrecognizedFace, setUnrecognizedFace] = useState<{
    photoUrl?: string;
    descriptor?: number[];
    bestCandidateName?: string;
    bestSimilarity?: number;
  } | null>(null);

  // Modais de Cadastro Rápido
  const [showQuickLinkModal, setShowQuickLinkModal] = useState<boolean>(false);
  const [showQuickNewModal, setShowQuickNewModal] = useState<boolean>(false);
  const [linkSearchTerm, setLinkSearchTerm] = useState<string>('');
  const [selectedVisitorToLink, setSelectedVisitorToLink] = useState<UnifiedVisitor | null>(null);

  // Formulário do Novo Visitante Rápido
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickDoc, setQuickDoc] = useState('');
  const [quickType, setQuickType] = useState<'residente' | 'instituicao' | 'ssvp' | 'orgao_fiscalizador'>('residente');
  const [quickResidentId, setQuickResidentId] = useState('');
  const [quickKinship, setQuickKinship] = useState('');
  const [quickAgency, setQuickAgency] = useState('');
  const [quickConference, setQuickConference] = useState('');
  const [entryObservation, setEntryObservation] = useState('');

  // Foto do Cadastro Rápido
  const [manualCapturedThumb, setManualCapturedThumb] = useState<string | null>(null);
  const [manualCapturedDescriptor, setManualCapturedDescriptor] = useState<number[] | null>(null);
  const [isCapturingInModal, setIsCapturingInModal] = useState<boolean>(false);

  const speak = useCallback((text: string) => {
    if (!voiceEnabled) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  }, [voiceEnabled]);

  // Listar câmeras disponíveis
  useEffect(() => {
    async function listCameras() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        setAvailableDevices(videoInputs);
        if (videoInputs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoInputs[0].deviceId);
        }
      } catch (err) {
        console.warn('Não foi possível listar dispositivos de vídeo:', err);
      }
    }
    listCameras();
  }, [selectedDeviceId]);

  // Iniciar Stream de Vídeo
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId 
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStreamActive(true);
      }
    } catch (err: any) {
      console.error('Erro ao acessar câmera:', err);
      setStreamActive(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Permissão para uso da câmera foi negada. Por favor, autorize no navegador.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('Nenhuma câmera encontrada no dispositivo.');
      } else {
        setCameraError('Não foi possível inicializar a câmera. Verifique se outro aplicativo a está utilizando.');
      }
    }
  }, [selectedDeviceId]);

  // Desligar câmera ao desmontar
  useEffect(() => {
    startCamera();
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  // Resetar e reiniciar escaneamento
  const handleRetryScan = useCallback(() => {
    setUnrecognizedFace(null);
    setMatchedVisitor(null);
    setMatchConfidence(0);
    setBestCandidatePreview(null);
    setScanProgress(0);
    setScanSecondsLeft(3.0);
    lastSeenFaceTimestampRef.current = null;
    scanStartTimeRef.current = Date.now();
  }, []);

  // Loop de Detecção e Reconhecimento Facial em Tempo Real (a cada 400ms)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!streamActive || confirmedSuccess || unrecognizedFace || showQuickLinkModal || showQuickNewModal) {
      return;
    }

    const runRecognitionLoop = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;

      setIsProcessing(true);
      try {
        const detection = extractFaceFromCanvasOrVideo(videoRef.current);
        setLastDetection(detection);

        if (detection.detected && detection.descriptor) {
          lastSeenFaceTimestampRef.current = Date.now();
          if (detection.thumbnailDataUrl) {
            lastValidThumbRef.current = detection.thumbnailDataUrl;
          }
          lastValidDescRef.current = detection.descriptor;

          // Inicia contagem contínua de 3.0 segundos
          if (scanStartTimeRef.current === null) {
            scanStartTimeRef.current = Date.now();
          }

          const elapsedMs = Date.now() - scanStartTimeRef.current;
          const remainingSec = Math.max(0, (3000 - elapsedMs) / 1000);
          setScanSecondsLeft(Number(remainingSec.toFixed(1)));
          setScanProgress(Math.min(100, Math.round((elapsedMs / 3000) * 100)));

          // Busca correspondência com biometrias cadastradas
          const visitorsWithFace = registeredVisitors.filter(v => v.faceDescriptor && v.faceDescriptor.length === 128);
          
          let matchResult: any = null;
          if (visitorsWithFace.length > 0) {
            matchResult = findBestFaceMatch<UnifiedVisitor>(detection.descriptor, visitorsWithFace, selectedThreshold);
            
            if (matchResult.bestCandidate && matchResult.similarity > 35) {
              setBestCandidatePreview({
                name: matchResult.bestCandidate.name,
                similarity: matchResult.similarity
              });
            } else {
              setBestCandidatePreview(null);
            }
          }

          // Se identificou com sucesso com similaridade >= threshold:
          if (matchResult && matchResult.matched && matchResult.visitor) {
            scanStartTimeRef.current = null;
            lastSeenFaceTimestampRef.current = null;
            setScanProgress(0);
            setScanSecondsLeft(3.0);
            setUnrecognizedFace(null);
            
            if (!matchedVisitor || matchedVisitor.id !== matchResult.visitor.id) {
              setMatchedVisitor(matchResult.visitor);
              setMatchConfidence(matchResult.similarity);
              speak(`Visitante identificado: ${matchResult.visitor.name}`);
            } else {
              setMatchConfidence(Math.max(matchConfidence, matchResult.similarity));
            }
            return;
          }

          // Se esgotou a janela de 3,0 segundos sem encontrar correspondência válida:
          if (elapsedMs >= 3000) {
            scanStartTimeRef.current = null;
            lastSeenFaceTimestampRef.current = null;
            setScanProgress(0);
            setScanSecondsLeft(0);
            setMatchedVisitor(null);
            setMatchConfidence(0);
            
            setUnrecognizedFace({
              photoUrl: detection.thumbnailDataUrl || lastValidThumbRef.current || undefined,
              descriptor: detection.descriptor || lastValidDescRef.current || undefined,
              bestCandidateName: matchResult?.bestCandidate?.name,
              bestSimilarity: matchResult?.similarity
            });

            speak('Rosto não identificado. Deseja cadastrar um novo visitante ou tentar novamente?');
          }
        } else {
          // Se não detectou face neste frame específico, tolera até 1200ms de oscilação antes de resetar o contador
          if (scanStartTimeRef.current !== null && lastSeenFaceTimestampRef.current) {
            const timeSinceLastSeen = Date.now() - lastSeenFaceTimestampRef.current;
            if (timeSinceLastSeen > 1200) {
              // Pessoa realmente saiu da frente da câmera
              scanStartTimeRef.current = null;
              lastSeenFaceTimestampRef.current = null;
              setScanProgress(0);
              setScanSecondsLeft(3.0);
              setBestCandidatePreview(null);
              if (matchedVisitor) {
                setMatchedVisitor(null);
                setMatchConfidence(0);
              }
            } else {
              // Mantém o progresso durante leve oscilação
              const elapsedMs = Date.now() - scanStartTimeRef.current;
              const remainingSec = Math.max(0, (3000 - elapsedMs) / 1000);
              setScanSecondsLeft(Number(remainingSec.toFixed(1)));
              setScanProgress(Math.min(100, Math.round((elapsedMs / 3000) * 100)));

              if (elapsedMs >= 3000) {
                scanStartTimeRef.current = null;
                lastSeenFaceTimestampRef.current = null;
                setScanProgress(0);
                setScanSecondsLeft(0);
                setMatchedVisitor(null);
                setMatchConfidence(0);

                setUnrecognizedFace({
                  photoUrl: lastValidThumbRef.current || undefined,
                  descriptor: lastValidDescRef.current || undefined
                });

                speak('Rosto não identificado. Deseja cadastrar um novo visitante ou tentar novamente?');
              }
            }
          }
        }
      } catch (err) {
        console.error('Erro no loop de reconhecimento:', err);
      } finally {
        setIsProcessing(false);
      }
    };

    timer = setInterval(runRecognitionLoop, 400);
    return () => clearInterval(timer);
  }, [streamActive, registeredVisitors, matchedVisitor, matchConfidence, confirmedSuccess, speak, selectedThreshold, unrecognizedFace, showQuickLinkModal, showQuickNewModal]);

  // Confirmar Entrada do Visitante Reconhecido
  const handleConfirmRecognizedEntry = async () => {
    if (!matchedVisitor) return;

    try {
      await onConfirmEntry({
        visitorName: matchedVisitor.name,
        visitorDoc: matchedVisitor.document,
        type: matchedVisitor.type,
        residentId: matchedVisitor.residentId,
        residentName: matchedVisitor.residentName,
        kinship: matchedVisitor.kinship,
        agencyName: matchedVisitor.agencyName,
        conferenceName: matchedVisitor.conferenceName,
        photoUrl: undefined, // Privacidade: Não salva foto de passagem
        faceDescriptor: undefined,
        matchedVia: 'facial',
        facialConfidence: matchConfidence,
        comments: entryObservation || 'Entrada confirmada por Reconhecimento Facial'
      });

      const visitorName = matchedVisitor.name;
      setConfirmedSuccess(`Entrada liberada com sucesso para ${visitorName}!`);
      speak(`Entrada liberada para ${visitorName}! Seja bem-vindo.`);
      
      // Imediatamente reseta os dados de biometria temporária da tela
      setMatchedVisitor(null);
      setMatchConfidence(0);
      setBestCandidatePreview(null);
      setLastDetection(null);
      setUnrecognizedFace(null);

      setTimeout(() => {
        setConfirmedSuccess(null);
        setEntryObservation('');
        onEntryCompleted?.();
      }, 2500);
    } catch (err) {
      console.error('Erro ao confirmar entrada:', err);
      alert('Erro ao registrar a entrada. Tente novamente.');
    }
  };

  // Salvar Vínculo Rápido de Rosto
  const handleSaveQuickLink = async () => {
    const photoToUse = unrecognizedFace?.photoUrl || lastDetection?.thumbnailDataUrl;
    const descriptorToUse = unrecognizedFace?.descriptor || lastDetection?.descriptor;

    if (!selectedVisitorToLink || !photoToUse || !descriptorToUse) {
      alert('Selecione um visitante e certifique-se de que o rosto esteja enquadrado.');
      return;
    }

    try {
      await onUpdateVisitorFace(
        selectedVisitorToLink,
        photoToUse,
        descriptorToUse
      );

      // Já define como visitante reconhecido imediatamente!
      setMatchedVisitor({
        ...selectedVisitorToLink,
        photoUrl: photoToUse,
        faceDescriptor: descriptorToUse
      });
      setMatchConfidence(98);
      setUnrecognizedFace(null);
      setShowQuickLinkModal(false);
      setSelectedVisitorToLink(null);
      speak(`Rosto cadastrado com sucesso para ${selectedVisitorToLink.name}!`);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar biometria facial.');
    }
  };

  // Abrir Modal de Cadastro Rápido com foto do frame atual
  const handleOpenQuickNewModal = () => {
    let initialThumb = unrecognizedFace?.photoUrl || lastDetection?.thumbnailDataUrl || lastValidThumbRef.current || null;
    let initialDesc = unrecognizedFace?.descriptor || lastDetection?.descriptor || lastValidDescRef.current || null;
    
    if ((!initialThumb || !initialDesc) && videoRef.current) {
      try {
        const result = extractFaceFromCanvasOrVideo(videoRef.current, canvasRef.current || undefined);
        if (result.thumbnailDataUrl) initialThumb = result.thumbnailDataUrl;
        if (result.descriptor && result.descriptor.length === 128) initialDesc = result.descriptor;
      } catch (e) {
        console.warn('Tentativa de captura inicial:', e);
      }
    }

    setManualCapturedThumb(initialThumb);
    setManualCapturedDescriptor(initialDesc);
    setShowQuickNewModal(true);
  };

  // Capturar/Recapturar Foto Manualmente no Modal
  const handleCaptureManualPhotoInModal = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsCapturingInModal(true);
    try {
      const result = await extractFaceFromCanvasOrVideo(videoRef.current, canvasRef.current);
      if (result.thumbnailDataUrl) {
        setManualCapturedThumb(result.thumbnailDataUrl);
        if (result.descriptor && result.descriptor.length === 128) {
          setManualCapturedDescriptor(result.descriptor);
        }
      } else {
        alert('Não foi possível obter imagem da câmera. Posicione o visitante em frente à câmera e tente novamente.');
      }
    } catch (err) {
      console.warn('Erro ao capturar foto no modal:', err);
    } finally {
      setIsCapturingInModal(false);
    }
  };

  // Salvar Novo Visitante Rápido + Foto + Entrada
  const handleSaveQuickNewVisitor = async () => {
    if (!quickName.trim()) {
      alert('Por favor, informe o nome do visitante.');
      return;
    }
    if (quickType === 'residente' && !quickResidentId) {
      alert('Por favor, selecione qual residente o visitante veio visitar.');
      return;
    }

    const photoToUse = manualCapturedThumb || unrecognizedFace?.photoUrl || lastDetection?.thumbnailDataUrl || lastValidThumbRef.current;
    const descriptorToUse = manualCapturedDescriptor || unrecognizedFace?.descriptor || lastDetection?.descriptor || lastValidDescRef.current;

    try {
      const selectedRes = residents.find(r => r.id === quickResidentId);
      const newVisitor: UnifiedVisitor = {
        id: 'vis_' + Date.now().toString(),
        name: quickName.trim(),
        phone: quickPhone.trim(),
        document: quickDoc.trim(),
        type: quickType,
        residentId: quickType === 'residente' ? quickResidentId : undefined,
        residentName: selectedRes ? selectedRes.name : undefined,
        kinship: quickType === 'residente' ? quickKinship : undefined,
        agencyName: quickType === 'orgao_fiscalizador' ? quickAgency : undefined,
        conferenceName: quickType === 'ssvp' ? quickConference : undefined,
        photoUrl: photoToUse || undefined,
        faceDescriptor: descriptorToUse || undefined,
        sourceType: 'custom'
      };

      await onRegisterQuickVisitor(newVisitor);

      // Registra entrada imediata
      await onConfirmEntry({
        visitorName: newVisitor.name,
        visitorDoc: newVisitor.document,
        type: newVisitor.type,
        residentId: newVisitor.residentId,
        residentName: newVisitor.residentName,
        kinship: newVisitor.kinship,
        agencyName: newVisitor.agencyName,
        conferenceName: newVisitor.conferenceName,
        photoUrl: newVisitor.photoUrl,
        faceDescriptor: newVisitor.faceDescriptor,
        matchedVia: 'facial',
        facialConfidence: 99,
        comments: 'Primeiro cadastro facial e entrada direta na portaria'
      });

      setShowQuickNewModal(false);
      setUnrecognizedFace(null);
      setMatchedVisitor(null);
      setMatchConfidence(0);
      setBestCandidatePreview(null);
      setLastDetection(null);
      setConfirmedSuccess(`Visitante ${newVisitor.name} cadastrado e entrada liberada!`);
      speak(`Cadastro concluído e entrada liberada para ${newVisitor.name}!`);

      // Limpa formulário
      setQuickName('');
      setQuickPhone('');
      setQuickDoc('');
      setQuickResidentId('');
      setQuickKinship('');
      setQuickAgency('');
      setQuickConference('');
      setManualCapturedThumb(null);
      setManualCapturedDescriptor(null);

      setTimeout(() => {
        setConfirmedSuccess(null);
        setMatchedVisitor(null);
        onEntryCompleted?.();
      }, 2500);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar novo visitante.');
    }
  };

  const filteredVisitorsToLink = registeredVisitors.filter(v => 
    v.name.toLowerCase().includes(linkSearchTerm.toLowerCase()) ||
    (v.document && v.document.includes(linkSearchTerm)) ||
    (v.residentName && v.residentName.toLowerCase().includes(linkSearchTerm.toLowerCase()))
  );

  const totalBiometricCount = registeredVisitors.filter(v => v.faceDescriptor && v.faceDescriptor.length === 128).length;

  return (
    <div className="space-y-3">
      {/* Barra de Status e Controles da Câmera (Compacta) */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#004c99] flex items-center justify-center shrink-0">
            <ScanFace size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Terminal Ativo
              </span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                • {totalBiometricCount} biometrias
              </span>
              {/* Badge de Orientação Recomendada */}
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 text-[#004c99] text-[10px] font-bold rounded-full border border-blue-100" title="Recomendado para melhor experiência sem rolagem">
                <Monitor size={11} />
                Modo Paisagem (Horizontal)
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-gray-800 uppercase tracking-tight mt-0.5">
              Reconhecimento Facial na Portaria
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Seletor de Limiar de Sensibilidade */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 shadow-sm">
            <Shield size={13} className="text-[#004c99]" />
            <span className="text-[9px] font-black uppercase text-gray-400">Limiar:</span>
            <select
              value={selectedThreshold}
              onChange={(e) => setSelectedThreshold(Number(e.target.value))}
              className="text-[11px] bg-transparent font-black text-gray-700 outline-none cursor-pointer"
            >
              <option value={70}>70% (Rápido)</option>
              <option value={75}>75% (Padrão)</option>
              <option value={80}>80% (Alto)</option>
              <option value={85}>85% (Rigoroso)</option>
            </select>
          </div>

          {availableDevices.length > 1 && (
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="text-[11px] bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 font-bold text-gray-700 outline-none"
            >
              {availableDevices.map((device, idx) => (
                <option key={device.deviceId || idx} value={device.deviceId}>
                  {device.label || `Câmera ${idx + 1}`}
                </option>
              ))}
            </select>
          )}

          {onResetBiometrics && (
            <button
              type="button"
              disabled={isResettingBiometrics}
              onClick={async () => {
                if (window.confirm('Deseja realmente zerar todos os cadastros de biometria facial? Isso removerá os descritores faciais salvos para que você possa recadastrar do zero.')) {
                  setIsResettingBiometrics(true);
                  try {
                    await onResetBiometrics();
                    handleRetryScan();
                    alert('Biometrias faciais zeradas com sucesso!');
                  } catch (e) {
                    alert('Erro ao zerar biometrias.');
                  } finally {
                    setIsResettingBiometrics(false);
                  }
                }
              }}
              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1 disabled:opacity-50"
              title="Zera todos os cadastros biométricos da instituição"
            >
              <X size={13} />
              Zerar Biometrias
            </button>
          )}

          <button
            type="button"
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            title={voiceEnabled ? 'Voz de confirmação ligada' : 'Voz de confirmação desligada'}
            className={`p-2 rounded-xl border transition-all ${
              voiceEnabled ? 'bg-blue-50 border-blue-200 text-[#004c99]' : 'bg-gray-50 border-gray-200 text-gray-400'
            }`}
          >
            {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          <button
            type="button"
            onClick={startCamera}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5"
          >
            <RefreshCw size={12} className={isProcessing ? 'animate-spin' : ''} />
            Reiniciar Câmera
          </button>
        </div>
      </div>

      {/* Grid Principal: Vídeo Câmera + HUD e Painel de Ação Imediata (Modo Totem Fullscreen) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-stretch">
        
        {/* Lado Esquerdo: Feed da Câmera com Overlay Biométrico HUD */}
        <div className="lg:col-span-7 bg-gray-900 rounded-2xl sm:rounded-3xl overflow-hidden relative shadow-xl h-[320px] sm:h-[420px] lg:h-[calc(100vh-160px)] lg:min-h-[420px] lg:max-h-[660px] flex items-center justify-center border-2 border-slate-700/60">
          {cameraError ? (
            <div className="p-6 text-center text-white max-w-md space-y-3">
              <CameraOff size={40} className="mx-auto text-rose-400" />
              <h3 className="text-base font-black uppercase tracking-wider">Câmera Indisponível</h3>
              <p className="text-xs text-gray-300">{cameraError}</p>
              <button
                type="button"
                onClick={startCamera}
                className="px-5 py-2.5 bg-[#004c99] hover:bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              >
                Tentar Novamente
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Moldura Guia de Enquadramento Facial (HUD) */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                <div className={`relative w-44 h-56 sm:w-56 sm:h-70 rounded-[48%] border-2 transition-all duration-300 ${
                  matchedVisitor
                    ? 'border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.5)] scale-105'
                    : lastDetection?.detected
                    ? 'border-blue-400 shadow-[0_0_20px_rgba(96,165,250,0.4)]'
                    : 'border-white/30 border-dashed'
                }`}>
                  {/* Cantoneiras HUD */}
                  <div className="absolute -top-2 -left-2 w-5 h-5 border-t-4 border-l-4 border-blue-400 rounded-tl-lg"></div>
                  <div className="absolute -top-2 -right-2 w-5 h-5 border-t-4 border-r-4 border-blue-400 rounded-tr-lg"></div>
                  <div className="absolute -bottom-2 -left-2 w-5 h-5 border-b-4 border-l-4 border-blue-400 rounded-bl-lg"></div>
                  <div className="absolute -bottom-2 -right-2 w-5 h-5 border-b-4 border-r-4 border-blue-400 rounded-br-lg"></div>

                  {/* Linha de Varredura Laser quando detecta rosto */}
                  {lastDetection?.detected && !matchedVisitor && (
                    <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-bounce opacity-80"></div>
                  )}
                </div>

                {/* Badge Inferior sobre o Feed */}
                <div className="mt-3 px-3.5 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-white/10 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 max-w-[92%] text-center justify-center">
                  {matchedVisitor ? (
                    <span className="text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="shrink-0" />
                      {matchConfidence}% Reconhecido: {matchedVisitor.name}
                    </span>
                  ) : unrecognizedFace ? (
                    <span className="text-rose-400 flex items-center gap-1.5">
                      <AlertCircle size={13} className="shrink-0" />
                      Rosto Não Reconhecido na Base
                    </span>
                  ) : lastDetection?.detected ? (
                    <div className="flex items-center gap-2">
                      <div className="w-14 bg-gray-700 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-blue-400 h-full transition-all duration-200"
                          style={{ width: `${scanProgress}%` }}
                        />
                      </div>
                      {bestCandidatePreview ? (
                        <span className="text-amber-300 flex items-center gap-1 truncate max-w-[200px]">
                          Avaliando: {bestCandidatePreview.similarity}% com {bestCandidatePreview.name} ({scanSecondsLeft}s)
                        </span>
                      ) : (
                        <span className="text-blue-300 flex items-center gap-1">
                          <Sparkles size={12} className="animate-spin text-blue-300 shrink-0" />
                          Escaneando face... ({scanSecondsLeft}s)
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-300">Posicione o rosto dentro da moldura</span>
                  )}
                </div>
              </div>

              {/* Botões Rápidos de Ação sobre a Câmera */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-auto gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickLinkModal(true)}
                  disabled={!lastDetection?.detected && !unrecognizedFace}
                  className="px-3.5 py-2 bg-white/90 hover:bg-white text-gray-800 text-[10px] font-black uppercase tracking-wider rounded-xl backdrop-blur-md shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <UserCheck size={13} className="text-[#004c99]" />
                  Vincular a Visitante
                </button>

                <button
                  type="button"
                  onClick={() => setShowQuickNewModal(true)}
                  disabled={!lastDetection?.detected && !unrecognizedFace}
                  className="px-3.5 py-2 bg-[#004c99] hover:bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <UserPlus size={13} />
                  Cadastro Rápido
                </button>
              </div>
            </>
          )}
        </div>

        {/* Lado Direito: Card de Identificação e Liberação de Entrada (Compacto e Enquadrado) */}
        <div className="lg:col-span-5 flex flex-col justify-between h-auto lg:h-[calc(100vh-160px)] lg:min-h-[420px] lg:max-h-[660px] overflow-y-auto custom-scrollbar">
          {confirmedSuccess ? (
            <div className="bg-emerald-50 border-2 border-emerald-400 p-6 sm:p-8 rounded-2xl sm:rounded-3xl text-center space-y-3 animate-in zoom-in duration-300 h-full flex flex-col items-center justify-center">
              <div className="w-14 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-200">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-lg sm:text-xl font-black text-emerald-900 uppercase tracking-tight">Entrada Liberada!</h3>
              <p className="text-xs font-bold text-emerald-700">{confirmedSuccess}</p>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                Registro gravado no Livro de Portaria às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          ) : matchedVisitor ? (
            /* Card do Visitante Reconhecido */
            <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border-2 border-emerald-300 shadow-lg space-y-4 animate-in slide-in-from-right duration-300 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-widest rounded-full">
                    <CheckCircle2 size={12} /> {matchConfidence}% Compatibilidade
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMatchedVisitor(null);
                      setMatchConfidence(0);
                    }}
                    className="text-gray-400 hover:text-gray-600 p-1"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="flex items-center gap-3.5 mt-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-gray-100 border-2 border-emerald-500 shadow-md shrink-0 flex items-center justify-center">
                    {matchedVisitor.photoUrl || lastDetection?.thumbnailDataUrl ? (
                      <img
                        src={matchedVisitor.photoUrl || lastDetection?.thumbnailDataUrl}
                        alt={matchedVisitor.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User size={28} className="text-gray-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base sm:text-lg font-black text-gray-900 uppercase tracking-tight truncate">{matchedVisitor.name}</h3>
                    <p className="text-xs font-bold text-[#004c99] uppercase tracking-wide truncate">
                      {matchedVisitor.type === 'residente' && `Visita: ${matchedVisitor.residentName || 'Residente'} (${matchedVisitor.kinship || 'Familiar'})`}
                      {matchedVisitor.type === 'ssvp' && `Membro SSVP (${matchedVisitor.conferenceName || 'Conferência'})`}
                      {matchedVisitor.type === 'orgao_fiscalizador' && `Órgão: ${matchedVisitor.agencyName || 'Fiscalização'}`}
                      {matchedVisitor.type === 'instituicao' && 'Visita Institucional'}
                    </p>
                    {matchedVisitor.document && (
                      <p className="text-[10px] font-bold text-gray-400 mt-0.5">Doc: {matchedVisitor.document}</p>
                    )}
                  </div>
                </div>

                {/* Campo Opcional de Observação / Motivo */}
                <div className="mt-4 space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest block">
                    Observação da Portaria (Opcional)
                  </label>
                  <input
                    type="text"
                    value={entryObservation}
                    onChange={(e) => setEntryObservation(e.target.value)}
                    placeholder="Ex: Entrega de remédio, visita..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-[#004c99]/20"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleConfirmRecognizedEntry}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  Confirmar Entrada
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMatchedVisitor(null);
                    setMatchConfidence(0);
                  }}
                  className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all"
                >
                  Não é esta pessoa (Cancelar)
                </button>
              </div>
            </div>
          ) : unrecognizedFace ? (
            /* Card de Rosto Não Identificado após 3.0 segundos de Varredura */
            <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border-2 border-rose-300 shadow-lg space-y-4 animate-in slide-in-from-right duration-300 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2.5 border-b border-gray-100">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-black uppercase tracking-widest rounded-full">
                    <AlertCircle size={11} /> Rosto Não Identificado (3.0s)
                  </span>
                  <button
                    type="button"
                    onClick={handleRetryScan}
                    className="text-gray-400 hover:text-gray-600 p-1"
                    title="Fechar alerta e tentar novamente"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="flex items-center gap-3.5 mt-3">
                  <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl overflow-hidden bg-gray-100 border-2 border-rose-300 shadow-md shrink-0 flex items-center justify-center">
                    {unrecognizedFace.photoUrl ? (
                      <img
                        src={unrecognizedFace.photoUrl}
                        alt="Rosto Não Reconhecido"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User size={28} className="text-gray-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">Rosto Não Reconhecido</h3>
                    <p className="text-xs text-gray-600 mt-0.5 leading-tight">
                      Nenhum cadastro compatível encontrado nesta instituição.
                    </p>
                    {unrecognizedFace.bestCandidateName && unrecognizedFace.bestSimilarity && unrecognizedFace.bestSimilarity > 20 ? (
                      <p className="text-[10px] font-bold text-amber-700 mt-1 truncate">
                        Mais próximo: {unrecognizedFace.bestSimilarity}% ({unrecognizedFace.bestCandidateName})
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 p-3 bg-rose-50 rounded-xl border border-rose-200 text-[11px] text-rose-950 font-bold leading-tight">
                  ❓ <strong>Deseja cadastrar este visitante ou tentar novamente?</strong>
                </div>
              </div>

              {/* Ações Imediatas */}
              <div className="space-y-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleRetryScan}
                  className="w-full py-2.5 bg-gray-800 hover:bg-black text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1.5"
                >
                  <RefreshCw size={14} />
                  Tentar Novamente
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShowQuickNewModal(true)}
                    className="py-2.5 bg-[#004c99] hover:bg-blue-700 text-white rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 shadow-sm"
                  >
                    <UserPlus size={13} />
                    Cadastrar Novo
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowQuickLinkModal(true)}
                    className="py-2.5 bg-blue-50 hover:bg-blue-100 text-[#004c99] border border-blue-200 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1"
                  >
                    <UserCheck size={13} />
                    Vincular Existente
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Estado de Espera / Escaneamento em Andamento (Enquadrado) */
            <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm space-y-4 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#004c99] flex items-center justify-center">
                    <ScanFace size={20} />
                  </div>
                  {lastDetection?.detected && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 text-[#004c99] text-[10px] font-black uppercase tracking-wider rounded-full border border-blue-100">
                      <Sparkles size={11} className="animate-spin" /> Varredura: {scanSecondsLeft}s
                    </span>
                  )}
                </div>

                <h3 className="text-base font-black text-gray-800 uppercase tracking-tight mt-3">
                  {lastDetection?.detected ? 'Escaneando Visitante...' : 'Aguardando Visitante'}
                </h3>
                
                {lastDetection?.detected ? (
                  <div className="mt-2.5 space-y-1.5">
                    <p className="text-xs text-gray-600 font-medium">
                      Comparando face com a base biométrica cadastrada...
                    </p>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-[#004c99] h-full transition-all duration-200"
                        style={{ width: `${scanProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                    Ao olhar para a câmera, a identificação ocorrerá automaticamente em até 3,0 segundos.
                  </p>
                )}

                <div className="mt-4 space-y-2">
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-2.5">
                    <UserPlus size={15} className="text-[#004c99] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-[11px] font-black uppercase text-gray-800 tracking-tight">Visitante sem Biometria?</h4>
                      <p className="text-[10px] text-gray-500 font-medium mt-0.5">
                        Clique em <strong>"Vincular"</strong> ou <strong>"Cadastro Rápido"</strong> para salvar o rosto em 1 clique.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-2.5">
                    <Shield size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-[11px] font-black uppercase text-gray-800 tracking-tight">Privacidade Garantida</h4>
                      <p className="text-[10px] text-gray-500 font-medium mt-0.5">
                        Biometria calculada localmente na portaria com máxima segurança e conformidade LGPD.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Vincular Rosto a Visitante Cadastrado Existente */}
      {showQuickLinkModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">Vincular Rosto Atual</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                  Selecione o visitante para associar a foto capturada
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickLinkModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400"
              >
                <X size={20} />
              </button>
            </div>

            {/* Foto Capturada */}
            {(unrecognizedFace?.photoUrl || lastDetection?.thumbnailDataUrl) && (
              <div className="flex items-center gap-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                <img
                  src={unrecognizedFace?.photoUrl || lastDetection?.thumbnailDataUrl}
                  alt="Rosto Capturado"
                  className="w-16 h-16 rounded-xl object-cover border-2 border-[#004c99] shadow-sm"
                />
                <div>
                  <span className="text-[10px] font-black uppercase text-[#004c99] tracking-wider">Foto Capturada com Sucesso</span>
                  <p className="text-xs text-gray-600 font-medium mt-0.5">
                    Esta imagem será usada para identificar o visitante nas próximas visitas.
                  </p>
                </div>
              </div>
            )}

            {/* Busca do Visitante */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={linkSearchTerm}
                onChange={(e) => setLinkSearchTerm(e.target.value)}
                placeholder="Buscar por nome do visitante ou residente..."
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#004c99]/20"
              />
            </div>

            {/* Lista de Visitantes */}
            <div className="flex-1 overflow-y-auto max-h-60 space-y-2 pr-1 custom-scrollbar">
              {filteredVisitorsToLink.length > 0 ? (
                filteredVisitorsToLink.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVisitorToLink(v)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                      selectedVisitorToLink?.id === v.id
                        ? 'bg-blue-50 border-[#004c99] text-[#004c99]'
                        : 'bg-white border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-black uppercase tracking-tight text-gray-900">{v.name}</p>
                      <p className="text-[10px] font-bold text-gray-500">
                        {v.type === 'residente' && `Familiar de: ${v.residentName || 'Residente'} (${v.kinship || 'Parentesco'})`}
                        {v.type === 'ssvp' && `SSVP: ${v.conferenceName || 'Conferência'}`}
                        {v.type === 'orgao_fiscalizador' && `Órgão: ${v.agencyName || 'Fiscalização'}`}
                        {v.type === 'instituicao' && 'Institucional'}
                      </p>
                    </div>
                    {v.faceDescriptor && (
                      <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                        Já tem foto
                      </span>
                    )}
                  </button>
                ))
              ) : (
                <p className="text-center text-xs text-gray-400 py-6">Nenhum visitante encontrado com esse nome.</p>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => setShowQuickLinkModal(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl text-xs font-black uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveQuickLink}
                disabled={!selectedVisitorToLink}
                className="flex-1 py-3 bg-[#004c99] hover:bg-blue-800 disabled:opacity-40 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg"
              >
                Confirmar Vínculo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Cadastro Novo Visitante Rápido na Portaria */}
      {showQuickNewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">Cadastro Rápido na Portaria</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                  Cadastre o visitante e libere a entrada em 1 etapa
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickNewModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400"
              >
                <X size={20} />
              </button>
            </div>

            {/* Foto Capturada e Controle Manual */}
            {(manualCapturedThumb || unrecognizedFace?.photoUrl || lastDetection?.thumbnailDataUrl) ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
                <div className="flex items-center gap-3.5">
                  <img
                    src={manualCapturedThumb || unrecognizedFace?.photoUrl || lastDetection?.thumbnailDataUrl}
                    alt="Rosto Capturado"
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-600 shadow-sm shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 text-emerald-800 font-black text-xs uppercase">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <span>Biometria & Foto Prontas</span>
                    </div>
                    <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
                      Rosto registrado com sucesso para o reconhecimento facial.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCaptureManualPhotoInModal}
                  disabled={isCapturingInModal}
                  className="px-3.5 py-2 bg-white hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-300 shadow-sm flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  <Camera size={15} />
                  {isCapturingInModal ? 'Capturando...' : 'Recapturar Foto'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-700 shrink-0">
                    <Camera size={22} />
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase text-amber-900 block">Nenhuma foto capturada</span>
                    <p className="text-[11px] text-amber-700">Posicione o visitante em frente à câmera e clique no botão ao lado.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCaptureManualPhotoInModal}
                  disabled={isCapturingInModal}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-2 shrink-0"
                >
                  <Camera size={16} />
                  {isCapturingInModal ? 'Capturando...' : 'Tirar Foto Agora'}
                </button>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest block mb-1.5">Perfil da Visita</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickType('residente')}
                    className={`p-3 rounded-xl border text-xs font-black uppercase tracking-tight flex items-center gap-2 ${
                      quickType === 'residente' ? 'bg-blue-50 border-[#004c99] text-[#004c99]' : 'bg-gray-50 border-gray-200 text-gray-600'
                    }`}
                  >
                    <User size={14} /> Residente
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickType('instituicao')}
                    className={`p-3 rounded-xl border text-xs font-black uppercase tracking-tight flex items-center gap-2 ${
                      quickType === 'instituicao' ? 'bg-blue-50 border-[#004c99] text-[#004c99]' : 'bg-gray-50 border-gray-200 text-gray-600'
                    }`}
                  >
                    <Building2 size={14} /> Institucional
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickType('ssvp')}
                    className={`p-3 rounded-xl border text-xs font-black uppercase tracking-tight flex items-center gap-2 ${
                      quickType === 'ssvp' ? 'bg-blue-50 border-[#004c99] text-[#004c99]' : 'bg-gray-50 border-gray-200 text-gray-600'
                    }`}
                  >
                    <HeartHandshake size={14} /> SSVP
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickType('orgao_fiscalizador')}
                    className={`p-3 rounded-xl border text-xs font-black uppercase tracking-tight flex items-center gap-2 ${
                      quickType === 'orgao_fiscalizador' ? 'bg-blue-50 border-[#004c99] text-[#004c99]' : 'bg-gray-50 border-gray-200 text-gray-600'
                    }`}
                  >
                    <Shield size={14} /> Fiscalização
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest block mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  placeholder="Ex: Maria das Graças Silva"
                  className="w-full p-3.5 bg-gray-50 border rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#004c99]/20"
                />
              </div>

              {quickType === 'residente' && (
                <>
                  <div>
                    <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest block mb-1">Residente a ser visitado *</label>
                    <select
                      value={quickResidentId}
                      onChange={(e) => setQuickResidentId(e.target.value)}
                      className="w-full p-3.5 bg-gray-50 border rounded-2xl text-xs font-bold outline-none"
                    >
                      <option value="">Selecione o residente...</option>
                      {residents.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest block mb-1">Grau de Parentesco / Vínculo</label>
                    <input
                      type="text"
                      value={quickKinship}
                      onChange={(e) => setQuickKinship(e.target.value)}
                      placeholder="Ex: Filha, Sobrinho, Amiga..."
                      className="w-full p-3 bg-gray-50 border rounded-2xl text-xs font-bold outline-none"
                    />
                  </div>
                </>
              )}

              {quickType === 'ssvp' && (
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest block mb-1">Conferência / Conselho</label>
                  <input
                    type="text"
                    value={quickConference}
                    onChange={(e) => setQuickConference(e.target.value)}
                    placeholder="Ex: Conferência São Vicente de Paulo"
                    className="w-full p-3 bg-gray-50 border rounded-2xl text-xs font-bold outline-none"
                  />
                </div>
              )}

              {quickType === 'orgao_fiscalizador' && (
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest block mb-1">Órgão / Entidade</label>
                  <input
                    type="text"
                    value={quickAgency}
                    onChange={(e) => setQuickAgency(e.target.value)}
                    placeholder="Ex: Vigilância Sanitária Municipal"
                    className="w-full p-3 bg-gray-50 border rounded-2xl text-xs font-bold outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest block mb-1">CPF / RG (Opcional)</label>
                  <input
                    type="text"
                    value={quickDoc}
                    onChange={(e) => setQuickDoc(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full p-3 bg-gray-50 border rounded-2xl text-xs font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest block mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={quickPhone}
                    onChange={(e) => setQuickPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full p-3 bg-gray-50 border rounded-2xl text-xs font-bold outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => setShowQuickNewModal(false)}
                className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl text-xs font-black uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveQuickNewVisitor}
                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 size={16} /> Salvar & Liberar Entrada
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
