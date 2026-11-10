/**
 * ThunderTools - Módulo de Diagnóstico Avançado com Gemini 1.5 Flash
 * Desenvolvido por Thunder (ThunderTools)
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Chave Oficial da Thunder IA integrada nativamente no ThunderTools.
 * Permite que qualquer usuário execute diagnósticos neurais imediatamente sem precisar de chave própria.
 */
const DEFAULT_APP_GEMINI_KEY = Buffer.from('QVEuQWI4Uk42TGFYa3o2bnVUT1VBVXgxdHpqeVA3NlA0a3N6cG1tTVRSYkNUTzB1eHpDeVE=', 'base64').toString('utf8');

/**
 * Verifica se o computador possui conectividade ativa com a internet
 */
async function checkInternetConnection() {
  const timeoutMs = 3500;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Testa endpoint da API Gemini
    const res = await fetch('https://generativelanguage.googleapis.com', {
      method: 'HEAD',
      signal: controller.signal
    });
    clearTimeout(timeout);
    return { online: true };
  } catch (_) {
    clearTimeout(timeout);
    // Fallback: ping HTTP para verificar conexão geral
    try {
      const fbController = new AbortController();
      const fbTimeout = setTimeout(() => fbController.abort(), 2500);
      const resFb = await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        signal: fbController.signal
      });
      clearTimeout(fbTimeout);
      return { online: resFb.ok || resFb.status === 204 };
    } catch (errFb) {
      return { online: false, error: 'Sem conexão ativa com a internet.' };
    }
  }
}

/**
 * Remove dados sensíveis (PII) e limita tamanho para envio seguro
 */
function sanitizeLogSnippet(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[a-zA-Z]:\\Users\\[^\\]+/gi, 'C:\\Users\\<USUARIO>')
    .replace(/[a-zA-Z]:\\Usu[aá]rios\\[^\\]+/gi, 'C:\\Users\\<USUARIO>')
    .replace(/(Password|Senha|Secret)\s*[:=]\s*[^\s]+/gi, '$1=********')
    .slice(0, 120000);
}

/**
 * Coleta logs reais de diagnóstico do Windows
 */
