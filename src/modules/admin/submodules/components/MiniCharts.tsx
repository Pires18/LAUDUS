// Gráficos SVG minúsculos, sem dependência de biblioteca — extraídos de
// AdminAnalytics.tsx pra reuso (ex.: séries históricas no Financeiro).
const CHART_W = 600;
const CHART_H = 150;
const PAD = 4;

/** Gráfico de área/linha simples — SVG. */
export function AreaLine({ data, color, money }: { data: { date: string; value: number }[]; color: string; money?: boolean }) {
  const fmt = (v: number) => (money ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : `${v}`);
  const max = Math.max(1, ...data.map(d => d.value));
  const n = data.length;
  const stepX = n > 1 ? (CHART_W - PAD * 2) / (n - 1) : 0;
  const pts = data.map((d, i) => {
    const x = PAD + i * stepX;
    const y = CHART_H - PAD - (d.value / max) * (CHART_H - PAD * 2);
    return { x, y, d };
  });
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${CHART_H - PAD} L${pts[0].x.toFixed(1)},${CHART_H - PAD} Z`;
  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" preserveAspectRatio="none">
      <path d={area} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p) => (
        <circle key={p.d.date} cx={p.x} cy={p.y} r={2} fill={color}>
          <title>{`${p.d.date}: ${fmt(p.d.value)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

/** Barras empilhadas (lite embaixo, pro em cima) — SVG, sem dependências. */
export function StackedBars({ data }: { data: { date: string; a: number; b: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.a + d.b));
  const n = data.length;
  const bw = (CHART_W - PAD * 2) / n;
  const barW = Math.max(2, bw * 0.7);
  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" preserveAspectRatio="none">
      {data.map((d, i) => {
        const x = PAD + i * bw + (bw - barW) / 2;
        const hA = (d.a / max) * (CHART_H - PAD * 2);
        const hB = (d.b / max) * (CHART_H - PAD * 2);
        const yA = CHART_H - PAD - hA;
        const yB = yA - hB;
        return (
          <g key={d.date}>
            <rect x={x} y={yA} width={barW} height={hA} fill="#6366f1" rx={1}>
              <title>{`${d.date}: ${d.a}`}</title>
            </rect>
            <rect x={x} y={yB} width={barW} height={hB} fill="#a855f7" rx={1}>
              <title>{`${d.date}: ${d.b}`}</title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}
