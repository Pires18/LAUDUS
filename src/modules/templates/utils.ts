import { ReportTemplate } from '../../types';

/**
 * Gera o conteúdo HTML inicial de um laudo baseado na máscara (template).
 * Concatena as seções da máscara para formar o documento base.
 */
export function getInitialReportContent(template: ReportTemplate): string {
  // Título centralizado
  let html = `<h2 style="text-align: center">${template.title}</h2>\n`;
  
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
    const isMainSection = /CLASSIFICA|ANÁLISE|CONCLUS/i.test(title);
    if (!isMainSection && cleanContent === '') return '';
    
    const finalContent = cleanContent !== '' ? cleanContent : '<p>(...)</p>';
    
    return `<h2>${title}</h2>\n${finalContent}\n`;
  };

  // Ordem Clínica Padrão
  html += addSection('TÉCNICA', template.technique);
  html += addSection('ANÁLISE', template.analysisTemplate);
  html += addSection('CLASSIFICAÇÕES', template.classificationTemplate || '');
  html += addSection('CONCLUSÃO', template.conclusionTemplate);
  html += addSection('RECOMENDAÇÕES', template.recommendationsTemplate);

  return html;
}
