import React from "react";
import {
  Plus,
  ChevronRight,
  Search,
  Clock,
  UserCheck,
  Archive,
  ArrowRight,
  Save,
  Trash2,
  ClipboardList,
  HeartPulse,
  Scale,
  Printer,
  Eye,
  ArrowLeft,
  X,
  FileText,
  Calendar,
  AlertCircle,
  LayoutGrid,
  Info,
  CheckCircle2,
  Phone,
  MapPin,
  Users,
  FileDown,
  Bed,
} from "lucide-react";
import RoomMappingModal from "./RoomMappingModal";
import {
  Candidate,
  CandidateStage,
  WaitlistPriority,
  FamilyMemberRecord,
  Resident,
  InterviewData,
  InstitutionSettings,
  NursingScreening,
} from "../types";
import { INITIAL_CANDIDATE, INITIAL_NURSING_SCREENING } from "../constants";

interface ScreeningModuleProps {
  candidates: Candidate[];
  onSave: (candidate: Candidate) => void;
  onBulkSave: (candidates: Candidate[]) => void;
  onDelete: (candidateId: string) => void;
  residents: Resident[];
  onAdmit: (candidate: Candidate) => void;
  settings?: InstitutionSettings | null;
}

const STAGE_THEMES: Record<
  string,
  { active: string; text: string; bg: string; border: string; iconBg: string }
> = {
  indigo: {
    active: "border-indigo-500 bg-indigo-50/50",
    text: "text-indigo-600",
    bg: "bg-indigo-500",
    border: "border-indigo-100",
    iconBg: "bg-indigo-50",
  },
  blue: {
    active: "border-blue-500 bg-blue-50/50",
    text: "text-blue-600",
    bg: "bg-blue-500",
    border: "border-blue-100",
    iconBg: "bg-blue-50",
  },
  orange: {
    active: "border-orange-500 bg-orange-50/50",
    text: "text-orange-600",
    bg: "bg-orange-500",
    border: "border-orange-100",
    iconBg: "bg-orange-50",
  },
  purple: {
    active: "border-purple-500 bg-purple-50/50",
    text: "text-purple-600",
    bg: "bg-purple-500",
    border: "border-purple-100",
    iconBg: "bg-purple-50",
  },
  teal: {
    active: "border-teal-500 bg-teal-600/50",
    text: "text-teal-600",
    bg: "bg-teal-500",
    border: "border-teal-100",
    iconBg: "bg-teal-50",
  },
  pink: {
    active: "border-pink-500 bg-pink-50/50",
    text: "text-pink-600",
    bg: "bg-pink-500",
    border: "border-pink-100",
    iconBg: "bg-pink-50",
  },
  green: {
    active: "border-green-500 bg-green-50/50",
    text: "text-green-600",
    bg: "bg-green-500",
    border: "border-green-100",
    iconBg: "bg-green-50",
  },
  red: {
    active: "border-red-500 bg-red-50/50",
    text: "text-red-600",
    bg: "bg-red-500",
    border: "border-red-100",
    iconBg: "bg-red-50",
  },
};

