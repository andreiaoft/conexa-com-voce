# ConexA COM Você — Orquestrador de Continuidade Pós-Alta

## Resumo Executivo

ConexA COM Você é uma plataforma assistencial de tecnologia em saúde projetada para eliminar a lacuna de cuidado entre a alta hospitalar e o acompanhamento ambulatorial. O sistema atua como um **Orquestrador de Continuidade Pós-Alta**: processa resumos clínicos textuais ou documentos PDF, aplica inteligência artificial para transformar linguagem técnica em orientações acessíveis ao paciente, estratifica o risco de reinternação e fornece ao gestor de saúde um painel operacional em tempo real.

A solução é construída sobre uma arquitetura de API desacoplada, com backend assíncrono em Python e frontend reativo em React, comunicando-se exclusivamente via contrato Pydantic-validado. Nenhum dado clínico é armazenado de forma persistente na camada de MVP — toda a rastreabilidade é mantida em memória de sessão, eliminando vetores de exposição de dados sensíveis em repouso.

---

## Tese do Projeto

A fragmentação do cuidado no pós-alta hospitalar é um dos principais vetores de reinternação precoce e de eventos adversos evitáveis. Quando um paciente recebe alta, a transferência de conhecimento clínico para o cuidado domiciliar ocorre quase exclusivamente através de documentos densos em termos técnicos e orientações verbais que o paciente raramente compreende ou retém.

ConexA COM Você resolve esta ruptura em três camadas:

1. **Tradução clínica assistida por IA**: O resumo de alta, escrito em linguagem médica, é processado por um modelo de linguagem de grande escala (LLM) com instrução precisa para produzir um plano de cuidado em linguagem acessível, sem realizar diagnósticos nem prescrições adicionais.

2. **Verificação de compreensão (teach-back digital)**: O paciente ou seu cuidador confirma o entendimento das orientações através de um formulário estruturado. O status de confirmação é registrado e sincronizado com o Dashboard Operacional.

3. **Estratificação de risco para gestão ativa**: Um algoritmo de classificação, governado por critérios clínicos explícitos embutidos no prompt do LLM, produz um nível de risco (`baixo`, `médio`, `alto`) por caso. Casos de risco alto ativam um gatilho de acionamento de navegação humana diretamente no painel do gestor.

---

## Arquitetura do Sistema

### Visão Geral

```
[ Equipe Assistencial ]
        |
        | texto clínico ou PDF
        v
[ Frontend — React + Vite ]
        |
        | HTTPS / REST (JSON + multipart/form-data)
        v
[ Backend — FastAPI + Python ]
        |
        | prompt estruturado
        v
[ OpenAI API — saída JSON validada por Pydantic ]
        |
        v
[ Store em memória — DashboardCaseRow ]
        |
        v
[ Dashboard Operacional ]
```

---

### Frontend

**Stack:** React 19 · Vite 6 · TailwindCSS 3 · PropTypes

| Componente | Responsabilidade |
|---|---|
| `OperationalInput` | Formulário de entrada de texto clínico com importação de PDF e extração automática de conteúdo |
| `PatientView` | Visualização do plano de cuidado em linguagem acessível, motor de áudio (SpeechSynthesis), confirmação de entendimento |
| `Dashboard` | Tabela operacional com estratificação de risco, red flags expansíveis e acionamento de navegação humana |

**Decisões de arquitetura relevantes:**

- **Centralização de chamadas API**: Todas as chamadas de rede são encapsuladas em `src/api.js`. Nenhum componente chama `fetch` diretamente. O contrato de erros é padronizado: `5xx` retorna mensagem genérica, `4xx` expõe o campo `detail` do Pydantic, erros de rede retornam mensagem de conectividade.
- **Hook `useAsyncAction`**: Abstração do ciclo `loading / error / try-catch / finally` compartilhado entre formulários, eliminando duplicação de estado.
- **Componente `Button`**: Sistema de variantes e tamanhos tipados (`primary`, `outlined`, `ghost`, `ghost-danger`) que garante consistência visual e evita divergência de estilos entre contextos de interação.
- **Paleta semântica Conexa**: Todas as cores são definidas como tokens no `tailwind.config.js` (`conexa-blue-dark`, `conexa-danger`, `conexa-yellow`, etc.). Nenhum valor hexadecimal aparece nos componentes.
- **Acessibilidade de voz**: O componente `PatientView` utiliza a API nativa `SpeechSynthesis` do navegador com seleção de voz pt-BR e expansão automática de siglas clínicas (29 regras de substituição: `VO` → "via oral", `mg` → "miligramas", `AVC` → "acidente vascular cerebral", etc.).

---

### Backend

