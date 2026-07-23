import { describe, it, expect } from 'vitest';
import { tiradsScore, TIRADS_OPTIONS, biradsSuggest, oradsSuggest, grafType, carotidStenosisNASCET, itbClassification, bosniakSuggest } from '../modules/editor/structured/scoring';
import { deriveStructuredSchema, summarizeStructured } from '../modules/editor/structured/deriveSchema';
import { computeDerivations } from '../modules/editor/structured/liveCompute';
import { normalKey, countKey, itemFieldId } from '../modules/editor/structured/structuredKeys';
import { ReportTemplate, StructuredSchema } from '../types';

function tpl(area: string, name: string, compartments: string[] = []): ReportTemplate {
  const analysisTemplate = compartments
    .map((c) => `<p><strong>${c}:</strong> medindo [__] x [__] x [__] cm.</p>`)
    .join('');
  return {
    id: 't', area: area as any, name, title: '', technique: '',
    analysisTemplate, conclusionTemplate: '', recommendationsTemplate: '',
    createdAt: 0, updatedAt: 0,
  } as ReportTemplate;
}

describe('scoring — ACR TI-RADS inline', () => {
  it('nódulo sólido, muito hipoecoico, mais alto que largo, margem irregular, focos puntiformes → TR5', () => {
    const r = tiradsScore({
      composition: 'sólida', echogenicity: 'muito hipoecoico',
      shape: 'mais alto que largo', margin: 'lobulada/irregular', foci: 'focos puntiformes',
    });
    // 2 + 3 + 3 + 2 + 3 = 13 pts
    expect(r?.points).toBe(13);
    expect(r?.tr).toBe(5);
    expect(r?.complete).toBe(true);
    expect(r?.conduct).toContain('1,0 cm');
  });

  it('espongiforme → TR1 (benigno)', () => {
    const r = tiradsScore({ composition: 'espongiforme', echogenicity: 'anecoico', shape: 'mais largo que alto', margin: 'lisa' });
    expect(r?.tr).toBe(1);
    expect(r?.points).toBe(0);
  });

  it('descritores incompletos e sem pontos → null', () => {
    expect(tiradsScore({})).toBeNull();
  });

  it('as opções de descritor batem com as chaves de pontuação', () => {
    expect(TIRADS_OPTIONS.composition).toContain('sólida');
    expect(TIRADS_OPTIONS.shape.length).toBe(2);
  });

  it('focos ecogênicos ADITIVOS (multiseleção) somam pontos', () => {
    const single = tiradsScore({ composition: 'sólida', echogenicity: 'hipoecoico', shape: 'mais largo que alto', margin: 'lisa', foci: 'macrocalcificações' });
    const multi = tiradsScore({ composition: 'sólida', echogenicity: 'hipoecoico', shape: 'mais largo que alto', margin: 'lisa', foci: 'macrocalcificações, focos puntiformes' });
    // single: 2+2+0+0+1 = 5 ; multi: +3 (puntiformes) = 8
    expect(single?.points).toBe(5);
    expect(multi?.points).toBe(8);
  });
});

describe('scoring — sugestões BI-RADS / O-RADS e Graf', () => {
  it('BI-RADS: morfologia benigna → 3; suspeita → 4/5', () => {
    expect(biradsSuggest({ forma: 'oval', orientacao: 'paralela', margem: 'circunscrita' })?.suspicious).toBe(false);
    const susp = biradsSuggest({ forma: 'irregular', orientacao: 'não paralela (mais alta que larga)', margem: 'espiculada' });
    expect(susp?.suspicious).toBe(true);
    expect(susp?.label).toMatch(/BI-RADS/);
    expect(biradsSuggest({})).toBeNull();
  });

  it('O-RADS: cisto unilocular anecoico → benigno; sólido com fluxo → alto risco', () => {
    expect(oradsSuggest({ tipo: 'unilocular', conteudo: 'anecoico', septos: 'ausentes' })?.suspicious).toBe(false);
    const solid = oradsSuggest({ tipo: 'sólida', vascularizacao: '4 – marcante' });
    expect(solid?.suspicious).toBe(true);
    expect(solid?.label).toMatch(/O-RADS 5/);
  });

  it('Graf: α≥60 → tipo I; α<43 → displásico', () => {
    expect(grafType(64)).toMatch(/^I /);
    expect(grafType(40)).toMatch(/III/);
    expect(grafType(0)).toBeNull();
  });
});

