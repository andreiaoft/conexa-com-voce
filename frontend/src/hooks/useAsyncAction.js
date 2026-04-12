import { useState } from "react";
import { toErrorMessage } from "../api.js";

/**
 * Encapsula o ciclo loading/error/finally de ações assíncronas em formulários.
 * Elimina a duplicação desse padrão em OperationalInput e PatientView.
 */
export function useAsyncAction(fallbackMessage = "Ocorreu um erro inesperado.") {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function run(action) {
    setError(null);
    setLoading(true);
    try {
      return await action();
    } catch (err) {
      setError(toErrorMessage(err, fallbackMessage));
    } finally {
      setLoading(false);
    }
  }

  return { loading, error, run };
}
