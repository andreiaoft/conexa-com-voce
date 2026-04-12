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
    text = re.sub(r"\n{3,}", "\n\n", raw)
    text = re.sub(r"(?<!\n)\n(?!\n)", " ", text)
    text = re.sub(r" {2,}", " ", text)
    return text.strip()

_ACAO_POR_RISCO = {
    RiscoContinuidade.baixo: "Monitorar sintomas; retorno se persistência além de 72h.",
    RiscoContinuidade.medio: "Agendar retorno ambulatorial e reforçar adesão ao plano.",
    RiscoContinuidade.alto: "Avaliação presencial urgente; follow-up em até 24h.",
}

_case_store: list[DashboardCaseRow] = []

app = FastAPI(title="ConexA COM Você API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "https://conexa-com-voce.vercel.app"],
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

@app.post("/api/generate-plan", response_model=GeneratePlanResponse)
async def generate_plan(body: ClinicalInput) -> GeneratePlanResponse:
    try:
        plan = await generate_clinical_plan(body.raw_text)
        
        # --- BLOQUEADOR SÊNIOR: DIAGNÓSTICO E RISCO ---
        diag = plan.diagnostico_simplificado.strip()
        
        # Se a IA alucinar e colocar o roteiro no diagnóstico ou texto muito longo
        if "olá" in diag.lower() or "conexa" in diag.lower() or len(diag) > 45:
            plan.diagnostico_simplificado = "Revisão Pós-Alta"
        else:
            plan.diagnostico_simplificado = diag[:40]

        # Regra de Ouro: Termos graves = Risco Alto Obrigatório
        termos_de_alerta = ["stent", "infarto", "angioplastia", "iam", "cirurgia", "cateterismo", "angina"]
        if any(t in body.raw_text.lower() for t in termos_de_alerta):
            plan.risco_continuidade = RiscoContinuidade.alto
        # --------------------------------------------

        case_id = f"CASO-{uuid.uuid4().hex[:8].upper()}"
        patient_id = f"PAC-{uuid.uuid4().hex[:8].upper()}"

        _case_store.append(DashboardCaseRow(
            case_id=case_id,
            patient_id=patient_id,
            diagnostico_simplificado=plan.diagnostico_simplificado,
            risco_continuidade=plan.risco_continuidade,
            teach_back_status="pendente",
            sinais_alerta_red_flags=plan.sinais_alerta_red_flags,
            acao_sugerida=_ACAO_POR_RISCO[plan.risco_continuidade],
        ))
        return GeneratePlanResponse(case_id=case_id, patient_id=patient_id, **plan.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)