import { StructuredFieldValue } from '../../../types';
import { fieldValueToText } from './deriveSchema';
import { parseIgLabel, resolveReferenceGa } from '../../calculators/formulas';
import type { PatientContext } from './patientContext';

/**
 * SEMENTE das calculadoras a partir do formulário Estruturado.
 *
 * Quando o médico abre uma calculadora por um campo do Estruturado, ela já
 * chega preenchida com o que foi digitado no formulário (dados maternos, exame
 * físico, datação, biometria, marcadores). Evita redigitação e garante que o
 * risco seja calculado sobre EXATAMENTE os dados do laudo.
 *
 * O valor salvo pelo médico na calculadora tem prioridade sobre a semente
 * (ver a mesclagem em ExamEditor): `{ ...seed, ...saved }`.
 */

type Values = Record<string, StructuredFieldValue> | undefined;

const txt = (v: Values, id: string) => fieldValueToText(v?.[id]);

/** Número em formato pt-BR ('1,4' → 1.4). Retorna '' quando ausente. */
function numStr(v: Values, id: string): string {
  const t = txt(v, id);
  if (!t) return '';
  const m = t.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return m ? m[0] : '';
}

function has(v: Values, id: string, needle: string): boolean {
  return txt(v, id).toLowerCase().includes(needle.toLowerCase());
}

