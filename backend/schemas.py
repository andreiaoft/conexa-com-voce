from enum import Enum
from typing import List, Literal

from pydantic import BaseModel, Field, field_validator


class RiscoContinuidade(str, Enum):
    baixo = "baixo"
    medio = "medio"
    alto = "alto"


class ClinicalInput(BaseModel):
    """
    Entrada operacional do sistema.
    O sistema recebe texto clínico livre ou extraído de PDF textual.
    """

    raw_text: str = Field(
        ...,
        min_length=1,
        max_length=8_000,
        description="Resumo clínico de alta ou consulta em texto livre.",
    )

    @field_validator("raw_text")
    @classmethod
    def validate_raw_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("O texto clínico não pode estar vazio.")
        return v


class PatientPlanOutput(BaseModel):
    """
    Saída estruturada gerada pelo LLM.
    Não constitui diagnóstico nem prescrição médica nova.
    """

    diagnostico_simplificado: str = Field(
        ...,
        min_length=1,
        max_length=80,
        description="Rótulo clínico curto e simples.",
    )
    plano_acao_hoje: str = Field(
        ...,
        min_length=1,
        max_length=1_200,
        description="Plano de ação do dia em linguagem acessível.",
    )
    medicacoes: List[str] = Field(
        default_factory=list,
        description="Lista de medicações já prescritas, simplificadas.",
    )
    sinais_alerta_red_flags: List[str] = Field(
        default_factory=list,
        description="Lista de sinais de alerta que exigem retorno.",
    )
    risco_continuidade: RiscoContinuidade = Field(
        ...,
        description='Classificação de risco: "baixo", "medio" ou "alto".',
    )

    @field_validator("diagnostico_simplificado", "plano_acao_hoje")
    @classmethod
    def strip_required_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Campo obrigatório vazio.")
        return v

    @field_validator("medicacoes", "sinais_alerta_red_flags")
    @classmethod
    def clean_string_lists(cls, values: List[str]) -> List[str]:
        cleaned = []
        for item in values:
            if not isinstance(item, str):
                continue
            text = item.strip()
            if text:
                cleaned.append(text)
        return cleaned


class DashboardCaseRow(BaseModel):
    """
    Linha exibida no dashboard operacional.
    """

    case_id: str = Field(..., min_length=1, max_length=32)
    patient_id: str = Field(..., min_length=1, max_length=32)
    diagnostico_simplificado: str = Field(..., min_length=1, max_length=80)
    risco_continuidade: RiscoContinuidade
    teach_back_status: Literal["pendente", "confirmado", "necessita_reforco"]
    sinais_alerta_red_flags: List[str] = Field(default_factory=list)
    acao_sugerida: str = Field(..., min_length=1, max_length=300)

    @field_validator(
        "case_id",
        "patient_id",
        "diagnostico_simplificado",
        "acao_sugerida",
    )
    @classmethod
    def strip_dashboard_text(cls, v: str) -> str:
        return v.strip()


class GeneratePlanResponse(PatientPlanOutput):
    """
    Resposta final do endpoint de geração de plano.
    """

    case_id: str = Field(..., min_length=1, max_length=32)
    patient_id: str = Field(..., min_length=1, max_length=32)

    @field_validator("case_id", "patient_id")
    @classmethod
    def strip_ids(cls, v: str) -> str:
        return v.strip()


class TeachBackInput(BaseModel):
    """
    Entrada do paciente/cuidador confirmando entendimento.
    """

    patient_id: str = Field(..., min_length=1, max_length=32)
    understood_instructions: bool
    patient_notes: str = Field(default="", max_length=1_000)

    @field_validator("patient_id", "patient_notes")
    @classmethod
    def strip_teach_back_fields(cls, v: str) -> str:
        return v.strip()


class TeachBackResponse(BaseModel):
    ok: bool
    patient_id: str = Field(..., min_length=1, max_length=32)

    @field_validator("patient_id")
    @classmethod
    def strip_patient_id(cls, v: str) -> str:
        return v.strip()