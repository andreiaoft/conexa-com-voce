import io
import json
import re
import uuid
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pypdf import PdfReader

from config import settings
from schemas import (
    ClinicalInput,
    DashboardCaseRow,
    GeneratePlanResponse,
    RiscoContinuidade,
    TeachBackInput,
    TeachBackResponse,
)
from services.llm_service import LLMServiceError, generate_clinical_plan

_MAX_PDF_BYTES = 5 * 1024 * 1024  # 5 MB
_BASE_DIR = Path(__file__).resolve().parent
_CASE_STORE_FILE = _BASE_DIR / "case_store.json"


def _clean_pdf_text(raw: str) -> str:
    text = re.sub(r"\n{3,}", "\n\n", raw)
    text = re.sub(r"(?<!\n)\n(?!\n)", " ", text)
    text = re.sub(r" {2,}", " ", text)
    return text.strip()


def _contains_any(text: str, terms: list[str]) -> bool:
    t = text.lower()
    return any(term in t for term in terms)


def _classificar_risco_deterministico(raw_text: str) -> RiscoContinuidade:
    text = raw_text.lower()

    termos_alto = [
        "infarto",
        "iam",
        "angioplastia",
        "stent",
        "cateterismo",
        "angina",
        "sepse",
        "choque",
        "instabilidade hemodinâmica",
        "instabilidade hemodinamica",
        "hipotensão",
        "hipotensao",
        "avc",
        "cirurgia",
        "pós-operatório",
        "pos-operatorio",
        "obstrução intestinal",
        "obstrucao intestinal",
        "abdome agudo",
        "apendicite",
        "blumberg",
        "dispneia grave",
        "falta de ar importante",
        "dor abdominal intensa",
        "dor abdominal difusa com piora",
        "dor persistente sem melhora",
        "vômitos persistentes",
        "vomitos persistentes",
        "febre alta persistente",
        "sangramento",
        "sangramento ativo",
        "desmaio",
        "síncope",
        "sincope",
        "rebaixamento do estado geral",
        "rebaixamento do nível de consciência",
        "rebaixamento do nivel de consciencia",
        "confusão mental",
        "confusao mental",
        "distensão abdominal",
        "distensao abdominal",
        "incapacidade de ingerir líquidos",
        "incapacidade de ingerir liquidos",
        "redução importante da aceitação oral",
        "reducao importante da aceitacao oral",
        "prostração importante",
        "prostracao importante",
        "saturação 90",
        "saturacao 90",
        "dessaturação",
        "dessaturacao",
        "anúria",
        "anuria",
    ]

    termos_medio = [
        "nefrolitíase",
        "nefrolitiase",
        "cólica renal",
        "colica renal",
        "litíase renal",
        "litiase renal",
        "litíase ureteral",
        "litiase ureteral",
        "litíase",
        "litiase",
        "dor lombar em cólica",
        "dor lombar em colica",
        "dor lombar intensa",
        "náuseas",
        "nauseas",
        "vômitos",
        "vomitos",
        "seguimento ambulatorial",
        "retorno ambulatorial",
        "acompanhamento ambulatorial",
        "reavaliação",
        "reavaliacao",
        "monitoramento próximo",
        "monitoramento proximo",
        "piora nos próximos dias",
        "piora nos proximos dias",
        "infecção moderada",
        "infeccao moderada",
        "infecção urinária",
        "infeccao urinaria",
        "diabetes descompensada",
        "hipertensão não controlada",
        "hipertensao nao controlada",
        "analgesia no pronto atendimento",
        "melhora parcial da dor",
    ]

    termos_baixo = [
        "síndrome gripal",
        "sindrome gripal",
        "ivas",
        "infecção viral de vias aéreas superiores",
        "infeccao viral de vias aereas superiores",
        "quadro viral leve",
        "resfriado comum",
        "faringite viral",
        "rinite viral",
        "gastroenterite leve",
        "contusão simples",
        "contusao simples",
        "coriza",
        "odinofagia leve",
        "tosse seca ocasional",
        "febre referida de até 37,8",
        "febre referida de ate 37,8",
        "sem sinais de toxemia",
        "saturação 98",
        "saturacao 98",
        "ausculta pulmonar sem alterações relevantes",
        "ausculta pulmonar sem alteracoes relevantes",
        "hidratação oral",
        "hidratacao oral",
        "lavagem nasal com soro fisiológico",
        "lavagem nasal com soro fisiologico",
        "repouso",
        "alta com orientações",
        "alta com orientacoes",
    ]

    if _contains_any(text, termos_baixo):
        return RiscoContinuidade.baixo

    if _contains_any(text, termos_medio):
        return RiscoContinuidade.medio

    if _contains_any(text, termos_alto):
        return RiscoContinuidade.alto

    return RiscoContinuidade.medio


