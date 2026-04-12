import { useState } from "react";
import PropTypes from "prop-types";
import Button from "./ui/Button.jsx";
import Card from "./ui/Card.jsx";

const rowPropType = PropTypes.shape({
  case_id: PropTypes.string.isRequired,
  diagnostico_simplificado: PropTypes.string.isRequired,
  risco_continuidade: PropTypes.oneOf(["baixo", "medio", "alto"]).isRequired,
  teach_back_status: PropTypes.string.isRequired,
  sinais_alerta_red_flags: PropTypes.arrayOf(PropTypes.string).isRequired,
  acao_sugerida: PropTypes.string.isRequired,
});

const RISK_BADGE = {
  alto:  "bg-conexa-danger-light text-conexa-danger",
  medio: "bg-conexa-warning-light text-conexa-warning",
  baixo: "bg-conexa-green-light text-conexa-green",
};

const ACAO_CLASS = {
  alto:  "font-medium text-conexa-danger",
  medio: "font-medium text-conexa-warning",
  baixo: "text-conexa-text-secondary",
};

function RiskBadge({ risk }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold ${RISK_BADGE[risk]}`}>
      {risk}
    </span>
  );
}

RiskBadge.propTypes = {
  risk: PropTypes.oneOf(["baixo", "medio", "alto"]).isRequired,
};

function RedFlagCell({ flags }) {
  const [expanded, setExpanded] = useState(false);

  if (flags.length === 0) {
    return <span className="text-xs text-conexa-text-secondary">Nenhum</span>;
  }

  const visible = expanded ? flags : flags.slice(0, 2);
  const hasMore = flags.length > 2;

  return (
    <div>
      <ul className="list-inside list-disc text-xs text-conexa-text-primary">
        {visible.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      {hasMore && (
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-1 text-xs font-medium text-conexa-blue-medium hover:underline"
        >
          {expanded ? "Mostrar menos" : `+ ${flags.length - 2} mais`}
        </button>
      )}
    </div>
  );
}

RedFlagCell.propTypes = {
  flags: PropTypes.arrayOf(PropTypes.string).isRequired,
};

const TH_BASE = "py-2 pr-4 font-medium align-top";
const TD_BASE = "py-2 pr-4 align-top text-conexa-text-primary";

function DashboardContent({ rows, error }) {
  if (error) {
    return (
      <p className="text-sm text-conexa-danger" role="alert">
        {error}
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-conexa-text-secondary">
        Nenhum caso gerado. Cole um resumo clínico na entrada operacional para começar.
      </p>
    );
  }

  const displayRows = [...rows].reverse();

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <colgroup>
          <col className="w-28" />
          <col className="w-[28%]" />
          <col className="w-20" />
          <col className="w-24" />
          <col className="w-[22%]" />
          <col className="w-[24%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-conexa-blue-light text-xs uppercase tracking-wide text-conexa-text-secondary">
            <th className={TH_BASE}>ID do caso</th>
            <th className={TH_BASE}>Diagnóstico</th>
            <th className={TH_BASE}>Risco</th>
            <th className={TH_BASE}>Teach-back</th>
            <th className={TH_BASE}>Red flags</th>
            <th className={`${TH_BASE} pr-0`}>Ação sugerida</th>
          </tr>
        </thead>
        <tbody>
          {displayRows.map((r) => (
            <tr
              key={r.case_id}
              className={`border-b border-conexa-blue-light ${r.risco_continuidade === "alto" ? "bg-conexa-danger-light" : ""}`}
            >
              <td className="py-2 pr-4 align-top font-mono text-xs text-conexa-text-secondary">
                {r.case_id}
              </td>
              <td className={`${TD_BASE} whitespace-normal`}>
                {r.diagnostico_simplificado}
              </td>
              <td className="py-2 pr-4 align-top">
                <RiskBadge risk={r.risco_continuidade} />
              </td>
              <td className={TD_BASE}>{r.teach_back_status}</td>
              <td className={TD_BASE}>
                <RedFlagCell flags={r.sinais_alerta_red_flags} />
              </td>
              <td className={`py-2 pr-0 align-top whitespace-normal ${ACAO_CLASS[r.risco_continuidade]}`}>
                {r.acao_sugerida}
                {r.risco_continuidade === "alto" && (
                  <Button
                    variant="ghost-danger"
                    size="2xs"
                    className="mt-2 block"
                    onClick={() =>
                      window.alert(
                        `Navegação acionada para o caso ${r.case_id}.\n\nInicie o contato humano com o paciente imediatamente.`,
                      )
                    }
                  >
                    Acionar navegação
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

DashboardContent.propTypes = {
  rows: PropTypes.arrayOf(rowPropType).isRequired,
  error: PropTypes.string,
};

function Dashboard({ rows, error, onClearHistory }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-conexa-blue-dark">Dashboard operacional</h2>
        {!error && rows.length > 0 && (
          <Button variant="ghost" size="xs" onClick={onClearHistory}>
            Limpar histórico
          </Button>
        )}
      </div>
      <DashboardContent rows={rows} error={error} />
    </Card>
  );
}

Dashboard.propTypes = {
  rows: PropTypes.arrayOf(rowPropType).isRequired,
  error: PropTypes.string,
  onClearHistory: PropTypes.func.isRequired,
};

export default Dashboard;
