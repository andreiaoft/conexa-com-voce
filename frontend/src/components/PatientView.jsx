import { useState } from "react";
import PropTypes from "prop-types";
import { submitTeachBack } from "../api.js";
import { useAsyncAction } from "../hooks/useAsyncAction.js";
import Button from "./ui/Button.jsx";
import Card from "./ui/Card.jsx";
import InlineAlert from "./ui/InlineAlert.jsx";
import SectionHeading from "./ui/SectionHeading.jsx";
import Textarea from "./ui/Textarea.jsx";

const planPropType = PropTypes.shape({
  diagnostico_simplificado: PropTypes.string.isRequired,
  plano_acao_hoje: PropTypes.string.isRequired,
  medicacoes: PropTypes.arrayOf(PropTypes.string).isRequired,
  sinais_alerta_red_flags: PropTypes.arrayOf(PropTypes.string).isRequired,
  risco_continuidade: PropTypes.oneOf(["baixo", "medio", "alto"]).isRequired,
});

// Tabela de expansão de siglas clínicas para síntese de voz.
const ABBREVIATION_MAP = [
  [/°C/g,               " graus Celsius"],
  [/°F/g,               " graus Fahrenheit"],
  [/\bVO\b/gi,          "via oral"],
  [/\bEV\b/gi,          "via endovenosa"],
  [/\bIM\b/gi,          "via intramuscular"],
  [/\bSC\b/gi,          "via subcutânea"],
  [/\bSL\b/gi,          "via sublingual"],
  [/\bSOS\b/gi,         "se necessário"],
  [/\bBID\b/gi,         "duas vezes ao dia"],
  [/\bTID\b/gi,         "três vezes ao dia"],
  [/\bQID\b/gi,         "quatro vezes ao dia"],
  [/(\d+)\s*x\/dia/gi,  "$1 vezes ao dia"],
  [/(\d+)\s*mg\b/g,     "$1 miligramas"],
  [/(\d+)\s*ml\b/gi,    "$1 mililitros"],
  [/(\d+)\s*kg\b/gi,    "$1 quilogramas"],
  [/(\d+)\s*g\b/g,      "$1 gramas"],
  [/(\d+)\s*h\b/g,      "$1 horas"],
  [/(\d+)\s*min\b/gi,   "$1 minutos"],
  [/\bATB\b/gi,         "antibiótico"],
  [/\bAAS\b/gi,         "ácido acetilsalicílico"],
  [/\bIAM\b/gi,         "infarto agudo do miocárdio"],
  [/\bAVC\b/gi,         "acidente vascular cerebral"],
  [/\bHAS\b/gi,         "hipertensão arterial"],
  [/\bDM\b/gi,          "diabetes"],
  [/\bICC\b/gi,         "insuficiência cardíaca"],
  [/\bDPOC\b/gi,        "doença pulmonar obstrutiva crônica"],
  [/\bIRC\b/gi,         "insuficiência renal crônica"],
  [/\bcp\b/gi,          "comprimido"],
  [/\bamp\b/gi,         "ampola"],
];

function expandAbbreviations(text) {
  const cleaned = text
    .replace(/[#*_~`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return ABBREVIATION_MAP.reduce(
    (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
    cleaned,
  );
}

/**
 * Prioridade de seleção de voz:
 * 1. Google + feminina (mais natural)
 * 2. Qualquer Google pt-BR
 * 3. Voz feminina por nome
 * 4. Índices [1] ou [2] (costumam ser femininas no Windows/Chrome)
 */
function selectPtBrVoice() {
  const voices = window.speechSynthesis.getVoices();
  const ptBr = voices.filter((v) => v.lang === "pt-BR" || v.lang === "pt_BR");

  const googleFeminine = ptBr.find(
    (v) => /google/i.test(v.name) && /female|feminina|maria|luciana/i.test(v.name),
  );
  if (googleFeminine) return googleFeminine;

  const google = ptBr.find((v) => /google/i.test(v.name));
  if (google) return google;

  const feminine = ptBr.find((v) =>
    /female|feminina|maria|luciana|vitoria|camila/i.test(v.name),
  );
  if (feminine) return feminine;

  return ptBr[1] ?? ptBr[2] ?? ptBr[0] ?? null;
}

/**
 * Ordem de leitura: saudação → o que fazer hoje → medicações →
 * alerta de alergia (se houver medicações) → sinais de alerta → despedida.
 */
function buildSpeechText(plan) {
  const parts = [plan.diagnostico_simplificado];
  parts.push(`O que fazer hoje: ${plan.plano_acao_hoje}.`);

  if (plan.medicacoes.length > 0) {
    parts.push(`Suas medicações são: ${plan.medicacoes.join(". ")}.`);
    parts.push(
      "Atenção importante: Verifique se você tem alergia a algum desses remédios. " +
      "Se tiver, não tome e fale com a equipe médica.",
    );
  }

  if (plan.sinais_alerta_red_flags.length > 0) {
    parts.push(
      `Fique atento aos seguintes sinais de alerta que exigem retorno imediato ao serviço de saúde: ${plan.sinais_alerta_red_flags.join(". ")}.`,
    );
  }

  parts.push("Desejamos uma ótima recuperação. Conte com a gente!");

  return expandAbbreviations(parts.join(" "));
}

function SpeakerIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
      <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.061z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
    </svg>
  );
}

function AlertTriangleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 flex-shrink-0" aria-hidden="true">
      <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
    </svg>
  );
}

function PlanSection({ title, children }) {
  return (
    <div>
      <SectionHeading>{title}</SectionHeading>
      {children}
    </div>
  );
}

PlanSection.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

function BulletList({ items, emptyText }) {
  if (items.length === 0) {
    return <p className="text-sm text-conexa-text-secondary">{emptyText}</p>;
  }
  return (
    <ul className="list-inside list-disc text-sm text-conexa-text-primary">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

BulletList.propTypes = {
  items: PropTypes.arrayOf(PropTypes.string).isRequired,
  emptyText: PropTypes.string.isRequired,
};

function MedicationAlert() {
  return (
    <div className="mt-2 flex items-start gap-2 rounded-md border-2 border-conexa-yellow bg-conexa-yellow-light p-3 text-sm text-conexa-yellow">
      <AlertTriangleIcon />
      <p>
        <strong>Atenção:</strong> Verifique se possui alergia a algum destes medicamentos
        antes de utilizá-los. Em caso de dúvida ou reação adversa, suspenda o uso e avise
        a equipe médica imediatamente.
      </p>
    </div>
  );
}

function RedFlagSection({ items }) {
  return (
    <div className="rounded-md border border-conexa-danger bg-conexa-danger-light p-3">
      <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-conexa-danger">
        Sinais de alerta
      </h4>
      {items.length === 0 ? (
        <p className="text-sm text-conexa-text-secondary">Nenhum sinal de alerta identificado.</p>
      ) : (
        <ul className="list-inside list-disc text-sm text-conexa-danger">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

RedFlagSection.propTypes = {
  items: PropTypes.arrayOf(PropTypes.string).isRequired,
};

function PatientView({ plan, patientId, onTeachBackComplete }) {
  const [understood, setUnderstood] = useState(false);
  const [notes, setNotes] = useState("");
  const [success, setSuccess] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const { loading, error, run } = useAsyncAction("Falha ao registar confirmação.");

  if (!plan) {
    return (
      <section className="rounded-xl border border-dashed border-conexa-blue-light bg-white p-4 text-sm text-conexa-text-secondary shadow-md">
        Gere um plano na entrada operacional para visualizar a vista do paciente.
      </section>
    );
  }

  function handleSpeak() {
    if (!window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(buildSpeechText(plan));
    utterance.lang = "pt-BR";
    const voice = selectPtBrVoice();
    if (voice) utterance.voice = voice;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  async function handleTeachBack(e) {
    e.preventDefault();
    setSuccess(false);
    await run(async () => {
      await submitTeachBack({
        patient_id: patientId,
        understood_instructions: understood,
        patient_notes: notes,
      });
      setSuccess(true);
      onTeachBackComplete();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-conexa-blue-dark">Vista do paciente</h2>
          <button
            onClick={handleSpeak}
            title={speaking ? "Parar leitura" : "Ler plano em voz alta"}
            aria-label={speaking ? "Parar leitura" : "Ler plano em voz alta"}
            className={`rounded p-1.5 transition-colors duration-150 ${
              speaking
                ? "bg-conexa-blue-light text-conexa-blue-dark"
                : "text-conexa-text-secondary hover:bg-conexa-blue-light hover:text-conexa-blue-dark"
            }`}
          >
            {speaking ? <StopIcon /> : <SpeakerIcon />}
          </button>
        </div>
        <p className="mb-1 text-xs text-conexa-text-secondary">ID: {patientId}</p>
        <p className="mb-4 text-sm text-conexa-text-primary">{plan.diagnostico_simplificado}</p>
        <div className="space-y-4">
          <PlanSection title="O que fazer hoje">
            <p className="text-sm text-conexa-text-primary">{plan.plano_acao_hoje}</p>
          </PlanSection>
          <PlanSection title="Medicações">
            <BulletList items={plan.medicacoes} emptyText="Nenhuma medicação registada." />
            {plan.medicacoes.length > 0 && <MedicationAlert />}
          </PlanSection>
          <RedFlagSection items={plan.sinais_alerta_red_flags} />
        </div>
      </Card>

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-conexa-blue-dark">
          Confirmação de Entendimento
        </h3>
        <p className="mb-3 text-sm text-conexa-text-secondary">
          Use o campo abaixo caso tenha alguma dúvida sobre as orientações acima.
        </p>
        {success ? (
          <p className="text-sm text-conexa-green" role="status">
            Confirmação enviada com sucesso.
          </p>
        ) : (
          <form onSubmit={handleTeachBack} className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm text-conexa-text-primary">
              <input
                type="checkbox"
                checked={understood}
                onChange={(e) => setUnderstood(e.target.checked)}
                disabled={loading}
              />
              Entendi as orientações
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Dúvidas ou observações (opcional)"
              disabled={loading}
              minHeight="min-h-[80px]"
            />
            <InlineAlert message={error} variant="error" />
            <Button variant="outlined" disabled={loading} className="self-start">
              {loading ? "A enviar..." : "Enviar minha confirmação"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}

PatientView.propTypes = {
  plan: planPropType,
  patientId: PropTypes.string.isRequired,
  onTeachBackComplete: PropTypes.func.isRequired,
};

export default PatientView;
