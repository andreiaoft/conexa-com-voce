import { useRef, useState } from "react";
import PropTypes from "prop-types";
import { extractPdfText, generatePlan } from "../api.js";
import { useAsyncAction } from "../hooks/useAsyncAction.js";
import Button from "./ui/Button.jsx";
import Card from "./ui/Card.jsx";
import InlineAlert from "./ui/InlineAlert.jsx";
import Textarea from "./ui/Textarea.jsx";

function UploadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path fillRule="evenodd" d="M9.25 4.75a.75.75 0 011.5 0v8.69l1.97-1.97a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L6.22 12.53a.75.75 0 111.06-1.06l1.97 1.97V4.75z" clipRule="evenodd" />
      <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
    </svg>
  );
}

function OperationalInput({ onPlanReceived }) {
  const [rawText, setRawText] = useState("");
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const { loading: planLoading, error: planError, run: runPlan } = useAsyncAction("Falha na geração do plano.");
  const { loading: pdfLoading, error: pdfError, run: runPdf } = useAsyncAction("Erro ao processar o PDF.");

  const isLoading = planLoading || pdfLoading;
  const hasContent = rawText.trim().length > 0;

  function handleClear() {
    setRawText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    textareaRef.current?.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await runPlan(async () => {
      const plan = await generatePlan(rawText);
      onPlanReceived(plan);
    });
  }

  async function handlePdfUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    await runPdf(async () => {
      const data = await extractPdfText(file);
      setRawText(data.text);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <Card>
      <h2 className="mb-3 text-lg font-semibold text-conexa-blue-dark">Entrada operacional</h2>
      <p className="mb-3 text-sm text-conexa-text-secondary">
        Cole o resumo de alta ou da consulta, ou importe um PDF textual. O sistema gera um
        plano de continuidade (não constitui diagnóstico médico).
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Textarea
          ref={textareaRef}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Texto clínico de referência..."
          disabled={isLoading}
          minHeight="min-h-[160px]"
          required
        />

        <div className="flex flex-wrap items-center gap-3">
          <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded border border-conexa-blue-medium px-3 py-1.5 text-xs font-medium text-conexa-blue-medium transition-colors duration-150 hover:bg-conexa-blue-light ${isLoading ? "cursor-not-allowed opacity-50" : ""}`}>
            <UploadIcon />
            {pdfLoading ? "A extrair texto..." : "Importar PDF"}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              disabled={isLoading}
              onChange={handlePdfUpload}
            />
          </label>
          <span className="text-xs text-conexa-text-secondary">
            Apenas PDFs com texto seleccionável (não digitalizados).
          </span>
        </div>

        <InlineAlert message={pdfError ?? planError} variant="error" />

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={isLoading || !hasContent}
          >
            {planLoading ? "A gerar..." : "Gerar plano"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleClear}
            disabled={isLoading || !hasContent}
          >
            Limpar
          </Button>
        </div>
      </form>
    </Card>
  );
}

OperationalInput.propTypes = {
  onPlanReceived: PropTypes.func.isRequired,
};

export default OperationalInput;