**Stack:** Python 3.11+ · FastAPI 0.115+ · Pydantic v2 · OpenAI SDK · pypdf · python-dotenv

| Módulo | Responsabilidade |
|---|---|
| `config.py` | Carregamento centralizado de variáveis de ambiente via `python-dotenv`. Fonte única de verdade para `HOST`, `PORT`, `LLM_API_KEY`, `LLM_MODEL`. |
| `schemas.py` | Contratos de dados Pydantic com validação estrita: `max_length` em todos os campos de entrada textual (mitigação de DoS), `field_validator` para sanitização de whitespace, enum `RiscoContinuidade`. |
| `services/llm_service.py` | Encapsulamento da integração OpenAI com cliente singleton lazy, prompt de sistema versionado, saída estruturada via `beta.chat.completions.parse` e exceção controlada `LLMServiceError`. |
| `main.py` | Roteamento FastAPI com CORS restrito, handler global de exceções (suprime stack traces), extração e limpeza de texto PDF, store em memória de casos. |

**Rotas expostas:**

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/cases` | Retorna a lista de casos gerados na sessão atual |
| `POST` | `/api/generate-plan` | Processa texto clínico via LLM e persiste o caso no store |
| `POST` | `/api/teach-back` | Registra o status de confirmação de entendimento do paciente |
| `POST` | `/api/extract-pdf` | Extrai e normaliza texto de PDF textual (máx. 5 MB) |
| `DELETE` | `/api/cases` | Limpa o store de casos da sessão |

---

## Diferenciais de Engenharia e UX

### Extração e Normalização de PDFs

O endpoint `POST /api/extract-pdf` vai além da extração bruta. A função `_clean_pdf_text` aplica três transformações sequenciais ao texto extraído pela biblioteca `pypdf`:

1. Normalização de quebras de linha excessivas (`\n{3,}` → `\n\n`)
2. Colapso de quebras de linha simples em espaços (`\n` → ` `) — resolve o problema de frases fragmentadas linha a linha que comprometem a coerência semântica para o LLM
3. Eliminação de espaços múltiplos

O resultado é um texto de parágrafo fluido que preserva a estrutura semântica original e maximiza a qualidade da interpretação pelo modelo de linguagem.

### Motor de Acessibilidade — Expansão de Siglas Clínicas

Antes da síntese de voz, o texto do plano de cuidado passa pela função `expandAbbreviations`, que aplica uma tabela declarativa de 29 substituições via regex. Isso elimina a leitura mecânica de siglas técnicas e caracteres especiais:

- Unidades: `°C` → "graus Celsius", `mg` → "miligramas", `ml` → "mililitros"
- Vias de administração: `VO` → "via oral", `EV` → "via endovenosa", `SC` → "via subcutânea"
- Frequências: `BID` → "duas vezes ao dia", `SOS` → "se necessário"
- Condições: `IAM` → "infarto agudo do miocárdio", `AVC` → "acidente vascular cerebral", `HAS` → "hipertensão arterial"
- Caracteres de ruído: `#`, `*`, `_`, `` ` `` removidos antes da leitura

A seleção de voz prioriza, nesta ordem: voz Google feminina pt-BR, qualquer voz Google pt-BR, voz feminina por nome, índice de posição (tipicamente feminina em Chrome/Windows).

### Algoritmo de Priorização de Risco Clínico

O prompt do LLM inclui critérios de classificação explícitos e hierárquicos:

- **Alto**: Prioridade máxima para abdome agudo, apendicite e sinal de Blumberg. Inclui infarto, AVC, sepse, obstrução intestinal, dispneia grave e febre com rigidez de nuca. Regra de desempate: na dúvida entre médio e alto, classificar como alto.
- **Médio**: Instabilidade de quadro crônico — nefrolitíase, hipertensão não controlada, infecção moderada, diabetes descompensada.
- **Baixo**: Condição benigna e autolimitada com diagnóstico fechado — IVAS, gastroenterite leve, contusão simples.

No Dashboard, casos de risco alto recebem destaque de linha em vermelho claro (`bg-conexa-danger-light`) e ativam o botão **Acionar Navegação**, que confirma o início do contato humano com o paciente.

### Teach-back Digital

O módulo de confirmação de entendimento (anteriormente denominado "teach-back" na literatura clínica) coleta: confirmação de compreensão (booleano), observações do paciente (texto livre, máx. 2 000 caracteres) e atualiza o status do caso no Dashboard (`pendente` → `confirmado` ou `necessita_reforco`).

---

## Segurança e Privacidade

O sistema foi projetado com os seguintes controles alinhados à sensibilidade de dados de saúde:

