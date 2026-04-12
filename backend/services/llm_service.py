from openai import AsyncOpenAI, OpenAIError

from config import settings
from schemas import PatientPlanOutput

_SYSTEM_PROMPT = """Você é um Navegador de Pacientes Especialista. Sua tarefa é analisar \
um resumo de alta médica ou consulta e transformá-lo em uma jornada de cuidado segura.

Regras Absolutas:
1. Não faça diagnósticos e não prescreva novos tratamentos. Apenas simplifique o que já \
foi prescrito pelo médico.
2. Traduza termos médicos para linguagem acessível (nível de compreensão de uma criança \
de 12 anos), sem perder a precisão clínica.
3. Identifique sinais de alerta (Red Flags) com prioridade máxima. Se houver risco \
iminente, a orientação de retorno deve ser enfática.

Classificação de Risco — critérios obrigatórios e decisivos:
- "alto": PRIORIDADE MÁXIMA para abdome agudo, apendicite ou sinal de Blumberg positivo. \
Classifique também como "alto" qualquer suspeita ou confirmação de condição aguda que \
exija avaliação presencial imediata (ex.: infarto, AVC, obstrução intestinal, sepse, \
dispneia grave, dor abdominal intensa sem diagnóstico fechado, febre alta com rigidez de \
nuca). Na dúvida entre "medio" e "alto", classifique SEMPRE como "alto".
- "medio": quadro crônico com instabilidade recente, ou condição que exige monitoramento \
próximo nos próximos dias (ex.: nefrolitíase em alta, hipertensão não controlada, infecção \
moderada com antibioticoterapia em curso, diabetes descompensada).
- "baixo": condição benigna, autolimitada, com diagnóstico fechado e plano clínico claro \
(ex.: IVAS/síndrome gripal, gastroenterite leve sem sinais de alarme, contusão simples, \
faringite viral).

Formato de saída — JSON estrito com os campos:
- diagnostico_simplificado: rótulo clínico curto e direto. MÁXIMO de 4 palavras. \
Use terminologia médica concisa que identifique o quadro do paciente. \
Exemplos corretos: "Pós-Angioplastia Coronária", "Diabetes Gestacional", \
"Síndrome Gripal", "Nefrolitíase em Alta", "Suspeita de Apendicite Aguda". \
NUNCA inclua saudações, frases completas, explicações ou a palavra "Diagnóstico".
- plano_acao_hoje: ações prioritárias do dia em linguagem acessível
- medicacoes: lista de strings com as medicações já prescritas, simplificadas
- sinais_alerta_red_flags: lista de strings com sinais que exigem retorno imediato
- risco_continuidade: exatamente uma das strings "baixo", "medio" ou "alto"
"""

_client: AsyncOpenAI | None = None


class LLMServiceError(Exception):
    """Exceção controlada do serviço de LLM — nunca expõe detalhes internos ao cliente."""


def _get_client() -> AsyncOpenAI:
    """Inicialização lazy do cliente OpenAI para reutilização de conexões."""
    global _client
    if _client is not None:
        return _client
    if not settings.LLM_API_KEY:
        raise LLMServiceError("LLM_API_KEY não configurada. Atualize o arquivo .env.")
    _client = AsyncOpenAI(api_key=settings.LLM_API_KEY)
    return _client


async def generate_clinical_plan(raw_text: str) -> PatientPlanOutput:
    """
    Envia o texto clínico ao LLM e retorna um PatientPlanOutput estruturado.

    ATENÇÃO: Este sistema NÃO realiza diagnóstico médico nem prescrição.
    O LLM apenas reorganiza e simplifica o que já consta no texto de entrada.
    Erros internos são suprimidos para evitar vazamento de prompts ou chaves.
    """
    client = _get_client()
    try:
        response = await client.beta.chat.completions.parse(
            model=settings.LLM_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": raw_text},
            ],
            response_format=PatientPlanOutput,
            temperature=0.2,
            max_tokens=1_024,
        )
    except OpenAIError as exc:
        raise LLMServiceError("Falha na comunicação com o serviço de IA.") from exc
    except Exception as exc:
        raise LLMServiceError("Erro inesperado ao processar o plano clínico.") from exc

    plan = response.choices[0].message.parsed
    if plan is None:
        raise LLMServiceError("O modelo não retornou uma resposta estruturada válida.")

    return plan