describe('scoring vascular — NASCET e ITB', () => {
  it('estenose carotídea por VPS da ACI', () => {
    expect(carotidStenosisNASCET(90)?.label).toMatch(/< 50%/);
    expect(carotidStenosisNASCET(160)?.label).toMatch(/50–69%/);
    const grave = carotidStenosisNASCET(260, 120, 80);
    expect(grave?.severe).toBe(true);
    expect(grave?.label).toMatch(/≥ 70%/);
    expect(grave?.label).toMatch(/ACI\/ACC/);
  });
  it('ITB: cortes ESC/AHA — os mesmos que o prompt da área ensina à IA', () => {
    // o chip do formulário e o laudo gerado precisam concordar sobre o mesmo
    // número (antes divergiam: chip normal 0,9–1,3 × prompt normal 1,00–1,40)
    expect(itbClassification(1.0)?.label).toMatch(/normal/);
    expect(itbClassification(1.0)?.alert).toBe(false);
    expect(itbClassification(0.5)?.label).toMatch(/leve a moderada/);
    expect(itbClassification(0.5)?.alert).toBe(true);
    expect(itbClassification(0.3)?.label).toMatch(/grave/);
    expect(itbClassification(1.5)?.label).toMatch(/incompress/);
  });

  it('ITB: fronteiras que mudaram ao adotar ESC/AHA', () => {
    // 0,95 era "normal"; agora é LIMÍTROFE (não é DAP, mas não é normal)
    expect(itbClassification(0.95)?.label).toMatch(/limítrofe/);
    expect(itbClassification(0.95)?.alert).toBe(false);
    // 1,35 era "incompressível"; agora é normal — só ACIMA de 1,40 é incompressível
    expect(itbClassification(1.35)?.label).toMatch(/normal/);
    expect(itbClassification(1.4)?.label).toMatch(/normal/);
    expect(itbClassification(1.41)?.label).toMatch(/incompress/);
    // 0,90 é DAP (o limite superior da DAP é 0,90, não 0,89)
    expect(itbClassification(0.9)?.label).toMatch(/leve a moderada/);
    expect(itbClassification(0.4)?.label).toMatch(/grave/);
  });
  it('Bosniak: cisto simples → I; componente sólido → IV', () => {
    expect(bosniakSuggest({ septos: 'ausentes', parede: 'fina' })?.label).toMatch(/Bosniak I /);
    expect(bosniakSuggest({ solido: 'presente' })?.suspicious).toBe(true);
    expect(bosniakSuggest({})).toBeNull();
  });
});

