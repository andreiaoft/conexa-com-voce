# Configuração do ambiente — Conexa Com Você

Este guia descreve os passos necessários para executar o projeto localmente após clonar o repositório.

## Pré-requisitos

- Python 3.11+
- Node.js 18+
- npm 9+

---

## 1. Variáveis de ambiente

Os arquivos `.env` **não são versionados** (estão no `.gitignore`).  
Cada pasta possui um arquivo `.env.example` como modelo. Copie-o e ajuste os valores.

### Backend

```bash
cd backend
cp .env.example .env
```

Edite `backend/.env` e preencha:

| Variável      | Descrição                                      | Exemplo            |
|---------------|------------------------------------------------|--------------------|
| `HOST`        | Endereço de escuta do servidor                 | `127.0.0.1`        |
| `PORT`        | Porta do servidor                              | `8000`             |
| `LLM_API_KEY` | Chave de API do modelo de linguagem (futuro)   | `sk-...`           |

### Frontend

```bash
cd frontend
cp .env.example .env
```

Edite `frontend/.env` e preencha:

| Variável        | Descrição                        | Exemplo                    |
|-----------------|----------------------------------|----------------------------|
| `VITE_API_URL`  | URL base do Backend FastAPI      | `http://127.0.0.1:8000`    |

> Variáveis do Vite devem obrigatoriamente ter o prefixo `VITE_` para serem expostas ao bundle.

---

## 2. Instalação das dependências

### Backend

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux / macOS
source .venv/bin/activate

pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

---

## 3. Executar em desenvolvimento

Abra dois terminais separados:

**Terminal 1 — Backend**

```bash
cd backend
# com .venv ativado
uvicorn main:app --reload
# ou diretamente:
python main.py
```

O servidor sobe em `http://127.0.0.1:8000` (ou conforme `HOST`/`PORT` no `.env`).

**Terminal 2 — Frontend**

```bash
cd frontend
npm run dev
```

A interface fica disponível em `http://localhost:5173`.

---

## 4. Segurança

- Nunca commitar arquivos `.env` com chaves reais.
- O `LLM_API_KEY` deve ser tratado como segredo; use um cofre de segredos em produção (ex.: AWS Secrets Manager, Azure Key Vault).
- Em produção, restrinja `CORS` no `main.py` para as origens do domínio real.