const ScreeningModule: React.FC<ScreeningModuleProps> = ({
  candidates,
  onSave,
  onBulkSave,
  onDelete,
  residents,
  onAdmit,
  settings,
}) => {
  const [editingCandidate, setEditingCandidate] =
    React.useState<Candidate | null>(null);
  const [managingCandidate, setManagingCandidate] =
    React.useState<Candidate | null>(null);
  const [isCreatingSimple, setIsCreatingSimple] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedStage, setSelectedStage] =
    React.useState<CandidateStage>("agendamentos");
  const [isMappingOpen, setIsMappingOpen] = React.useState(false);

  // MOCK DATA PARA VISUALIZAÇÃO (APENAS EM MEMÓRIA)
  const mockCandidates: Candidate[] = React.useMemo(() => {
    const names = ["João Pereira", "Maria Fernandes", "Antônio Souza"];
    const stages: CandidateStage[] = [
      "aguardando_vaga",
      "decisao_diretoria",
      "avaliacao_medica",
      "integracao",
    ];

    const mocks: Candidate[] = [];
    stages.forEach((stage, sIdx) => {
      names.forEach((name, nIdx) => {
        mocks.push({
          ...INITIAL_CANDIDATE,
          id: `MOCK-${stage}-${nIdx}`,
          name,
          age: (70 + nIdx * 5 + sIdx).toString(),
          address: `Rua Mock ${nIdx + 1}, Bairro Teste`,
          phone: "(16) 99999-9999",
          stage,
          priority:
            nIdx === 0
              ? "social_urgente"
              : nIdx === 1
                ? "dependencia_duvidosa"
                : "padrao",
          createdAt: new Date().toISOString(),
          boardOpinion:
            stage !== "aguardando_vaga"
              ? "Parecer favorável da diretoria em ata."
              : "",
          medicalStatus: stage === "integracao" ? "favoravel" : undefined,
          medicalOpinion:
            stage === "integracao"
              ? "Paciente apto para convívio coletivo."
              : "",
          contractStatus:
            stage === "integracao" && nIdx === 1 ? "assinado" : "pendente",
          integrationDate:
            stage === "integracao"
              ? new Date().toISOString().split("T")[0]
              : undefined,
        });
      });
    });
    return mocks;
  }, []);

  const allCandidates = React.useMemo(() => {
    if (candidates.length > 0) return candidates;
    return mockCandidates;
  }, [candidates, mockCandidates]);

  const stages: {
    id: CandidateStage;
    label: string;
    icon: any;
    color: string;
    description: string;
  }[] = [
    {
      id: "agendamentos",
      label: "0. Agendamentos",
      icon: Calendar,
      color: "indigo",
      description: "Pessoas aguardando visita ou entrevista inicial.",
    },
    {
      id: "entrevista",
      label: "1. Entrevistas",
      icon: ClipboardList,
      color: "blue",
      description: "Coleta de dados iniciais e visita social.",
    },
    {
      id: "aguardando_vaga",
      label: "2. Fila de Espera",
      icon: Clock,
      color: "orange",
      description: "Aptos aguardando vaga disponível.",
    },
    {
      id: "decisao_diretoria",
      label: "3. Diretoria",
      icon: Scale,
      color: "purple",
      description: "Análise de prioridade em ata de reunião.",
    },
    {
      id: "avaliacao_medica",
      label: "4. Médico/Parecer",
      icon: HeartPulse,
      color: "teal",
      description: "Avaliação clínica de compatibilidade.",
    },
    {
      id: "integracao",
      label: "5. Integração",
      icon: Calendar,
      color: "pink",
      description: "Contratos e tarde de experiência.",
    },
    {
      id: "arquivado",
      label: "Casos Arquivados",
      icon: Archive,
      color: "red",
      description: "Processos encerrados ou idosos inaptos.",
    },
  ];

  const handleExportPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const allStages = [
      ...stages,
      { id: "acolhido" as CandidateStage, label: "Acolhidos", color: "green" },
    ];

    let html = `
      <html>
        <head>
          <title>Relatório de Candidatos - SSVP</title>
          <style>
            body { font-family: 'Inter', system-ui, sans-serif; padding: 30px; color: #1e293b; line-height: 1.5; }
            .header { text-align: center; border-bottom: 3px solid #004c99; margin-bottom: 40px; padding-bottom: 20px; }
            .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; color: #004c99; font-weight: 900; letter-spacing: -0.5px; }
            .header p { margin: 8px 0 0; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
            .stage-section { margin-bottom: 50px; page-break-inside: avoid; }
            .stage-title { font-size: 14px; font-weight: 900; text-transform: uppercase; margin-bottom: 15px; display: flex; justify-content: space-between; border-left: 6px solid #004c99; padding-left: 15px; background: #f8fafc; padding: 10px 15px; border-radius: 0 8px 8px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
            th { background: #f1f5f9; border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-weight: 900; text-transform: uppercase; color: #475569; }
            td { border: 1px solid #e2e8f0; padding: 10px; vertical-align: top; }
            tr:nth-child(even) { background: #f8fafc; }
            .priority-tag { font-size: 8px; font-weight: 900; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; border: 1px solid #e2e8f0; background: #fff; }
            .footer { margin-top: 50px; font-size: 9px; text-align: center; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Relatório de Candidatos por Status</h1>
            <p>Lar São Vicente de Paulo - Monte Alto/SP | Emitido em: ${new Date().toLocaleString("pt-BR")}</p>
          </div>
    `;

    allStages.forEach((stage) => {
      const stageCandidates = allCandidates.filter((c) => c.stage === stage.id);
      if (stageCandidates.length > 0) {
        html += `
          <div class="stage-section">
            <div class="stage-title">
              <span>${stage.label}</span>
              <span style="color: #64748b; font-weight: 700">Total: ${stageCandidates.length}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 25%">Nome do Candidato</th>
                  <th style="width: 15%">Telefone</th>
                  <th style="width: 30%">Localização / Endereço</th>
                  <th style="width: 15%">Data Contato</th>
                  <th style="width: 15%">Prioridade</th>
                </tr>
              </thead>
              <tbody>
        `;
        stageCandidates.forEach((cand) => {
          const priorityLabel =
            cand.priority === "social_urgente"
              ? "SOCIAL (URGENTE)"
              : cand.priority === "dependencia_duvidosa"
                ? "DEP. DUVIDOSA"
                : cand.priority === "padrao"
                  ? "PRIORIDADE PADRÃO"
                  : "-";
          html += `
            <tr>
              <td style="font-weight: 800; color: #0f172a; text-transform: uppercase">${cand.name}</td>
              <td>${cand.phone || "-"}</td>
              <td style="font-style: italic">${cand.address || "-"}</td>
              <td>${cand.scheduledDate ? new Date(cand.scheduledDate).toLocaleDateString("pt-BR") : "-"}</td>
              <td><span class="priority-tag">${priorityLabel}</span></td>
            </tr>
          `;
        });
        html += `</tbody></table></div>`;
      }
    });

    html += `
          <div class="footer">Este documento é de uso interno da SSVP e contém dados sensíveis.</div>
        </body>
      </html>
    `;
      printWindow.document.write(html);
      printWindow.document.close();
      
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };

      // Fallback
      setTimeout(() => {
        if (printWindow) {
          printWindow.focus();
          printWindow.print();
        }
      }, 1000);
    };

  const getStageCandidates = (stage: CandidateStage) =>
    allCandidates.filter((c) => {
      const matchesSearch = c.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      return c.stage === stage && matchesSearch;
    });

  const archivedCandidates = allCandidates.filter(
    (c) => c.stage === "arquivado",
  );
  const admittedCandidates = allCandidates.filter(
    (c) => c.stage === "acolhido",
  );

  const handleSaveSimpleAppointment = (data: Partial<Candidate>) => {
    const newCandidate: Candidate = {
      ...INITIAL_CANDIDATE,
      id: `C${Date.now()}`,
      name: data.name || "",
      phone: data.phone || "",
      address: data.address || "",
      requestOrigin: data.requestOrigin || "CONTATO DIRETO",
      requestDescription: data.requestDescription || "",
      scheduledDate:
        data.scheduledDate || new Date().toISOString().split("T")[0],
      stage: "agendamentos",
      createdAt: new Date().toISOString(),
    };
    onSave(newCandidate);
    setIsCreatingSimple(false);
    setSelectedStage("agendamentos");
  };

  if (editingCandidate) {
    return (
      <CandidateForm
        candidate={editingCandidate}
        onSave={(data) => {
          onSave(data);
          setEditingCandidate(null);
        }}
        onCancel={() => setEditingCandidate(null)}
        onAdmit={() => {
          onAdmit(editingCandidate);
          setEditingCandidate(null);
        }}
      />
    );
  }

  const activeStageData = stages.find((s) => s.id === selectedStage);
  const ActiveIcon = activeStageData?.icon || LayoutGrid;

  // Cálculos de ocupação e vagas
  const maleCount = residents.filter(r => (r.gender || '').toLowerCase() === 'masculino').length;
  const femaleCount = residents.filter(r => (r.gender || '').toLowerCase() === 'feminino').length;
  
  const capMale = Number(settings?.capacityMale) || 0;
  const capFemale = Number(settings?.capacityFemale) || 0;
  const capGeneral = Number(settings?.capacityGeneral) || 0;

  const maleVacancies = capMale > 0 
    ? Math.max(0, capMale - maleCount) 
    : (capGeneral > 0 ? Math.max(0, Math.floor((capGeneral - residents.length) / 2)) : 0);

  const femaleVacancies = capFemale > 0 
    ? Math.max(0, capFemale - femaleCount) 
    : (capGeneral > 0 ? Math.max(0, Math.ceil((capGeneral - residents.length) / 2)) : 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header Superior */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm no-print gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">
            Fluxo de Triagem
          </h1>
          <p className="text-[11px] font-bold text-gray-400 uppercase mt-1">
            Gestão Social e Processos de Admissão
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-center w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300"
              size={16}
            />
            <input
              type="text"
              placeholder="Buscar candidato..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-xs font-bold"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handleExportPDF}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-all font-black text-xs uppercase shadow-sm"
              title="Gerar listagem completa por status"
            >
              <FileDown size={18} />
              <span>Exportar PDF</span>
            </button>

            <button
              onClick={() => setIsMappingOpen(true)}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-all font-black text-xs uppercase shadow-sm"
              title="Ver mapeamento de leitos"
            >
              <Bed size={18} />
              <span>Quartos/Leitos</span>
            </button>

            <button
              onClick={() => setIsCreatingSimple(true)}
              className="flex-1 sm:flex-none bg-[#004c99] hover:bg-blue-800 text-white px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all font-black text-xs uppercase"
            >
              <Plus size={18} />
              <span>Novo Agendamento</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cards de Resumo de Ocupação */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        {/* Card 1: Homens */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 group hover:shadow-md transition-all">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
            <Users size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Acolhidos (H)</p>
            <h4 className="text-2xl font-black text-gray-900 tracking-tighter">{maleCount}</h4>
          </div>
        </div>
        
        {/* Card 2: Mulheres */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 group hover:shadow-md transition-all">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl group-hover:scale-110 transition-transform">
            <Users size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Acolhidas (M)</p>
            <h4 className="text-2xl font-black text-gray-900 tracking-tighter">{femaleCount}</h4>
          </div>
        </div>

        {/* Card 3: Vagas Masculinas */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 group hover:shadow-md transition-all">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
            <LayoutGrid size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Vagas (H)</p>
            <h4 className={`text-2xl font-black tracking-tighter ${maleVacancies > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {maleVacancies}
            </h4>
          </div>
        </div>

        {/* Card 4: Vagas Femininas */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 group hover:shadow-md transition-all">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl group-hover:scale-110 transition-transform">
            <LayoutGrid size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Vagas (M)</p>
            <h4 className={`text-2xl font-black tracking-tighter ${femaleVacancies > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {femaleVacancies}
            </h4>
          </div>
        </div>
      </div>

      {/* Tabs de Status */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 no-print overflow-x-auto pb-2 no-scrollbar">
        {stages.map((stage) => {
          const count = allCandidates.filter(
            (c) => c.stage === stage.id,
          ).length;
          const isActive = selectedStage === stage.id;
          const theme = STAGE_THEMES[stage.color];
          const StageIcon = stage.icon;

          return (
            <button
              key={stage.id}
              onClick={() => setSelectedStage(stage.id)}
              className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col gap-2 group relative overflow-hidden h-full ${
                isActive
                  ? `${theme.active} border-${stage.color}-500 shadow-lg`
                  : "bg-white border-transparent hover:border-gray-200 shadow-sm"
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${isActive ? `${theme.bg} text-white` : "bg-gray-50 text-gray-400 group-hover:bg-gray-100"}`}
              >
                <StageIcon size={18} />
              </div>
              <div>
                <div className="text-[8px] font-black uppercase text-gray-400 tracking-widest leading-tight">
                  {stage.label}
                </div>
                <div className="text-xl font-black text-gray-900 leading-none mt-0.5">
                  {count}
                </div>
              </div>
              {isActive && (
                <div
                  className={`absolute bottom-0 left-0 right-0 h-1 ${theme.bg}`}
                ></div>
              )}
            </button>
          );
        })}
      </div>

      {/* Lista Empilhada */}
      <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
        <div className="p-8 border-b bg-gray-50/30 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`p-3 rounded-2xl bg-white shadow-sm text-gray-900 border`}
            >
              <ActiveIcon size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 uppercase tracking-tighter">
                {activeStageData?.label}
              </h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {activeStageData?.description}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black text-gray-400 uppercase block">
              Cadastros
            </span>
            <span className="text-2xl font-black text-[#004c99]">
              {getStageCandidates(selectedStage).length}
            </span>
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {getStageCandidates(selectedStage).map((cand) => (
            <div
              key={cand.id}
              onClick={() => setManagingCandidate(cand)}
              className="p-6 flex items-center justify-between hover:bg-blue-50/20 cursor-pointer transition-all group"
            >
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 font-black text-sm uppercase group-hover:bg-[#004c99] group-hover:text-white transition-all shadow-inner border border-gray-100">
                  {cand.name.charAt(0)}
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-black text-gray-900 uppercase tracking-tight">
                    {cand.name}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-bold text-gray-400 uppercase">
                      Ficha: {cand.id.slice(-4)} • Criada em{" "}
                      {new Date(cand.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                    {cand.requestOrigin && (
                      <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase border bg-gray-50 text-gray-500 border-gray-100 flex items-center gap-1">
                        {cand.requestOrigin}
                      </span>
                    )}
                    {cand.priority && (
                      <span
                        className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase border ${
                          cand.priority === "social_urgente"
                            ? "bg-red-50 text-red-600 border-red-100"
                            : cand.priority === "dependencia_duvidosa"
                              ? "bg-orange-50 text-orange-600 border-orange-100"
                              : "bg-blue-50 text-blue-600 border-blue-100"
                        }`}
                      >
                        {cand.priority === "social_urgente"
                          ? "SOCIAL (URGENTE)"
                          : cand.priority === "dependencia_duvidosa"
                            ? "DEP. DUVIDOSA"
                            : "PADRÃO"}
                      </span>
                    )}
                    {cand.stage === "agendamentos" && cand.scheduledDate && (
                      <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase border bg-indigo-50 text-indigo-600 border-indigo-100 flex items-center gap-1">
                        <Clock size={10} />{" "}
                        {new Date(cand.scheduledDate).toLocaleDateString(
                          "pt-BR",
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right hidden lg:block border-r pr-6 border-gray-100">
                  <span className="text-[9px] font-black text-gray-300 uppercase block mb-0.5 tracking-widest">
                    Localização/Contato
                  </span>
                  <span className="text-[11px] font-medium text-gray-600 italic max-w-xs truncate block">
                    {cand.address
                      ? cand.address
                      : cand.phone
                        ? cand.phone
                        : "Sem detalhamento"}
                  </span>
                </div>
                <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase text-[#004c99] group-hover:bg-[#004c99] group-hover:text-white group-hover:shadow-lg transition-all">
                  Gerenciar Etapa <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ))}
          {getStageCandidates(selectedStage).length === 0 && (
            <div className="p-24 text-center flex flex-col items-center justify-center gap-4 opacity-20">
              <LayoutGrid size={48} strokeWidth={1} />
              <span className="text-xs font-black uppercase tracking-widest">
                Etapa vazia no momento
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Histórico e Acolhidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 no-print">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b flex items-center justify-between bg-red-50/10">
            <div className="flex items-center gap-3">
              <Archive size={18} className="text-red-400" />
              <h3 className="text-xs font-black uppercase text-gray-800 tracking-widest">
                Candidatos Arquivados
              </h3>
            </div>
            <span className="text-[10px] font-black bg-white px-3 py-1 rounded-full border border-red-100 text-red-500">
              {archivedCandidates.length}
            </span>
          </div>
          <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto no-scrollbar">
            {archivedCandidates.map((c) => (
              <div
                key={c.id}
                onClick={() => setManagingCandidate(c)}
                className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div>
                  <div className="text-[11px] font-black text-gray-700 uppercase">
                    {c.name}
                  </div>
                  <div className="text-[9px] font-bold text-red-400 uppercase">
                    {c.archiveReason || "Desistência"}
                  </div>
                </div>
                <Eye size={14} className="text-gray-300" />
              </div>
            ))}
            {archivedCandidates.length === 0 && (
              <div className="p-10 text-center text-[9px] font-bold uppercase text-gray-300 italic">
                Sem registros
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b flex items-center justify-between bg-green-50/10">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={18} className="text-green-500" />
              <h3 className="text-xs font-black uppercase text-gray-800 tracking-widest">
                Acolhimentos Recentes
              </h3>
            </div>
            <span className="text-[10px] font-black bg-white px-3 py-1 rounded-full border border-green-100 text-green-600">
              {admittedCandidates.length}
            </span>
          </div>
          <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto no-scrollbar">
            {admittedCandidates.map((c) => (
              <div
                key={c.id}
                onClick={() => setManagingCandidate(c)}
                className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div>
                  <div className="text-[11px] font-black text-gray-700 uppercase">
                    {c.name}
                  </div>
                  <div className="text-[9px] font-bold text-green-500 uppercase tracking-widest">
                    Matriculado
                  </div>
                </div>
                <Eye size={14} className="text-gray-300" />
              </div>
            ))}
            {admittedCandidates.length === 0 && (
              <div className="p-10 text-center text-[9px] font-bold uppercase text-gray-300 italic">
                Sem registros
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL SIMPLES DE CRIAÇÃO */}
      <RoomMappingModal 
        isOpen={isMappingOpen}
        onClose={() => setIsMappingOpen(false)}
        residents={residents}
        settings={settings}
      />

      {isCreatingSimple && (
        <SimpleAppointmentModal
          onClose={() => setIsCreatingSimple(false)}
          onSave={handleSaveSimpleAppointment}
        />
      )}

      {/* MODAL DE GESTÃO DE STATUS */}
      {managingCandidate && (
        <StatusManagementModal
          candidate={managingCandidate}
          onClose={() => setManagingCandidate(null)}
          onSave={(data) => {
            onSave(data);
            setManagingCandidate(null);
          }}
          onEdit={() => {
            setEditingCandidate(managingCandidate);
            setManagingCandidate(null);
          }}
          onOpenFullForm={(cand: Candidate) => {
            setEditingCandidate(cand);
            setManagingCandidate(null);
          }}
          onAdmit={(cand: Candidate) => {
            onAdmit(cand);
            setManagingCandidate(null);
          }}
          onDelete={(id: string) => {
            onDelete(id);
            setManagingCandidate(null);
          }}
        />
      )}
    </div>
  );
};

// --- MODAL SIMPLES DE AGENDAMENTO ---

function SimpleAppointmentModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const [data, setData] = React.useState({
    name: "",
    address: "",
    phone: "",
    requestOrigin: "CONTATO DIRETO" as any,
    requestDescription: "",
    scheduledDate: new Date().toISOString().split("T")[0],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.name || !data.phone || !data.scheduledDate) return;
    onSave(data);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 md:p-8 border-b bg-indigo-50/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-xl border border-indigo-100 flex-shrink-0">
              <Calendar size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">
                Novo Agendamento
              </h3>
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest hidden sm:block">
                Pré-Triagem / Registro Inicial
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-300 hover:text-gray-900 rounded-xl transition-all ml-2"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-10 space-y-6 overflow-y-auto flex-1">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
              Nome do Idoso *
            </label>
            <input
              required
              autoFocus
              value={data.name}
              onChange={(e) =>
                setData((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full p-4 border border-gray-200 rounded-xl text-xs font-black uppercase focus:ring-2 focus:ring-indigo-100 outline-none"
              placeholder="NOME COMPLETO..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
                Telefone Contato *
              </label>
              <div className="relative">
                <Phone
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"
                  size={14}
                />
                <input
                  required
                  value={data.phone}
                  onChange={(e) =>
                    setData((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  className="w-full pl-10 pr-4 py-4 border border-gray-200 rounded-xl text-xs font-black uppercase focus:ring-2 focus:ring-indigo-100 outline-none"
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
                Data do contato *
              </label>
              <input
                type="date"
                required
                value={data.scheduledDate}
                onChange={(e) =>
                  setData((prev) => ({
                    ...prev,
                    scheduledDate: e.target.value,
                  }))
                }
                className="w-full p-4 border border-gray-200 rounded-xl text-xs font-black uppercase focus:ring-2 focus:ring-indigo-100 outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
              Endereço da Visita
            </label>
            <div className="relative">
              <MapPin
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"
                size={14}
              />
              <input
                value={data.address}
                onChange={(e) =>
                  setData((prev) => ({ ...prev, address: e.target.value }))
                }
                className="w-full pl-10 pr-4 py-4 border border-gray-200 rounded-xl text-xs font-black uppercase focus:ring-2 focus:ring-indigo-100 outline-none"
                placeholder="RUA, NÚMERO, BAIRRO..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
                Origem do Pedido *
              </label>
              <select
                required
                value={data.requestOrigin}
                onChange={(e) =>
                  setData((prev) => ({
                    ...prev,
                    requestOrigin: e.target.value as any,
                  }))
                }
                className="w-full p-4 border border-gray-200 rounded-xl text-xs font-black uppercase focus:ring-2 focus:ring-indigo-100 outline-none bg-white"
              >
                <option value="CREAS/PREFEITURA">CREAS/PREFEITURA</option>
                <option value="JUDICIAL">JUDICIAL</option>
                <option value="CONFERÊNCIAS">CONFERÊNCIAS</option>
                <option value="CONTATO DIRETO">CONTATO DIRETO</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
              Descrição / Breve Relato
            </label>
            <textarea
              value={data.requestDescription}
              onChange={(e) =>
                setData((prev) => ({
                  ...prev,
                  requestDescription: e.target.value,
                }))
              }
              placeholder="DESCREVA BREVEMENTE O CASO..."
              className="w-full p-4 border border-gray-200 rounded-xl text-xs font-black uppercase focus:ring-2 focus:ring-indigo-100 outline-none h-24 resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
          >
            Cadastrar Agendamento <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}

// --- MODAL DE GESTÃO DE ETAPA ---

function StatusManagementModal({
  candidate,
  onClose,
  onSave,
  onEdit,
  onAdmit,
  onDelete,
  onOpenFullForm,
}: any) {
  const [data, setData] = React.useState<Candidate>(candidate);
  const [view, setView] = React.useState<"update" | "archive">("update");
  const [isNursingModalOpen, setIsNursingModalOpen] = React.useState(false);

  const updateField = (field: keyof Candidate, value: any) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const advanceStage = (nextStage: CandidateStage) => {
    const updated = { ...data, stage: nextStage };
    onSave(updated);
    onClose();
  };

  const renderStageControls = () => {
    switch (data.stage) {
      case "agendamentos":
        return (
          <div className="space-y-6">
            <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col items-center text-center gap-2">
              <div className="w-14 h-14 bg-white rounded-full shadow-lg flex items-center justify-center text-indigo-600">
                <Calendar size={28} />
              </div>
              <div className="space-y-1">
                <p className="text-[12px] font-black text-indigo-900 uppercase tracking-tighter">
                  Visita Social Realizada?
                </p>
                <p className="text-[10px] text-indigo-800 leading-relaxed font-medium">
                  Você pode iniciar o preenchimento da ficha agora ou apenas
                  evoluir o status para a próxima etapa.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between border border-gray-100">
                <div className="text-[10px] font-black uppercase text-gray-400">
                  Data do contato:
                </div>
                <div className="text-xs font-black text-gray-800">
                  {new Date(data.scheduledDate || "").toLocaleDateString(
                    "pt-BR",
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 pt-2">
                <button
                  onClick={() => onOpenFullForm(data)}
                  className="w-full py-3.5 bg-white border-2 border-indigo-600 text-indigo-600 rounded-2xl text-[11px] font-black uppercase shadow-sm hover:bg-indigo-50 transition-all flex items-center justify-center gap-3"
                >
                  <FileText size={18} /> INICIAR ENTREVISTA (ABRIR FICHA)
                </button>
                <button
                  onClick={() => advanceStage("entrevista")}
                  className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3"
                >
                  <ArrowRight size={20} /> EVOLUIR PARA ENTREVISTA
                </button>
              </div>
            </div>
          </div>
        );
      case "entrevista":
        return (
          <div className="space-y-6">
            <div className="p-5 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-4">
              <Info className="text-blue-500 shrink-0" size={20} />
              <div className="space-y-1">
                <p className="text-[11px] font-black text-blue-900 uppercase">
                  Configuração de Fila
                </p>
                <p className="text-[10px] text-blue-800 leading-relaxed font-medium">
                  Defina a prioridade de atendimento do idoso antes de movê-lo
                  para a lista de espera.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
                Nível de prioridade
              </label>
              <select
                value={data.priority || "padrao"}
                onChange={(e) =>
                  updateField("priority", e.target.value as WaitlistPriority)
                }
                className="w-full p-4 border border-gray-200 rounded-xl text-xs font-black uppercase bg-white focus:ring-2 focus:ring-blue-200 outline-none"
              >
                <option value="social_urgente">
                  1) PRIORIDADE SOCIAL (URGENTE)
                </option>
                <option value="dependencia_duvidosa">
                  2) GRAU DE DEPENDÊNCIA DUVIDOSO (REQUER AVALIAÇÃO MÉDICA)
                </option>
                <option value="padrao">3) PRIORIDADE PADRÃO</option>
              </select>
            </div>

            <button
              onClick={() => advanceStage("aguardando_vaga")}
              className="w-full py-4 bg-[#004c99] text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-blue-800 transition-all flex items-center justify-center gap-2"
            >
              <ArrowRight size={16} /> ENVIAR PARA LISTA DE ESPERA
            </button>
          </div>
        );
      case "aguardando_vaga":
        return (
          <div className="space-y-6">
            <div className="p-5 bg-orange-50 border border-orange-100 rounded-2xl flex items-start gap-4">
              <Clock className="text-orange-500 shrink-0" size={20} />
              <div className="space-y-1">
                <p className="text-[11px] font-black text-orange-900 uppercase">
                  Fila de Espera
                </p>
                <p className="text-[10px] text-orange-800 leading-relaxed font-medium">
                  Candidato apto aguardando disponibilidade de vaga para
                  prosseguir.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
                Nível de Prioridade
              </label>
              <select
                value={data.priority || "padrao"}
                onChange={(e) =>
                  updateField("priority", e.target.value as WaitlistPriority)
                }
                className="w-full p-4 border border-gray-200 rounded-xl text-xs font-black uppercase bg-white focus:ring-2 focus:ring-orange-200 outline-none"
              >
                <option value="social_urgente">
                  1) PRIORIDADE SOCIAL (URGENTE)
                </option>
                <option value="dependencia_duvidosa">
                  2) GRAU DE DEPENDÊNCIA DUVIDOSO (REQUER AVALIAÇÃO MÉDICA)
                </option>
                <option value="padrao">3) PRIORIDADE PADRÃO</option>
              </select>
            </div>
            <button
              onClick={() => advanceStage("decisao_diretoria")}
              className="w-full py-4 bg-purple-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-purple-700 transition-all flex items-center justify-center gap-2"
            >
              Enviar para Parecer da Diretoria <ArrowRight size={16} />
            </button>
          </div>
        );
      case "decisao_diretoria":
        return (
          <div className="space-y-6">
            <div className="p-5 bg-purple-50 border border-purple-100 rounded-2xl flex items-start gap-4">
              <Scale className="text-purple-500 shrink-0" size={20} />
              <div className="space-y-1">
                <p className="text-[11px] font-black text-purple-900 uppercase">
                  Parecer da Diretoria
                </p>
                <p className="text-[10px] text-purple-800 leading-relaxed font-medium">
                  Registre a decisão oficial da diretoria conforme ata de
                  reunião.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
                Relato da Ata / Parecer
              </label>
              <textarea
                value={data.boardOpinion}
                onChange={(e) => updateField("boardOpinion", e.target.value)}
                placeholder="Insira a decisão oficial aqui..."
                className="w-full p-5 border border-gray-200 rounded-2xl text-xs font-medium h-40 focus:ring-2 focus:ring-purple-200 outline-none uppercase"
              />
            </div>
            <button
              disabled={!data.boardOpinion}
              onClick={() => advanceStage("avaliacao_medica")}
              className="w-full py-4 bg-teal-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-teal-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              Encaminhar para Parecer Médico <ArrowRight size={16} />
            </button>
          </div>
        );
      case "avaliacao_medica":
        return (
          <div className="space-y-6">
            <div className="p-5 bg-teal-50 border border-teal-100 rounded-2xl flex items-start gap-4">
              <HeartPulse className="text-teal-500 shrink-0" size={20} />
              <div className="space-y-1">
                <p className="text-[11px] font-black text-teal-900 uppercase">
                  Parecer Médico
                </p>
                <p className="text-[10px] text-teal-800 leading-relaxed font-medium">
                  Avaliação clínica de compatibilidade com o perfil da unidade.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => updateField("medicalStatus", "favoravel")}
                className={`py-4 rounded-2xl text-[10px] font-black uppercase border-2 transition-all ${data.medicalStatus === "favoravel" ? "bg-green-50 border-green-600 text-green-700" : "border-gray-100 text-gray-400"}`}
              >
                Apto
              </button>
              <button
                onClick={() => {
                  const updated = {
                    ...data,
                    medicalStatus: "desfavoravel" as const,
                    stage: "arquivado" as const,
                    archiveReason: "REPROVADO NA AVALIAÇÃO MÉDICA (INAPTO).",
                  };
                  onSave(updated);
                  onClose();
                }}
                className={`py-4 rounded-2xl text-[10px] font-black uppercase border-2 transition-all ${data.medicalStatus === "desfavoravel" ? "bg-red-50 border-red-600 text-red-700" : "border-gray-100 text-gray-400"}`}
              >
                Inapto
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
                Observações Médicas
              </label>
              <textarea
                value={data.medicalOpinion}
                onChange={(e) => updateField("medicalOpinion", e.target.value)}
                className="w-full p-5 border border-gray-200 rounded-2xl text-xs font-medium h-32 focus:ring-2 focus:ring-teal-200 outline-none uppercase"
              />
            </div>

            <div className="pt-2">
              <button
                onClick={() => setIsNursingModalOpen(true)}
                className="w-full py-4 border-2 border-dashed border-teal-200 text-teal-600 rounded-2xl text-[10px] font-black uppercase hover:bg-teal-50 transition-all flex items-center justify-center gap-2"
              >
                <ClipboardList size={16} /> 
                {data.nursingScreening ? 'Editar Triagem de Enfermagem' : 'Realizar Triagem de Enfermagem'}
              </button>
              {data.nursingScreening && (
                <p className="text-[9px] font-bold text-teal-500 text-center mt-2 uppercase">
                  Triagem realizada em {new Date(data.nursingScreening.date).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>

            {data.medicalStatus === "favoravel" && (
              <button
                onClick={() => advanceStage("integracao")}
                className="w-full py-4 bg-pink-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-pink-700 transition-all flex items-center justify-center gap-2"
              >
                Seguir para Integração <ArrowRight size={16} />
              </button>
            )}
          </div>
        );
      case "integracao":
        const handleGenerateFullReport = () => {
          const printWindow = window.open("", "_blank");
          if (!printWindow) return;

          const priorityLabel =
            data.priority === "social_urgente"
              ? "SOCIAL (URGENTE)"
              : data.priority === "dependencia_duvidosa"
                ? "DEP. DUVIDOSA"
                : data.priority === "padrao"
                  ? "PRIORIDADE PADRÃO"
                  : "NÃO DEFINIDA";

          const interview = data.interview;

          let html = `
            <html>
              <head>
                <title>Relatório Geral de Triagem - ${data.name}</title>
                <style>
                  body { font-family: 'Inter', system-ui, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
                  .header { text-align: center; border-bottom: 4px solid #004c99; margin-bottom: 30px; padding-bottom: 20px; }
                  .header h1 { margin: 0; font-size: 28px; text-transform: uppercase; color: #004c99; font-weight: 900; }
                  .header p { margin: 5px 0 0; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; }
                  .section { margin-bottom: 30px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
                  .section-title { background: #f8fafc; padding: 12px 20px; font-size: 14px; font-weight: 900; text-transform: uppercase; color: #004c99; border-bottom: 1px solid #e2e8f0; }
                  .section-content { padding: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
                  .full-width { grid-column: span 2; }
                  .field { margin-bottom: 10px; }
                  .label { font-size: 10px; font-weight: 900; text-transform: uppercase; color: #64748b; display: block; }
                  .value { font-size: 13px; font-weight: 600; color: #1e293b; }
                  .text-block { background: #f1f5f9; padding: 15px; border-radius: 8px; font-size: 12px; white-space: pre-wrap; margin-top: 5px; }
                  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
                  th { background: #f1f5f9; border: 1px solid #e2e8f0; padding: 8px; text-align: left; font-weight: 900; text-transform: uppercase; }
                  td { border: 1px solid #e2e8f0; padding: 8px; }
                  .footer { margin-top: 40px; font-size: 10px; text-align: center; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px; }
                  @media print { .no-print { display: none; } }
                </style>
              </head>
              <body>
                <div class="header">
                  <h1>Relatório Geral de Triagem</h1>
                  <p>Candidato: ${data.name} | Emitido em: ${new Date().toLocaleString("pt-BR")}</p>
                </div>

                <div class="section">
                  <div class="section-title">Dados do Agendamento</div>
                  <div class="section-content">
                    <div class="field"><span class="label">Data do Contato</span><span class="value">${data.scheduledDate ? new Date(data.scheduledDate).toLocaleDateString("pt-BR") : "N/A"}</span></div>
                    <div class="field"><span class="label">Telefone</span><span class="value">${data.phone || "N/A"}</span></div>
                    <div class="field full-width"><span class="label">Endereço</span><span class="value">${data.address || "N/A"}</span></div>
                  </div>
                </div>

                <div class="section">
                  <div class="section-title">Entrevista Social</div>
                  <div class="section-content">
                    <div class="field"><span class="label">Idade</span><span class="value">${data.age || "N/A"}</span></div>
                    <div class="field"><span class="label">Sexo</span><span class="value">${data.gender || "N/A"}</span></div>
                    <div class="field"><span class="label">Estado Civil</span><span class="value">${data.maritalStatus || "N/A"}</span></div>
                    <div class="field"><span class="label">CPF</span><span class="value">${data.cpf || "N/A"}</span></div>
                    <div class="field full-width"><span class="label">Reside com</span><span class="value">${interview.residesWith || "N/A"}</span></div>
                    <div class="field full-width"><span class="label">Motivo da Solicitação</span><div class="text-block">${interview.requestReason || "Não informado"}</div></div>
                    <div class="field full-width"><span class="label">Parecer da Assistente Social</span><div class="text-block">${interview.socialAnalysis || "Não informado"}</div></div>
                  </div>
                </div>

                <div class="section">
                  <div class="section-title">Fila de Espera</div>
                  <div class="section-content">
                    <div class="field full-width"><span class="label">Nível de Prioridade</span><span class="value">${priorityLabel}</span></div>
                  </div>
                </div>

                <div class="section">
                  <div class="section-title">Parecer da Diretoria</div>
                  <div class="section-content">
                    <div class="field full-width"><span class="label">Decisão Oficial / Ata</span><div class="text-block">${data.boardOpinion || "Não registrado"}</div></div>
                  </div>
                </div>

                <div class="section">
                  <div class="section-title">Parecer Médico</div>
                  <div class="section-content">
                    <div class="field"><span class="label">Status Clínico</span><span class="value">${data.medicalStatus === "favoravel" ? "APTO" : data.medicalStatus === "desfavoravel" ? "INAPTO" : "PENDENTE"}</span></div>
                    <div class="field full-width"><span class="label">Observações Médicas</span><div class="text-block">${data.medicalOpinion || "Não registrado"}</div></div>
                  </div>
                </div>

                <div class="section">
                  <div class="section-title">Integração</div>
                  <div class="section-content">
                    <div class="field"><span class="label">Data da Integração</span><span class="value">${data.integrationDate ? new Date(data.integrationDate).toLocaleDateString("pt-BR") : "N/A"}</span></div>
                    <div class="field"><span class="label">Status do Contrato</span><span class="value">${data.contractStatus === "assinado" ? "ASSINADO" : "PENDENTE"}</span></div>
                    <div class="field full-width"><span class="label">Relatório da Integração</span><div class="text-block">${data.integrationReport || "Não registrado"}</div></div>
                  </div>
                </div>

                ${
                  data.admissionDate
                    ? `
                <div class="section">
                  <div class="section-title">Acolhimento</div>
                  <div class="section-content">
                    <div class="field full-width"><span class="label">Data de Efetivação do Acolhimento</span><span class="value" style="color: #16a34a; font-size: 18px;">${new Date(data.admissionDate).toLocaleDateString("pt-BR")}</span></div>
                  </div>
                </div>
                `
                    : ""
                }

                <div class="footer">Este documento é de uso interno da SSVP e contém dados sensíveis.</div>
              </body>
            </html>
          `;
          printWindow.document.write(html);
          printWindow.document.close();
          
          printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
          };

          // Fallback para navegadores onde onload pode não disparar para document.write
          setTimeout(() => {
            if (printWindow) {
              printWindow.focus();
              printWindow.print();
            }
          }, 1000);
        };

        return (
          <div className="space-y-6">
            <div className="p-5 bg-pink-50 border border-pink-100 rounded-2xl flex items-start gap-4">
              <Calendar className="text-pink-500 shrink-0" size={20} />
              <div className="space-y-1">
                <p className="text-[11px] font-black text-pink-900 uppercase">
                  Integração e Contratos
                </p>
                <p className="text-[10px] text-pink-800 leading-relaxed font-medium">
                  Finalização de documentação e agendamento da data de entrada.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
                  Data da Integração
                </label>
                <input
                  type="date"
                  value={data.integrationDate}
                  onChange={(e) =>
                    updateField("integrationDate", e.target.value)
                  }
                  className="w-full p-4 border border-gray-200 rounded-xl text-xs font-black uppercase"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
                  Assinatura Contrato
                </label>
                <select
                  value={data.contractStatus}
                  onChange={(e) =>
                    updateField("contractStatus", e.target.value)
                  }
                  className="w-full p-4 border border-gray-200 rounded-xl text-xs font-black uppercase"
                >
                  <option value="pendente">Aguardando Família</option>
                  <option value="assinado">100% Finalizado</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
                Relatório da Integração do Idoso
              </label>
              <textarea
                value={data.integrationReport}
                onChange={(e) =>
                  updateField("integrationReport", e.target.value)
                }
                placeholder="Descreva como foi a tarde de experiência do idoso..."
                className="w-full p-5 border border-gray-200 rounded-2xl text-xs font-medium h-32 focus:ring-2 focus:ring-pink-200 outline-none uppercase"
              />
            </div>

            <div className="flex flex-col gap-3 pt-4">
              {data.stage !== "acolhido" ? (
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        `Deseja realmente acolher o candidato ${data.name}? Ele será transferido para a lista de Residentes.`,
                      )
                    ) {
                      onAdmit(data);
                      onClose();
                    }
                  }}
                  disabled={data.contractStatus !== "assinado"}
                  className="w-full py-5 bg-green-600 text-white rounded-2xl text-xs font-black uppercase shadow-2xl hover:bg-green-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50 border-b-4 border-green-800"
                >
                  <UserCheck size={24} /> FINALIZAR TRIAGEM E ACOLHER
                </button>
              ) : (
                <div className="p-4 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center gap-3 text-green-700">
                  <CheckCircle2 size={20} />
                  <span className="text-[11px] font-black uppercase tracking-widest">
                    Candidato Acolhido em{" "}
                    {data.admissionDate
                      ? new Date(data.admissionDate).toLocaleDateString("pt-BR")
                      : ""}
                  </span>
                </div>
              )}

              <button
                onClick={handleGenerateFullReport}
                className="w-full py-4 bg-white border-2 border-gray-200 text-gray-500 rounded-2xl text-[10px] font-black uppercase shadow-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
              >
                <FileText size={16} /> Ver Relatório Completo de Triagem
              </button>
            </div>
          </div>
        );
      case "arquivado":
        return (
          <div className="space-y-6">
            <div className="p-6 bg-red-50 border border-red-100 rounded-3xl flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center text-red-500">
                <Archive size={32} />
              </div>
              <div className="space-y-1">
                <p className="text-[12px] font-black text-red-900 uppercase tracking-tighter">
                  Candidato Arquivado
                </p>
                <p className="text-[10px] text-red-800 leading-relaxed font-medium">
                  Motivo: {data.archiveReason || "Não informado"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => advanceStage("agendamentos")}
                className="w-full py-4 bg-white border-2 border-[#004c99] text-[#004c99] rounded-2xl text-[11px] font-black uppercase shadow-sm hover:bg-blue-50 transition-all flex items-center justify-center gap-3"
              >
                <ArrowLeft size={18} /> Reativar / Desarquivar
              </button>

              <button
                onClick={() => onDelete(data.id)}
                className="w-full py-4 bg-red-50 text-red-600 rounded-2xl text-[11px] font-black uppercase hover:bg-red-100 transition-all flex items-center justify-center gap-3 border border-red-100"
              >
                <Trash2 size={18} /> Excluir Registro Permanentemente
              </button>
            </div>
          </div>
        );
      default:
        return (
          <div className="text-center py-10 font-black uppercase text-gray-300 text-xs italic tracking-widest">
            Acesso ao Prontuário Concluído
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="p-6 md:p-8 border-b flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#004c99] shadow-lg border border-gray-100">
              <UserCheck size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter leading-tight">
                {data.name}
              </h3>
              <div className="text-[9px] font-black uppercase px-3 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200 mt-1 inline-block">
                Fase: {data.stage.replace("_", " ")}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 text-gray-300 hover:text-gray-900 hover:bg-gray-100 rounded-2xl transition-all"
          >
            <X size={28} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
          {view === "update" ? (
            <>
              {renderStageControls()}
              <div className="pt-6 border-t flex flex-col gap-3">
                <button
                  onClick={onEdit}
                  className="w-full py-4 text-[10px] font-black text-[#004c99] bg-blue-50 hover:bg-blue-100 rounded-2xl uppercase flex items-center justify-center gap-3 transition-all"
                >
                  <FileText size={18} /> Acessar Ficha Completa
                </button>
                {data.stage !== "acolhido" && data.stage !== "arquivado" && (
                  <button
                    onClick={() => setView("archive")}
                    className="w-full py-4 text-[10px] font-black text-red-500 hover:bg-red-50 rounded-2xl uppercase flex items-center justify-center gap-3 transition-all"
                  >
                    <Archive size={18} /> Arquivar Candidato
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-8 py-4">
              <div className="text-center space-y-3">
                <AlertCircle
                  size={60}
                  className="text-red-500 mx-auto"
                  strokeWidth={1}
                />
                <h4 className="text-lg font-black uppercase text-gray-800 tracking-tighter">
                  Arquivar Processo?
                </h4>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
                  Motivo do Descarte
                </label>
                <select
                  value={data.archiveReason}
                  onChange={(e) => updateField("archiveReason", e.target.value)}
                  className="w-full p-5 border border-gray-200 rounded-2xl text-xs font-black uppercase bg-white focus:ring-2 focus:ring-red-200 outline-none"
                >
                  <option value="">Selecione o motivo oficial...</option>
                  <option value="Inapto Saúde">Inapto Clínico (Médico)</option>
                  <option value="Inapto Financeiro">
                    Perfil Financeiro incompatível
                  </option>
                  <option value="Falta de Vagas">Sem vagas na unidade</option>
                  <option value="Desistência da Família">Desistência da Família</option>
                  <option value="Desistência do Idoso">Desistência do Idoso</option>
                  <option value="Falecimento">Falecimento</option>
                </select>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setView("update")}
                  className="flex-1 py-4 text-[10px] font-black uppercase text-gray-400 hover:bg-gray-100 rounded-2xl"
                >
                  Voltar
                </button>
                <button
                  onClick={() => {
                    const updated = {
                      ...data,
                      stage: "arquivado" as CandidateStage,
                    };
                    onSave(updated);
                    onClose();
                  }}
                  disabled={!data.archiveReason}
                  className="flex-1 py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl disabled:opacity-50 hover:bg-red-700"
                >
                  Confirmar Arquivamento
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {isNursingModalOpen && (
        <NursingScreeningModal
          candidateName={data.name}
          onClose={() => setIsNursingModalOpen(false)}
          initialData={data.nursingScreening}
          onSave={(nursingData) => {
            updateField("nursingScreening", nursingData);
            setIsNursingModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

// --- NOVO FORMULÁRIO DE CANDIDATO (ENTREVISTA SOCIAL OFICIAL) ---

// Subcomponents for CandidateForm to avoid re-rendering loss of focus
const FormSection = ({ num, title, children }: any) => (
  <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden mb-8">
    <div className="bg-gray-50/50 p-6 border-b flex items-center gap-4">
      <div className="w-10 h-10 bg-[#004c99] text-white rounded-2xl flex items-center justify-center font-black">
        {num}
      </div>
      <h3 className="text-sm font-black uppercase tracking-widest text-[#004c99]">
        {title}
      </h3>
    </div>
    <div className="p-8">{children}</div>
  </div>
);

const FormLabel = ({ children }: any) => (
  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1 block">
    {children}
  </label>
);

const FormInput = (props: any) => (
  <input
    {...props}
    className="w-full p-2 border-b-2 border-gray-100 focus:border-blue-600 outline-none text-xs font-black uppercase bg-transparent"
  />
);

const FormChoice = ({ label, value, current, onClick }: any) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border-2 transition-all flex items-center gap-2 ${current === value ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-100 text-gray-400 hover:border-gray-200"}`}
  >
    <div
      className={`w-3 h-3 rounded-full border-2 ${current === value ? "bg-white border-white" : "bg-transparent border-gray-200"}`}
    ></div>
    {label}
  </button>
);

function CandidateForm({ candidate, onSave, onCancel, onAdmit }: any) {
  const [data, setData] = React.useState<Candidate>(candidate);

  const updateField = (field: keyof Candidate, value: any) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const updateInterview = (field: keyof InterviewData, value: any) => {
    setData((prev) => ({
      ...prev,
      interview: { ...prev.interview, [field]: value },
    }));
  };

  const addFamilyMember = () => {
    const newMember: FamilyMemberRecord = {
      id: Date.now().toString(),
      name: "",
      kinship: "",
      age: "",
      job: "",
      income: "",
    };
    updateInterview("familyTable", [...data.interview.familyTable, newMember]);
  };

  const updateFamilyMember = (id: string, field: string, value: string) => {
    const updatedTable = data.interview.familyTable.map((m) =>
      m.id === id ? { ...m, [field]: value } : m,
    );
    updateInterview("familyTable", updatedTable);
  };

  const removeFamilyMember = (id: string) => {
    updateInterview(
      "familyTable",
      data.interview.familyTable.filter((m) => m.id !== id),
    );
  };

  return (
    <div id="printable-area" className="space-y-6 max-w-6xl mx-auto pb-20 animate-in fade-in duration-500">
      {/* Top Sticky Bar */}
      <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-gray-200 shadow-xl no-print sticky top-4 z-40">
        <div className="flex items-center gap-4">
          <button
            onClick={onCancel}
            className="p-3 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 transition-all text-gray-400"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-lg font-black text-gray-900 uppercase tracking-tighter">
              Entrevista Social para Acolhimento ILPI
            </h2>
            <div className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-700 inline-block mt-0.5">
              Módulo Assistência Social
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => window.print()}
            className="px-6 py-3 bg-white border border-gray-200 rounded-2xl text-xs font-black uppercase flex items-center gap-2 hover:shadow-md transition-all"
          >
            <Printer size={18} /> Imprimir Ficha
          </button>
          <button
            onClick={() => onSave(data)}
            className="px-8 py-3 bg-[#004c99] text-white rounded-2xl text-xs font-black uppercase flex items-center gap-2 hover:bg-blue-800 shadow-2xl shadow-blue-200 transition-all"
          >
            <Save size={20} /> Salvar Alterações
          </button>
        </div>
      </div>

      {/* Identificação */}
      <FormSection num="1" title="IDENTIFICAÇÃO DO IDOSO">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-x-8 gap-y-6">
          <div className="md:col-span-2">
            <FormLabel>Nome Completo</FormLabel>
            <FormInput
              value={data.name}
              onChange={(e: any) => updateField("name", e.target.value)}
            />
          </div>
          <div>
            <FormLabel>Data de Nascimento</FormLabel>
            <FormInput
              type="date"
              value={data.birthDate}
              onChange={(e: any) => updateField("birthDate", e.target.value)}
            />
          </div>
          <div>
            <FormLabel>Idade</FormLabel>
            <FormInput
              value={data.age}
              onChange={(e: any) => updateField("age", e.target.value)}
            />
          </div>
          <div className="md:col-span-2 flex gap-3">
            <div className="flex-1">
              <FormLabel>Sexo</FormLabel>
              <div className="flex gap-2">
                {["Feminino", "Masculino", "Outro"].map((v) => (
                  <FormChoice
                    key={v}
                    label={v}
                    value={v}
                    current={data.gender}
                    onClick={() => updateField("gender", v)}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="md:col-span-2">
            <FormLabel>Estado Civil</FormLabel>
            <FormInput
              value={data.maritalStatus}
              onChange={(e: any) =>
                updateField("maritalStatus", e.target.value)
              }
            />
          </div>
          <div>
            <FormLabel>RG</FormLabel>
            <FormInput
              value={data.rg}
              onChange={(e: any) => updateField("rg", e.target.value)}
            />
          </div>
          <div>
            <FormLabel>CPF</FormLabel>
            <FormInput
              value={data.cpf}
              onChange={(e: any) => updateField("cpf", e.target.value)}
            />
          </div>
          <div className="md:col-span-3">
            <FormLabel>Endereço Atual</FormLabel>
            <FormInput
              value={data.address}
              onChange={(e: any) => updateField("address", e.target.value)}
            />
          </div>
          <div>
            <FormLabel>Telefone</FormLabel>
            <FormInput
              value={data.phone}
              onChange={(e: any) => updateField("phone", e.target.value)}
            />
          </div>
        </div>
      </FormSection>

      {/* Responsável Legal */}
      <FormSection num="2" title="RESPONSÁVEL LEGAL / FAMILIAR">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <FormLabel>Nome do Responsável</FormLabel>
            <FormInput
              value={data.repName}
              onChange={(e: any) => updateField("repName", e.target.value)}
            />
          </div>
          <div>
            <FormLabel>Grau de Parentesco</FormLabel>
            <FormInput
              value={data.repKinship}
              onChange={(e: any) => updateField("repKinship", e.target.value)}
            />
          </div>
          <div>
            <FormLabel>Telefone</FormLabel>
            <FormInput
              value={data.repPhone}
              onChange={(e: any) => updateField("repPhone", e.target.value)}
            />
          </div>
          <div>
            <FormLabel>Endereço</FormLabel>
            <FormInput
              value={data.repAddress}
              onChange={(e: any) => updateField("repAddress", e.target.value)}
            />
          </div>
        </div>
      </FormSection>

      {/* Composição Familiar e Rede Apoio */}
      <FormSection num="3" title="COMPOSIÇÃO FAMILIAR E REDE DE APOIO">
        <div className="space-y-8">
          <div>
            <FormLabel>Com quem o idoso reside atualmente?</FormLabel>
            <div className="flex flex-wrap gap-2">
              {["Sozinho", "Filhos", "Familiares", "Outros"].map((v) => (
                <FormChoice
                  key={v}
                  label={v}
                  value={v}
                  current={data.interview.residesWith}
                  onClick={() => updateInterview("residesWith", v)}
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <FormLabel>Possui filhos?</FormLabel>
                <div className="flex gap-2">
                  {["Sim", "Não"].map((v) => (
                    <FormChoice
                      key={v}
                      label={v}
                      value={v}
                      current={data.interview.hasChildren}
                      onClick={() => updateInterview("hasChildren", v)}
                    />
                  ))}
                </div>
              </div>
              <div className="flex-1">
                <FormLabel>Quantos?</FormLabel>
                <FormInput
                  value={data.interview.childrenCount}
                  onChange={(e: any) =>
                    updateInterview("childrenCount", e.target.value)
                  }
                />
              </div>
            </div>
            <div>
              <FormLabel>Existe cuidador?</FormLabel>
              <div className="flex flex-wrap gap-2">
                {["Não", "Sim", "Familiar", "Profissional"].map((v) => (
                  <FormChoice
                    key={v}
                    label={v}
                    value={v}
                    current={data.interview.hasCaregiver}
                    onClick={() => updateInterview("hasCaregiver", v)}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
            <div>
              <FormLabel>
                Possui rede de apoio (parentes, vizinhos, serviços)?
              </FormLabel>
              <div className="flex gap-2">
                {["Sim", "Não"].map((v) => (
                  <FormChoice
                    key={v}
                    label={v}
                    value={v}
                    current={data.interview.hasSupportNetwork}
                    onClick={() => updateInterview("hasSupportNetwork", v)}
                  />
                ))}
              </div>
            </div>
            <div>
              <FormLabel>Quais?</FormLabel>
              <FormInput
                value={data.interview.supportNetworkDetails}
                onChange={(e: any) =>
                  updateInterview("supportNetworkDetails", e.target.value)
                }
              />
            </div>
          </div>
        </div>
      </FormSection>

      {/* Tabela de Composição Familiar */}
      <FormSection num="4" title="COMPOSIÇÃO FAMILIAR (DETALHAMENTO)">
        <div className="overflow-hidden border rounded-2xl">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-500 tracking-widest border-b">
              <tr>
                <th className="px-6 py-4">Nome</th>
                <th className="px-6 py-4">Parentesco</th>
                <th className="px-6 py-4">Idade</th>
                <th className="px-6 py-4">Trabalho</th>
                <th className="px-6 py-4">Renda Mensal</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.interview.familyTable.map((m: any) => (
                <tr key={m.id} className="hover:bg-blue-50/10">
                  <td className="px-6 py-3">
                    <FormInput
                      value={m.name}
                      onChange={(e: any) =>
                        updateFamilyMember(m.id, "name", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-6 py-3">
                    <FormInput
                      value={m.kinship}
                      onChange={(e: any) =>
                        updateFamilyMember(m.id, "kinship", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-6 py-3 w-20">
                    <FormInput
                      value={m.age}
                      onChange={(e: any) =>
                        updateFamilyMember(m.id, "age", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-6 py-3">
                    <FormInput
                      value={m.job}
                      onChange={(e: any) =>
                        updateFamilyMember(m.id, "job", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-6 py-3 w-32">
                    <FormInput
                      value={m.income}
                      onChange={(e: any) =>
                        updateFamilyMember(m.id, "income", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={() => removeFamilyMember(m.id)}
                      className="p-2 text-red-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={6} className="p-4 bg-gray-50/30 text-center">
                  <button
                    onClick={addFamilyMember}
                    className="inline-flex items-center gap-2 text-[10px] font-black uppercase text-[#004c99] hover:bg-white px-6 py-2 rounded-xl border border-dashed border-[#004c99] transition-all"
                  >
                    <Plus size={14} /> Adicionar Familiar à Tabela
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </FormSection>

      {/* Moradia */}
      <FormSection num="5" title="CONDIÇÕES DE MORADIA">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
          <div>
            <FormLabel>Tipo de Moradia</FormLabel>
            <div className="flex gap-2">
              {["Própria", "Alugada", "Cedida"].map((v) => (
                <FormChoice
                  key={v}
                  label={v}
                  value={v}
                  current={data.interview.housingType}
                  onClick={() => updateInterview("housingType", v)}
                />
              ))}
            </div>
          </div>
          <div>
            <FormLabel>Valor Aluguel</FormLabel>
            <FormInput
              value={data.interview.rentValue}
              onChange={(e: any) =>
                updateInterview("rentValue", e.target.value)
              }
            />
          </div>
        </div>
      </FormSection>

      {/* Socioeconômica */}
      <FormSection num="6" title="SITUAÇÃO SOCIOECONÔMICA">
        <div className="space-y-8">
          <div>
            <FormLabel>Fonte de renda do idoso</FormLabel>
            <div className="flex flex-wrap gap-2">
              {["Aposentadoria", "Pensão", "BPC/LOAS", "Outros"].map((v) => (
                <FormChoice
                  key={v}
                  label={v}
                  value={v}
                  current={data.interview.incomeSource}
                  onClick={() => updateInterview("incomeSource", v)}
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <FormLabel>Valor aproximado da renda R$</FormLabel>
              <FormInput
                value={data.interview.incomeValue}
                onChange={(e: any) =>
                  updateInterview("incomeValue", e.target.value)
                }
              />
            </div>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <FormLabel>Possui empréstimo?</FormLabel>
                <div className="flex gap-2">
                  {["Sim", "Não"].map((v) => (
                    <FormChoice
                      key={v}
                      label={v}
                      value={v}
                      current={data.interview.hasLoan}
                      onClick={() => updateInterview("hasLoan", v)}
                    />
                  ))}
                </div>
              </div>
              <div className="flex-1">
                <FormLabel>Valor R$</FormLabel>
                <FormInput
                  value={data.interview.loanValue}
                  onChange={(e: any) =>
                    updateInterview("loanValue", e.target.value)
                  }
                />
              </div>
            </div>
            <div>
              <FormLabel>A família possui condições de custear cuidados?</FormLabel>
              <div className="flex gap-2">
                {["Sim", "Não", "Parcialmente"].map((v) => (
                  <FormChoice
                    key={v}
                    label={v}
                    value={v}
                    current={data.interview.canAffordCare}
                    onClick={() => updateInterview("canAffordCare", v)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </FormSection>

      {/* Saúde */}
      <FormSection num="7" title="CONDIÇÕES DE SAÚDE">
        <div className="space-y-8">
          <div>
            <FormLabel>Diagnósticos médicos</FormLabel>
            <FormInput
              value={data.interview.medicalDiagnoses}
              onChange={(e: any) =>
                updateInterview("medicalDiagnoses", e.target.value)
              }
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
            <div>
              <FormLabel>Uso de medicação contínua?</FormLabel>
              <div className="flex gap-2">
                {["Sim", "Não"].map((v) => (
                  <FormChoice
                    key={v}
                    label={v}
                    value={v}
                    current={data.interview.continuousMedication}
                    onClick={() => updateInterview("continuousMedication", v)}
                  />
                ))}
              </div>
            </div>
            <div>
              <FormLabel>Quais?</FormLabel>
              <FormInput
                value={data.interview.medicationDetails}
                onChange={(e: any) =>
                  updateInterview("medicationDetails", e.target.value)
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
            <div>
              <FormLabel>Possui acompanhamento médico regular?</FormLabel>
              <div className="flex gap-2">
                {["Sim", "Não"].map((v) => (
                  <FormChoice
                    key={v}
                    label={v}
                    value={v}
                    current={data.interview.regularMedicalFollowup}
                    onClick={() => updateInterview("regularMedicalFollowup", v)}
                  />
                ))}
              </div>
            </div>
            <div>
              <FormLabel>Apresenta comprometimento cognitivo?</FormLabel>
              <div className="flex gap-2">
                {["Sim", "Não", "Em avaliação"].map((v) => (
                  <FormChoice
                    key={v}
                    label={v}
                    value={v}
                    current={data.interview.cognitiveImpairment}
                    onClick={() => updateInterview("cognitiveImpairment", v)}
                  />
                ))}
              </div>
            </div>
            <div>
              <FormLabel>Quais?</FormLabel>
              <FormInput
                value={data.interview.cognitiveDetails}
                onChange={(e: any) =>
                  updateInterview("cognitiveDetails", e.target.value)
                }
              />
            </div>
          </div>
        </div>
      </FormSection>

      {/* Grau de Dependência */}
      <FormSection num="8" title="GRAU DE DEPENDÊNCIA (O idoso realiza sozinho?)">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {[
            { label: "Higiene pessoal", field: "depHygiene" },
            { label: "Alimentação", field: "depFeeding" },
            { label: "Locomoção", field: "depMobility" },
            { label: "Uso do banheiro", field: "depBathroom" },
            { label: "Medicação", field: "depMedication" },
          ].map((item) => (
            <div key={item.field} className="space-y-2">
              <FormLabel>{item.label}</FormLabel>
              <div className="flex flex-col gap-2">
                {item.field === "depMobility"
                  ? ["Sim", "Não", "Andador", "Cadeira de Rodas"].map((v) => (
                      <FormChoice
                        key={v}
                        label={v}
                        value={v}
                        current={(data.interview as any)[item.field]}
                        onClick={() => updateInterview(item.field as any, v)}
                      />
                    ))
                  : ["Sim", "Não"].map((v) => (
                      <FormChoice
                        key={v}
                        label={v}
                        value={v}
                        current={(data.interview as any)[item.field]}
                        onClick={() => updateInterview(item.field as any, v)}
                      />
                    ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-10 pt-6 border-t border-dashed border-gray-100 flex items-center gap-6">
          <FormLabel>Necessita de cuidador em tempo integral?</FormLabel>
          <div className="flex gap-2">
            {["Sim", "Não"].map((v) => (
              <FormChoice
                key={v}
                label={v}
                value={v}
                current={data.interview.needsFullTimeCare}
                onClick={() => updateInterview("needsFullTimeCare", v)}
              />
            ))}
          </div>
        </div>
      </FormSection>

      {/* Psicossociais */}
      <FormSection num="9" title="ASPECTOS PSICOSSOCIAIS">
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
            <div>
              <FormLabel>Há conflitos familiares?</FormLabel>
              <div className="flex gap-2">
                {["Sim", "Não"].map((v) => (
                  <FormChoice
                    key={v}
                    label={v}
                    value={v}
                    current={data.interview.familyConflicts}
                    onClick={() => updateInterview("familyConflicts", v)}
                  />
                ))}
              </div>
            </div>
            <div>
              <FormLabel>Quais?</FormLabel>
              <FormInput
                value={data.interview.conflictDetails}
                onChange={(e: any) =>
                  updateInterview("conflictDetails", e.target.value)
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <FormLabel>O idoso concorda com o ingresso na ILPI?</FormLabel>
              <div className="flex gap-2">
                {["Sim", "Não", "Parcialmente"].map((v) => (
                  <FormChoice
                    key={v}
                    label={v}
                    value={v}
                    current={data.interview.elderlyAgrees}
                    onClick={() => updateInterview("elderlyAgrees", v)}
                  />
                ))}
              </div>
            </div>
            <div>
              <FormLabel>A família concorda?</FormLabel>
              <div className="flex gap-2">
                {["Sim", "Não"].map((v) => (
                  <FormChoice
                    key={v}
                    label={v}
                    value={v}
                    current={data.interview.familyAgrees}
                    onClick={() => updateInterview("familyAgrees", v)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </FormSection>

      {/* Motivo Solicitação */}
      <FormSection num="10" title="MOTIVO DA SOLICITAÇÃO DO ACOLHIMENTO">
        <textarea
          value={data.interview.requestReason}
          onChange={(e) => updateInterview("requestReason", e.target.value)}
          placeholder="Descreva detalhadamente o motivo do pedido..."
          className="w-full p-8 border border-gray-100 rounded-2xl bg-gray-50 text-xs font-black uppercase focus:bg-white transition-all h-60 outline-none leading-relaxed"
        />
      </FormSection>

      {/* Parecer Social */}
      <FormSection num="11" title="PARECER SOCIAL">
        <textarea
          value={data.interview.socialAnalysis}
          onChange={(e) => updateInterview("socialAnalysis", e.target.value)}
          placeholder="Parecer técnico da Assistente Social..."
          className="w-full p-8 border-l-8 border-l-[#004c99] border-y border-r border-gray-100 rounded-2xl bg-gray-50 text-xs font-black uppercase focus:bg-white transition-all h-60 outline-none leading-relaxed"
        />
      </FormSection>
    </div>
  );
}

// --- MODAL DE TRIAGEM DE ENFERMAGEM ---

interface NursingScreeningModalProps {
  onClose: () => void;
  onSave: (data: NursingScreening) => void;
  initialData?: NursingScreening;
  candidateName: string;
}

function NursingScreeningModal({ onClose, onSave, initialData, candidateName }: NursingScreeningModalProps) {
  const [formData, setFormData] = React.useState<NursingScreening>(initialData || INITIAL_NURSING_SCREENING);

  const handleComorbidityToggle = (item: string) => {
    const current = formData.clinicalHistory.comorbidities || [];
    if (current.includes(item)) {
      setFormData({
        ...formData,
        clinicalHistory: {
          ...formData.clinicalHistory,
          comorbidities: current.filter(c => c !== item)
        }
      });
    } else {
      setFormData({
        ...formData,
        clinicalHistory: {
          ...formData.clinicalHistory,
          comorbidities: [...current, item]
        }
      });
    }
  };

  const handleCommunicationToggle = (item: string) => {
    const current = formData.functionalAssessment.communication || [];
    if (current.includes(item)) {
      setFormData({
        ...formData,
        functionalAssessment: {
          ...formData.functionalAssessment,
          communication: current.filter(c => c !== item)
        }
      });
    } else {
      setFormData({
        ...formData,
        functionalAssessment: {
          ...formData.functionalAssessment,
          communication: [...current, item]
        }
      });
    }
  };

  const handleBenefitToggle = (item: string) => {
    const current = formData.healthSupport.activeBenefits || [];
    if (current.includes(item)) {
      setFormData({
        ...formData,
        healthSupport: {
          ...formData.healthSupport,
          activeBenefits: current.filter(c => c !== item)
        }
      });
    } else {
      setFormData({
        ...formData,
        healthSupport: {
          ...formData.healthSupport,
          activeBenefits: [...current, item]
        }
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        <div className="p-8 border-b bg-[#004c99] text-white flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <HeartPulse size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tighter">
                Triagem Prévia de Enfermagem
              </h3>
              <p className="text-[10px] font-bold uppercase opacity-80">
                Candidato(a): {candidateName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-white/10 rounded-2xl transition-all"
          >
            <X size={28} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-10 bg-gray-50/30">
          {/* 1. Sinais Vitais e Biometria */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 border-b pb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-black text-xs">1</div>
              <h4 className="text-sm font-black uppercase text-gray-800">Sinais Vitais e Biometria</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <div>
                <FormLabel>Pressão Arterial (Sis)</FormLabel>
                <FormInput 
                  type="number"
                  placeholder="Sis"
                  value={formData.vitalSigns.paSystolic}
                  onChange={(e: any) => setFormData({...formData, vitalSigns: {...formData.vitalSigns, paSystolic: Number(e.target.value)}})}
                />
              </div>
              <div>
                <FormLabel>Pressão Arterial (Dia)</FormLabel>
                <FormInput 
                  type="number"
                  placeholder="Dia"
                  value={formData.vitalSigns.paDiastolic}
                  onChange={(e: any) => setFormData({...formData, vitalSigns: {...formData.vitalSigns, paDiastolic: Number(e.target.value)}})}
                />
              </div>
              <div>
                <FormLabel>Freq. Cardíaca (BPM)</FormLabel>
                <FormInput 
                  type="number"
                  placeholder="BPM"
                  value={formData.vitalSigns.fc}
                  onChange={(e: any) => setFormData({...formData, vitalSigns: {...formData.vitalSigns, fc: Number(e.target.value)}})}
                />
              </div>
              <div>
                <FormLabel>Temp. (°C)</FormLabel>
                <FormInput 
                  type="number"
                  step="0.1"
                  placeholder="°C"
                  value={formData.vitalSigns.temperature}
                  onChange={(e: any) => setFormData({...formData, vitalSigns: {...formData.vitalSigns, temperature: Number(e.target.value)}})}
                />
              </div>
              <div>
                <FormLabel>Sat. O2 (%)</FormLabel>
                <FormInput 
                  type="number"
                  placeholder="%"
                  value={formData.vitalSigns.spo2}
                  onChange={(e: any) => setFormData({...formData, vitalSigns: {...formData.vitalSigns, spo2: Number(e.target.value)}})}
                />
              </div>
              <div>
                <FormLabel>Glicemia (Valor)</FormLabel>
                <FormInput 
                  type="number"
                  placeholder="mg/dL"
                  value={formData.vitalSigns.hgtValue}
                  onChange={(e: any) => setFormData({...formData, vitalSigns: {...formData.vitalSigns, hgtValue: Number(e.target.value)}})}
                />
              </div>
              <div className="col-span-1 md:col-span-2">
                <FormLabel>Tipo de Glicemia</FormLabel>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setFormData({...formData, vitalSigns: {...formData.vitalSigns, hgtType: 'jejum'}})}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${formData.vitalSigns.hgtType === 'jejum' ? 'bg-[#004c99] text-white' : 'bg-gray-100 text-gray-500'}`}
                  >
                    Jejum
                  </button>
                  <button 
                    onClick={() => setFormData({...formData, vitalSigns: {...formData.vitalSigns, hgtType: 'pos-prandial'}})}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${formData.vitalSigns.hgtType === 'pos-prandial' ? 'bg-[#004c99] text-white' : 'bg-gray-100 text-gray-500'}`}
                  >
                    Pós-prandial
                  </button>
                </div>
              </div>
              <div>
                <FormLabel>Peso (Kg)</FormLabel>
                <FormInput 
                  placeholder="Kg"
                  value={formData.vitalSigns.weight}
                  onChange={(e: any) => setFormData({...formData, vitalSigns: {...formData.vitalSigns, weight: e.target.value}})}
                />
              </div>
              <div>
                <FormLabel>Altura (cm)</FormLabel>
                <FormInput 
                  placeholder="cm"
                  value={formData.vitalSigns.height}
                  onChange={(e: any) => setFormData({...formData, vitalSigns: {...formData.vitalSigns, height: e.target.value}})}
                />
              </div>
            </div>
          </section>

          {/* 2. Anamnese e Histórico Clínico */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 border-b pb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-black text-xs">2</div>
              <h4 className="text-sm font-black uppercase text-gray-800">Anamnese e Histórico Clínico</h4>
            </div>
            <div className="grid grid-cols-1 gap-6">
              <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl">
                <FormLabel>Alergias</FormLabel>
                <textarea 
                  className="w-full bg-transparent outline-none text-xs font-black uppercase min-h-[60px]"
                  placeholder="Descreva alergias conhecidas..."
                  value={formData.clinicalHistory.allergies}
                  onChange={(e) => setFormData({...formData, clinicalHistory: {...formData.clinicalHistory, allergies: e.target.value}})}
                />
              </div>
              <div>
                <FormLabel>Diagnósticos Prévios (Comorbidades)</FormLabel>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['Hipertensão', 'Diabetes', 'Alzheimer', 'Parkinson', 'Cardiopatias', 'Sequela de AVC', 'Outros'].map(item => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleComorbidityToggle(item)}
                      className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border-2 transition-all ${formData.clinicalHistory.comorbidities?.includes(item) ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-100 text-gray-400"}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                {formData.clinicalHistory.comorbidities?.includes('Outros') && (
                  <div className="mt-3">
                    <FormInput 
                      placeholder="Especifique outras comorbidades..." 
                      value={formData.clinicalHistory.otherComorbidities}
                      onChange={(e: any) => setFormData({...formData, clinicalHistory: {...formData.clinicalHistory, otherComorbidities: e.target.value}})}
                    />
                  </div>
                )}
              </div>
              <div>
                <FormLabel>Cirurgias Anteriores</FormLabel>
                <FormInput 
                  placeholder="Liste cirurgias realizadas..."
                  value={formData.clinicalHistory.surgeries}
                  onChange={(e: any) => setFormData({...formData, clinicalHistory: {...formData.clinicalHistory, surgeries: e.target.value}})}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-white border border-gray-100 rounded-2xl">
                  <FormLabel>Tabagismo</FormLabel>
                  <div className="flex gap-4 mt-2">
                    <FormChoice label="Sim" value={true} current={formData.clinicalHistory.habits.smoking} onClick={() => setFormData({...formData, clinicalHistory: {...formData.clinicalHistory, habits: {...formData.clinicalHistory.habits, smoking: true}}})} />
                    <FormChoice label="Não" value={false} current={formData.clinicalHistory.habits.smoking} onClick={() => setFormData({...formData, clinicalHistory: {...formData.clinicalHistory, habits: {...formData.clinicalHistory.habits, smoking: false}}})} />
                  </div>
                  {formData.clinicalHistory.habits.smoking && (
                    <div className="mt-2">
                      <FormInput placeholder="Observação..." value={formData.clinicalHistory.habits.smokingDetails} onChange={(e: any) => setFormData({...formData, clinicalHistory: {...formData.clinicalHistory, habits: {...formData.clinicalHistory.habits, smokingDetails: e.target.value}}})} />
                    </div>
                  )}
                </div>
                <div className="p-4 bg-white border border-gray-100 rounded-2xl">
                  <FormLabel>Etilismo</FormLabel>
                  <div className="flex gap-4 mt-2">
                    <FormChoice label="Sim" value={true} current={formData.clinicalHistory.habits.alcohol} onClick={() => setFormData({...formData, clinicalHistory: {...formData.clinicalHistory, habits: {...formData.clinicalHistory.habits, alcohol: true}}})} />
                    <FormChoice label="Não" value={false} current={formData.clinicalHistory.habits.alcohol} onClick={() => setFormData({...formData, clinicalHistory: {...formData.clinicalHistory, habits: {...formData.clinicalHistory.habits, alcohol: false}}})} />
                  </div>
                  {formData.clinicalHistory.habits.alcohol && (
                    <div className="mt-2">
                      <FormInput placeholder="Observação..." value={formData.clinicalHistory.habits.alcoholDetails} onChange={(e: any) => setFormData({...formData, clinicalHistory: {...formData.clinicalHistory, habits: {...formData.clinicalHistory.habits, alcoholDetails: e.target.value}}})} />
                    </div>
                  )}
                </div>
              </div>
              <div>
                <FormLabel>Medicamentos em Uso (Remédios, Dosagens e Horários)</FormLabel>
                <textarea 
                  className="w-full p-4 border border-gray-100 rounded-2xl outline-none text-xs font-black uppercase min-h-[100px] bg-white"
                  placeholder="Liste os medicamentos que o candidato já toma em casa..."
                  value={formData.clinicalHistory.medications}
                  onChange={(e) => setFormData({...formData, clinicalHistory: {...formData.clinicalHistory, medications: e.target.value}})}
                />
              </div>
            </div>
          </section>

          {/* 3. Avaliação Funcional e Cognitiva */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 border-b pb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-black text-xs">3</div>
              <h4 className="text-sm font-black uppercase text-gray-800">Avaliação Funcional e Cognitiva</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <FormLabel>Mobilidade</FormLabel>
                <div className="flex flex-col gap-2 mt-2">
                  {[
                    { label: 'Deambula sem auxílio', value: 'deambula' },
                    { label: 'Usa dispositivo/bengala', value: 'dispositivo' },
                    { label: 'Cadeirante', value: 'cadeirante' },
                    { label: 'Acamado', value: 'acamado' }
                  ].map(opt => (
                    <FormChoice 
                      key={opt.value} 
                      label={opt.label} 
                      value={opt.value} 
                      current={formData.functionalAssessment.mobility} 
                      onClick={() => setFormData({...formData, functionalAssessment: {...formData.functionalAssessment, mobility: opt.value as any}})} 
                    />
                  ))}
                </div>
              </div>
              <div>
                <FormLabel>Continência</FormLabel>
                <div className="flex flex-col gap-2 mt-2">
                  {[
                    { label: 'Continente', value: 'continente' },
                    { label: 'Incontinência Urinária', value: 'incontinencia_urinaria' },
                    { label: 'Incontinência Fecal', value: 'incontinencia_fecal' },
                    { label: 'Uso contínuo de fraldas', value: 'fraldas' }
                  ].map(opt => (
                    <FormChoice 
                      key={opt.value} 
                      label={opt.label} 
                      value={opt.value} 
                      current={formData.functionalAssessment.continence} 
                      onClick={() => setFormData({...formData, functionalAssessment: {...formData.functionalAssessment, continence: opt.value as any}})} 
                    />
                  ))}
                </div>
              </div>
              <div>
                <FormLabel>Nível de Consciência</FormLabel>
                <div className="flex gap-2 flex-wrap mt-2">
                  {[
                    { label: 'Lúcido/Orientado', value: 'lucido' },
                    { label: 'Confuso', value: 'confuso' },
                    { label: 'Letárgico', value: 'letargico' }
                  ].map(opt => (
                    <FormChoice 
                      key={opt.value} 
                      label={opt.label} 
                      value={opt.value} 
                      current={formData.functionalAssessment.consciousness} 
                      onClick={() => setFormData({...formData, functionalAssessment: {...formData.functionalAssessment, consciousness: opt.value as any}})} 
                    />
                  ))}
                </div>
              </div>
              <div>
                <FormLabel>Comunicação (Checklist)</FormLabel>
                <div className="flex gap-2 flex-wrap mt-2">
                  {['Verbaliza bem', 'Apresenta déficit auditivo', 'Apresenta déficit visual'].map(item => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleCommunicationToggle(item)}
                      className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border-2 transition-all ${formData.functionalAssessment.communication?.includes(item) ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-100 text-gray-400"}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <FormLabel>Grau de Dependência (Base Katz)</FormLabel>
                <div className="flex gap-6 mt-2">
                  {[
                    { label: 'Independente', value: 'independente' },
                    { label: 'Dependência Parcial', value: 'parcial' },
                    { label: 'Dependência Total', value: 'total' }
                  ].map(opt => (
                    <FormChoice 
                      key={opt.value} 
                      label={opt.label} 
                      value={opt.value} 
                      current={formData.functionalAssessment.dependencyLevel} 
                      onClick={() => setFormData({...formData, functionalAssessment: {...formData.functionalAssessment, dependencyLevel: opt.value as any}})} 
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 4. Exame Físico Simplificado */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 border-b pb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-black text-xs">4</div>
              <h4 className="text-sm font-black uppercase text-gray-800">Exame Físico Simplificado</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <FormLabel>Integridade da Pele</FormLabel>
                <div className="flex flex-col gap-2 mt-2">
                  {[
                    { label: 'Pele íntegra', value: 'integra' },
                    { label: 'Lesões por Pressão', value: 'lesao_pressao' },
                    { label: 'Escoriações/Hematomas', value: 'escoriacoes_hematomas' }
                  ].map(opt => (
                    <FormChoice 
                      key={opt.value} 
                      label={opt.label} 
                      value={opt.value} 
                      current={formData.physicalExam.skinIntegrity} 
                      onClick={() => setFormData({...formData, physicalExam: {...formData.physicalExam, skinIntegrity: opt.value as any}})} 
                    />
                  ))}
                </div>
                {formData.physicalExam.skinIntegrity !== 'integra' && (
                  <div className="mt-3">
                    <FormInput placeholder="Descreva o local da lesão..." value={formData.physicalExam.skinDetails} onChange={(e: any) => setFormData({...formData, physicalExam: {...formData.physicalExam, skinDetails: e.target.value}})} />
                  </div>
                )}
              </div>
              <div>
                <FormLabel>Estado Nutricional / Alimentação</FormLabel>
                <div className="flex flex-col gap-2 mt-2">
                  {[
                    { label: 'Boa aceitação via oral', value: 'via_oral' },
                    { label: 'Dificuldade de deglutição/engasgos', value: 'dificuldade_degluticao' },
                    { label: 'Uso de Sonda enteral/GTT', value: 'sonda_enteral_gtt' }
                  ].map(opt => (
                    <FormChoice 
                      key={opt.value} 
                      label={opt.label} 
                      value={opt.value} 
                      current={formData.physicalExam.nutritionalStatus} 
                      onClick={() => setFormData({...formData, physicalExam: {...formData.physicalExam, nutritionalStatus: opt.value as any}})} 
                    />
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <FormLabel>Padrão de Sono</FormLabel>
                <div className="flex gap-4 flex-wrap mt-2">
                  {[
                    { label: 'Dorme bem', value: 'dorme_bem' },
                    { label: 'Agitação noturna', value: 'agitacao_noturna' },
                    { label: 'Uso de medicação para dormir', value: 'uso_medicacao_dormir' }
                  ].map(opt => (
                    <FormChoice 
                      key={opt.value} 
                      label={opt.label} 
                      value={opt.value} 
                      current={formData.physicalExam.sleepPattern} 
                      onClick={() => setFormData({...formData, physicalExam: {...formData.physicalExam, sleepPattern: opt.value as any}})} 
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 5. Rede de Apoio de Saúde (Foco SUS) */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 border-b pb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-black text-xs">5</div>
              <h4 className="text-sm font-black uppercase text-gray-800">Rede de Apoio de Saúde (Foco SUS)</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <FormLabel>Número do Cartão SUS</FormLabel>
                <FormInput 
                  placeholder="000 0000 0000 0000" 
                  value={formData.healthSupport.susCard}
                  onChange={(e: any) => setFormData({...formData, healthSupport: {...formData.healthSupport, susCard: e.target.value}})}
                />
              </div>
              <div>
                <FormLabel>UBS / Posto de Referência</FormLabel>
                <FormInput 
                  placeholder="Nome da unidade..." 
                  value={formData.healthSupport.referenceUBS}
                  onChange={(e: any) => setFormData({...formData, healthSupport: {...formData.healthSupport, referenceUBS: e.target.value}})}
                />
              </div>
              <div>
                <FormLabel>Médico do Posto / Especialista</FormLabel>
                <FormInput 
                  placeholder="Nome e especialidade..." 
                  value={formData.healthSupport.referenceDoctor}
                  onChange={(e: any) => setFormData({...formData, healthSupport: {...formData.healthSupport, referenceDoctor: e.target.value}})}
                />
              </div>
              <div className="md:col-span-3">
                <FormLabel>Benefícios de Saúde Ativos</FormLabel>
                <div className="flex gap-2 flex-wrap mt-2">
                  {['Retira fraldas pelo SUS', 'Retira medicamentos de alto custo/farmácia municipal'].map(item => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleBenefitToggle(item)}
                      className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border-2 transition-all ${formData.healthSupport.activeBenefits?.includes(item) ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-100 text-gray-400"}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="pt-10 border-t grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <FormLabel>Enfermeira Responsável</FormLabel>
              <FormInput 
                placeholder="Nome da profissional..." 
                value={formData.professionalName}
                onChange={(e: any) => setFormData({...formData, professionalName: e.target.value})}
              />
            </div>
            <div>
              <FormLabel>Data da Assinatura</FormLabel>
              <FormInput 
                type="date"
                value={formData.signatureDate}
                onChange={(e: any) => setFormData({...formData, signatureDate: e.target.value})}
              />
            </div>
          </section>
        </div>

        <div className="p-8 border-t bg-gray-50 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-4 text-[10px] font-black uppercase text-gray-400 hover:bg-gray-100 rounded-2xl transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(formData)}
            className="flex-1 py-4 bg-[#004c99] text-white rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-blue-800 transition-all flex items-center justify-center gap-3"
          >
            <CheckCircle2 size={18} /> Salvar Triagem
          </button>
        </div>
      </div>
    </div>
  );
}

export default ScreeningModule;
