/**
 * Cliente de API centralizado — único módulo que conhece VITE_API_URL.
 *
 * Contrato de erros:
 *   - 5xx: mensagem genérica (sem vazar internals do servidor)
 *   - 4xx: campo `detail` do Pydantic (validação, seguro para exibir)
 *   - Rede indisponível: mensagem amigável
 *
 * Componentes nunca devem chamar fetch diretamente; usam apenas as funções
 * exportadas abaixo e capturam erros via toErrorMessage().
 */

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function apiFetch(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      // FormData: deixar o browser definir Content-Type com o boundary correto.
      headers: isFormData
        ? (options.headers ?? {})
        : { "Content-Type": "application/json", ...(options.headers ?? {}) },
    });
  } catch {
    throw new Error("Sem conexão com o servidor. Verifique sua rede.");
  }

  if (res.status === 204) return null;

  if (res.ok) {
    return res.json();
  }

  if (res.status >= 500) {
    throw new Error("Erro no servidor. Tente novamente mais tarde.");
  }

  const body = await res.json().catch(() => ({}));
  throw new Error(body.detail ?? `Erro ${res.status}`);
}

/**
 * Extrai uma mensagem legível de qualquer valor capturado em catch.
 * Centraliza o padrão (err instanceof Error ? err.message : fallback)
 * para que os componentes não repitam essa lógica.
 */
export function toErrorMessage(err, fallback = "Ocorreu um erro inesperado.") {
  return err instanceof Error ? err.message : fallback;
}

export function fetchCases() {
  return apiFetch("/api/cases");
}

export function generatePlan(rawText) {
  return apiFetch("/api/generate-plan", {
    method: "POST",
    body: JSON.stringify({ raw_text: rawText }),
  });
}

export function submitTeachBack(payload) {
  return apiFetch("/api/teach-back", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function clearCases() {
  return apiFetch("/api/cases", { method: "DELETE" });
}

export function extractPdfText(file) {
  const form = new FormData();
  form.append("file", file);
  return apiFetch("/api/extract-pdf", { method: "POST", body: form });
}
