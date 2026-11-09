import React, { useState } from 'react';
import { FileDown, Check } from 'lucide-react';

export function ExportPDFButton({ onExport, className = '' }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    setSuccess(false);

    try {
      if (onExport) {
        await onExport();
      } else if (window.api?.exportSystemReportPDF) {
        // Chamada real IPC ao Electron
        await window.api.exportSystemReportPDF();
      } else {
        // Simulação elegante em ambiente dev/browser
        await new Promise((res) => setTimeout(res, 1800));
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Erro ao gerar PDF do sistema:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      className={`tt-export-pdf-btn ${className}`}
      onClick={handleClick}
      disabled={loading}
      title="Gerar e salvar relatório técnico em PDF"
    >
      {loading ? (
        <>
          <div className="tt-spinner" />
          <span>Gerando Relatório PDF...</span>
        </>
      ) : success ? (
        <>
          <Check size={16} style={{ color: '#86efac' }} />
          <span>Relatório Salvo!</span>
        </>
      ) : (
        <>
          <FileDown size={16} />
          <span>Exportar Relatório PDF</span>
        </>
      )}
    </button>
  );
}
