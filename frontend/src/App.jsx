import { useCallback, useEffect, useState } from "react";
import logo from "./assets/logo-conexa.png";
import { clearCases, fetchCases, toErrorMessage } from "./api.js";
import Dashboard from "./components/Dashboard.jsx";
import OperationalInput from "./components/OperationalInput.jsx";
import PatientView from "./components/PatientView.jsx";

function App() {
  const [cases, setCases] = useState([]);
  const [casesError, setCasesError] = useState(null);
  const [plan, setPlan] = useState(null);
  const [patientId, setPatientId] = useState("");
  const [resetKey, setResetKey] = useState(0);

  const refreshCases = useCallback(() => {
    fetchCases()
      .then(setCases)
      .catch((err) => setCasesError(toErrorMessage(err, "Erro ao carregar casos.")));
  }, []);

  useEffect(() => {
    refreshCases();
  }, [refreshCases]);

  const handlePlanReceived = useCallback((data) => {
    setPlan(data);
    setPatientId(data.patient_id);
    refreshCases();
  }, [refreshCases]);

  const handleClearHistory = useCallback(async () => {
    try {
      await clearCases();
      setCases([]);
      setPlan(null);
      setPatientId("");
      setCasesError(null);
      setResetKey((prev) => prev + 1); 
    } catch {
      setCasesError("Erro ao limpar histórico.");
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="fixed inset-x-0 top-0 z-10 flex items-center gap-4 border-b bg-white px-6 py-3 shadow-sm">
        <img src={logo} alt="ConexA" className="h-10" />
        <h1 className="text-lg font-semibold text-conexa-blue-dark">ConexA COM Você</h1>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-8 pt-[80px]">
        <div className="grid gap-6 lg:grid-cols-2">
          
          <OperationalInput key={`in-${resetKey}`} onPlanReceived={handlePlanReceived} />
          
          {/* BLOQUEADOR VISUAL: Só mostra o PatientView se existir um plano gerado */}
          {plan ? (
            <PatientView 
              key={`pv-${resetKey}`} 
              plan={plan} 
              patientId={patientId} 
              onTeachBackComplete={refreshCases} 
            />
          ) : (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-8 text-slate-400">
              <svg className="mb-4 h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg font-medium text-slate-500">Nenhum caso ativo</p>
              <p className="text-sm text-center mt-2">Envie um resumo clínico ao lado para gerar o plano do paciente.</p>
            </div>
          )}

        </div>
        <Dashboard rows={cases} error={casesError} onClearHistory={handleClearHistory} />
      </main>
    </div>
  );
}

export default App;