describe('summarize — seções normal/alterado e repetíveis', () => {
  const abdome = deriveStructuredSchema(tpl('medicina-interna', 'ABDOME', ['Baço']), 'medicina-interna');
  const bacoId = abdome.sections.find((s) => s.label === 'Baço')!.id;
  const tireoide = deriveStructuredSchema(tpl('pequenas-partes', 'RASTREIO PP', ['Achados Nodulares']), 'pequenas-partes');
  const nodId = tireoide.sections.find((s) => s.label === 'Achados Nodulares')!.id;

  it('seção normalable em estado normal compila "sem alterações"', () => {
    expect(summarizeStructured(abdome, {}).lines.join('\n')).toMatch(/Baço: sem alterações/);
  });

  it('seção normalable em estado alterado emite os campos preenchidos', () => {
    const { lines } = summarizeStructured(abdome, { [normalKey(bacoId)]: 'altered', baco_eixo: '14' });
    expect(lines.join('\n')).toMatch(/14/);
    expect(lines.join('\n')).not.toMatch(/Baço: sem alterações/);
  });

  it('campo oculto por showIf com valor residual não compila nem conta', () => {
    // Regressão: mudar o controlador (ex.: flap 'presente' → 'ausente') ocultava
    // o campo na UI, mas o valor antigo seguia vazando para o laudo/IA.
    const schema: StructuredSchema = {
      area: 'vascular',
      sections: [{
        id: 'aorta', label: 'Aorta', fields: [
          { id: 'flap', label: 'Flap intimal', kind: 'select', options: ['ausente', 'presente'] },
          { id: 'debakey', label: 'DeBakey', kind: 'select', options: ['DeBakey I (tipo A)'], showIf: { field: 'flap', equals: 'presente' } },
        ],
      }],
    };
    const shown = summarizeStructured(schema, { flap: 'presente', debakey: 'DeBakey I (tipo A)' });
    expect(shown.lines.join('\n')).toMatch(/DeBakey/);
    const hidden = summarizeStructured(schema, { flap: 'ausente', debakey: 'DeBakey I (tipo A)' });
    expect(hidden.lines.join('\n')).not.toMatch(/DeBakey/);
    expect(hidden.filledCount).toBe(1); // só o flap conta como preenchido
  });

  it('medida digitada se registra no card Normal; auto-preenchimento da faixa não', () => {
    const schema: StructuredSchema = {
      area: 'medicina-interna',
      sections: [{
        id: 'orgao', label: 'Órgão', normalable: true, normalText: 'aspecto habitual', fields: [
          { id: 'medida_x', label: 'Medida X', kind: 'measure', unit: 'mm', normal: '10–20 mm' },
        ],
      }],
    };
    // número digitado (dentro da faixa, sem alwaysShow) compila junto da normalidade
    const digitado = summarizeStructured(schema, { medida_x: '14' });
    expect(digitado.lines.join('\n')).toMatch(/Órgão: sem alterações/);
    expect(digitado.lines.join('\n')).toMatch(/Medida X: 14 mm/);
    // botão Normal copia o TEXTO da faixa para o campo — isso não é registro
    const auto = summarizeStructured(schema, { medida_x: '10–20 mm' });
    expect(auto.lines.join('\n')).not.toMatch(/Medida X/);
    expect(auto.lines.join('\n')).toMatch(/Órgão: sem alterações/);
  });

  it('select com a opção NORMAL escolhida se registra no card Normal; vazio colapsa', () => {
    // Regressão: "esteatose: ausente", "CEAP: C0" etc. documentam a pesquisa —
    // eram engolidos pelo colapso de normalidade (88 campos nas 10 áreas).
    const schema: StructuredSchema = {
      area: 'medicina-interna',
      sections: [{
        id: 'orgao', label: 'Órgão', normalable: true, normalText: 'aspecto habitual', fields: [
          { id: 'pesquisa', label: 'Pesquisa Y', kind: 'select', options: ['ausente', 'presente'] },
        ],
      }],
    };
    const escolhido = summarizeStructured(schema, { pesquisa: 'ausente' }).lines.join('\n');
    expect(escolhido).toMatch(/Órgão: sem alterações/); // 1ª opção não vira achado
    expect(escolhido).toMatch(/Pesquisa Y: ausente/);   // mas o escolhido compila
    const vazio = summarizeStructured(schema, {}).lines.join('\n');
    expect(vazio).toMatch(/Órgão: sem alterações/);
    expect(vazio).not.toMatch(/Pesquisa Y/);            // vazio segue compacto
  });

  it('seção repetível itera instâncias por índice', () => {
    const { lines, filledCount } = summarizeStructured(tireoide, {
      [countKey(nodId)]: '2',
      [itemFieldId(nodId, 0, 'loc')]: 'lobo direito',
      [itemFieldId(nodId, 1, 'loc')]: 'lobo esquerdo',
    });
    const text = lines.join('\n');
    expect(text).toMatch(/Nódulo 1:/);
    expect(text).toMatch(/Nódulo 2:/);
    expect(filledCount).toBeGreaterThanOrEqual(2);
  });
});

describe('liveCompute — escore TI-RADS por instância', () => {
  const tireoide = deriveStructuredSchema(tpl('pequenas-partes', 'RASTREIO PP', ['Achados Nodulares']), 'pequenas-partes');
  const nodId = tireoide.sections.find((s) => s.label === 'Achados Nodulares')!.id;

  it('calcula TR do nódulo repetível a partir dos descritores', () => {
    const d = computeDerivations(tireoide, {
      [countKey(nodId)]: '1',
      [itemFieldId(nodId, 0, 'composicao')]: 'sólida',
      [itemFieldId(nodId, 0, 'ecogenicidade')]: 'muito hipoecoico',
      [itemFieldId(nodId, 0, 'forma')]: 'mais alto que largo',
      [itemFieldId(nodId, 0, 'margem')]: 'lisa',
    });
    const tr = d.find((x) => x.id.includes('__tr'));
    expect(tr?.text).toContain('TR5');
    expect(tr?.alert).toBe(true);
    expect(tr?.label).toContain('TI-RADS');
  });

  it('pula seção normalable em estado normal (sem volume espúrio)', () => {
    const abdome = deriveStructuredSchema(tpl('medicina-interna', 'ABDOME', ['Baço']), 'medicina-interna');
    expect(computeDerivations(abdome, {}).length).toBe(0);
  });
});
