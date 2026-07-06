import { StructuredSchema, StructuredFieldValue } from '../../../types';
import { fieldValueToText } from './deriveSchema';
import { sectionState, itemCount, itemFieldId } from './structuredKeys';
import { tiradsScore, biradsSuggest, oradsSuggest, grafType } from './scoring';
import {
  ellipsoidVolume,
  prostateVolumeWeight,
  gaFromLMP,
  crlToGestationalAge,
  gaFromMsd,
  dopplerIndices,
} from '../../calculators/formulas';

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
          out.push({
            id: scoreId('tr'),
            sectionId: section.id,
            label: `${prefix}TI-RADS`,
            text: `TR${r.tr} (${r.label}) · ${r.points} pts · ${r.conduct}`,
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

  // ── Próstata: volume (cc) + peso (g) a partir de prostata_dims (cm → mm) ──
  const prost = triplet(v['prostata_dims']);
  if (prost) {
    const r = prostateVolumeWeight(prost[0] * 10, prost[1] * 10, prost[2] * 10);
    if (r) out.push({ id: 'prostata__vw', sectionId: 'prostata', label: 'Próstata', text: `Volume ${fmt(r.volume)} cc · Peso ${fmt(r.weight)} g · ${r.classification}` });
  }

  // ── Fetal: RCP = IP ACM / IP AU (alerta se < 1) ──
  const ipAcm = num(v['ip_acm']);
  const ipAu = num(v['ip_au']);
  if (ipAcm != null && ipAu != null && ipAu > 0) {
    const rcp = ipAcm / ipAu;
    out.push({ id: 'rcp__calc', sectionId: 'doppler', label: 'RCP (ACM/AU)', text: `${fmt(rcp)}${rcp < 1 ? ' — reduzida (< 1)' : ''}`, alert: rcp < 1 });
  }

  // ── Fetal: IG/DPP pela DUM; IG pelo CCN; IG pelo DMSG ──
  const dumStr = fieldValueToText(v['dum']);
  const dum = dumStr ? parseBrDate(dumStr) : null;
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
