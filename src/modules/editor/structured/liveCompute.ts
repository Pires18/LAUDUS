import { StructuredSchema, StructuredFieldValue, StructuredFieldDef } from '../../../types';
import { fieldValueToText } from './deriveSchema';
import { itemCount, itemFieldId } from './structuredKeys';
import { effectiveSectionState } from './abnormalRange';
import { sectionRepeatContainers } from './containers';
import { meanArterialPressure, bodyMassIndex, seedForCalculator } from './calcSeed';
import type { PatientContext } from './patientContext';
import { trisomyRiskFromForm, trisomyHasEvidence, peRiskFromForm } from '../../calculators/fmf/fromForm';
import { formatOneInN, crlToGaWeeks } from '../../calculators/fmf/qc';
import type { MarkerState } from '../../calculators/fmf/trisomy';
import type { RacialOrigin, Conception } from '../../calculators/fmf/preeclampsia';
import type { Analyzer, ParityKind, DiabetesKind } from '../../calculators/fmf/medians';
import { tiradsScore, biradsSuggest, oradsSuggest, grafType, carotidStenosisNASCET, itbClassification, bosniakSuggest } from './scoring';
import {
  ellipsoidVolume,
  prostateVolumeWeight,
  crlToGestationalAge,
  gaFromMsd,
  gaFromBiometry,
  pickBiometryDatingParam,
  parseIgLabel,
  resolveReferenceGa,
  ivcCollapsibilityIndex,
  imtClassification,
  DatingMethod,
} from '../../calculators/formulas';
import {
  calcHadlockEfw, mcaPsvMoM, getCprRef,
  UA_REF, MCA_REF, UTA_REF, DV_REF, getRef, zToPercentile, DOPPLER_GA_MIN, DOPPLER_GA_MAX,
} from '../../calculators/constants/fetalReferences';
import { getPercentileBy, DEFAULT_BIOMETRY_REFERENCE } from '../../calculators/constants/biometryReferences';

/**
 * Cálculo em TEMPO REAL (sem abrir modal) a partir dos campos estruturados.
 * Reaproveita as fórmulas puras de `calculators/formulas.ts` — fonte única,
 * sem duplicar matemática clínica. Retorna leituras derivadas que a aba
 * Estruturado renderiza inline por seção e que são anexadas à compilação p/ IA.
 */
export interface Derivation {
  id: string;
  sectionId: string;
  label: string;
  text: string;
  alert?: boolean;
}

type Values = Record<string, StructuredFieldValue> | undefined;

