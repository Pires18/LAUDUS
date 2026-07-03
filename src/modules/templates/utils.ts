import { ReportTemplate, AppSettings } from '../../types';

/**
 * Seções opcionais do laudo controladas pela aba LAUD.IA do perfil.
 * Quando `false`, a seção é totalmente omitida do laudo-base. Ausência = incluída.
 */
export interface ReportSectionToggles {
  recommendations?: boolean;
  methodologicalObs?: boolean;
  classification?: boolean;
}

/** Deriva os toggles de seção a partir das configurações do usuário (default: tudo ligado). */
export function sectionTogglesFromSettings(settings?: AppSettings): ReportSectionToggles {
  return {
    recommendations: settings?.laudIaRecommendationsEnabled !== false,
    methodologicalObs: settings?.laudIaMethodologicalObsEnabled !== false,
    classification: settings?.laudIaClassificationEnabled !== false,
  };
}

/**
 * Gera o conteúdo HTML inicial de um laudo baseado na máscara (template).
 * Concatena as seções da máscara para formar o documento base.
 * `toggles` permite omitir seções (recomendações, observações, classificação)
 * conforme as preferências LAUD.IA do usuário.
 */
export function getInitialReportContent(
  template: ReportTemplate,
  toggles?: ReportSectionToggles
): string {
  // Título centralizado
  let html = `<h1 style="text-align: center">${template.title}</h1>\n`;
  
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

  // Seções opcionais controladas pela aba LAUD.IA (ausência = incluída)
  const withClassification = toggles?.classification !== false;
  const withRecommendations = toggles?.recommendations !== false;
  const withMethodologicalObs = toggles?.methodologicalObs !== false;

  // Ordem Clínica Padrão
  html += addSection('TÉCNICA', template.technique);
  html += addSection('ANÁLISE', template.analysisTemplate);
  if (withClassification) html += addSection('CLASSIFICAÇÕES', template.classificationTemplate || '');
  html += addSection('CONCLUSÃO', template.conclusionTemplate);
  if (withRecommendations) html += addSection('RECOMENDAÇÕES', template.recommendationsTemplate);
  if (withMethodologicalObs) html += addSection('OBSERVAÇÕES METODOLÓGICAS', template.observationsTemplate);

  return html;
}
