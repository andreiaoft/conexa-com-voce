import io
import re
import uuid

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


def _clean_pdf_text(raw: str) -> str:
    """Normaliza texto de PDF: colapsa quebras de linha simples em espaços,
    preservando parágrafos (duplos) para manter a estrutura semântica."""
    text = re.sub(r"\n{3,}", "\n\n", raw)
    text = re.sub(r"(?<!\n)\n(?!\n)", " ", text)
    text = re.sub(r" {2,}", " ", text)
    return text.strip()

_ACAO_POR_RISCO: dict[RiscoContinuidade, str] = {
    RiscoContinuidade.baixo: "Monitorar sintomas; retorno se persistência além de 72h.",
    RiscoContinuidade.medio: "Agendar retorno ambulatorial e reforçar adesão ao plano.",
    RiscoContinuidade.alto: "Avaliação presencial urgente; follow-up em até 24h.",
}

# Store em memória para o MVP. Em produção, substituir por repositório com banco de dados.
_case_store: list[DashboardCaseRow] = []

app = FastAPI(title="ConexA COM Você API")

# Restrito às origens do Vite em desenvolvimento — sem wildcards.
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
        content={"detail": "Erro interno. Tente novamente mais tarde."},
    )


@app.get("/api/cases", response_model=list[DashboardCaseRow])
def list_cases() -> list[DashboardCaseRow]:
    return list(_case_store)


@app.post("/api/extract-pdf")
async def extract_pdf(file: UploadFile = File(...)) -> dict[str, str]:
    """
    Extrai texto de um PDF textual (máx. 5 MB).
    Sem análise clínica — apenas extração de conteúdo.
    """
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="O arquivo deve ser um PDF válido.")

    content = await file.read()
    if len(content) > _MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="O PDF excede o limite de 5 MB.")

    try:
        reader = PdfReader(io.BytesIO(content))
        raw = "\n\n".join(page.extract_text() or "" for page in reader.pages)
        text = _clean_pdf_text(raw)
    except Exception:
        raise HTTPException(
            status_code=422,
            detail="Não foi possível ler o PDF. Verifique se o arquivo não está protegido.",
        )

    if not text:
        raise HTTPException(
            status_code=422,
            detail="O PDF não contém texto extraível. PDFs digitalizados (imagem) não são suportados.",
        )

    return {"text": text[:8_000]}


@app.delete("/api/cases", status_code=204)
def clear_cases() -> None:
    """Limpa o store em memória. Em produção exigirá autenticação de gestor."""
    _case_store.clear()


@app.post("/api/generate-plan", response_model=GeneratePlanResponse)
async def generate_plan(body: ClinicalInput) -> GeneratePlanResponse:
    """
    Gera plano de continuidade pós-alta via LLM.
    NÃO constitui diagnóstico médico nem prescrição.
    """
    try:
        plan = await generate_clinical_plan(body.raw_text)
    except LLMServiceError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=503, detail="Erro ao gerar plano. Tente novamente.")

    case_id = f"CASO-{uuid.uuid4().hex[:8].upper()}"
    patient_id = f"PAC-{uuid.uuid4().hex[:8].upper()}"

    _case_store.append(
        DashboardCaseRow(
            case_id=case_id,
            patient_id=patient_id,
            diagnostico_simplificado=plan.diagnostico_simplificado,
            risco_continuidade=plan.risco_continuidade,
            teach_back_status="pendente",
            sinais_alerta_red_flags=plan.sinais_alerta_red_flags,
            acao_sugerida=_ACAO_POR_RISCO[plan.risco_continuidade],
        )
    )

    return GeneratePlanResponse(case_id=case_id, patient_id=patient_id, **plan.model_dump())


@app.post("/api/teach-back", response_model=TeachBackResponse)
def teach_back(body: TeachBackInput) -> TeachBackResponse:
    status = "confirmado" if body.understood_instructions else "necessita_reforco"
    for case in _case_store:
        if case.patient_id == body.patient_id:
            case.teach_back_status = status
            break
    return TeachBackResponse(ok=True, patient_id=body.patient_id)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
