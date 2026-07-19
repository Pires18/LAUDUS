import { ReportTemplate, AppSettings, ExamRequest } from '../../types';

/**
 * Seções opcionais do laudo controladas pela aba LAUD.IA do perfil.
 * Quando `false`, a seção é totalmente omitida do laudo-base. Ausência = incluída.
 *
 * As Observações Metodológicas (Nota ao Final do Laudo) são uma SEÇÃO do corpo
 * do laudo — editável por exame, com padrão vindo da máscara.
 */
export interface ReportSectionToggles {
  recommendations?: boolean;
  classification?: boolean;
  observations?: boolean;
}

/** Deriva os toggles de seção a partir das configurações do usuário (default: tudo ligado). */
export function sectionTogglesFromSettings(settings?: AppSettings): ReportSectionToggles {
  return {
    recommendations: settings?.laudIaRecommendationsEnabled !== false,
    classification: settings?.laudIaClassificationEnabled !== false,
    observations: settings?.laudIaMethodologicalObsEnabled !== false,
  };
}

/**
 * Gera o conteúdo HTML inicial de um laudo baseado na máscara (template).
 * Concatena as seções da máscara para formar o documento base.
 * `toggles` permite omitir seções (recomendações, observações, classificação)
 * conforme as preferências LAUD.IA do usuário.
 */
const sanitize = (content: string | undefined): string => {
  if (!content) return '';
  return content
    .replace(/^(<p>(&nbsp;|\s|<br>)*<\/p>|(<br>|\n))*/gi, '')
    .replace(/(<p>(&nbsp;|\s|<br>)*<\/p>|(<br>|\n))*$/gi, '')
    .trim();
};

const addSection = (title: string, content: string | undefined) => {
  const cleanContent = sanitize(content);

  // Seções principais sempre aparecem como cabeçalho mesmo se vazias
  const isMainSection = /CLASSIFICA|ANÁLISE|CONCLUS|OBSERVAÇ|RECOMENDA/i.test(title);
  if (!isMainSection && cleanContent === '') return '';

  const finalContent = cleanContent !== '' ? cleanContent : '<p>(...)</p>';

  return `<h2>${title}</h2>\n${finalContent}\n`;
};

export function getInitialReportContent(
  template: ReportTemplate,
  toggles?: ReportSectionToggles
): string {
  // Título centralizado
  let html = `<h1 style="text-align: center">${template.title}</h1>\n`;

  // Seções opcionais controladas pela aba LAUD.IA (ausência = incluída)
  const withClassification = toggles?.classification !== false;
  const withRecommendations = toggles?.recommendations !== false;
  const withObservations = toggles?.observations !== false;

  // Ordem Clínica Padrão. As Observações Metodológicas (Nota ao Final do Laudo)
  // são a última seção do corpo — editável no laudo.
  html += addSection('TÉCNICA', template.technique);
  html += addSection('ANÁLISE', template.analysisTemplate);
  if (withClassification) html += addSection('CLASSIFICAÇÕES', template.classificationTemplate || '');
  html += addSection('CONCLUSÃO', template.conclusionTemplate);
  if (withRecommendations) html += addSection('RECOMENDAÇÕES', template.recommendationsTemplate);
  if (withObservations) html += addSection('OBSERVAÇÕES METODOLÓGICAS', template.observationsTemplate || '');

  return html;
}

// ───────────────────────── Exames combinados ─────────────────────────

/**
 * IDs das máscaras de um exame, na ordem (1º = primária). Exames antigos
 * só têm `templateId`; combinados têm `templateIds` com o primário espelhado.
 */
export function examTemplateIds(
  exam: Pick<ExamRequest, 'templateId' | 'templateIds'>
): string[] {
  const ids = exam.templateIds?.filter(Boolean);
  if (ids && ids.length > 0) return ids;
  return exam.templateId ? [exam.templateId] : [];
}

export function isCombinedExam(
  exam: Pick<ExamRequest, 'templateId' | 'templateIds'>
): boolean {
  return examTemplateIds(exam).length > 1;
}