/** dd/mm/aaaa → aaaa-mm-dd (formato do <input type="date">). */
function toIsoDate(br: string): string {
  const m = br.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return '';
  const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${yr}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

const RACIAL: Record<string, string> = {
  branca: 'white',
  'afro-caribenha': 'afroCaribbean',
  'sul-asiática': 'southAsian',
  'leste-asiática': 'eastAsian',
  mista: 'mixed',
};

const CONCEPTION: Record<string, string> = {
  espontânea: 'spontaneous',
  'indução da ovulação': 'ovulationInduction',
  'FIV/ICSI': 'ivf',
};

const PARITY: Record<string, string> = {
  nulípara: 'nulliparous',
  'multípara sem PE prévia': 'parousNoPE',
  'multípara com PE prévia': 'parousPE',
};

const DIABETES: Record<string, string> = {
  ausente: 'none',
  'tipo 1': 'type1',
  'tipo 2 em insulina': 'type2insulin',
  'tipo 2 sem insulina': 'type2noinsulin',
};

const ANALYZER: Record<string, string> = { Cobas: 'cobas', Delfia: 'delfia', Kryptor: 'kryptor' };

/** Marcador do 1º trimestre → MarkerState da calculadora de trissomias. */
function markerState(v: Values, id: string, abnormalWhen: (t: string) => boolean): string {
  const t = txt(v, id);
  if (!t) return 'notAssessed';
  return abnormalWhen(t.toLowerCase()) ? 'abnormal' : 'normal';
}

/** PAM (pressão arterial média) = (2·diastólica + sistólica) / 3. */
export function meanArterialPressure(systolic: number, diastolic: number): number | null {
  if (!(systolic > 0 && diastolic > 0) || diastolic > systolic) return null;
  return (2 * diastolic + systolic) / 3;
}

/** IMC = peso(kg) / altura(m)². */
export function bodyMassIndex(weightKg: number, heightCm: number): number | null {
  if (!(weightKg > 0 && heightCm > 0)) return null;
  return weightKg / Math.pow(heightCm / 100, 2);
}

/** dd/mm/aaaa → Date LOCAL (meia-noite) | null. `new Date('aaaa-mm-dd')` seria
 *  UTC — no fuso local viraria a véspera e deslocaria a IG em 1 dia. */
function toDate(br: string): Date | null {
  const m = br.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  const yr = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const dt = new Date(yr, Number(m[2]) - 1, Number(m[1]));
  return isNaN(dt.getTime()) ? null : dt;
}

/** Momento do exame truncado para a meia-noite LOCAL — a datação compara datas,
 *  não horários (o mesmo truncamento do liveCompute e da calculadora). */
function examMidnight(examDateMs?: number): Date {
  const d = examDateMs ? new Date(examDateMs) : new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * IG de referência do formulário (semanas/dias), pela MESMA hierarquia do motor
 * (`resolveReferenceGa`: USG > DUM > biometria). É o que a calculadora de Doppler
 * precisa para converter os IPs em percentis.
 */
function referenceGa(v: Values, examDateMs?: number): { weeks: number; days: number } | null {
  const metodo = txt(v, 'ig_metodo').toLowerCase();
  const method = /biometr/.test(metodo) ? 'biometria' : /usg|ultrass/.test(metodo) ? 'usg' : /dum|menstrua/.test(metodo) ? 'dum' : null;
  const usgIg = parseIgLabel(txt(v, 'usg_ig'));
  const n = (id: string) => {
    const s = numStr(v, id);
    return s ? Number(s) : null;
  };
  const igRef = resolveReferenceGa({
    method,
    dum: toDate(txt(v, 'dum')),
    usgDate: toDate(txt(v, 'usg_data')),
    usgWeeks: usgIg?.weeks ?? null,
    usgDays: usgIg?.days ?? null,
    biometry: { ccn: n('ccn'), dbp: n('dbp'), cc: n('cc') },
    examDate: examMidnight(examDateMs),
  });
  if (!igRef) return null;
  return { weeks: igRef.weeks, days: igRef.days };
}

/**
 * Semente para uma calculadora. Retorna `null` quando não há mapeamento ou
 * nenhum dado aproveitável no formulário.
 */
export function seedForCalculator(
  calcId: string,
  values: Values,
  examDateMs?: number,
  ctx?: PatientContext
): Record<string, unknown> | null {
  // Data do exame em aaaa-mm-dd LOCAL (toISOString seria UTC: um exame às
  // 22h no Brasil semearia a calculadora com o dia SEGUINTE → IG +1 dia).
  const examDay = examMidnight(examDateMs);
  const isoExam = `${examDay.getFullYear()}-${String(examDay.getMonth() + 1).padStart(2, '0')}-${String(examDay.getDate()).padStart(2, '0')}`;

  // Fallbacks vindos do cadastro/prontuário do paciente: usados quando o campo
  // correspondente do formulário está vazio (o valor do formulário prevalece).
  const ageOr = (id: string) => numStr(values, id) || (ctx?.ageYears != null ? String(ctx.ageYears) : '');
  const weightOr = (id: string) => numStr(values, id) || (ctx?.weightKg != null ? String(ctx.weightKg) : '');
  const heightOr = (id: string) => numStr(values, id) || (ctx?.heightCm != null ? String(ctx.heightCm) : '');

  if (calcId === 'gestational-age') {
    const metodo = txt(values, 'ig_metodo').toLowerCase();
    const usgIg = parseIgLabel(txt(values, 'usg_ig'));
    const dumIso = toIsoDate(txt(values, 'dum'));
    const usgDateIso = toIsoDate(txt(values, 'usg_data'));
    const declared = /biometr/.test(metodo)
      ? 'bio'
      : /usg|ultrass/.test(metodo)
        ? 'usg'
        : /dum|menstrua/.test(metodo)
          ? 'dum'
          : null;
    // Sem método declarado, abre na aba que TEM dados (mesma hierarquia do
    // motor: USG > DUM > biometria) — antes caía sempre em 'usg' e a
    // calculadora podia abrir vazia com o chip do formulário mostrando IG.
    const method = declared
      ?? (usgDateIso && usgIg
        ? 'usg'
        : dumIso
          ? 'dum'
          : numStr(values, 'ccn') || numStr(values, 'dbp') || numStr(values, 'cc')
            ? 'bio'
            : 'usg');
    return {
      referenceDate: isoExam,
      method,
      dumDate: dumIso,
      prevUsgDate: usgDateIso,
      prevUsgWeeks: usgIg ? String(usgIg.weeks) : '',
      prevUsgDays: usgIg ? String(usgIg.days) : '',
      ccn: numStr(values, 'ccn'),
      bpd: numStr(values, 'dbp'),
      hc: numStr(values, 'cc'),
    };
  }

  if (calcId === 'who-fetal-biometry') {
    const sexo = txt(values, 'sexo_fetal').toLowerCase();
    return {
      bpd: numStr(values, 'dbp'),
      hc: numStr(values, 'cc'),
      ac: numStr(values, 'ca'),
      fl: numStr(values, 'cf'),
      sex: /mascul/.test(sexo) ? 'male' : /femin/.test(sexo) ? 'female' : 'unknown',
      dumDate: toIsoDate(txt(values, 'dum')),
      referenceDate: isoExam,
    };
  }

  if (calcId === 'barcelona-fetal-growth') {
    // biometria + Doppler juntos (o mesmo que who-fetal-biometry + doppler-fetal),
    // pois o estadiamento de Barcelona consome os dois. IG pela datação do laudo.
    const sexo = txt(values, 'sexo_fetal').toLowerCase();
    const ga = referenceGa(values, examDateMs);
    const au = txt(values, 'au_diastole').toLowerCase();
    const dv = txt(values, 'dv').toLowerCase();
    return {
      gaWeeks: ga ? String(ga.weeks) : '',
      gaDays: ga ? String(ga.days) : '',
      sex: /mascul/.test(sexo) ? 'male' : /femin/.test(sexo) ? 'female' : 'unknown',
      bpd: numStr(values, 'dbp'),
      hc: numStr(values, 'cc'),
      ac: numStr(values, 'ca'),
      fl: numStr(values, 'cf'),
      auPi: numStr(values, 'ip_au'),
      acmPi: numStr(values, 'ip_acm'),
      utaPi: numStr(values, 'ip_uta'),
      dvPi: numStr(values, 'ip_dv'),
      auFlow: /revers/.test(au) ? 'redf' : /ausente|zero/.test(au) ? 'aedf' : 'normal',
      dvWave: /revers/.test(dv) ? 'rav' : dv ? 'normal' : 'not_evaluated',
    };
  }

  if (calcId === 'ivc-index') {
    return { maxDia: numStr(values, 'vci_max'), minDia: numStr(values, 'vci_min') };
  }

  if (calcId === 'imt-elsa-br') {
    // a curva ELSA-Brasil depende de idade E sexo — ambos vêm do card, com
    // fallback para o cadastro do paciente (idade da DN, sexo do cadastro).
    const sexo = txt(values, 'emi_sexo').toLowerCase();
    const sexFromCtx = ctx?.sex === 'F' ? 'female' : ctx?.sex === 'M' ? 'male' : '';
    return {
      imtRight: numStr(values, 'emi_d'),
      imtLeft: numStr(values, 'emi_e'),
      age: ageOr('emi_idade'),
      sex: /femin/.test(sexo) ? 'female' : /mascul/.test(sexo) ? 'male' : sexFromCtx || 'male',
    };
  }

  if (calcId === 'amniotic-fluid') {
    // o card mede os quadrantes em cm; a calculadora trabalha em mm → ×10.
    const q = (id: string) => {
      const n = Number(numStr(values, id));
      return n > 0 ? String(n * 10) : '';
    };
    const q1 = q('ila_q1'), q2 = q('ila_q2'), q3 = q('ila_q3'), q4 = q('ila_q4');
    const temQuadrantes = !!(q1 && q2 && q3 && q4);
    const mbv = numStr(values, 'mbv'); // já em mm no card
    return {
      method: temQuadrantes ? 'ila' : 'mbv',
      q1, q2, q3, q4,
      // o MBV da calculadora é lido do array `pockets`, não de um campo único
      ...(mbv ? { pockets: [{ id: 'seed', label: 'MBV', depth: mbv }] } : {}),
    };
  }

  if (calcId === 'doppler-fetal') {
    const ga = referenceGa(values, examDateMs);
    // 'positiva' | 'ausente' | 'reversa' (card) → auFlow/dvWave da calculadora
    const au = txt(values, 'au_diastole').toLowerCase();
    const dv = txt(values, 'dv').toLowerCase();
    return {
      gaWeeks: ga ? String(ga.weeks) : '',
      gaDays: ga ? String(ga.days) : '',
      auPi: numStr(values, 'ip_au'),
      acmPi: numStr(values, 'ip_acm'),
      utaPi: numStr(values, 'ip_uta'),
      dvPi: numStr(values, 'ip_dv'),
      auFlow: /revers/.test(au) ? 'redf' : /ausente|zero/.test(au) ? 'aedf' : 'normal',
      dvWave: /revers/.test(dv) ? 'rav' : dv ? 'normal' : 'not_evaluated',
    };
  }

  if (calcId === 'msd-dmsg') return { msd: numStr(values, 'dmsg') };

  if (calcId === 'fmf-trisomy-risk') {
    return {
      age: ageOr('mae_idade'),
      crlMm: numStr(values, 'ccn'),
      ntMm: numStr(values, 'nt'),
      // FCF (batimentos) — marcador de FHR do rastreio combinado (Kagan 2008):
      // taquicardia da T13, bradicardia da T18. Vem da vitalidade do exame.
      fhrBpm: numStr(values, 'bcf'),
      pappaMoM: numStr(values, 'pappa_mom'),
      bhcgMoM: numStr(values, 'bhcg_mom'),
      // Osso nasal ausente/hipoplásico, onda A do DV ausente/reversa e
      // regurgitação tricúspide presente são os estados "anormais" da FMF.
      nasalBone: markerState(values, 'on', (t) => /ausente|hipoplás/.test(t)),
      ductusVenosus: markerState(values, 'dv', (t) => /ausente|revers/.test(t)),
      tricuspid: markerState(values, 'tricuspide', (t) => /presente/.test(t)),
    };
  }

  if (calcId === 'fmf-preeclampsia-risk') {
    const sys = Number(numStr(values, 'pa_sistolica'));
    const dia = Number(numStr(values, 'pa_diastolica'));
    const map = meanArterialPressure(sys, dia);
    const etnia = txt(values, 'mae_etnia');
    const conc = txt(values, 'mae_concepcao');
    const par = txt(values, 'mae_paridade');
    const dm = txt(values, 'mae_diabetes');
    const analyzer = txt(values, 'bio_analisador');
    // Razão P2/P1 das artérias oftálmicas (biomarcador de PE no modelo).
    const p1 = Number(numStr(values, 'oft_p1'));
    const p2 = Number(numStr(values, 'oft_p2'));
    const psvRatio = p1 > 0 && p2 > 0 ? (p2 / p1).toFixed(2) : '';
    return {
      age: ageOr('mae_idade'),
      weightKg: weightOr('mae_peso'),
      heightCm: heightOr('mae_altura'),
      racialOrigin: RACIAL[etnia] || 'white',
      conception: CONCEPTION[conc] || 'spontaneous',
      parity: PARITY[par] || 'nulliparous',
      previousPeGaWeeks: numStr(values, 'mae_pe_ig'),
      diabetes: DIABETES[dm] || 'none',
      chronicHypertension: has(values, 'mae_comorbidades', 'hipertensão crônica'),
      sleOrAps: has(values, 'mae_comorbidades', 'LES'),
      familyHistoryPE: has(values, 'mae_comorbidades', 'história familiar'),
      smoker: has(values, 'mae_comorbidades', 'tabagismo'),
      analyzer: ANALYZER[analyzer] || 'cobas',
      mapMmHg: map != null ? map.toFixed(1) : '',
      utaPiRaw: numStr(values, 'ip_uta'),
      plgfRaw: numStr(values, 'plgf_mom'),
      psvRatioRaw: psvRatio,
    };
  }

  if (calcId === 'fmf-preeclampsia-risk-2t') {
    // Rastreio de PE de 2ª visita (19–24+6): mesmos fatores maternos do 1º T +
    // IG de referência do laudo. Biomarcadores de 2ª visita (MAP/IP uterino/PlGF)
    // e razão P2/P1 oftálmica. Antes esta calculadora abria sempre vazia.
    const sys = Number(numStr(values, 'pa_sistolica'));
    const dia = Number(numStr(values, 'pa_diastolica'));
    const map = meanArterialPressure(sys, dia);
    const etnia = txt(values, 'mae_etnia');
    const conc = txt(values, 'mae_concepcao');
    const par = txt(values, 'mae_paridade');
    const dm = txt(values, 'mae_diabetes');
    const analyzer = txt(values, 'bio_analisador');
    const ga = referenceGa(values, examDateMs);
    return {
      age: ageOr('mae_idade'),
      weightKg: weightOr('mae_peso'),
      heightCm: heightOr('mae_altura'),
      gaWeeks: ga ? String(ga.weeks + ga.days / 7) : '',
      racialOrigin: RACIAL[etnia] || 'white',
      conception: CONCEPTION[conc] || 'spontaneous',
      parity: PARITY[par] || 'nulliparous',
      previousPeGaWeeks: numStr(values, 'mae_pe_ig'),
      diabetes: DIABETES[dm] || 'none',
      chronicHypertension: has(values, 'mae_comorbidades', 'hipertensão crônica'),
      sleOrAps: has(values, 'mae_comorbidades', 'LES'),
      familyHistoryPE: has(values, 'mae_comorbidades', 'história familiar'),
      smoker: has(values, 'mae_comorbidades', 'tabagismo'),
      analyzer: ANALYZER[analyzer] || 'cobas',
      mapMmHg: map != null ? map.toFixed(1) : '',
      // o componente lê IP uterino de utaR/utaL (média) → semeia no direito.
      utaR: numStr(values, 'ip_uta'),
      plgfRaw: numStr(values, 'plgf_mom'),
      // razão P2/P1 oftálmica: semeia o par direito (o componente calcula a média).
      oftRp1: numStr(values, 'oft_p1'),
      oftRp2: numStr(values, 'oft_p2'),
    };
  }

  return null;
}
