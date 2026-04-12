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

  const refreshCases = useCallback(() => {
    fetchCases()
      .then(setCases)
      .catch((err) => setCasesError(toErrorMessage(err, "Erro ao carregar casos.")));
  }, []);

  useEffect(() => {
    refreshCases();
  }, [refreshCases]);

  const handlePlanReceived = useCallback(
    (data) => {
      setPlan(data);
      setPatientId(data.patient_id);
      refreshCases();
    },
    [refreshCases],
  );

  const handleClearHistory = useCallback(async () => {
    try {
      await clearCases();
      setCases([]);
      setCasesError(null);
    } catch {
      setCasesError("Erro ao limpar histórico. Tente novamente.");
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="fixed inset-x-0 top-0 z-10 flex items-center gap-4 border-b border-conexa-blue-light bg-white px-6 py-3 shadow-sm">
        <img src={logo} alt="ConexA COM Você" className="h-10 w-auto flex-shrink-0" />
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-conexa-blue-dark">
            ConexA COM Você
          </h1>
          <p className="truncate text-xs text-conexa-text-secondary">
            Orquestrador de continuidade pós-alta — MVP demonstração
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-8 pt-[65px]">
        <div className="grid gap-6 py-6 lg:grid-cols-2">
          <OperationalInput onPlanReceived={handlePlanReceived} />
          <PatientView
            plan={plan}
            patientId={patientId}
            onTeachBackComplete={refreshCases}
          />
        </div>
        <Dashboard rows={cases} error={casesError} onClearHistory={handleClearHistory} />
      </main>
    </div>
  );
}

export default App;