/** Nome do tipo de exame combinado: nomes das máscaras unidos por " + ". */
export function combinedExamType(templates: ReportTemplate[]): string {
  return templates.map((t) => t.name).join(' + ');
}

/**
 * Título único do laudo combinado. Base = título da máscara primária; dos
 * títulos seguintes remove-se apenas a palavra inicial "ULTRASSONOGRAFIA"
 * (preservando a preposição) e junta-se com " E ". Títulos sem o prefixo
 * são unidos integralmente.
 * Ex.: "ULTRASSONOGRAFIA DE ABDOME TOTAL" + "ULTRASSONOGRAFIA DE PRÓSTATA
 * (VIA ABDOMINAL)" → "ULTRASSONOGRAFIA DE ABDOME TOTAL E DE PRÓSTATA (VIA ABDOMINAL)".
 */
export function getCombinedTitle(templates: ReportTemplate[]): string {
  const titles = templates
    .map((t) => (t.title || t.name || '').trim())
    .filter(Boolean);
  return titles
    .map((t, i) => (i === 0 ? t : t.replace(/^ULTRASSONOGRAFIA\s+/i, '')))
    .join(' E ');
}

/** Texto normalizado de um bloco HTML para comparação de duplicatas. */
const normalizeText = (html: string): string =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Divide o conteúdo de uma seção em blocos `<p>…</p>` + restos intocados. */
const splitBlocks = (html: string): string[] =>
  html
    .split(/(<p[^>]*>[\s\S]*?<\/p>)/gi)
    .map((s) => s.trim())
    .filter(Boolean);

/** Rótulo `<strong>…:</strong>` normalizado de um parágrafo de ANÁLISE. */
const blockLabel = (html: string): string | null => {
  const m = /<strong[^>]*>([\s\S]*?)<\/strong>/i.exec(html);
  if (!m) return null;
  const label = normalizeText(m[1]).replace(/:$/, '').trim();
  return label || null;
};

// ── Fusão de prosa unificada (TÉCNICA / OBSERVAÇÕES METODOLÓGICAS) ──

/** Divide um texto plano em sentenças (fim em "." seguido de maiúscula). */
const splitSentences = (text: string): string[] =>
  text
    .split(/(?<=\.)\s+(?=[A-ZÀ-ÚÇ])/)
    .map((s) => s.trim())
    .filter(Boolean);

/** Tokens normalizados de uma sentença (sem acentos/caixa/pontuação final). */
const sentenceTokens = (sentence: string): string[] =>
  normalizeText(sentence)
    .split(' ')
    .map((w) => w.replace(/[.,;:]+$/, ''))
    .filter(Boolean);

/** Nº mínimo de palavras iguais no início para considerar duas sentenças "a mesma frase-tronco". */
const PROSE_MERGE_MIN_WORDS = 8;

/**
 * Funde o conteúdo de TÉCNICA/OBSERVAÇÕES de N máscaras num ÚNICO parágrafo
 * coeso, sentença a sentença:
 * - sentença idêntica (normalizada) aparece uma vez;
 * - sentença que é PREFIXO de outra é absorvida pela mais completa (ex.: a
 *   limitação por interposição gasosa com e sem a ressalva da via abdominal);
 * - sentenças com o mesmo tronco inicial (≥ 8 palavras) são FUNDIDAS com "e"
 *   (ex.: "…diretrizes de CBR e a classificação de Bosniak (2019)" +
 *   "…diretrizes de CBR e o sistema O-RADS US (v2022)" → uma única frase com
 *   as duas diretrizes);
 * - sentenças diferentes são mantidas em sequência, no mesmo parágrafo.
 */
