# Matriz de Permissões Simplificada (SSVP Gestão)

## Perfis e Regras Gerais

- **Administrador / TI / Gestral (`administrador`, `gerencial`)**
  - Conta com acesso irrestrito visual a todos os módulos, abas e configurações.
  - Pode criar, editar, arquivar e visualizar todos os módulos.
  - Permissão de acesso a Módulo Financeiro, Estoque, RH, Residentes, Triagens e Configurações de Sistema.

- **Enfermagem (`enfermeira`)**
  - Especializado em Saúde.
  - Pode visualizar Residentes e Triagens.
  - Pode registrar controles diários (Sinais vitais, glicemia).
  - Controle e baixa de Estoque / Medicamentos.
  - Pode arquivar registros que considerar inapropriados na sua área.

- **Médico (`medico`)**
  - Módulo focado exclusivas em Consultas Médicas e Evolução Clínica.
  - Pode avaliar Residentes e prescrever medicamentos.
  - Somente visualiza o perfil do Residente, a aba Saúde/Cuidados e Agenda.

- **Assistente Social (`assistente_social`)**
  - Acesso direto à Triagem e ao cadastro completo dos Residentes.
  - Gestão de Atendimentos Multidisciplinares, PIP, PIA, Histórico de Vínculos e Benefícios.

- **Equipe Multidisciplinar (`psicologia`, `terapeuta_ocupacional`, `fisioterapeuta`, `nutricionista`)**
  - Foco apenas no acompanhamento do Residente e nas abas de Multidisciplinar.
  - Eles podem ver Residentes e acessar Agenda de Atendimentos.
  - Não possuem acesso ao financeiro nem configurações gerais.

- **Cuidador (`cuidados`)**
  - Acesso muito restrito focado em rotina diária.
  - Acesso ao Saúde e Cuidados (Controles diários, banho, alimentação).
  - Pode acessar o painel de Agenda para a rotina diária.

- **Visitante Institucional (`visitante`)**
  - Usado num terminal na porta da ILPI.
  - Só acessa a tela de "Portal do Visitante" para autoatendimento e registro de visita (nenhum menu lateral, nenhum dado exposto).

## Operações no Backend

O sistema conta agora com o middleware de segurança (`requireAuth` e `requireRole`) em rotas da API:
- `GET /api/residents` → Apenas para profissionais da instituição. Retorna registros sem a flag de `archived: true`.
- `POST /api/residents` → Profissionais com acesso de edição (não cuidadores básicos, embora dependa do hospital). O backend insere logs de auditoria (`auditLog`) com `userId`, `action` e `date`.
- `DELETE /api/residents` → Permissão para gerência ou especialidades fortes. O sistema aplica inativação lógica através de `archived: true` protegendo contra "apagamento físico" inadequado.
- (E o fluxo segue replicado para Triagens/Candidatos e afins).

## Operações em Lote e Limitações de Atomicidade

Para operações em lote (`POST /api/residents/bulk` e `POST /api/candidates/bulk`):
- **Pré-validação**: É realizada a pré-validação rigorosa de autorização e escopo institucional de todos os itens antes de iniciar as gravações, reduzindo expressivamente falhas de autorização durante a escrita.
- **Limitação de Atomicidade**: As gravações são particionadas em lotes de no máximo 400 documentos por batch do Firestore. Commits separados **não garantem a atomicidade do conjunto completo**.
- **Comportamento em Falha**: Uma falha posterior durante o commit de um lote subsequente pode deixar grupos de lotes anteriores já gravados e persistidos no banco de dados. O lote inteiro **não** é transacionalmente atômico.