async function fetchSystemLogSnippet(logType = 'system-auto') {
  try {
    if (logType === 'cbs') {
      const cbsPath = path.join(process.env.SystemRoot || 'C:\\Windows', 'Logs', 'CBS', 'CBS.log');
      if (!fs.existsSync(cbsPath)) {
        return { success: false, error: 'Arquivo CBS.log não encontrado no sistema.' };
      }
      const stat = fs.statSync(cbsPath);
      const bufferSize = Math.min(150 * 1024, stat.size);
      const buffer = Buffer.alloc(bufferSize);
      const fd = fs.openSync(cbsPath, 'r');
      fs.readSync(fd, buffer, 0, bufferSize, Math.max(0, stat.size - bufferSize));
      fs.closeSync(fd);
      const rawText = buffer.toString('utf8');
      
      const lines = rawText.split(/\r?\n/);
      const errorLines = lines.filter(l => /error|failed|corrupt|\[SR\]|warning/i.test(l));
      const resultText = (errorLines.length >= 10 ? errorLines.slice(-150) : lines.slice(-100)).join('\n');
      return { 
        success: true, 
        logType: 'cbs', 
        title: 'Log de Integridade CBS / SFC (CBS.log)', 
        snippet: sanitizeLogSnippet(resultText) 
      };
    }

    if (logType === 'dism') {
      const dismPath = path.join(process.env.SystemRoot || 'C:\\Windows', 'Logs', 'DISM', 'dism.log');
      if (!fs.existsSync(dismPath)) {
        return { success: false, error: 'Arquivo dism.log não encontrado no sistema.' };
      }
      const stat = fs.statSync(dismPath);
      const bufferSize = Math.min(120 * 1024, stat.size);
      const buffer = Buffer.alloc(bufferSize);
      const fd = fs.openSync(dismPath, 'r');
      fs.readSync(fd, buffer, 0, bufferSize, Math.max(0, stat.size - bufferSize));
      fs.closeSync(fd);
      const rawText = buffer.toString('utf8');
      const lines = rawText.split(/\r?\n/);
      const errorLines = lines.filter(l => /error|failed|warning/i.test(l));
      const resultText = (errorLines.length >= 10 ? errorLines.slice(-120) : lines.slice(-80)).join('\n');
      return { 
        success: true, 
        logType: 'dism', 
        title: 'Log de Manutenção de Imagem (dism.log)', 
        snippet: sanitizeLogSnippet(resultText) 
      };
    }

    if (logType === 'event-viewer') {
      const events = await new Promise((resolve) => {
        execFile('wevtutil.exe', [
          'qe', 'System',
          '/q:*[System[(Level=1 or Level=2) and TimeCreated[timediff(@SystemTime) <= 172800000]]]',
          '/c:20',
          '/f:text'
        ], { timeout: 6000, maxBuffer: 1024 * 1024 }, (err, stdout) => {
          if (err || !stdout) resolve('Nenhum evento crítico recente registrado no log System.');
          else resolve(stdout);
        });
      });
      return { 
        success: true, 
        logType: 'event-viewer', 
        title: 'Visualizador de Eventos (Erros Críticos - 48h)', 
        snippet: sanitizeLogSnippet(events) 
      };
    }

    if (logType === 'windows-update') {
      const repPath = path.join(process.env.SystemRoot || 'C:\\Windows', 'SoftwareDistribution', 'ReportingEvents.log');
      if (fs.existsSync(repPath)) {
        const text = fs.readFileSync(repPath, 'utf8');
        const lines = text.split(/\r?\n/).slice(-60).join('\n');
        return { 
          success: true, 
          logType: 'windows-update', 
          title: 'Histórico de Eventos do Windows Update', 
          snippet: sanitizeLogSnippet(lines) 
        };
      }
      return { success: false, error: 'Log de Windows Update não localizado no sistema.' };
    }

    if (logType === 'bsod') {
      const minidumpDir = path.join(process.env.SystemRoot || 'C:\\Windows', 'Minidump');
      let dumpFiles = [];
      if (fs.existsSync(minidumpDir)) {
        try {
          dumpFiles = fs.readdirSync(minidumpDir).filter(f => f.endsWith('.dmp'));
        } catch (_) {}
      }

      const bugCheckEvents = await new Promise((resolve) => {
        execFile('wevtutil.exe', [
          'qe', 'System',
          '/q:*[System[Provider[@Name=\'Microsoft-Windows-WER-SystemErrorReporting\' or @Name=\'BugCheck\']]]',
          '/c:5',
          '/f:text'
        ], { timeout: 5000 }, (_, stdout) => resolve(stdout || ''));
      });

      const summary = `Arquivos de despejo Minidump encontrados (${dumpFiles.length}):\n${dumpFiles.join('\n') || 'Nenhum .dmp recente em C:\\Windows\\Minidump'}\n\nEventos de BugCheck / Falha de Sistema:\n${bugCheckEvents || 'Nenhum registro de BugCheck detectado nas últimas sessões.'}`;
      return { 
        success: true, 
        logType: 'bsod', 
        title: 'Diagnóstico de Telas Azuis (BSOD / MiniDump)', 
        snippet: sanitizeLogSnippet(summary) 
      };
    }

    // Default: 'system-auto' (Auditoria Consolidada)
    const [cbsSnippet, eventSnippet] = await Promise.all([
      fetchSystemLogSnippet('cbs').catch(() => ({ snippet: '' })),
      fetchSystemLogSnippet('event-viewer').catch(() => ({ snippet: '' }))
    ]);

    const sysInfo = `SISTEMA OPERACIONAL: ${os.type()} ${os.release()} (Arquitetura: ${os.arch()})\nHOSTNAME: ${os.hostname()}\nMEMÓRIA LIVRE: ${(os.freemem() / (1024**3)).toFixed(1)} GB de ${(os.totalmem() / (1024**3)).toFixed(1)} GB\nUPTIME: ${Math.floor(os.uptime() / 3600)} horas\n`;
    const combined = `${sysInfo}\n=== EVENTOS CRÍTICOS RECENTES (ÚLTIMAS 48H) ===\n${eventSnippet.snippet || 'Nenhum erro de evento crítico identificado.'}\n\n=== EXTRATO DE INTEGRIDADE CBS ===\n${cbsSnippet.snippet ? cbsSnippet.snippet.slice(-3000) : 'CBS íntegro ou sem erros reportados.'}`;

    return { 
      success: true, 
      logType: 'system-auto', 
      title: 'Varredura Consolidada do Sistema', 
      snippet: sanitizeLogSnippet(combined) 
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Cache do endpoint e modelo funcional do Gemini
 */
let cachedGeminiEndpoint = null;

/**
 * Chamada à API Google Gemini com fallback automático entre modelos modernos (2.5-flash, 2.0-flash, 1.5-flash)
 */
async function callGemini15Flash(apiKey, promptText, systemInstructionText) {
  const requestBody = {
    systemInstruction: {
      parts: [
        { text: systemInstructionText }
      ]
    },
    contents: [
      {
        role: 'user',
        parts: [
          { text: promptText }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.15,
      responseMimeType: 'application/json'
    }
  };

  // Modelos candidatos ordenados por estabilidade e imunidade a congestionamento (Flash-Lite prioritário)
  const candidateEndpoints = [
    ...(cachedGeminiEndpoint ? [cachedGeminiEndpoint] : []),
    { version: 'v1beta', model: 'gemini-3.5-flash-lite' },
    { version: 'v1beta', model: 'gemini-3.5-flash' },
    { version: 'v1beta', model: 'gemini-3.8-flash' },
    { version: 'v1beta', model: 'gemini-3.1-flash-lite' },
    { version: 'v1beta', model: 'gemini-flash-latest' },
    { version: 'v1beta', model: 'gemini-flash-lite-latest' },
    { version: 'v1beta', model: 'gemini-3-flash-preview' }
  ];

  // Remove duplicados da lista
  const uniqueEndpoints = candidateEndpoints.filter((item, idx, self) =>
    idx === self.findIndex(t => t.version === item.version && t.model === item.model)
  );

  let lastError = null;

  for (const { version, model } of uniqueEndpoints) {
    try {
      const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data?.error?.message || response.statusText;

        // Se o modelo retornar 404, 503 (alta demanda) ou 429, faz failover silencioso para o próximo modelo da fila
        if (response.status === 404 || response.status === 503 || response.status === 429 || /not found|not supported|high demand|unavailable|overloaded|spikes/i.test(errorMsg)) {
          lastError = new Error(`Modelo ${model} momentaneamente indisponível (${response.status}): ${errorMsg}`);
          continue;
        }

        // Se for erro de autenticação, encerra imediatamente (chave inválida ou não autorizada)
        if ((response.status === 400 || response.status === 401) && /API_KEY_INVALID|not valid|ACCESS_TOKEN_TYPE_UNSUPPORTED/i.test(errorMsg)) {
          throw new Error('Chave da API Gemini não autorizada ou expirada. Verifique as credenciais no Google AI Studio ou contate o suporte do Thunder.');
        }

        throw new Error(`Erro na API Gemini (${response.status}): ${errorMsg}`);
      }

      const rawJsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawJsonText) {
        throw new Error('A API Gemini não retornou conteúdo na resposta.');
      }

      // Sucesso! Salva em cache o endpoint funcional para chamadas subsequentes mais rápidas
      cachedGeminiEndpoint = { version, model };

      try {
        return JSON.parse(rawJsonText);
      } catch (parseErr) {
        const jsonMatch = rawJsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error(`Falha ao decodificar JSON retornado pela IA: ${parseErr.message}`);
      }
    } catch (err) {
      if (err.message && err.message.includes('não disponível')) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('Nenhum modelo Gemini compatível foi localizado no Google AI Studio para esta chave.');
}

/**
 * Sanitiza e valida comandos sugeridos pela IA para evitar alucinações e comandos interativos
 */
function sanitizeDiagnosisOutput(diagnosis) {
  if (!diagnosis || typeof diagnosis !== 'object') return diagnosis;

  if (Array.isArray(diagnosis.comandosSugeridos)) {
    const sanitizedCommands = [];

    for (const item of diagnosis.comandosSugeridos) {
      if (!item || !item.comando) continue;
      let rawCmd = String(item.comando).trim();
      let rawTipo = String(item.tipo || 'cmd').toLowerCase();
      let rawDesc = String(item.descricao || 'Correção do Sistema').trim();

      // Limpar blocos markdown acidentais
      rawCmd = rawCmd.replace(/^```[a-zA-Z0-9_-]*\r?\n?/, '').replace(/\r?\n?```$/, '').trim();
      // Remover comandos pause que travam terminal oculto
      rawCmd = rawCmd.replace(/^\s*pause\s*(&+|\|+|;)?\s*/gi, '')
      rawCmd = rawCmd.replace(/\s*(&+|\|+|;)\s*pause\s*$/gi, '')
      rawCmd = rawCmd.replace(/\s*(&+|\|+|;)\s*pause\s*(&+|\|+|;)\s*/gi, ' $1 ')
      rawCmd = rawCmd.replace(/(?:\r?\n)\s*pause\s*(?:\r?\n|$)/gi, '\n')
      rawCmd = rawCmd.trim()

      // Mapeamento e correção de alucinações frequentes de LLMs em ambiente Windows:
      // 1. Clear-WindowsUpdateCache (não existe nativamente)
      if (/Clear-WindowsUpdateCache/i.test(rawCmd)) {
        rawCmd = 'net stop wuauserv && net stop bits && del /f /q /s %windir%\\SoftwareDistribution\\Download\\* && net start wuauserv && net start bits';
        rawTipo = 'cmd';
        rawDesc = 'Redefinir e limpar cache corrompido do Windows Update';
      }
      // 2. Reset-PrintSpooler (não existe nativamente)
      else if (/Reset-PrintSpooler/i.test(rawCmd)) {
        rawCmd = 'net stop spooler && del /q /f /s %systemroot%\\System32\\Spool\\Printers\\* && net start spooler';
        rawTipo = 'cmd';
        rawDesc = 'Reiniciar spooler e limpar fila de impressão travada';
      }
      // 3. Flush-Dns (o correto é Clear-DnsClientCache ou ipconfig /flushdns)
      else if (/Flush-Dns/i.test(rawCmd)) {
        rawCmd = 'ipconfig /flushdns';
        rawTipo = 'cmd';
        rawDesc = 'Limpar e liberar o cache de resolução DNS';
      }
      // 4. Repair-WindowsImage
      else if (/Repair-WindowsImage\s+-Online\s+-RestoreHealth/i.test(rawCmd)) {
        rawCmd = 'DISM /Online /Cleanup-Image /RestoreHealth';
        rawTipo = 'cmd';
      }
      // 5. Restart-Service sem -Force
      else if (/^Restart-Service\b/i.test(rawCmd) && !/-Force/i.test(rawCmd)) {
        rawCmd += ' -Force';
        rawTipo = 'powershell';
      }
      // 6. Stop-Service sem -Force
      else if (/^Stop-Service\b/i.test(rawCmd) && !/-Force/i.test(rawCmd)) {
        rawCmd += ' -Force';
        rawTipo = 'powershell';
      }
      // 7. Remove-Item sem -Force
      else if (/^Remove-Item\b/i.test(rawCmd) && !/-Force/i.test(rawCmd)) {
        rawCmd += ' -Force';
        rawTipo = 'powershell';
      }
      // 8. Se for comando tradicional do CMD marcado erroneamente como powershell
      else if (/^(sfc|dism|ipconfig|net|chkdsk|reg|cleanmgr)\b/i.test(rawCmd)) {
        rawTipo = 'cmd';
      }
      // 9. Se for cmdlet PowerShell (Verb-Noun) mas marcado como cmd
      else if (/^[a-zA-Z]+-[a-zA-Z]+/i.test(rawCmd)) {
        rawTipo = 'powershell';
      }

      // Adicionar /f para reg add/delete se faltar
      if (/\breg\s+(add|delete)\b/i.test(rawCmd) && !/\s\/[fy]\b/i.test(rawCmd)) {
        rawCmd += ' /f';
      }

      sanitizedCommands.push({
        comando: rawCmd,
        descricao: rawDesc,
        tipo: rawTipo
      });
    }

    diagnosis.comandosSugeridos = sanitizedCommands;
  }

  return diagnosis;
}

/**
 * Função orquestradora da análise diagnóstica com Gemini 1.5
 */
async function runGeminiDiagnosticAnalysis(options = {}) {
  const { apiKey, logType = 'system-auto', customSnippet = '' } = options;

  // 1. Validar conexão com a internet
  const netCheck = await checkInternetConnection();
  if (!netCheck.online) {
    return {
      success: false,
      error: 'Sem conexão ativa com a internet. A análise diagnóstica com Gemini 1.5 requer acesso à internet.'
    };
  }

  // 2. Validar chave de API (usa a chave customizada informada, ou variável de ambiente, ou a chave mestre oficial integrada)
  const activeKey = (apiKey || process.env.GEMINI_API_KEY || DEFAULT_APP_GEMINI_KEY || '').trim();
  if (!activeKey) {
    return {
      success: false,
      error: 'Chave da API Gemini não configurada no aplicativo.'
    };
  }

  // 3. Obter snippet de log
  let logText = '';
  let logTitle = 'Log Personalizado';

  if (logType === 'custom') {
    if (!customSnippet || !customSnippet.trim()) {
      return { success: false, error: 'Nenhum texto de log informado para análise.' };
    }
    logText = sanitizeLogSnippet(customSnippet.trim());
  } else {
    const fetchRes = await fetchSystemLogSnippet(logType);
    if (!fetchRes.success) {
      return { success: false, error: fetchRes.error || 'Falha ao coletar o log do sistema.' };
    }
    logText = fetchRes.snippet;
    logTitle = fetchRes.title;
  }

  // 4. Montar System Prompt do especialista
  const systemInstruction = `Você é o Motor de Inteligência Artificial Thunder IA, Especialista em Manutenção e Diagnóstico do ThunderTools, desenvolvido e mantido por Thunder.
Sua missão é atuar como engenheiro sênior de suporte e sistemas Windows. Analise com rigor técnico os dados de diagnóstico e logs fornecidos (CBS, DISM, Event Viewer, BSOD, serviços e hardware).

DIRETRIZES OBRIGATÓRIAS PARA OS COMANDOS SUGERIDOS:
1. O sistema operacional é estritamente WINDOWS 10 / WINDOWS 11. NUNCA sugira comandos de Linux (como sudo, systemctl, journalctl, apt, etc.).
2. NUNCA INVENTE cmdlets fictícios no PowerShell (ex: 'Clear-WindowsUpdateCache', 'Reset-PrintSpooler', 'Flush-Dns' NÃO EXISTEM).
   - Para redefinir o Windows Update, use comandos reais do CMD (net stop wuauserv && net stop bits && del /f /q /s %windir%\\SoftwareDistribution\\Download\\* && net start wuauserv && net start bits).
   - Para limpar cache DNS, use 'ipconfig /flushdns' (tipo: 'cmd') ou 'Clear-DnsClientCache' (tipo: 'powershell').
   - Para reparar arquivos de sistema e imagem, use 'sfc /scannow' e 'DISM /Online /Cleanup-Image /RestoreHealth' (tipo: 'cmd').
   - Para reiniciar spooler de impressão, use 'net stop spooler && del /q /f /s %systemroot%\\System32\\Spool\\Printers\\* && net start spooler' (tipo: 'cmd').
3. EXECUÇÃO 100% NÃO-INTERATIVA (NUNCA solicite confirmação interativa ao usuário):
   - No CMD: sempre inclua '/f', '/q' ou '/y' (ex: reg add ... /f, reg delete ... /f, del /f /q ...). NUNCA utilize 'pause'.
   - No PowerShell: sempre inclua parâmetros silenciosos não-interativos: '-Force', '-Confirm:$false' (ex: Restart-Service -Name Spooler -Force).
4. O campo "tipo" DEVE refletir com precisão a sintaxe do comando:
   - "powershell": cmdlets com formato Verbo-Substantivo (ex: Restart-Service, Get-Process, Clear-DnsClientCache, Set-ItemProperty).
   - "cmd": binários nativos tradicionais (ex: sfc, dism, ipconfig, net, reg, chkdsk, cleanmgr).
5. Cada comando deve ser uma linha clara e autocontida, sem blocos de markdown (\`\`\`) dentro da propriedade comando.

Responda ESTRITAMENTE em formato JSON com o seguinte schema:
{
  "statusGeral": "CRÍTICO" | "ALERTA" | "MODERADO" | "SAUDÁVEL",
  "severidade": "critica" | "alta" | "media" | "baixa",
  "codigoErro": "Código do erro (ex: 0x800f081f, Event ID 7034, DCOM 10016) ou 'Nenhum' se saudável",
  "titulo": "Título técnico objetivo do diagnóstico (máx. 8 palavras)",
  "causaRaiz": "Causa raiz objetiva e comprovada nos logs (1 a 2 frases)",
  "explicacaoTecnica": "Detalhamento técnico do subsistema afetado, bibliotecas ou chaves de registro envolvidas",
  "impactoSistema": "Impacto na fluidez, estabilidade, integridade ou segurança do computador",
  "comandosSugeridos": [
    {
      "comando": "Comando exato e seguro para CMD ou PowerShell",
      "descricao": "Finalidade objetiva deste comando",
      "tipo": "powershell" | "cmd"
    }
  ],
  "orientacoesManuais": [
    "Dica ou verificação prática para o técnico ou usuário"
  ],
  "textoParaLaudo": "Resumo formal, claro e profissional para ser inserido na Ordem de Serviço / Laudo Técnico da Thunder IA",
  "requerReinicializacao": true | false
}`;

  const promptContent = `TIPO DE DIAGNÓSTICO: ${logTitle} (${logType})
DATA DA COLETA: ${new Date().toLocaleString('pt-BR')}

DADOS BRUTOS DO LOG / REGISTROS:
${logText}

Por favor, analise a integridade, localize falhas ou causas de lentidão/erros e gere o plano de ação técnico estruturado.`;

  try {
    const rawDiagnosis = await callGemini15Flash(activeKey, promptContent, systemInstruction);
    const diagnosis = sanitizeDiagnosisOutput(rawDiagnosis);
    return {
      success: true,
      logType,
      logTitle,
      analyzedAt: Date.now(),
      diagnosis
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

module.exports = {
  checkInternetConnection,
  fetchSystemLogSnippet,
  runGeminiDiagnosticAnalysis
};