const mergeUnifiedProse = (contents: Array<string | undefined>): string => {
  const entries: { text: string }[] = [];

  const addSentence = (sentence: string) => {
    const newTokens = sentenceTokens(sentence);
    if (newTokens.length === 0) return;
    for (const entry of entries) {
      const exTokens = sentenceTokens(entry.text);
      let common = 0;
      while (
        common < exTokens.length &&
        common < newTokens.length &&
        exTokens[common] === newTokens[common]
      ) common++;
      if (common === newTokens.length && common === exTokens.length) return; // idêntica
      if (common < PROSE_MERGE_MIN_WORDS) continue;
      if (common === newTokens.length) return; // nova ⊆ existente
      if (common === exTokens.length) { entry.text = sentence; return; } // existente ⊆ nova
      // Fusão: tronco comum + cauda existente + " e " + cauda nova
      const exWords = entry.text.trim().split(/\s+/);
      const newWords = sentence.trim().split(/\s+/);
      const head = exWords.slice(0, common).join(' ');
      const exTail = exWords.slice(common).join(' ').replace(/\.\s*$/, '');
      const newTail = newWords.slice(common).join(' ');
      entry.text = `${head} ${exTail} e ${newTail}`;
      return;
    }
    entries.push({ text: sentence });
  };

  for (const content of contents) {
    const clean = sanitize(content);
    if (!clean) continue;
    const plain = clean.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
    for (const sentence of splitSentences(plain)) addSentence(sentence);
  }

  if (entries.length === 0) return '';
  return `<p>${entries.map((e) => e.text).join(' ')}</p>`;
};

/**
 * Concatena o conteúdo da mesma seção vindo de N máscaras, descartando
 * duplicatas: em modo 'exact', parágrafos com texto normalizado idêntico;
 * em modo 'label' (ANÁLISE), parágrafos cujo rótulo <strong> de compartimento
 * já apareceu (protege contra "BEXIGA:" dobrado). Blocos não-<p> passam intactos.
 */
const mergeSectionContents = (
  contents: Array<string | undefined>,
  dedupe: 'exact' | 'label'
): string => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const content of contents) {
    const clean = sanitize(content);
    if (!clean) continue;
    for (const block of splitBlocks(clean)) {
      if (/^<p/i.test(block)) {
        const key = dedupe === 'label' ? blockLabel(block) : normalizeText(block);
        if (key) {
          if (seen.has(key)) continue;
          seen.add(key);
        }
      }
      out.push(block);
    }
  }
  return out.join('\n');
};

/**
 * Laudo-base de um exame combinado (formato aprovado: seções mescladas).
 * Um único <h1> com o título combinado e UMA ocorrência de cada seção na
 * ordem clínica padrão, concatenando o conteúdo das máscaras na ordem.
 * Com 1 máscara, delega para `getInitialReportContent` (saída idêntica —
 * a detecção de primeira geração compara byte a byte).
 */
export function getCombinedInitialReportContent(
  templates: Array<ReportTemplate | null | undefined>,
  toggles?: ReportSectionToggles
): string {
  const valid = templates.filter((t): t is ReportTemplate => Boolean(t));
  if (valid.length === 0) return '';
  if (valid.length === 1) return getInitialReportContent(valid[0], toggles);

  let html = `<h1 style="text-align: center">${getCombinedTitle(valid)}</h1>\n`;

  const withClassification = toggles?.classification !== false;
  const withRecommendations = toggles?.recommendations !== false;
  const withObservations = toggles?.observations !== false;

  // TÉCNICA e OBSERVAÇÕES METODOLÓGICAS são UNIFICADAS num parágrafo único e
  // coeso (fusão de sentenças); as demais seções concatenam com dedupe.
  html += addSection('TÉCNICA', mergeUnifiedProse(valid.map((t) => t.technique)));
  html += addSection('ANÁLISE', mergeSectionContents(valid.map((t) => t.analysisTemplate), 'label'));
  if (withClassification)
    html += addSection('CLASSIFICAÇÕES', mergeSectionContents(valid.map((t) => t.classificationTemplate || ''), 'exact'));
  html += addSection('CONCLUSÃO', mergeSectionContents(valid.map((t) => t.conclusionTemplate), 'exact'));
  if (withRecommendations)
    html += addSection('RECOMENDAÇÕES', mergeSectionContents(valid.map((t) => t.recommendationsTemplate), 'exact'));
  if (withObservations)
    html += addSection('OBSERVAÇÕES METODOLÓGICAS', mergeUnifiedProse(valid.map((t) => t.observationsTemplate || '')));

  return html;
}