| Controle | Implementação |
|---|---|
| Segregação de segredos | `LLM_API_KEY` exclusivamente via variável de ambiente (`.env`), nunca exposta em código-fonte ou resposta de API |
| Supressão de erros internos | Handler global `_unhandled_exception_handler` retorna `"Erro interno."` genérico — stack traces e conteúdo de prompts nunca chegam ao cliente |
| Validação de payloads | `ClinicalInput.raw_text` limitado a 8 000 caracteres; `patient_notes` a 2 000 caracteres — mitigação de ataques DoS por payload excessivo |
| Sanitização de inputs | `field_validator` em todos os campos textuais do Pydantic aplica `str.strip()` antes de qualquer processamento |
| CORS restrito | Origens permitidas exclusivamente: `http://localhost:5173` e `http://127.0.0.1:5173` — sem wildcards |
| Sem persistência em disco | Dados clínicos residem exclusivamente em memória de processo — eliminando vetores de exposição de dados em repouso para o MVP |
| Validação de tipo de arquivo | Upload de PDF valida `Content-Type: application/pdf` e limita o tamanho a 5 MB antes de qualquer processamento |

---

## Instalação e Setup

### Pré-requisitos

- Python 3.11 ou superior
- Node.js 18 ou superior
- Chave de API OpenAI com acesso ao modelo `gpt-4o-mini` (ou superior)

---

### Backend

```bash
cd backend
```

**1. Criar e ativar o ambiente virtual:**

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux / macOS
source .venv/bin/activate
```

**2. Instalar dependências:**

```bash
pip install -r requirements.txt
```

**3. Configurar variáveis de ambiente:**

```bash
cp .env.example .env
```

Edite `.env` e preencha `LLM_API_KEY` com a sua chave OpenAI:

```
HOST=127.0.0.1
PORT=8000
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini
```

**4. Iniciar o servidor:**

```bash
python main.py
```

O servidor ficará disponível em `http://127.0.0.1:8000`. A documentação interativa da API estará em `http://127.0.0.1:8000/docs`.

---

### Frontend

```bash
cd frontend
```

**1. Instalar dependências:**

```bash
npm install
```

**2. Configurar variáveis de ambiente:**

```bash
cp .env.example .env
```

O arquivo `.env` padrão aponta para o backend local:

```
VITE_API_URL=http://127.0.0.1:8000
```

**3. Iniciar o servidor de desenvolvimento:**

```bash
npm run dev
```

A aplicação ficará disponível em `http://localhost:5173`.

---

### Build de Produção (Frontend)

```bash
npm run build
```

Os artefatos otimizados serão gerados em `frontend/dist/`.

---

## Estrutura do Projeto

```
conexa/
├── backend/
│   ├── services/
│   │   └── llm_service.py       # Integração OpenAI e prompt clínico
│   ├── config.py                # Carregamento de variáveis de ambiente
│   ├── main.py                  # Rotas FastAPI e lógica de negócio
│   ├── schemas.py               # Contratos Pydantic
│   ├── requirements.txt
│   ├── .env.example
│   └── .env                     # Não versionado
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/              # Button, Card, Textarea, InlineAlert, SectionHeading
│   │   │   ├── Dashboard.jsx
│   │   │   ├── OperationalInput.jsx
│   │   │   └── PatientView.jsx
│   │   ├── hooks/
│   │   │   └── useAsyncAction.js
│   │   ├── api.js               # Cliente HTTP centralizado
│   │   └── App.jsx
│   ├── tailwind.config.js       # Paleta semântica Conexa
│   ├── .env.example
│   └── .env                     # Não versionado
├── .gitignore
├── SETUP.md
└── README.md
```

---

## Limitações do MVP e Roadmap

| Limitação atual | Evolução proposta |
|---|---|
| Store em memória (dados perdidos ao reiniciar) | Repositório com banco de dados relacional (PostgreSQL) |
| Sem autenticação de usuário | OAuth 2.0 com perfis de gestor e equipe assistencial |
| Rota `DELETE /api/cases` sem proteção | Autenticação de gestor antes da exposição |
| LLM única como motor de risco | Pipeline de validação clínica com regras determinísticas como camada de segurança adicional |
| Texto extraído de PDF sem OCR | Integração com serviço de OCR para documentos digitalizados |

---

## Declaração de Não-Diagnóstico

O ConexA COM Você **não realiza diagnósticos médicos e não prescreve tratamentos**. O sistema utiliza inteligência artificial exclusivamente para reorganizar, simplificar e traduzir informações já contidas no documento clínico de entrada, com o objetivo de melhorar a compreensão do paciente sobre orientações previamente estabelecidas por profissional de saúde habilitado. Toda decisão clínica permanece sob responsabilidade exclusiva do médico assistente.