function num(v: StructuredFieldValue | undefined): number | null {
  const t = fieldValueToText(v);
  if (!t) return null;
  const m = t.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function triplet(v: StructuredFieldValue | undefined): [number, number, number] | null {
  const t = fieldValueToText(v);
  if (!t) return null;
  const parts = t.split(/\s*x\s*/i).map((p) => {
    const m = p.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : NaN;
  });
  if (parts.length < 3 || parts.slice(0, 3).some((n) => isNaN(n) || n <= 0)) return null;
  return [parts[0], parts[1], parts[2]];
}

function fmt(n: number, dec = 2): string {
  return n.toFixed(dec).replace('.', ',');
}

function parseBrDate(s: string): Date | null {
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  const yr = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const dt = new Date(yr, Number(m[2]) - 1, Number(m[1]));
  return isNaN(dt.getTime()) ? null : dt;
}

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function computeDerivations(
  schema: StructuredSchema,
  values: Values,
  examDateMs?: number,
  ctx?: PatientContext
): Derivation[] {
  const v = values || {};
  const out: Derivation[] = [];
  // examDate carrega a hora do dia; a datação compara DATAS. Sem truncar para a
  // meia-noite local, um exame à tarde arredonda a IG +1 dia vs. a calculadora
  // (que usa 'T00:00:00') — e todos os percentis derivados deslocam junto.
  const refRaw = examDateMs ? new Date(examDateMs) : new Date();
  const ref = new Date(refRaw.getFullYear(), refRaw.getMonth(), refRaw.getDate());

  // F2 — mapa campo→seção: garante que o chip de "cálculo automático" apareça no
  // compartimento certo (o slug real do heading, ex.: "biometria-fetal"/"dopplerfluxometria",
  // não o literal genérico). Não afeta o prompt (todas as derivações vão para CÁLCULOS AUTOMÁTICOS).
  const fieldSection: Record<string, string> = {};
  for (const s of schema.sections) {
    if (s.repeatable) continue;
    for (const f of s.fields) if (!(f.id in fieldSection)) fieldSection[f.id] = s.id;
  }
  const secOf = (fieldId: string, fallback: string) => fieldSection[fieldId] || fallback;

  // ── IG DE REFERÊNCIA — fonte única dos percentis (OMS, Doppler, MoM) e dos
  // riscos. Resolve por DUM, USG anterior ou biometria (CCN 1ºT / DBP 2ºT /
  // CC 3ºT), respeitando o método declarado no laudo. ──
  const dumStr = fieldValueToText(v['dum']);
  const dum = dumStr ? parseBrDate(dumStr) : null;
  const usgDateStr = fieldValueToText(v['usg_data']);
  const usgIg = parseIgLabel(fieldValueToText(v['usg_ig']));
  const metodoRaw = fieldValueToText(v['ig_metodo']).toLowerCase();
  const method: DatingMethod | null = /biometr/.test(metodoRaw)
    ? 'biometria'
    : /usg|ultrass/.test(metodoRaw)
      ? 'usg'
      : /dum|menstrua/.test(metodoRaw)
        ? 'dum'
        : null;

  const igRef = resolveReferenceGa({
    method,
    dum,
    usgDate: usgDateStr ? parseBrDate(usgDateStr) : null,
    usgWeeks: usgIg?.weeks ?? null,
    usgDays: usgIg?.days ?? null,
    biometry: { ccn: num(v['ccn']), dbp: num(v['dbp']), cc: num(v['cc']) },
    examDate: ref,
  });
  const weeksGA: number | null = igRef ? igRef.totalDays / 7 : null;
  if (igRef) {
    out.push({
      id: 'ig__ref',
      sectionId: secOf('ig_metodo', secOf('dum', 'datacao')),
      label: `IG de referência (${igRef.sourceLabel})`,
      text: `${igRef.label}${igRef.edd ? ` · DPP ${fmtDate(igRef.edd)}` : ''}`,
    });
  }

  // ── Volume do elipsoide + escores, sobre campos FIXOS da seção e sobre cada
  // instância dos containers repetíveis (seção-lista pura OU grupo aninhado). ──
  const emitCalcs = (
    fields: StructuredFieldDef[],
    fid: (f: string) => string,
    prefix: string,
    score: 'tirads' | 'birads' | 'orads' | 'bosniak' | undefined,
    sectionId: string,
    scoreId: (suffix: string) => string
  ) => {
    // Volume do elipsoide
    for (const field of fields) {
      if (field.kind !== 'triplet' || field.calcId !== 'volume-elipsoide') continue;
      const t = triplet(v[fid(field.id)]);
      if (!t) continue;
      const vol = ellipsoidVolume(t[0], t[1], t[2], field.unit === 'mm' ? 'mm' : 'cm');
      if (vol != null) {
        out.push({ id: `${fid(field.id)}__vol`, sectionId, label: `${prefix}Volume`, text: `${fmt(vol)} cm³` });
      }
    }

    // Escore TI-RADS a partir dos descritores (scoreKey)
    if (score === 'tirads') {
      const desc: Record<string, string> = {};
      for (const field of fields) {
        if (!field.scoreKey) continue;
        const t = fieldValueToText(v[fid(field.id)]);
        if (t) desc[field.scoreKey] = t;
      }
      const r = tiradsScore(desc);
      if (r) {
        // Conduta ciente do tamanho: maior dimensão do nódulo × limiar do TR.
        const dimsField = fields.find((f) => f.kind === 'triplet');
        const t = dimsField ? triplet(v[fid(dimsField.id)]) : null;
        let action = '';
        if (t) {
          const maxCm = Math.max(...t) / (dimsField!.unit === 'mm' ? 10 : 1);
          const paafAt = r.tr === 5 ? 1.0 : r.tr === 4 ? 1.5 : r.tr === 3 ? 2.5 : Infinity;
          const followAt = r.tr === 5 ? 0.5 : r.tr === 4 ? 1.0 : r.tr === 3 ? 1.5 : Infinity;
          if (maxCm >= paafAt) action = ` → PAAF indicada (${fmt(maxCm, 1)} cm)`;
          else if (maxCm >= followAt) action = ` → seguimento (${fmt(maxCm, 1)} cm)`;
          else if (r.tr >= 3) action = ` → sem conduta adicional (${fmt(maxCm, 1)} cm)`;
        }
        out.push({
          id: scoreId('tr'),
          sectionId,
          label: `${prefix}TI-RADS`,
          text: `TR${r.tr} (${r.label}) · ${r.points} pts${action || ' · ' + r.conduct}`,
          alert: r.tr >= 4,
        });
      }
    }

    // Sugestão BI-RADS a partir da morfologia
    if (score === 'birads') {
      const s = biradsSuggest({
        forma: fieldValueToText(v[fid('forma')]),
        orientacao: fieldValueToText(v[fid('orientacao')]),
        margem: fieldValueToText(v[fid('margem')]),
        eco: fieldValueToText(v[fid('eco')]),
        acusticas: fieldValueToText(v[fid('acusticas')]),
      });
      if (s) out.push({ id: scoreId('bi'), sectionId, label: `${prefix}Sugestão`, text: s.detail ? `${s.label} (${s.detail})` : s.label, alert: s.suspicious });
    }

    // Sugestão O-RADS a partir do tipo/conteúdo/fluxo
    if (score === 'orads') {
      const s = oradsSuggest({
        tipo: fieldValueToText(v[fid('tipo')]),
        conteudo: fieldValueToText(v[fid('conteudo')]),
        septos: fieldValueToText(v[fid('septos')]),
        vascularizacao: fieldValueToText(v[fid('vascularizacao')]),
      });
      if (s) out.push({ id: scoreId('or'), sectionId, label: `${prefix}Sugestão`, text: s.detail ? `${s.label} (${s.detail})` : s.label, alert: s.suspicious });
    }

    // Sugestão Bosniak (cisto renal)
    if (score === 'bosniak') {
      const s = bosniakSuggest({
        septos: fieldValueToText(v[fid('septos')]),
        parede: fieldValueToText(v[fid('parede')]),
        calcificacao: fieldValueToText(v[fid('calcificacao')]),
        solido: fieldValueToText(v[fid('solido')]),
      });
      if (s) out.push({ id: scoreId('bk'), sectionId, label: `${prefix}Sugestão`, text: s.label, alert: s.suspicious });
    }
  };

  for (const section of schema.sections) {
    // estado EFETIVO: auto-alterado quando um valor digitado sai da faixa normal
    // (a menos que o médico tenha escolhido manualmente) → passa a computar.
    const isNormal = section.normalable && effectiveSectionState(section, v) === 'normal';
    // Campos FIXOS da seção (não valem para seção-lista pura). Em 'Normal',
    // só a biometria que se registra na normalidade (`alwaysShow`) segue calculando.
    if (!section.repeatable) {
      const fixed = isNormal ? section.fields.filter((f) => f.alwaysShow) : section.fields;
      if (fixed.length) {
        emitCalcs(fixed, (f) => f, '', isNormal ? undefined : section.score, section.id, (suffix) => `${section.id}__${suffix}`);
      }
    }
    if (isNormal) continue; // lesões/nódulos só existem sob 'Alterado'
    // Cada instância dos containers repetíveis (lista pura e/ou grupo aninhado).
    for (const container of sectionRepeatContainers(section)) {
      const n = itemCount(v, container.containerId);
      for (let i = 0; i < n; i++) {
        emitCalcs(
          container.fields,
          (f) => itemFieldId(container.containerId, i, f),
          `${container.itemLabel || 'Item'} ${i + 1} — `,
          container.score,
          container.sectionId,
          (suffix) => `${container.containerId}@${i}__${suffix}`
        );
      }
    }
  }

  // ── Quadril infantil: tipo de Graf a partir dos ângulos α (e β) ──
  for (const side of ['d', 'e'] as const) {
    const alpha = num(v[`alfa_${side}`]);
    const beta = num(v[`beta_${side}`]);
    if (alpha != null) {
      const g = grafType(alpha, beta ?? undefined);
      if (g) out.push({ id: `graf_${side}`, sectionId: secOf(`alfa_${side}`, `quadril-${side}`), label: 'Tipo de Graf', text: g, alert: alpha < 60 });
    }
  }

  // ── Carótidas: grau de estenose (SRU 2003) pela VPS/VDF da ACI ──
  for (const side of ['d', 'e'] as const) {
    const vpsIca = num(v[`vps_aci_${side}`]);
    if (vpsIca != null) {
      const s = carotidStenosisNASCET(vpsIca, num(v[`vdf_aci_${side}`]) ?? undefined, num(v[`vps_acc_${side}`]) ?? undefined);
      if (s) out.push({ id: `car_sten_${side}`, sectionId: secOf(`vps_aci_${side}`, `carotida-${side}`), label: 'Estenose (VPS)', text: s.label, alert: s.severe });
    }
  }

  // ── Carótidas: EMI (espessura médio-intimal) máxima classificada por ELSA-Brasil ──
  // Chip inline consistente com os demais cálculos: usa o maior valor entre D/E.
  // Com idade+sexo → percentil ELSA (imtClassification); sem eles → referência absoluta.
  {
    const emiD = num(v['emi_d']);
    const emiE = num(v['emi_e']);
    if (emiD != null || emiE != null) {
      const emiMax = Math.max(emiD ?? 0, emiE ?? 0);
      const age = num(v['emi_idade']);
      const sexoTxt = fieldValueToText(v['emi_sexo']).toLowerCase();
      const sex: 'male' | 'female' | null = /femin/.test(sexoTxt) ? 'female' : /mascul/.test(sexoTxt) ? 'male' : null;
      const cls = age != null && sex ? imtClassification(age, sex, emiMax) : null;
      let text: string;
      let alert: boolean;
      if (cls) {
        text = `${fmt(emiMax)} mm (máx) — ${cls}`;
        alert = /acentuado|elevado|> p90/i.test(cls);
      } else {
        // sem idade/sexo: limiar absoluto (< 0,9 normal · 0,9–1,2 espessado · > 1,2 placa)
        const abs = emiMax > 1.2 ? 'placa (> 1,2 mm)' : emiMax >= 0.9 ? 'espessado (0,9–1,2 mm)' : 'normal (< 0,9 mm)';
        text = `${fmt(emiMax)} mm (máx) — ${abs} · informe idade/sexo p/ percentil ELSA`;
        alert = emiMax > 1.2;
      }
      out.push({ id: 'emi__class', sectionId: secOf('emi_d', 'emi'), label: 'EMI (ELSA-Brasil)', text, alert });
    }
  }

  // ── ITB: interpretação por lado ──
  for (const side of ['d', 'e'] as const) {
    const itb = num(v[`itb_${side}`]);
    if (itb != null) {
      const c = itbClassification(itb);
      if (c) out.push({ id: `itb_${side}`, sectionId: secOf(`itb_${side}`, 'itb'), label: `ITB ${side.toUpperCase()}`, text: c.label, alert: c.alert });
    }
  }

  // ── Tireoide: volume total (soma dos lobos) ──
  const loboD = triplet(v['lobo_d_dims']);
  const loboE = triplet(v['lobo_e_dims']);
  if (loboD || loboE) {
    const vd = loboD ? ellipsoidVolume(loboD[0], loboD[1], loboD[2], 'cm') || 0 : 0;
    const ve = loboE ? ellipsoidVolume(loboE[0], loboE[1], loboE[2], 'cm') || 0 : 0;
    if (vd + ve > 0) out.push({ id: 'tireoide__voltotal', sectionId: secOf('lobo_d_dims', 'istmo'), label: 'Volume tireoidiano total', text: `${fmt(vd + ve)} cm³${vd + ve > 18 ? ' — aumentado' : ''}`, alert: vd + ve > 18 });
  }

  // ── Tireoide: espessura do istmo (espessado > 0,4 cm) ──
  const istmo = num(v['istmo']);
  if (istmo != null) {
    const esp = istmo > 0.4;
    out.push({ id: 'istmo__esp', sectionId: secOf('istmo', 'istmo'), label: 'Istmo', text: `${fmt(istmo, 1)} cm${esp ? ' — espessado (> 0,4)' : ''}`, alert: esp });
  }

  // ── Testículos: atrofia (< 12 cm³) e assimetria volumétrica (> 20%) ──
  {
    const td = triplet(v['test_d_dims']);
    const te = triplet(v['test_e_dims']);
    const vtd = td ? ellipsoidVolume(td[0], td[1], td[2], 'cm') : null;
    const vte = te ? ellipsoidVolume(te[0], te[1], te[2], 'cm') : null;
    if ((vtd != null && vtd > 0) || (vte != null && vte > 0)) {
      const flags: string[] = [];
      let alert = false;
      if (vtd != null && vtd > 0 && vtd < 12) { flags.push('atrofia à D (< 12)'); alert = true; }
      if (vte != null && vte > 0 && vte < 12) { flags.push('atrofia à E (< 12)'); alert = true; }
      if (vtd != null && vte != null && vtd > 0 && vte > 0) {
        const maxV = Math.max(vtd, vte);
        const assim = Math.abs(vtd - vte) / maxV;
        if (assim > 0.2) { flags.push(`assimetria ${Math.round(assim * 100)}% (> 20%)`); alert = true; }
      }
      const pair = `D ${vtd != null ? fmt(vtd) : '—'} · E ${vte != null ? fmt(vte) : '—'} cm³`;
      out.push({ id: 'test__vol', sectionId: secOf('test_d_dims', 'testiculos'), label: 'Volume testicular', text: `${pair}${flags.length ? ' — ' + flags.join('; ') : ''}`, alert });
    }
  }

  // ── Linfonodo cervical: suspeição por córtex ≥ 3 mm ou perda do hilo ──
  {
    const cort = num(v['linf_cortical']);
    const hiloAus = /ausente|desloc/i.test(fieldValueToText(v['linf_hilo']));
    if ((cort != null && cort > 0) || hiloAus) {
      const susp = (cort != null && cort >= 3) || hiloAus;
      const parts: string[] = [];
      if (cort != null && cort > 0) parts.push(`córtex ${fmt(cort, 1)} mm`);
      if (hiloAus) parts.push('hilo ausente/deslocado');
      out.push({ id: 'linf__susp', sectionId: secOf('linf_cortical', 'linfonodos-regionais'), label: 'Linfonodo', text: `${parts.join(' · ')}${susp ? ' — características suspeitas' : ''}`, alert: susp });
    }
  }

  // ── Fetal: PFE (Hadlock IV) + percentil a partir de DBP/CC/CA/CF ──
  // O percentil usa a MESMA curva-padrão da calculadora de biometria
  // (DEFAULT_BIOMETRY_REFERENCE = Hadlock, com fallback OMS quando fora da
  // faixa) → o chip ao vivo e o modal dão o MESMO percentil.
  const bpdN = num(v['dbp']), ccN = num(v['cc']), caN = num(v['ca']), cfN = num(v['cf']);
  if (bpdN && ccN && caN && cfN && bpdN > 0 && ccN > 0 && caN > 0 && cfN > 0) {
    const efw = calcHadlockEfw(bpdN, ccN, caN, cfN);
    // curva por sexo quando informado (só a OMS diferencia; Hadlock resolve na neutra).
    const sexo = fieldValueToText(v['sexo_fetal']);
    const efwDim = /mascul/i.test(sexo) ? 'EFW_M' : /femin/i.test(sexo) ? 'EFW_F' : 'EFW';
    const pct = weeksGA != null ? getPercentileBy(DEFAULT_BIOMETRY_REFERENCE, efwDim, weeksGA, efw).percentile : null;
    const pctTxt = pct != null ? ` · p${pct}${pct < 10 ? ' (PIG)' : pct > 90 ? ' (GIG)' : ''}` : '';
    out.push({ id: 'pfe__hadlock', sectionId: secOf('ca', 'biometria'), label: 'PFE (Hadlock IV)', text: `${Math.round(efw)} g${pctTxt}`, alert: pct != null && (pct < 10 || pct > 90) });
  }

  // ── Fetal: percentil por medida biométrica (mesma curva-padrão da calculadora) ──
  if (weeksGA != null) {
    for (const [fieldId, dim, label] of [
      ['dbp', 'BPD', 'DBP'], ['cc', 'HC', 'CC'], ['ca', 'AC', 'CA'], ['cf', 'FL', 'CF'],
    ] as const) {
      const val = num(v[fieldId]);
      if (val == null || val <= 0) continue;
      const p = getPercentileBy(DEFAULT_BIOMETRY_REFERENCE, dim, weeksGA, val).percentile;
      if (p != null) out.push({ id: `pct_${fieldId}`, sectionId: secOf(fieldId, 'biometria'), label: `${label} percentil`, text: `p${p}`, alert: p < 3 || p > 97 });
    }
  }

  // ── Fetal: cervicometria (colo curto se < 25 mm) ──
  const colo = num(v['colo']);
  if (colo != null) {
    out.push({ id: 'colo__cervico', sectionId: secOf('colo', 'datacao'), label: 'Cervicometria', text: `${fmt(colo, 0)} mm${colo < 25 ? ' — colo curto (< 25)' : ''}`, alert: colo < 25 });
  }

  // ── Fetal: translucência nucal (alterada se > 3,5 mm) ──
  const nt = num(v['nt']);
  if (nt != null) {
    out.push({ id: 'nt__marker', sectionId: secOf('nt', 'datacao'), label: 'Translucência Nucal', text: `${fmt(nt, 1)} mm${nt > 3.5 ? ' — aumentada (> p95)' : ''}`, alert: nt > 3.5 });
  }

  // ── Ginecologia: morfologia de SOP (CFA ≥ 20 ou volume ovariano > 10 cm³) ──
  for (const [side, dimsId, afcId, sid] of [
    ['direito', 'ovd_dims', 'ovd_afc', 'ovario-d'],
    ['esquerdo', 'ove_dims', 'ove_afc', 'ovario-e'],
  ] as const) {
    const afc = num(v[afcId]);
    const t = triplet(v[dimsId]);
    const vol = t ? ellipsoidVolume(t[0], t[1], t[2], 'cm') : null;
    const pcos = (afc != null && afc >= 20) || (vol != null && vol > 10);
    if (afc != null && pcos) {
      out.push({ id: `sop_${side}`, sectionId: secOf(dimsId, sid), label: 'Morfologia', text: `sugestiva de SOP (CFA ${afc}${vol != null ? `, vol ${fmt(vol)} cm³` : ''})`, alert: true });
    }
  }

  // ── Abdome: esplenomegalia (maior eixo do baço > 12 cm) ──
  const baco = num(v['baco_eixo']);
  if (baco != null) {
    out.push({ id: 'baco__eixo', sectionId: secOf('baco_eixo', 'baco'), label: 'Baço', text: `${fmt(baco, 1)} cm${baco > 12 ? ' — esplenomegalia (> 12)' : ''}`, alert: baco > 12 });
  }

  // ── VRPM: significância (> 50 ml significativo; > 100 ml acentuado) ──
  const vrpm = num(v['vrpm']);
  if (vrpm != null) {
    const c = vrpm > 100 ? ' — acentuado' : vrpm > 50 ? ' — significativo' : ' — normal';
    out.push({ id: 'vrpm__class', sectionId: secOf('vrpm', 'vrpm'), label: 'VRPM', text: `${fmt(vrpm, 0)} ml${c}`, alert: vrpm > 50 });
  }

  // ── Doppler renal BILATERAL: RAR (≥ 3,5 → estenose ≥ 60%) e IR intraparenq. (> 0,7) por lado ──
  const vpsAorta = num(v['vps_aorta']);
  for (const [side, label, sid] of [
    ['d', 'D', 'arteria-renal-direita'],
    ['e', 'E', 'arteria-renal-esquerda'],
  ] as const) {
    const vpsRenal = num(v[`vps_renal_${side}`]);
    if (vpsRenal != null && vpsAorta != null && vpsAorta > 0) {
      const rar = vpsRenal / vpsAorta;
      out.push({ id: `rar_${side}`, sectionId: secOf(`vps_renal_${side}`, sid), label: `RAR ${label}`, text: `${fmt(rar, 1)}${rar >= 3.5 ? ' — estenose ≥ 60%' : ''}`, alert: rar >= 3.5 });
    }
    const ir = num(v[`ir_${side}`]);
    if (ir != null) {
      out.push({ id: `ri_intra_${side}`, sectionId: secOf(`ir_${side}`, `indices-intraparenquimatosos-${side === 'd' ? 'direitos' : 'esquerdos'}`), label: `IR intraparenq. ${label}`, text: `${fmt(ir)}${ir > 0.7 ? ' — elevado (> 0,7)' : ''}`, alert: ir > 0.7 });
    }
  }

  // ── Fetal: percentis Doppler (AU/ACM/UtA) por z-score (Arduini/Baschat) ──
  if (weeksGA != null && weeksGA >= DOPPLER_GA_MIN && weeksGA <= DOPPLER_GA_MAX) {
    for (const [fieldId, ref, label, lowBad] of [
      ['ip_au', UA_REF, 'IP AU percentil', false],
      ['ip_acm', MCA_REF, 'IP ACM percentil', true],
      ['ip_uta', UTA_REF, 'IP UtA percentil', false],
    ] as const) {
      const val = num(v[fieldId]);
      if (val == null) continue;
      const [m, s] = getRef(ref, weeksGA);
      if (!s) continue;
      const p = zToPercentile((val - m) / s);
      const alert = lowBad ? p < 5 : p > 95;
      out.push({ id: `dop_${fieldId}`, sectionId: secOf(fieldId, 'doppler'), label, text: `p${p}`, alert });
    }
  }

  // ── Fetal: IP do ducto venoso por percentil (Hecher 1994) — F7 ──
  const ipDv = num(v['ip_dv']);
  if (ipDv != null && ipDv > 0 && weeksGA != null && weeksGA >= DOPPLER_GA_MIN && weeksGA <= DOPPLER_GA_MAX) {
    const [m, s] = getRef(DV_REF, weeksGA);
    if (s) {
      const p = zToPercentile((ipDv - m) / s);
      out.push({ id: 'dv_ip__pct', sectionId: secOf('ip_dv', 'doppler'), label: 'IP DV percentil', text: `p${p}`, alert: p > 95 });
    }
  }

  // ── Fetal: PSV-ACM em MoM (anemia se > 1,5 MoM) — Mari 2000; requer IG pela DUM ──
  // Válido apenas ~18–40 sem (a mediana de Mari é definida a partir de 18 sem); sem
  // gate, o 1º trimestre produziria MoM extrapolado/enganoso.
  const psvAcm = num(v['psv_acm']);
  if (psvAcm != null && psvAcm > 0 && weeksGA != null && weeksGA >= 18 && weeksGA <= DOPPLER_GA_MAX) {
    const mom = mcaPsvMoM(psvAcm, weeksGA);
    out.push({ id: 'psv_acm__mom', sectionId: secOf('psv_acm', 'doppler'), label: 'PSV-ACM (MoM)', text: `${fmt(mom)} MoM${mom > 1.5 ? ' — anemia fetal provável (> 1,5)' : ''}`, alert: mom > 1.5 });
  }

  // ── Fetal: razão P2/P1 da artéria oftálmica (risco de PE se ≥ 0,65) — Sarno/Nicolaides 2020 ──
  const oftP1 = num(v['oft_p1']), oftP2 = num(v['oft_p2']);
  if (oftP1 != null && oftP1 > 0 && oftP2 != null && oftP2 > 0) {
    const ratio = oftP2 / oftP1;
    out.push({ id: 'oft__ratio', sectionId: secOf('oft_p1', 'doppler'), label: 'Razão P2/P1 oftálmica', text: `${fmt(ratio)}${ratio >= 0.65 ? ' — risco aumentado de pré-eclâmpsia (≥ 0,65)' : ''}`, alert: ratio >= 0.65 });
  }

  // ── Fetal gemelar: discordância de peso ((maior−menor)/maior × 100) — F1: campos pfe1/pfe2 ──
  const pfe1 = num(v['pfe1']);
  const pfe2 = num(v['pfe2']);
  if (pfe1 != null && pfe2 != null && Math.max(pfe1, pfe2) > 0) {
    const disc = (Math.abs(pfe1 - pfe2) / Math.max(pfe1, pfe2)) * 100;
    out.push({ id: 'gemelar__disc', sectionId: secOf('pfe1', 'discordancia'), label: 'Discordância', text: `${fmt(disc, 0)}%${disc > 20 ? ' — significativa (> 20%)' : ''}`, alert: disc > 20 });
  }

  // ── Pediatria: estenose hipertrófica do piloro / apendicite ──
  const pilMusc = num(v['piloro_musculo']);
  const pilCanal = num(v['piloro_canal']);
  if (pilMusc != null || pilCanal != null) {
    // EHP exige AMBOS (não um isolado): espessura muscular ≥ 4 mm E comprimento
    // do canal ≥ 17 mm (areaPrompts pediatria). Um só no limiar → medir o outro.
    const muscHigh = pilMusc != null && pilMusc >= 4;
    const canalHigh = pilCanal != null && pilCanal >= 17;
    const est = muscHigh && canalHigh;
    const parcial = !est && (muscHigh || canalHigh);
    const text = est
      ? 'critérios de estenose hipertrófica (músculo ≥ 4 e canal ≥ 17)'
      : parcial
        ? 'uma medida no limiar de EHP — medir/confirmar o outro parâmetro'
        : 'dentro dos limites';
    out.push({ id: 'piloro__est', sectionId: secOf('piloro_musculo', 'piloro'), label: 'Piloro', text, alert: est || parcial });
  }
  const apDiam = num(v['apendice_diam']);
  if (apDiam != null) {
    out.push({ id: 'apendice__diam', sectionId: secOf('apendice_diam', 'apendice'), label: 'Apêndice', text: `${fmt(apDiam, 0)} mm${apDiam > 6 ? ' — sugestivo de apendicite (> 6)' : ''}`, alert: apDiam > 6 });
  }

  // ── Fetal (ecocardiograma): relação cardiotorácica — cardiomegalia se > 0,35 ──
  // O campo `rct` tem faixa normal aproximada ('≈ 0,3'), que o abnormalRange NÃO
  // auto-classifica; o chip aplica o mesmo corte da tabela do prompt (§14:
  // normal 0,25–0,35), mantendo motor e IA em concordância.
  const rct = num(v['rct']);
  if (rct != null && rct > 0) {
    const cardiomegalia = rct > 0.35;
    out.push({ id: 'rct__card', sectionId: secOf('rct', 'situs'), label: 'Relação cardiotorácica', text: `${fmt(rct)}${cardiomegalia ? ' — cardiomegalia (> 0,35)' : ''}`, alert: cardiomegalia });
  }

  // ── Átrio ventricular: ventriculomegalia (> 10 mm) ──
  // Mesmo id canônico na neurossonografia fetal e no transfontanelar pediátrico.
  const atrio = num(v['atrio_vent']);
  if (atrio != null) {
    const vm = atrio > 10;
    out.push({
      id: 'atrio__vm',
      sectionId: secOf('atrio_vent', 'sistema-ventricular'),
      label: 'Átrio ventricular',
      text: `${fmt(atrio)} mm${vm ? ' — ventriculomegalia (> 10)' : ''}`,
      alert: vm,
    });
  }

  // ── Ginecologia: espessura endometrial por estado hormonal ──
  // Limiares da tabela de referência do prompt da área (areaPrompts.ts): a
  // terapia hormonal MUDA o corte, e é por isso que o estado hormonal entra no
  // formulário. No menacme a espessura varia com a fase do ciclo — sem limiar
  // único, então o chip só registra a medida.
  const endo = num(v['endometrio_esp']);
  const meno = fieldValueToText(v['menopausa']);
  if (endo != null && meno) {
    const post = /menopausa/.test(meno);
    const limiar = !post
      ? null
      : /c[íi]clica/.test(meno)
        ? 8
        : /cont[íi]nua/.test(meno)
          ? 6
          : 5; // pós-menopausa sem TH
    const suspeito = limiar != null && endo > limiar;
    out.push({
      id: 'endo__esp',
      sectionId: secOf('endometrio_esp', 'endometrio'),
      label: 'Endométrio',
      text: `${fmt(endo, 1)} mm${suspeito ? ` — espessado para o estado hormonal (> ${limiar})` : ''}`,
      alert: suspeito,
    });
  }

  // ── Próstata: volume (cc) + peso (g) a partir de prostata_dims (cm → mm) ──
  const prost = triplet(v['prostata_dims']);
  if (prost) {
    const r = prostateVolumeWeight(prost[0] * 10, prost[1] * 10, prost[2] * 10);
    if (r) {
      out.push({ id: 'prostata__vw', sectionId: secOf('prostata_dims', 'prostata'), label: 'Próstata', text: `Volume ${fmt(r.volume)} cc · Peso ${fmt(r.weight)} g · ${r.classification}` });
      const psa = num(v['psa']);
      if (psa != null && r.volume > 0) {
        const dens = psa / r.volume;
        out.push({ id: 'psa__density', sectionId: secOf('prostata_dims', 'prostata'), label: 'Densidade do PSA', text: `${dens.toFixed(2).replace('.', ',')} ng/mL/cc${dens > 0.15 ? ' — elevada (> 0,15)' : ''}`, alert: dens > 0.15 });
      }
    }
  }

  // ── Abdome: colédoco dilatado. Limiar sobe com a idade (≤ 8 mm em > 70 anos,
  // pela idade JÁ conhecida do paciente) e no pós-colecistectomia (≤ 10 mm). ──
  const coledoco = num(v['coledoco']);
  if (coledoco != null) {
    const idoso = ctx?.ageYears != null && ctx.ageYears > 70;
    // Pós-colecistectomia dilata o colédoco fisiologicamente (limiar sobe p/ ≤ 10 mm).
    const colec = /colecistectomiz/i.test(fieldValueToText(v['vesicula_achados']));
    const limiar = colec ? 10 : idoso ? 8 : 6;
    const contexto = colec ? ' · pós-colecistectomia' : idoso ? ' · > 70 anos' : '';
    const dil = coledoco > limiar;
    out.push({
      id: 'coledoco__cal',
      sectionId: secOf('coledoco', 'vias-biliares'),
      label: 'Colédoco',
      text: `${fmt(coledoco, 1)} mm${dil ? ` — dilatado (> ${limiar}${contexto})` : ''}`,
      alert: dil,
    });
  }

  // ── Pâncreas: ducto de Wirsung dilatado (≥ 3 mm) ──
  const wirsung = num(v['wirsung']);
  if (wirsung != null) {
    const dil = wirsung >= 3;
    out.push({ id: 'wirsung__cal', sectionId: secOf('wirsung', 'pancreas'), label: 'Ducto de Wirsung', text: `${fmt(wirsung, 1)} mm${dil ? ' — dilatado (≥ 3)' : ''}`, alert: dil });
  }

  // ── Aorta abdominal: ectasia (2,5–2,9 cm) / aneurisma (≥ 3,0 cm) ──
  const aorta = num(v['aorta']);
  if (aorta != null && aorta > 0) {
    const cls = aorta >= 5.5 ? ' — aneurisma volumoso (≥ 5,5) — avaliação vascular urgente (R6)'
      : aorta >= 3.0 ? ' — aneurisma (≥ 3,0)'
      : aorta >= 2.5 ? ' — ectasia (2,5–2,9)' : '';
    out.push({ id: 'aorta__cal', sectionId: secOf('aorta', 'aorta'), label: 'Aorta', text: `${fmt(aorta, 1)} cm${cls}`, alert: aorta >= 3.0 });
  }

  // ── Aorta torácica: raiz aórtica dilatada / limiar cirúrgico (id próprio,
  // distinto da aorta abdominal). Limite ♀ é menor (3,6 cm). ──
  const raiz = num(v['raiz_calibre']);
  if (raiz != null && raiz > 0) {
    const cls = raiz >= 5.5 ? ' — aneurisma (≥ 5,5) — avaliação cirúrgica urgente (R6)'
      : raiz >= 4.5 ? ' — dilatação significativa (≥ 4,5 · limiar cirúrgico em Marfan/valvopatia)'
      : raiz > 4.0 ? ' — levemente dilatada (> 4,0 · limite ♀ 3,6)' : '';
    out.push({ id: 'raiz__cal', sectionId: secOf('raiz_calibre', 'raiz'), label: 'Raiz aórtica', text: `${fmt(raiz, 1)} cm${cls}`, alert: raiz >= 5.5 });
  }

  // ── Venoso superficial: refluxo patológico (> 0,5 s) na safena magna/parva ──
  for (const side of ['d', 'e'] as const) {
    const rt = num(v[`refluxo_tempo_vs-${side}`]);
    if (rt != null && rt > 0) {
      const pat = rt > 0.5;
      out.push({
        id: `refluxo_vs_${side}`,
        sectionId: secOf(`refluxo_tempo_vs-${side}`, `venoso-superficial-${side}`),
        label: `Refluxo superficial ${side.toUpperCase()}`,
        text: `${fmt(rt, 1)} s${pat ? ' — patológico (> 0,5 s)' : ' — fisiológico (≤ 0,5 s)'}`,
        alert: pat,
      });
    }
  }

  // ── Nervo mediano: área seccional no túnel do carpo (STC se ≥ 10 mm²;
  // 10–13 leve, > 13 moderado/grave) ──
  const csaMediano = num(v['csa_mediano']);
  if (csaMediano != null && csaMediano > 0) {
    const cls = csaMediano > 13 ? ' — STC moderado/grave (> 13)' : csaMediano >= 10 ? ' — STC (≥ 10; leve 10–13)' : '';
    out.push({ id: 'csa_mediano__stc', sectionId: secOf('csa_mediano', 'tunel-do-carpo'), label: 'Nervo mediano (CSA)', text: `${fmt(csaMediano, 0)} mm²${cls}`, alert: csaMediano >= 10 });
  }

  // ── Fetal: RCP = IP ACM / IP AU — percentil por IG (F5, getCprRef); alerta se < p5 ou < 1 ──
  const ipAcm = num(v['ip_acm']);
  const ipAu = num(v['ip_au']);
  if (ipAcm != null && ipAu != null && ipAu > 0) {
    const rcp = ipAcm / ipAu;
    let text = fmt(rcp);
    let alert = rcp < 1;
    if (weeksGA != null && weeksGA >= DOPPLER_GA_MIN && weeksGA <= DOPPLER_GA_MAX) {
      const [m, s] = getCprRef(weeksGA);
      const p = zToPercentile((rcp - m) / s);
      text = `${fmt(rcp)} · p${p}`;
      alert = p < 5 || rcp < 1;
      if (p < 5) text += ' — reduzida (< p5)';
      else if (rcp < 1) text += ' — reduzida (< 1)';
    } else if (rcp < 1) {
      text += ' — reduzida (< 1)';
    }
    out.push({ id: 'rcp__calc', sectionId: secOf('ip_acm', 'doppler'), label: 'RCP (ACM/AU)', text, alert });
  }

  // ── Exame físico materno: PAM e IMC (entram nas calculadoras de risco) ──
  const paSis = num(v['pa_sistolica']);
  const paDia = num(v['pa_diastolica']);
  if (paSis != null && paDia != null) {
    const map = meanArterialPressure(paSis, paDia);
    if (map != null) {
      out.push({
        id: 'pam__calc',
        sectionId: secOf('pa_sistolica', 'dados-maternos'),
        label: 'PAM',
        text: `${fmt(map, 1)} mmHg${map >= 100 ? ' — elevada' : ''}`,
        alert: map >= 100,
      });
    }
  }
  const maePeso = num(v['mae_peso']);
  const maeAltura = num(v['mae_altura']);
  if (maePeso != null && maeAltura != null) {
    const imc = bodyMassIndex(maePeso, maeAltura);
    if (imc != null) {
      const c = imc < 18.5 ? 'baixo peso' : imc < 25 ? 'eutrofia' : imc < 30 ? 'sobrepeso' : 'obesidade';
      out.push({
        id: 'imc__calc',
        sectionId: secOf('mae_peso', 'dados-maternos'),
        label: 'IMC',
        text: `${fmt(imc, 1)} kg/m² — ${c}`,
        alert: imc >= 30,
      });
    }
  }

  // ── Fetal: IG pelo CCN e pelo DMSG (datação do 1º trimestre) ──
  const ccn = num(v['ccn']);
  if (ccn != null) {
    const ga = crlToGestationalAge(ccn);
    if (ga) out.push({ id: 'ig__ccn', sectionId: secOf('ccn', 'datacao'), label: 'IG (CCN)', text: ga.label });
  }
  const dmsg = num(v['dmsg']);
  if (dmsg != null) {
    const ga = gaFromMsd(dmsg);
    out.push({ id: 'ig__dmsg', sectionId: secOf('dmsg', 'datacao'), label: 'IG (DMSG)', text: ga.label });
  }

  // ── Fetal: IG BIOMÉTRICA (parâmetro do trimestre) e concordância com a
  // referência. Divergência > 10% sugere revisar a datação (ISUOG/ACOG). ──
  if (igRef && igRef.method !== 'biometria') {
    const param = pickBiometryDatingParam({ ccn: num(v['ccn']), dbp: num(v['dbp']), cc: num(v['cc']) }, weeksGA);
    if (param && param !== 'ccn') {
      const val = num(v[param]);
      const gaBio = val != null ? gaFromBiometry(param, val) : null;
      if (gaBio) {
        const diffDays = Math.abs(gaBio.totalDays - igRef.totalDays);
        const divergent = igRef.totalDays > 0 && diffDays / igRef.totalDays > 0.1;
        out.push({
          id: 'ig__biometrica',
          sectionId: secOf(param, 'biometria'),
          label: `IG biométrica (${param.toUpperCase()})`,
          text: `${gaBio.label} · ${divergent ? `divergente da referência (${diffDays} d) — revisar datação` : `concordante (${diffDays} d)`}`,
          alert: divergent,
        });
      }
    }
  }

  // ── Fetal: líquido amniótico. ILA em cm — pela SOMA dos 4 quadrantes quando
  // presentes (método de Phelan), senão pelo total manual. MBV em mm. Cortes de
  // `amnioticILA`/`amnioticMBV` (formulas.ts), em cm/mm respectivamente. ──
  const quads = ['ila_q1', 'ila_q2', 'ila_q3', 'ila_q4'].map((k) => num(v[k]));
  const temQuadrantes = quads.every((q) => q != null);
  const ilaSoma = temQuadrantes ? quads.reduce((a, q) => a! + q!, 0) : null;
  const ilaCm = ilaSoma ?? num(v['ila']);
  if (ilaCm != null) {
    let c: string;
    if (ilaCm < 5) c = 'oligoâmnio';
    else if (ilaCm < 8) c = 'líquido reduzido';
    else if (ilaCm <= 24) c = 'volume normal';
    else c = 'polidrâmnio';
    const origem = temQuadrantes ? ' (soma dos 4 quadrantes)' : '';
    out.push({ id: 'la__ila', sectionId: secOf('ila', 'liquido-amniotico'), label: 'ILA', text: `${fmt(ilaCm, 1)} cm${origem} — ${c}`, alert: ilaCm < 5 || ilaCm > 24 });
  }
  const mbvMm = num(v['mbv']);
  if (mbvMm != null) {
    const c = mbvMm < 20 ? 'oligoâmnio' : mbvMm <= 80 ? 'volume normal' : 'polidrâmnio';
    out.push({ id: 'la__mbv', sectionId: secOf('mbv', 'liquido-amniotico'), label: 'MBV', text: `${fmt(mbvMm, 0)} mm — ${c}`, alert: mbvMm < 20 || mbvMm > 80 });
  }

  // ── VCI: índice de colapsabilidade = (máx − mín)/máx. < 50% sugere congestão. ──
  const vciMax = num(v['vci_max']);
  const vciMin = num(v['vci_min']);
  const vciIdx = vciMax != null && vciMin != null ? ivcCollapsibilityIndex(vciMax, vciMin) : null;
  if (vciIdx != null) {
    const baixo = vciIdx < 50;
    out.push({ id: 'vci__idx', sectionId: secOf('vci_max', 'grandes-vasos'), label: 'Colapsabilidade VCI', text: `${fmt(vciIdx, 0)}%${baixo ? ' — < 50% (sugere congestão / volemia alta)' : ''}`, alert: baixo });
  }

  // Nota: os índices Doppler genéricos (IR/PI/S-D a partir de VPS/VDF/Vmed)
  // ficam na calculadora `vascular-ratios` (VascularRatiosCalculator), que os
  // vasos vasculares abrem — não há campo de esquema `vps`/`vdf` "cru" para um
  // cálculo ao vivo (o parser gera `vps-val` e o fieldLibrary usa ids por vaso).

  // ── RISCOS FMF AO VIVO — trissomias e pré-eclâmpsia calculados enquanto o
  // médico preenche o 1º trimestre (idade/TN/bioquímica/marcadores e fatores
  // maternos/PAM/Doppler). Mesma matemática do modal (`fromForm.ts`), então o
  // chip inline e a calculadora dão o MESMO número. O chip mostra BASAL →
  // CORRIGIDO. Se o campo "risco OFICIAL da FMF" foi preenchido, ele tem
  // prioridade e o chip interno é suprimido.
  //
  // ⚠️ TRAVA DE 1º TRIMESTRE: o rastreio combinado (TN + medianas Tan 2018 de
  // MAP/UtA/PlGF) é validado SÓ em 11+0–13+6 sem. Sem esta trava, uma
  // OBSTÉTRICA ABDOMINAL COM DOPPLER (2º/3º T, que também tem dados maternos +
  // IP uterina) calcularia um risco de PE ERRADO com medianas do 1º T. Só
  // computa quando a IG (ou o CCN) está na janela do 1º trimestre. ──
  const n = (x: unknown): number | null => {
    const s = typeof x === 'string' ? x : x == null ? '' : String(x);
    return s ? num(s) : null;
  };
  const asMarker = (x: unknown): MarkerState =>
    x === 'abnormal' ? 'abnormal' : x === 'normal' ? 'normal' : 'notAssessed';
  const fmtN = (o: number) => formatOneInN(o);
  const band = (o: number) => (o <= 100 ? ' — alto risco' : o <= 1000 ? ' — risco intermediário' : '');

  const ccnNum = num(v['ccn']);
  const ccnInWindow = ccnNum != null && ccnNum >= 45 && ccnNum <= 84;
  // IG para o rastreio: referência (se 11–13+6) ou derivada do CCN.
  const gaForRisk =
    weeksGA != null && weeksGA >= 11 && weeksGA < 14
      ? weeksGA
      : ccnInWindow
        ? crlToGaWeeks(ccnNum!)
        : null;
  const firstTrimester = gaForRisk != null;

  // Trissomias (seção Marcadores)
  if (firstTrimester && !fieldValueToText(v['risco_trissomias_fmf']).trim()) {
    const s = seedForCalculator('fmf-trisomy-risk', v, examDateMs, ctx);
    const triInput = s && {
      ageYears: n(s.age), crlMm: n(s.crlMm), ntMm: n(s.ntMm), fhrBpm: n(s.fhrBpm),
      freeBhcgMoM: n(s.bhcgMoM), pappaMoM: n(s.pappaMoM),
      nasalBone: asMarker(s.nasalBone), ductusVenosus: asMarker(s.ductusVenosus), tricuspid: asMarker(s.tricuspid),
    };
    const tri = triInput && trisomyHasEvidence(triInput) ? trisomyRiskFromForm(triInput) : null;
    if (tri) {
      const sid = secOf('nt', 'marcadores');
      out.push({ id: 'fmf_t21', sectionId: sid, label: 'Risco T21 (FMF)', text: `basal ${fmtN(tri.priorOneInN.t21)} → ${fmtN(tri.oneInN.t21)}${band(tri.oneInN.t21)}`, alert: tri.oneInN.t21 <= 1000 });
      // T13/18 COMBINADO (a FMF reporta junto): basal e corrigido.
      const basalComb = 1 / tri.priorOneInN.t18 + 1 / tri.priorOneInN.t13;
      const corrComb = tri.posterior.t18 + tri.posterior.t13;
      const basalCombN = basalComb > 0 ? Math.round(1 / basalComb) : Infinity;
      const corrCombN = corrComb > 0 ? Math.round(1 / corrComb) : Infinity;
      out.push({ id: 'fmf_t1318', sectionId: sid, label: 'Risco T13/18 (FMF)', text: `basal ${fmtN(basalCombN)} → ${fmtN(corrCombN)}${band(corrCombN)}`, alert: corrCombN <= 1000 });
    }
  }

  // Pré-eclâmpsia (seção Doppler do 1º trimestre)
  if (firstTrimester && !fieldValueToText(v['risco_pe_fmf']).trim()) {
    const s = seedForCalculator('fmf-preeclampsia-risk', v, examDateMs, ctx);
    // só mostra quando há PELO MENOS um biomarcador (PAM/IP uterina/PlGF/PSV) —
    // fatores maternos sozinhos dão o basal, mas não vale poluir o formulário.
    const hasBiomarker = !!s && [s.mapMmHg, s.utaPiRaw, s.plgfRaw, s.psvRatioRaw].some((x) => n(x) != null);
    const pe = s && hasBiomarker && peRiskFromForm({
      ageYears: n(s.age), weightKg: n(s.weightKg), heightCm: n(s.heightCm),
      gaWeeks: gaForRisk,
      racialOrigin: (s.racialOrigin as RacialOrigin) || 'white',
      conception: (s.conception as Conception) || 'spontaneous',
      parity: (s.parity as ParityKind) || 'nulliparous',
      previousPeGaWeeks: n(s.previousPeGaWeeks),
      diabetes: (s.diabetes as DiabetesKind) || 'none',
      chronicHypertension: !!s.chronicHypertension, sleOrAps: !!s.sleOrAps,
      familyHistoryPE: !!s.familyHistoryPE, smoker: !!s.smoker,
      analyzer: (s.analyzer as Analyzer) || 'cobas',
      mapMmHg: n(s.mapMmHg), utaPiRaw: n(s.utaPiRaw), plgfRaw: n(s.plgfRaw), psvRatio: n(s.psvRatioRaw),
    });
    if (pe) {
      out.push({
        id: 'fmf_pe_preterm',
        sectionId: secOf('ip_uta', 'doppler-1t'),
        label: 'Risco PE pré-termo (FMF)',
        text: `basal ${fmtN(pe.risk.basalPretermPE.oneInN)} → ${fmtN(pe.risk.pretermPE.oneInN)}${pe.risk.aspirinRecommended ? ' — considerar AAS 150 mg/noite' : ''}`,
        alert: pe.risk.aspirinRecommended,
      });
    }
  }

  // ── Reumatológico: agregação OMERACT das articulações (soma GSUS/PDUS e nº
  // de articulações com atividade PD ≥ 1). Os graus 0–3 vêm dos itens do grupo
  // repetível de sinovite; a soma é objetiva (não fabrica um "GLOESS" numérico). ──
  if (schema.area === 'reumatologico') {
    const grade = (val: StructuredFieldValue | undefined): number | null => {
      const m = fieldValueToText(val).match(/[0-3]/);
      return m ? parseInt(m[0], 10) : null;
    };
    let gsusSum = 0, pdusSum = 0, nActive = 0, nJoints = 0;
    let anchor = 'escore-combinado';
    for (const section of schema.sections) {
      for (const container of sectionRepeatContainers(section)) {
        const hasGsus = container.fields.some((f) => f.id === 'gsus');
        const hasPdus = container.fields.some((f) => f.id === 'pdus');
        if (!hasGsus && !hasPdus) continue;
        const n = itemCount(v, container.containerId);
        for (let i = 0; i < n; i++) {
          const g = grade(v[itemFieldId(container.containerId, i, 'gsus')]);
          const p = grade(v[itemFieldId(container.containerId, i, 'pdus')]);
          if (g == null && p == null) continue;
          nJoints++;
          if (g != null) gsusSum += g;
          if (p != null) { pdusSum += p; if (p >= 1) nActive++; }
        }
      }
    }
    if (schema.sections.some((s) => s.id === 'escore-combinado')) anchor = 'escore-combinado';
    else anchor = secOf('art_lista', 'sinovite');
    if (nJoints > 0) {
      const jl = `${nJoints} articulaç${nJoints > 1 ? 'ões' : 'ão'}`;
      out.push({ id: 'reuma__gsus', sectionId: anchor, label: 'Soma GSUS (Σ 0–3)', text: `${gsusSum} — ${jl}` });
      out.push({ id: 'reuma__pdus', sectionId: anchor, label: 'Soma PDUS (Σ 0–3)', text: `${pdusSum}`, alert: pdusSum > 0 });
      out.push({
        id: 'reuma__ativas', sectionId: anchor,
        label: 'Articulações com atividade (PD ≥ 1)',
        text: nActive > 0 ? `${nActive} — atividade inflamatória` : '0 — sem atividade ao Doppler',
        alert: nActive > 0,
      });
    }
  }

  // ── Mastologia: suspeição do linfonodo axilar (grupo repetível). Córtex ≥ 3 mm
  // (critério mais sensível), hilo ausente/deslocado ou forma arredondada (L:T < 2). ──
  if (schema.area === 'mastologia') {
    for (const section of schema.sections) {
      for (const container of sectionRepeatContainers(section)) {
        if (!container.fields.some((f) => f.id === 'cortex')) continue;
        const n = itemCount(v, container.containerId);
        for (let i = 0; i < n; i++) {
          const cortex = num(v[itemFieldId(container.containerId, i, 'cortex')]);
          const hilo = fieldValueToText(v[itemFieldId(container.containerId, i, 'hilo')]);
          const forma = fieldValueToText(v[itemFieldId(container.containerId, i, 'forma')]);
          const nivel = fieldValueToText(v[itemFieldId(container.containerId, i, 'nivel')]);
          const hiloSusp = /ausente|desloc/i.test(hilo);
          const formaSusp = /arredondad|<\s*2/i.test(forma);
          if (cortex == null && !hiloSusp && !formaSusp) continue; // sem dado relevante
          const susp = (cortex != null && cortex >= 3) || hiloSusp || formaSusp;
          const parts: string[] = [];
          if (cortex != null) parts.push(`córtex ${fmt(cortex, 1)} mm`);
          if (hiloSusp) parts.push(`hilo ${/ausente/i.test(hilo) ? 'ausente' : 'deslocado'}`);
          if (formaSusp) parts.push('L:T < 2');
          const nivelTxt = nivel ? ` (${nivel.split('—')[0].trim()})` : '';
          out.push({
            id: `linf_ax_${container.containerId}@${i}`,
            sectionId: container.sectionId,
            label: `Linfonodo axilar${nivelTxt}`,
            text: `${parts.join(' · ') || 'avaliado'}${susp ? ' — características suspeitas' : ''}`,
            alert: susp,
          });
        }
      }
    }
  }

  return out;
}

/** Linhas "CÁLCULOS AUTOMÁTICOS" para anexar à instrução da IA. */
export function derivationsToLines(derivations: Derivation[]): string[] {
  return derivations.map((d) => `  - ${d.label}: ${d.text}`);
}
