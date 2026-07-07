import { StructuredSchema, StructuredFieldValue } from '../../../types';
import { fieldValueToText } from './deriveSchema';
import { sectionState, itemCount, itemFieldId } from './structuredKeys';
import { tiradsScore, biradsSuggest, oradsSuggest, grafType, carotidStenosisNASCET, itbClassification, bosniakSuggest } from './scoring';
import {
  ellipsoidVolume,
  prostateVolumeWeight,
  gaFromLMP,
  crlToGestationalAge,
  gaFromMsd,
  dopplerIndices,
} from '../../calculators/formulas';
import {
  calcHadlockEfw, getWhoPercentile,
  UA_REF, MCA_REF, UTA_REF, getRef, zToPercentile, DOPPLER_GA_MIN, DOPPLER_GA_MAX,
} from '../../calculators/constants/fetalReferences';

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
  examDateMs?: number
): Derivation[] {
  const v = values || {};
  const out: Derivation[] = [];
  const ref = examDateMs ? new Date(examDateMs) : new Date();

  // DUM parseada uma vez (usada por IG/DPP e pelos percentis fetais).
  const dumStr = fieldValueToText(v['dum']);
  const dum = dumStr ? parseBrDate(dumStr) : null;
  let weeksGA: number | null = null;
  if (dum) { const g = gaFromLMP(dum, ref); if (g) weeksGA = g.totalDays / 7; }

  // ── Volume do elipsoide + escore TI-RADS (por instância em seções repetíveis) ──
  for (const section of schema.sections) {
    if (section.normalable && sectionState(v, section.id) === 'normal') continue;
    const n = section.repeatable ? itemCount(v, section.id) : 1;
    for (let i = 0; i < n; i++) {
      const fid = (f: string) => (section.repeatable ? itemFieldId(section.id, i, f) : f);
      const prefix = section.repeatable ? `${section.itemLabel || 'Item'} ${i + 1} — ` : '';

      // Volume do elipsoide
      for (const field of section.fields) {
        if (field.kind !== 'triplet' || field.calcId !== 'volume-elipsoide') continue;
        const t = triplet(v[fid(field.id)]);
        if (!t) continue;
        const vol = ellipsoidVolume(t[0], t[1], t[2], field.unit === 'mm' ? 'mm' : 'cm');
        if (vol != null) {
          out.push({ id: `${fid(field.id)}__vol`, sectionId: section.id, label: `${prefix}Volume`, text: `${fmt(vol)} cm³` });
        }
      }

      const scoreId = (suffix: string) => `${section.id}${section.repeatable ? `@${i}` : ''}__${suffix}`;

      // Escore TI-RADS a partir dos descritores (scoreKey)
      if (section.score === 'tirads') {
        const desc: Record<string, string> = {};
        for (const field of section.fields) {
          if (!field.scoreKey) continue;
          const t = fieldValueToText(v[fid(field.id)]);
          if (t) desc[field.scoreKey] = t;
        }
        const r = tiradsScore(desc);
        if (r) {
          // Conduta ciente do tamanho: maior dimensão do nódulo × limiar do TR.
          const dimsField = section.fields.find((f) => f.kind === 'triplet');
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
            sectionId: section.id,
            label: `${prefix}TI-RADS`,
            text: `TR${r.tr} (${r.label}) · ${r.points} pts${action || ' · ' + r.conduct}`,
            alert: r.tr >= 4,
          });
        }
      }

      // Sugestão BI-RADS a partir da morfologia
      if (section.score === 'birads') {
        const s = biradsSuggest({
          forma: fieldValueToText(v[fid('forma')]),
          orientacao: fieldValueToText(v[fid('orientacao')]),
          margem: fieldValueToText(v[fid('margem')]),
          eco: fieldValueToText(v[fid('eco')]),
          acusticas: fieldValueToText(v[fid('acusticas')]),
        });
        if (s) out.push({ id: scoreId('bi'), sectionId: section.id, label: `${prefix}Sugestão`, text: s.detail ? `${s.label} (${s.detail})` : s.label, alert: s.suspicious });
      }

      // Sugestão O-RADS a partir do tipo/conteúdo/fluxo
      if (section.score === 'orads') {
        const s = oradsSuggest({
          tipo: fieldValueToText(v[fid('tipo')]),
          conteudo: fieldValueToText(v[fid('conteudo')]),
          septos: fieldValueToText(v[fid('septos')]),
          vascularizacao: fieldValueToText(v[fid('vascularizacao')]),
        });
        if (s) out.push({ id: scoreId('or'), sectionId: section.id, label: `${prefix}Sugestão`, text: s.detail ? `${s.label} (${s.detail})` : s.label, alert: s.suspicious });
      }

      // Sugestão Bosniak (cisto renal)
      if (section.score === 'bosniak') {
        const s = bosniakSuggest({
          septos: fieldValueToText(v[fid('septos')]),
          parede: fieldValueToText(v[fid('parede')]),
          calcificacao: fieldValueToText(v[fid('calcificacao')]),
          solido: fieldValueToText(v[fid('solido')]),
        });
        if (s) out.push({ id: scoreId('bk'), sectionId: section.id, label: `${prefix}Sugestão`, text: s.label, alert: s.suspicious });
      }
    }
  }

  // ── Quadril infantil: tipo de Graf a partir dos ângulos α (e β) ──
  for (const side of ['d', 'e'] as const) {
    const alpha = num(v[`alfa_${side}`]);
    const beta = num(v[`beta_${side}`]);
    if (alpha != null) {
      const g = grafType(alpha, beta ?? undefined);
      if (g) out.push({ id: `graf_${side}`, sectionId: `quadril-${side}`, label: 'Tipo de Graf', text: g, alert: alpha < 60 });
    }
  }

  // ── Carótidas: grau de estenose (SRU 2003) pela VPS/VDF da ACI ──
  for (const side of ['d', 'e'] as const) {
    const vpsIca = num(v[`vps_aci_${side}`]);
    if (vpsIca != null) {
      const s = carotidStenosisNASCET(vpsIca, num(v[`vdf_aci_${side}`]) ?? undefined, num(v[`vps_acc_${side}`]) ?? undefined);
      if (s) out.push({ id: `car_sten_${side}`, sectionId: `carotida-${side}`, label: 'Estenose (VPS)', text: s.label, alert: s.severe });
    }
  }

  // ── ITB: interpretação por lado ──
  for (const side of ['d', 'e'] as const) {
    const itb = num(v[`itb_${side}`]);
    if (itb != null) {
      const c = itbClassification(itb);
      if (c) out.push({ id: `itb_${side}`, sectionId: 'itb', label: `ITB ${side.toUpperCase()}`, text: c.label, alert: c.alert });
    }
  }

  // ── Tireoide: volume total (soma dos lobos) ──
  const loboD = triplet(v['lobo_d_dims']);
  const loboE = triplet(v['lobo_e_dims']);
  if (loboD || loboE) {
    const vd = loboD ? ellipsoidVolume(loboD[0], loboD[1], loboD[2], 'cm') || 0 : 0;
    const ve = loboE ? ellipsoidVolume(loboE[0], loboE[1], loboE[2], 'cm') || 0 : 0;
    if (vd + ve > 0) out.push({ id: 'tireoide__voltotal', sectionId: 'istmo', label: 'Volume tireoidiano total', text: `${fmt(vd + ve)} cm³${vd + ve > 18 ? ' — aumentado' : ''}`, alert: vd + ve > 18 });
  }

  // ── Fetal: PFE (Hadlock IV) + percentil OMS a partir de DBP/CC/CA/CF ──
  const bpdN = num(v['dbp']), ccN = num(v['cc']), caN = num(v['ca']), cfN = num(v['cf']);
  if (bpdN && ccN && caN && cfN && bpdN > 0 && ccN > 0 && caN > 0 && cfN > 0) {
    const efw = calcHadlockEfw(bpdN, ccN, caN, cfN);
    const pct = weeksGA != null ? getWhoPercentile('EFW', weeksGA, efw) : null;
    const pctTxt = pct != null ? ` · p${pct}${pct < 10 ? ' (PIG)' : pct > 90 ? ' (GIG)' : ''}` : '';
    out.push({ id: 'pfe__hadlock', sectionId: 'biometria', label: 'PFE (Hadlock IV)', text: `${Math.round(efw)} g${pctTxt}`, alert: pct != null && (pct < 10 || pct > 90) });
  }

  // ── Fetal: percentil OMS por medida biométrica (quando há IG pela DUM) ──
  if (weeksGA != null) {
    for (const [fieldId, dim, label] of [
      ['dbp', 'BPD', 'DBP'], ['cc', 'HC', 'CC'], ['ca', 'AC', 'CA'], ['cf', 'FL', 'CF'],
    ] as const) {
      const val = num(v[fieldId]);
      if (val == null || val <= 0) continue;
      const p = getWhoPercentile(dim, weeksGA, val);
      if (p != null) out.push({ id: `pct_${fieldId}`, sectionId: 'biometria', label: `${label} percentil`, text: `p${p}`, alert: p < 3 || p > 97 });
    }
  }

  // ── Fetal: cervicometria (colo curto se < 25 mm) ──
  const colo = num(v['colo']);
  if (colo != null) {
    out.push({ id: 'colo__cervico', sectionId: 'datacao', label: 'Cervicometria', text: `${fmt(colo, 0)} mm${colo < 25 ? ' — colo curto (< 25)' : ''}`, alert: colo < 25 });
  }

  // ── Fetal: translucência nucal (alterada se > 3,5 mm) ──
  const nt = num(v['nt']);
  if (nt != null) {
    out.push({ id: 'nt__marker', sectionId: 'datacao', label: 'Translucência Nucal', text: `${fmt(nt, 1)} mm${nt > 3.5 ? ' — aumentada (> p95)' : ''}`, alert: nt > 3.5 });
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
      out.push({ id: `sop_${side}`, sectionId: sid, label: 'Morfologia', text: `sugestiva de SOP (CFA ${afc}${vol != null ? `, vol ${fmt(vol)} cm³` : ''})`, alert: true });
    }
  }

  // ── Abdome: esplenomegalia (maior eixo do baço > 12 cm) ──
  const baco = num(v['baco_eixo']);
  if (baco != null) {
    out.push({ id: 'baco__eixo', sectionId: 'baco', label: 'Baço', text: `${fmt(baco, 1)} cm${baco > 12 ? ' — esplenomegalia (> 12)' : ''}`, alert: baco > 12 });
  }

  // ── VRPM: significância (> 50 ml significativo; > 100 ml acentuado) ──
  const vrpm = num(v['vrpm']);
  if (vrpm != null) {
    const c = vrpm > 100 ? ' — acentuado' : vrpm > 50 ? ' — significativo' : ' — normal';
    out.push({ id: 'vrpm__class', sectionId: 'vrpm', label: 'VRPM', text: `${fmt(vrpm, 0)} ml${c}`, alert: vrpm > 50 });
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
      out.push({ id: `rar_${side}`, sectionId: sid, label: `RAR ${label}`, text: `${fmt(rar, 1)}${rar >= 3.5 ? ' — estenose ≥ 60%' : ''}`, alert: rar >= 3.5 });
    }
    const ir = num(v[`ir_${side}`]);
    if (ir != null) {
      out.push({ id: `ri_intra_${side}`, sectionId: `indices-intraparenquimatosos-${side === 'd' ? 'direitos' : 'esquerdos'}`, label: `IR intraparenq. ${label}`, text: `${fmt(ir)}${ir > 0.7 ? ' — elevado (> 0,7)' : ''}`, alert: ir > 0.7 });
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
      out.push({ id: `dop_${fieldId}`, sectionId: 'doppler', label, text: `p${p}`, alert });
    }
  }

  // ── Fetal: BPP (soma dos 5 parâmetros; alerta se < 8/10) ──
  const bppFields = ['mov_resp', 'mov_corp', 'tonus', 'la_bpp', 'cardiotoco'];
  const bppVals = bppFields.map((f) => fieldValueToText(v[f]));
  if (bppVals.some(Boolean)) {
    const score = bppVals.reduce((a, t) => a + (parseInt(t.trim()[0], 10) || 0), 0);
    out.push({ id: 'bpp__score', sectionId: 'bpp', label: 'Escore BPP', text: `${score}/10${score < 8 ? ' — alterado' : ''}`, alert: score < 8 });
  }

  // ── Fetal gemelar: discordância de peso ((maior−menor)/maior × 100) ──
  const pfe1 = num(v['pfe1']);
  const pfe2 = num(v['pfe2']);
  if (pfe1 != null && pfe2 != null && Math.max(pfe1, pfe2) > 0) {
    const disc = (Math.abs(pfe1 - pfe2) / Math.max(pfe1, pfe2)) * 100;
    out.push({ id: 'gemelar__disc', sectionId: 'discordancia', label: 'Discordância', text: `${fmt(disc, 0)}%${disc > 20 ? ' — significativa (> 20%)' : ''}`, alert: disc > 20 });
  }

  // ── Pediatria: estenose hipertrófica do piloro / apendicite ──
  const pilMusc = num(v['piloro_musculo']);
  const pilCanal = num(v['piloro_canal']);
  if (pilMusc != null || pilCanal != null) {
    const est = (pilMusc != null && pilMusc >= 3) || (pilCanal != null && pilCanal >= 15);
    out.push({ id: 'piloro__est', sectionId: 'piloro', label: 'Piloro', text: est ? 'critérios de estenose hipertrófica' : 'dentro dos limites', alert: est });
  }
  const apDiam = num(v['apendice_diam']);
  if (apDiam != null) {
    out.push({ id: 'apendice__diam', sectionId: 'apendice', label: 'Apêndice', text: `${fmt(apDiam, 0)} mm${apDiam > 6 ? ' — sugestivo de apendicite (> 6)' : ''}`, alert: apDiam > 6 });
  }

  // ── Ginecologia: espessura endometrial por estado hormonal ──
  const endo = num(v['endometrio_esp']);
  const meno = fieldValueToText(v['menopausa']);
  if (endo != null && meno) {
    const post = /menopausa/.test(meno);
    const suspeito = post && endo > 4;
    out.push({ id: 'endo__esp', sectionId: 'endometrio', label: 'Endométrio', text: `${fmt(endo, 1)} mm${suspeito ? ' — espessado p/ pós-menopausa (> 4)' : ''}`, alert: suspeito });
  }

  // ── Próstata: volume (cc) + peso (g) a partir de prostata_dims (cm → mm) ──
  const prost = triplet(v['prostata_dims']);
  if (prost) {
    const r = prostateVolumeWeight(prost[0] * 10, prost[1] * 10, prost[2] * 10);
    if (r) {
      out.push({ id: 'prostata__vw', sectionId: 'prostata', label: 'Próstata', text: `Volume ${fmt(r.volume)} cc · Peso ${fmt(r.weight)} g · ${r.classification}` });
      const psa = num(v['psa']);
      if (psa != null && r.volume > 0) {
        const dens = psa / r.volume;
        out.push({ id: 'psa__density', sectionId: 'prostata', label: 'Densidade do PSA', text: `${dens.toFixed(2).replace('.', ',')} ng/mL/cc${dens > 0.15 ? ' — elevada (> 0,15)' : ''}`, alert: dens > 0.15 });
      }
    }
  }

  // ── Fetal: RCP = IP ACM / IP AU (alerta se < 1) ──
  const ipAcm = num(v['ip_acm']);
  const ipAu = num(v['ip_au']);
  if (ipAcm != null && ipAu != null && ipAu > 0) {
    const rcp = ipAcm / ipAu;
    out.push({ id: 'rcp__calc', sectionId: 'doppler', label: 'RCP (ACM/AU)', text: `${fmt(rcp)}${rcp < 1 ? ' — reduzida (< 1)' : ''}`, alert: rcp < 1 });
  }

  // ── Fetal: IG/DPP pela DUM; IG pelo CCN; IG pelo DMSG ──
  if (dum) {
    const ga = gaFromLMP(dum, ref);
    if (ga) out.push({ id: 'ig__dum', sectionId: 'datacao', label: 'IG (DUM)', text: `${ga.label} · DPP ${fmtDate(ga.edd)}` });
  }
  const ccn = num(v['ccn']);
  if (ccn != null) {
    const ga = crlToGestationalAge(ccn);
    if (ga) out.push({ id: 'ig__ccn', sectionId: 'datacao', label: 'IG (CCN)', text: ga.label });
  }
  const dmsg = num(v['dmsg']);
  if (dmsg != null) {
    const ga = gaFromMsd(dmsg);
    out.push({ id: 'ig__dmsg', sectionId: 'datacao', label: 'IG (DMSG)', text: ga.label });
  }

  // ── Fetal: classificação do líquido amniótico (ILA em cm; MBV em mm) ──
  const ilaCm = num(v['ila']);
  if (ilaCm != null) {
    let c: string;
    if (ilaCm < 5) c = 'oligoâmnio';
    else if (ilaCm < 8) c = 'líquido reduzido';
    else if (ilaCm <= 18) c = 'volume normal';
    else if (ilaCm <= 24) c = 'líquido aumentado';
    else c = 'polidrâmnio';
    out.push({ id: 'la__ila', sectionId: 'liquido-amniotico', label: 'ILA', text: `${fmt(ilaCm, 1)} cm — ${c}`, alert: ilaCm < 5 || ilaCm > 24 });
  }

  // ── Vascular genérico: índices Doppler (IR / S/D) a partir de VPS e VDF ──
  const vps = num(v['vps']);
  const vdf = num(v['vdf']);
  if (vps != null && vdf != null && vdf > 0) {
    const di = dopplerIndices(vps, vdf);
    if (di.ri != null && di.sd != null) {
      out.push({ id: 'doppler__idx', sectionId: 'doppler', label: 'Índices', text: `IR ${fmt(di.ri)} · S/D ${fmt(di.sd)}` });
    }
  }

  return out;
}

/** Linhas "CÁLCULOS AUTOMÁTICOS" para anexar à instrução da IA. */
export function derivationsToLines(derivations: Derivation[]): string[] {
  return derivations.map((d) => `  - ${d.label}: ${d.text}`);
}
