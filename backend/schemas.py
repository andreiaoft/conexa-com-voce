from enum import Enum

from pydantic import BaseModel, Field, field_validator


class RiscoContinuidade(str, Enum):
    baixo = "baixo"
    medio = "medio"
    alto = "alto"


class ClinicalInput(BaseModel):
    """
    Input de texto clínico fornecido pela equipe operacional.
    Este sistema NÃO realiza diagnóstico clínico nem prescrição médica.
    O campo raw_text é limitado para mitigar ataques DoS por payload excessivo.
    """

    raw_text: str = Field(min_length=1, max_length=8_000)

    @field_validator("raw_text")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip()


class TeachBackInput(BaseModel):
    """
    Registo do teach-back aplicado ao paciente pós-orientação.
    Este sistema NÃO realiza diagnóstico clínico nem prescrição médica.
    """

    patient_id: str = Field(min_length=1, max_length=50)
    understood_instructions: bool
    patient_notes: str = Field(max_length=2_000)

    @field_validator("patient_id", "patient_notes")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip()


class PatientPlanOutput(BaseModel):
    """
    Plano de continuidade pós-alta gerado pelo LLM.
    NÃO constitui diagnóstico médico nem prescrição. Uso exclusivo de orientação
    operacional e educação do paciente para seguimento ambulatorial.
    """

    diagnostico_simplificado: str
    plano_acao_hoje: str
    medicacoes: list[str]
    sinais_alerta_red_flags: list[str]
    risco_continuidade: RiscoContinuidade


class GeneratePlanResponse(PatientPlanOutput):
    """
    Resposta completa da rota generate-plan.
    Estende PatientPlanOutput com os identificadores do caso gravado no store,
    eliminando a necessidade de um segundo request para obter case_id/patient_id.
    """

    case_id: str
    patient_id: str


class TeachBackResponse(BaseModel):
    ok: bool
    patient_id: str


class DashboardCaseRow(BaseModel):
    """
    Linha de caso para exibição no dashboard operacional.
    Dados de acompanhamento apenas — sem decisão clínica.
    """

    case_id: str
    patient_id: str
    diagnostico_simplificado: str
    risco_continuidade: RiscoContinuidade
    teach_back_status: str
    sinais_alerta_red_flags: list[str]
    acao_sugerida: str
