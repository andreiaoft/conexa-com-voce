/**
 * Cliente de API centralizado.
 * - Em desenvolvimento local: usa localhost se VITE_API_URL não estiver definido
 * - Em produção: usa VITE_API_URL
 */

const rawBase =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? "http://127.0.0.1:8000" : "");

const API_BASE = rawBase.replace(/\/$/, "");
const REQUEST_TIMEOUT_MS = 25000;

async function apiFetch(path, options = {}) {
  const isFormData = options.body instanceof FormData;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;

  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: isFormData
        ? (options.headers ?? {})
        : { "Content-Type": "application/json", ...(options.headers ?? {}) },
    });
  } catch (err) {
    clearTimeout(timeoutId);

    if (err?.name === "AbortError") {
      throw new Error("A requisição demorou demais. Tente novamente.");
    }

    throw new Error("Sem conexão com o servidor. Verifique sua rede.");
  }

  clearTimeout(timeoutId);

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