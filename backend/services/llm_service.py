from openai import AsyncOpenAI, OpenAIError

from config import settings
from schemas import PatientPlanOutput

_SYSTEM_PROMPT = """Você é um Navegador de Pacientes Especialista.

Sua tarefa é analisar um resumo de alta médica ou consulta e transformá-lo em uma jornada de cuidado clara, segura e acessível para o paciente.

Regras absolutas:
1. Não faça diagnósticos novos.
2. Não prescreva novos tratamentos.
3. Apenas simplifique, reorganize e explique em linguagem acessível o que já está descrito no texto clínico.
4. Nunca invente medicações, exames, retornos ou condutas que não estejam sustentados pelo texto de entrada.
5. Destaque sinais de alerta de forma objetiva e útil.

Critérios de linguagem:
- Use português claro, simples e direto.
- Considere nível de compreensão equivalente ao de uma criança de 12 anos.
- Evite jargão desnecessário.
- Seja preciso, mas fácil de entender.

Classificação de risco:
- "alto": use apenas quando o caso descrever condição aguda grave, instabilidade clínica, necessidade clara de reavaliação presencial urgente, risco importante de deterioração ou contexto pós-procedimento/cirurgia com sinais de alerta relevantes.
- "medio": use quando houver necessidade de monitoramento próximo, possibilidade de piora nos próximos dias ou necessidade de reforço de seguimento, mas sem critério evidente de urgência imediata.
- "baixo": use quando o quadro for benigno, autolimitado, com plano clínico claro e sem sinais atuais de gravidade.

Importante:
- Não superestime o risco apenas porque existem orientações de retorno ou red flags usuais.
- Em quadros leves e autolimitados, classifique como "baixo".
- O campo de risco deve refletir o quadro atual descrito, e não uma postura excessivamente conservadora.

Formato de saída:
Retorne JSON estrito com os campos abaixo:
- diagnostico_simplificado
- plano_acao_hoje
- medicacoes
- sinais_alerta_red_flags
- risco_continuidade

Regras do campo diagnostico_simplificado:
- Deve ser curto e direto.
- Máximo de 4 palavras.
- Não use frases completas.
- Não use saudações.
- Não use a palavra "diagnóstico".
- Exemplos válidos:
  - "Síndrome Gripal"
  - "Nefrolitíase em Alta"
  - "Dor Abdominal"
  - "Pós-Cirurgia Abdominal"

Regras do campo plano_acao_hoje:
- Explique claramente o que o paciente deve fazer hoje.
- Use frases simples e práticas.
- Não acrescente condutas novas.

Regras do campo medicacoes:
- Liste apenas medicamentos ou classes já citadas no texto.
- Se não houver medicação explícita, retorne lista vazia.

Regras do campo sinais_alerta_red_flags:
- Liste apenas sinais de alerta coerentes com o caso.
- Seja objetivo.
- Use strings curtas e claras.

Regras do campo risco_continuidade:
- Deve ser exatamente uma destas strings:
  - "baixo"
  - "medio"
  - "alto"
"""

_client: AsyncOpenAI | None = None


class LLMServiceError(Exception):
    """Exceção controlada do serviço de LLM."""


def _get_client() -> AsyncOpenAI:
    global _client

    if _client is not None:
        return _client

    if not settings.LLM_API_KEY:
        raise LLMServiceError("LLM_API_KEY não configurada. Atualize o arquivo .env.")

    _client = AsyncOpenAI(api_key=settings.LLM_API_KEY)
    return _client


async def generate_clinical_plan(raw_text: str) -> PatientPlanOutput:
    """
    Envia o texto clínico ao LLM e retorna uma resposta estruturada.

    Observação:
    O sistema não realiza diagnóstico nem prescrição.
    O modelo apenas simplifica e reorganiza o conteúdo já presente no texto clínico.
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
            temperature=0.1,
            max_tokens=900,
        )
    except OpenAIError as exc:
        raise LLMServiceError("Falha na comunicação com o serviço de IA.") from exc
    except Exception as exc:
        raise LLMServiceError("Erro inesperado ao processar o plano clínico.") from exc

    plan = response.choices[0].message.parsed

    if plan is None:
        raise LLMServiceError("O modelo não retornou uma resposta estruturada válida.")

    return plan