_ACAO_POR_RISCO = {
    RiscoContinuidade.baixo: "Monitorar sintomas; retorno se persistência além de 72h.",
    RiscoContinuidade.medio: "Agendar retorno ambulatorial e reforçar adesão ao plano.",
    RiscoContinuidade.alto: "Avaliação presencial urgente; follow-up em até 24h.",
}


def _load_case_store() -> list[DashboardCaseRow]:
    if not _CASE_STORE_FILE.exists():
        return []

    try:
        raw = json.loads(_CASE_STORE_FILE.read_text(encoding="utf-8"))
        if not isinstance(raw, list):
            return []

        restored: list[DashboardCaseRow] = []
        for item in raw:
            try:
                restored.append(DashboardCaseRow(**item))
            except Exception:
                continue
        return restored
    except Exception:
        return []


def _save_case_store(rows: list[DashboardCaseRow]) -> None:
    payload = [row.model_dump() for row in rows]
    _CASE_STORE_FILE.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


_case_store: list[DashboardCaseRow] = _load_case_store()

app = FastAPI(title="ConexA COM Você API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://conexa-com-voce.vercel.app",
    ],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno no servidor ConexA."},
    )


@app.get("/api/cases", response_model=list[DashboardCaseRow])
def list_cases() -> list[DashboardCaseRow]:
    return list(_case_store)


@app.post("/api/extract-pdf")
async def extract_pdf(file: UploadFile = File(...)) -> dict[str, str]:
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="O arquivo deve ser um PDF.")

    content = await file.read()
    if len(content) > _MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="PDF muito grande.")

    try:
        reader = PdfReader(io.BytesIO(content))
        raw = "\n\n".join(page.extract_text() or "" for page in reader.pages)
        text = _clean_pdf_text(raw)
    except Exception:
        raise HTTPException(status_code=422, detail="Erro ao ler o PDF.")

    return {"text": text[:8_000]}


@app.delete("/api/cases", status_code=204)
def clear_cases() -> None:
    _case_store.clear()
    _save_case_store(_case_store)


@app.post("/api/generate-plan", response_model=GeneratePlanResponse)
async def generate_plan(body: ClinicalInput) -> GeneratePlanResponse:
    try:
        raw = body.raw_text.strip()

        if len(raw) < 30:
            raise HTTPException(
                status_code=400,
                detail="Texto clínico insuficiente para gerar o plano. Cole um resumo de alta ou consulta mais completo.",
            )

        plan = await generate_clinical_plan(raw)

        diag = plan.diagnostico_simplificado.strip()

        if "olá" in diag.lower() or "conexa" in diag.lower() or len(diag) > 45:
            plan.diagnostico_simplificado = "Revisão Pós-Alta"
        else:
            plan.diagnostico_simplificado = diag[:40]

        plan.risco_continuidade = _classificar_risco_deterministico(raw)

        case_id = f"CASO-{uuid.uuid4().hex[:8].upper()}"
        patient_id = f"PAC-{uuid.uuid4().hex[:8].upper()}"

        row = DashboardCaseRow(
            case_id=case_id,
            patient_id=patient_id,
            diagnostico_simplificado=plan.diagnostico_simplificado,
            risco_continuidade=plan.risco_continuidade,
            teach_back_status="pendente",
            sinais_alerta_red_flags=plan.sinais_alerta_red_flags,
            acao_sugerida=_ACAO_POR_RISCO[plan.risco_continuidade],
        )

        _case_store.append(row)
        _save_case_store(_case_store)

        return GeneratePlanResponse(
            case_id=case_id,
            patient_id=patient_id,
            **plan.model_dump(),
        )

    except HTTPException:
        raise
    except LLMServiceError:
        raise HTTPException(status_code=500, detail="Falha ao processar o plano clínico.")
    except Exception:
        raise HTTPException(status_code=500, detail="Erro interno no servidor ConexA.")


@app.post("/api/teach-back", response_model=TeachBackResponse)
def teach_back(body: TeachBackInput) -> TeachBackResponse:
    status = "confirmado" if body.understood_instructions else "necessita_reforco"

    for case in _case_store:
        if case.patient_id == body.patient_id:
            case.teach_back_status = status
            _save_case_store(_case_store)
            break

    return TeachBackResponse(ok=True, patient_id=body.patient_id)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)