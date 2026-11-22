import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Download,
  HelpCircle,
  Lightbulb,
  RotateCcw,
  XCircle,
} from 'lucide-react';

export interface ChartSeries {
  name: string;
  data: number[];
  color?: string;
}

export interface ChartSpec {
  title?: string;
  subtitle?: string;
  type: 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter' | 'radar';
  labels: string[];
  series: ChartSeries[];
  unit?: string;
}

const DEFAULT_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#06b6d4',
  '#f43f5e',
  '#84cc16',
];

export function parseChartSpec(code: string): { spec: ChartSpec | null; error?: string } {
  try {
    const raw = JSON.parse(code.trim()) as Record<string, unknown>;
    if (!raw || typeof raw !== 'object') {
      return { spec: null, error: 'Chart JSON must be an object.' };
    }
    const rawType = String(raw.type || 'bar').toLowerCase();
    const type: ChartSpec['type'] =
      rawType === 'line' ||
      rawType === 'area' ||
      rawType === 'pie' ||
      rawType === 'donut' ||
      rawType === 'doughnut' ||
      rawType === 'scatter' ||
      rawType === 'radar'
        ? rawType === 'doughnut'
          ? 'donut'
          : (rawType as ChartSpec['type'])
        : 'bar';

    const labels = Array.isArray(raw.labels)
      ? raw.labels.map((l, i) => (l !== undefined && l !== null ? String(l) : `#${i + 1}`))
      : [];

    const rawSeries = Array.isArray(raw.series)
      ? raw.series
      : Array.isArray(raw.datasets)
      ? raw.datasets
      : [];

    const series: ChartSeries[] = [];
    for (let i = 0; i < rawSeries.length; i += 1) {
      const s = rawSeries[i];
      if (s && typeof s === 'object') {
        const obj = s as Record<string, unknown>;
        const dataArr = Array.isArray(obj.data)
          ? obj.data.map((n) => (typeof n === 'number' && Number.isFinite(n) ? n : Number(n) || 0))
          : [];
        series.push({
          name: typeof obj.name === 'string' ? obj.name : typeof obj.label === 'string' ? obj.label : `Series ${i + 1}`,
          data: dataArr,
          color: typeof obj.color === 'string' ? obj.color : DEFAULT_COLORS[i % DEFAULT_COLORS.length],
        });
      }
    }

    if (series.length === 0 && Array.isArray(raw.data)) {
      const dataArr = raw.data.map((n) => (typeof n === 'number' && Number.isFinite(n) ? n : Number(n) || 0));
      series.push({
        name: typeof raw.title === 'string' ? raw.title : 'Value',
        data: dataArr,
        color: DEFAULT_COLORS[0],
      });
    }

    if (series.length === 0 || series.every((s) => s.data.length === 0)) {
      return { spec: null, error: 'Chart JSON requires non-empty "series" (or "datasets") with numeric data.' };
    }

    const maxLen = Math.max(...series.map((s) => s.data.length));
    const finalLabels =
      labels.length >= maxLen
        ? labels.slice(0, maxLen)
        : Array.from({ length: maxLen }, (_, idx) => labels[idx] ?? `Item ${idx + 1}`);

    return {
      spec: {
        title: typeof raw.title === 'string' ? raw.title : undefined,
        subtitle: typeof raw.subtitle === 'string' ? raw.subtitle : undefined,
        type,
        labels: finalLabels,
        series,
        unit: typeof raw.unit === 'string' ? raw.unit : '',
      },
    };
  } catch (err) {
    return { spec: null, error: err instanceof Error ? err.message : 'Invalid chart JSON.' };
  }
}

export const InlineChartViewer: React.FC<{ code: string; compact?: boolean }> = ({
  code,
  compact = true,
}) => {
  const parsed = useMemo(() => parseChartSpec(code), [code]);
  const [hiddenSeries, setHiddenSeries] = useState<Set<number>>(new Set());
  const [hoverInfo, setHoverInfo] = useState<{ label: string; value: string; color: string } | null>(null);
  const spec = parsed.spec;

  const visibleSeries = useMemo(() => {
    if (!spec) return [];
    return spec.series
      .map((s, idx) => ({ ...s, origIdx: idx }))
      .filter((s) => !hiddenSeries.has(s.origIdx));
  }, [spec, hiddenSeries]);

  if (!spec) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950/30 text-xs font-mono text-red-700 dark:text-red-300 border-t border-neutral-200 dark:border-white/10">
        {parsed.error || 'Could not parse chart JSON.'}
      </div>
    );
  }

  const unit = spec.unit ? ` ${spec.unit}` : '';
  const svgW = 680;
  const svgH = compact ? 300 : 360;
  const padL = 56;
  const padR = 24;
  const padT = 24;
  const padB = 48;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const allVals = visibleSeries.flatMap((s) => s.data);
  const rawMax = allVals.length ? Math.max(...allVals, 0) : 10;
  const rawMin = allVals.length ? Math.min(...allVals, 0) : 0;
  const maxVal = rawMax === rawMin ? rawMax + 10 : rawMax * 1.08;
  const minVal = rawMin < 0 ? rawMin * 1.08 : 0;
  const range = Math.max(1e-6, maxVal - minVal);
  const yFor = (val: number) => padT + plotH - ((val - minVal) / range) * plotH;
  const zeroY = yFor(0);

  const toggleSeries = (idx: number) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else if (next.size < spec.series.length - 1) next.add(idx);
      return next;
    });
  };

  const handleDownloadSvg = () => {
    const el = document.getElementById(`folio-chart-svg-${spec.title || 'chart'}`);
    if (!el) return;
    const blob = new Blob([el.outerHTML], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(spec.title || 'chart').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isPieOrDonut = spec.type === 'pie' || spec.type === 'donut';
  const isRadar = spec.type === 'radar';

  const formatNum = (n: number) =>
    Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2).replace(/\.?0+$/, '');

  return (
    <div className="border-t border-neutral-200 dark:border-white/10 bg-white dark:bg-[#161618] text-[#0d0d0d] dark:text-[#ececec]">
      <div className="px-3.5 py-2 border-b border-neutral-200 dark:border-white/10 bg-[#f6f6f7] dark:bg-[#1f1f23] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <BarChart3 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span className="font-semibold truncate">{spec.title || 'Interactive Chart'}</span>
          {spec.subtitle && (
            <span className="text-neutral-500 dark:text-neutral-400 truncate hidden sm:inline">
              · {spec.subtitle}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hoverInfo && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-[11px] font-medium tabular-nums">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hoverInfo.color }} />
              <span>{hoverInfo.label}:</span>
              <span className="font-mono">{hoverInfo.value}</span>
            </span>
          )}
          <button
            type="button"
            onClick={handleDownloadSvg}
            title="Export chart as SVG"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-300 dark:border-white/15 text-[11px] font-medium hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors"
          >
            <Download className="w-3 h-3" />
            <span>SVG</span>
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          id={`folio-chart-svg-${spec.title || 'chart'}`}
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full h-auto max-h-[360px] select-none overflow-visible"
        >
          {isPieOrDonut ? (
            (() => {
              const firstSeries = visibleSeries[0] || spec.series[0];
              const total = firstSeries.data.reduce((a, b) => a + Math.max(0, b), 0) || 1;
              const cx = svgW / 2;
              const cy = svgH / 2;
              const r = Math.min(plotW, plotH) * 0.46;
              const innerR = spec.type === 'donut' ? r * 0.54 : 0;
              let accAngle = -Math.PI / 2;

              return (
                <g>
                  {firstSeries.data.map((val, idx) => {
                    const safeVal = Math.max(0, val);
                    const sliceAngle = (safeVal / total) * Math.PI * 2;
                    const startAngle = accAngle;
                    const endAngle = accAngle + sliceAngle;
                    accAngle = endAngle;

                    const x1 = cx + Math.cos(startAngle) * r;
                    const y1 = cy + Math.sin(startAngle) * r;
                    const x2 = cx + Math.cos(endAngle) * r;
                    const y2 = cy + Math.sin(endAngle) * r;
                    const largeArc = sliceAngle > Math.PI ? 1 : 0;

                    let d = '';
                    if (innerR > 0) {
                      const ix1 = cx + Math.cos(endAngle) * innerR;
                      const iy1 = cy + Math.sin(endAngle) * innerR;
                      const ix2 = cx + Math.cos(startAngle) * innerR;
                      const iy2 = cy + Math.sin(startAngle) * innerR;
                      d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;
                    } else {
                      d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                    }

                    const color = DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
                    const pct = ((safeVal / total) * 100).toFixed(1);
                    const midAngle = startAngle + sliceAngle / 2;
                    const lx = cx + Math.cos(midAngle) * (r + 18);
                    const ly = cy + Math.sin(midAngle) * (r + 18);

                    return (
                      <g
                        key={idx}
                        onMouseEnter={() =>
                          setHoverInfo({
                            label: spec.labels[idx] || `#${idx + 1}`,
                            value: `${formatNum(safeVal)}${unit} (${pct}%)`,
                            color,
                          })
                        }
                        onMouseLeave={() => setHoverInfo(null)}
                        className="cursor-pointer transition-opacity hover:opacity-85"
                      >
                        <path d={d} fill={color} stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} />
                        {sliceAngle > 0.24 && (
                          <text
                            x={lx}
                            y={ly}
                            textAnchor={Math.cos(midAngle) >= 0 ? 'start' : 'end'}
                            dominantBaseline="middle"
                            fontSize="11"
                            fill="currentColor"
                            opacity="0.8"
                          >
                            {spec.labels[idx]} ({pct}%)
                          </text>
                        )}
                      </g>
                    );
                  })}
                  {spec.type === 'donut' && (
                    <text
                      x={cx}
                      y={cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="14"
                      fontWeight="600"
                      fill="currentColor"
                    >
                      {formatNum(total)}{unit}
                    </text>
                  )}
                </g>
              );
            })()
          ) : isRadar ? (
            (() => {
              const cx = svgW / 2;
              const cy = svgH / 2 + 4;
              const maxR = Math.min(plotW, plotH) * 0.42;
              const count = Math.max(3, spec.labels.length);
              const step = (Math.PI * 2) / count;
              const radarMax = Math.max(1e-6, rawMax * 1.1);

              return (
                <g>
                  {[0.25, 0.5, 0.75, 1].map((ring) => (
                    <polygon
                      key={ring}
                      fill="none"
                      stroke="currentColor"
                      strokeOpacity="0.14"
                      points={Array.from({ length: count }, (_, i) => {
                        const a = -Math.PI / 2 + i * step;
                        return `${cx + Math.cos(a) * maxR * ring},${cy + Math.sin(a) * maxR * ring}`;
                      }).join(' ')}
                    />
                  ))}
                  {spec.labels.map((lbl, i) => {
                    const a = -Math.PI / 2 + i * step;
                    const x2 = cx + Math.cos(a) * maxR;
                    const y2 = cy + Math.sin(a) * maxR;
                    const lx = cx + Math.cos(a) * (maxR + 18);
                    const ly = cy + Math.sin(a) * (maxR + 14);
                    return (
                      <g key={i}>
                        <line x1={cx} y1={cy} x2={x2} y2={y2} stroke="currentColor" strokeOpacity="0.16" />
                        <text
                          x={lx}
                          y={ly}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize="11"
                          fill="currentColor"
                          opacity="0.75"
                        >
                          {lbl}
                        </text>
                      </g>
                    );
                  })}
                  {visibleSeries.map((s) => {
                    const color = s.color || DEFAULT_COLORS[s.origIdx % DEFAULT_COLORS.length];
                    const pts = spec.labels.map((_, i) => {
                      const val = Math.max(0, s.data[i] ?? 0);
                      const r = (val / radarMax) * maxR;
                      const a = -Math.PI / 2 + i * step;
                      return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, val };
                    });
                    return (
                      <g key={s.origIdx}>
                        <polygon
                          points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
                          fill={color}
                          fillOpacity="0.2"
                          stroke={color}
                          strokeWidth="2.2"
                        />
                        {pts.map((p, i) => (
                          <circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r={4}
                            fill={color}
                            className="cursor-pointer"
                            onMouseEnter={() =>
                              setHoverInfo({
                                label: `${s.name} · ${spec.labels[i]}`,
                                value: `${formatNum(p.val)}${unit}`,
                                color,
                              })
                            }
                            onMouseLeave={() => setHoverInfo(null)}
                          />
                        ))}
                      </g>
                    );
                  })}
                </g>
              );
            })()
          ) : (
            <g>
              {/* Horizontal Grid + Y ticks */}
              {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                const val = minVal + range * frac;
                const y = yFor(val);
                return (
                  <g key={frac}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={svgW - padR}
                      y2={y}
                      stroke="currentColor"
                      strokeOpacity="0.12"
                      strokeDasharray={frac === 0 ? undefined : '4 4'}
                    />
                    <text
                      x={padL - 8}
                      y={y}
                      textAnchor="end"
                      dominantBaseline="middle"
                      fontSize="10.5"
                      fill="currentColor"
                      opacity="0.6"
                      className="font-mono"
                    >
                      {formatNum(val)}
                    </text>
                  </g>
                );
              })}

              {/* X Axis Labels */}
              {spec.labels.map((lbl, idx) => {
                const count = spec.labels.length;
                const x =
                  spec.type === 'bar'
                    ? padL + ((idx + 0.5) / count) * plotW
                    : count === 1
                    ? padL + plotW / 2
                    : padL + (idx / (count - 1)) * plotW;
                const showEvery = count > 14 ? Math.ceil(count / 10) : 1;
                if (idx % showEvery !== 0 && idx !== count - 1) return null;
                return (
                  <text
                    key={idx}
                    x={x}
                    y={svgH - 18}
                    textAnchor="middle"
                    fontSize="10.5"
                    fill="currentColor"
                    opacity="0.7"
                  >
                    {lbl.length > 12 ? `${lbl.slice(0, 11)}…` : lbl}
                  </text>
                );
              })}

              {/* Bars */}
              {spec.type === 'bar' &&
                spec.labels.map((lbl, lIdx) => {
                  const groupW = plotW / Math.max(1, spec.labels.length);
                  const barAreaW = groupW * 0.72;
                  const singleBarW = Math.max(4, barAreaW / Math.max(1, visibleSeries.length) - 3);
                  const groupLeft = padL + lIdx * groupW + (groupW - barAreaW) / 2;

                  return visibleSeries.map((s, sIdx) => {
                    const val = s.data[lIdx] ?? 0;
                    const yVal = yFor(val);
                    const yTop = Math.min(yVal, zeroY);
                    const barH = Math.max(2, Math.abs(zeroY - yVal));
                    const x = groupLeft + sIdx * (singleBarW + 3);
                    const color = s.color || DEFAULT_COLORS[s.origIdx % DEFAULT_COLORS.length];

                    return (
                      <rect
                        key={`${lIdx}-${s.origIdx}`}
                        x={x}
                        y={yTop}
                        width={singleBarW}
                        height={barH}
                        rx={3}
                        fill={color}
                        className="cursor-pointer transition-opacity hover:opacity-80"
                        onMouseEnter={() =>
                          setHoverInfo({
                            label: `${s.name} · ${lbl}`,
                            value: `${formatNum(val)}${unit}`,
                            color,
                          })
                        }
                        onMouseLeave={() => setHoverInfo(null)}
                      />
                    );
                  });
                })}

              {/* Line / Area / Scatter */}
              {(spec.type === 'line' || spec.type === 'area' || spec.type === 'scatter') &&
                visibleSeries.map((s) => {
                  const color = s.color || DEFAULT_COLORS[s.origIdx % DEFAULT_COLORS.length];
                  const count = spec.labels.length;
                  const pts = spec.labels.map((lbl, idx) => {
                    const val = s.data[idx] ?? 0;
                    const x = count === 1 ? padL + plotW / 2 : padL + (idx / (count - 1)) * plotW;
                    const y = yFor(val);
                    return { x, y, val, lbl };
                  });

                  const lineD = pts
                    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                    .join(' ');
                  const areaD =
                    pts.length > 0
                      ? `${lineD} L ${pts[pts.length - 1].x.toFixed(1)} ${zeroY.toFixed(1)} L ${pts[0].x.toFixed(1)} ${zeroY.toFixed(1)} Z`
                      : '';

                  return (
                    <g key={s.origIdx}>
                      {spec.type === 'area' && areaD && (
                        <path d={areaD} fill={color} fillOpacity="0.16" />
                      )}
                      {spec.type !== 'scatter' && (
                        <path
                          d={lineD}
                          fill="none"
                          stroke={color}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                      {pts.map((p, idx) => (
                        <circle
                          key={idx}
                          cx={p.x}
                          cy={p.y}
                          r={spec.type === 'scatter' ? 5.5 : 4}
                          fill={color}
                          stroke="#ffffff"
                          strokeWidth="1.4"
                          className="cursor-pointer"
                          onMouseEnter={() =>
                            setHoverInfo({
                              label: `${s.name} · ${p.lbl}`,
                              value: `${formatNum(p.val)}${unit}`,
                              color,
                            })
                          }
                          onMouseLeave={() => setHoverInfo(null)}
                        />
                      ))}
                    </g>
                  );
                })}
            </g>
          )}
        </svg>

        {/* Legend */}
        {!isPieOrDonut && spec.series.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
            {spec.series.map((s, idx) => {
              const hidden = hiddenSeries.has(idx);
              const color = s.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleSeries(idx)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-opacity ${
                    hidden
                      ? 'opacity-40 border-neutral-200 dark:border-white/10'
                      : 'border-neutral-200 dark:border-white/15 bg-neutral-50 dark:bg-white/5'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span>{s.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  hint?: string;
}

export interface QuizSpec {
  title?: string;
  questions: QuizQuestion[];
}

export function parseQuizSpec(code: string): { spec: QuizSpec | null; error?: string } {
  try {
    const raw = JSON.parse(code.trim()) as Record<string, unknown>;
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.questions)) {
      return { spec: null, error: 'Quiz JSON must contain a "questions" array.' };
    }
    const questions: QuizQuestion[] = [];
    for (const q of raw.questions) {
      if (!q || typeof q !== 'object') continue;
      const obj = q as Record<string, unknown>;
      const question = typeof obj.question === 'string' ? obj.question.trim() : '';
      const options = Array.isArray(obj.options) ? obj.options.map((o) => String(o)) : [];
      const correctIndex =
        typeof obj.correctIndex === 'number'
          ? obj.correctIndex
          : typeof obj.answerIndex === 'number'
          ? obj.answerIndex
          : 0;
      if (question && options.length >= 2) {
        questions.push({
          question,
          options,
          correctIndex: Math.max(0, Math.min(options.length - 1, Math.floor(correctIndex))),
          explanation: typeof obj.explanation === 'string' ? obj.explanation : undefined,
          hint: typeof obj.hint === 'string' ? obj.hint : undefined,
        });
      }
    }
    if (questions.length === 0) {
      return { spec: null, error: 'No valid questions with >=2 options found.' };
    }
    return {
      spec: {
        title: typeof raw.title === 'string' ? raw.title : 'Interactive Quiz',
        questions,
      },
    };
  } catch (err) {
    return { spec: null, error: err instanceof Error ? err.message : 'Invalid quiz JSON.' };
  }
}

export const InlineQuizViewer: React.FC<{ code: string }> = ({ code }) => {
  const parsed = useMemo(() => parseQuizSpec(code), [code]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [shownHints, setShownHints] = useState<Set<number>>(new Set());

  const spec = parsed.spec;
  if (!spec) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950/30 text-xs font-mono text-red-700 dark:text-red-300 border-t border-neutral-200 dark:border-white/10">
        {parsed.error || 'Could not parse quiz JSON.'}
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const correctCount = spec.questions.reduce(
    (sum, q, idx) => (answers[idx] === q.correctIndex ? sum + 1 : sum),
    0
  );

  return (
    <div className="border-t border-neutral-200 dark:border-white/10 bg-white dark:bg-[#161618] text-[#0d0d0d] dark:text-[#ececec]">
      <div className="px-3.5 py-2 border-b border-neutral-200 dark:border-white/10 bg-[#f6f6f7] dark:bg-[#1f1f23] flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <HelpCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="font-semibold truncate">{spec.title || 'Interactive Quiz'}</span>
          <span className="text-neutral-500 dark:text-neutral-400 tabular-nums">
            · {correctCount}/{spec.questions.length} correct
          </span>
        </div>
        {answeredCount > 0 && (
          <button
            type="button"
            onClick={() => {
              setAnswers({});
              setShownHints(new Set());
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-300 dark:border-white/15 text-[11px] font-medium hover:bg-neutral-200/70 dark:hover:bg-white/10"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      <div className="p-3.5 sm:p-4 space-y-4">
        {spec.questions.map((q, qIdx) => {
          const picked = answers[qIdx];
          const hasPicked = picked !== undefined;
          const isRight = picked === q.correctIndex;
          const hintVisible = shownHints.has(qIdx);

          return (
            <div
              key={qIdx}
              className="rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50/70 dark:bg-[#1e1e22] p-3.5 space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-snug">
                  <span className="text-neutral-400 mr-1.5 font-mono">{qIdx + 1}.</span>
                  {q.question}
                </p>
                {q.hint && !hasPicked && (
                  <button
                    type="button"
                    onClick={() =>
                      setShownHints((prev) => {
                        const next = new Set(prev);
                        if (next.has(qIdx)) next.delete(qIdx);
                        else next.add(qIdx);
                        return next;
                      })
                    }
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 shrink-0"
                  >
                    <Lightbulb className="w-3 h-3" />
                    <span>Hint</span>
                  </button>
                )}
              </div>

              {hintVisible && q.hint && !hasPicked && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  {q.hint}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {q.options.map((opt, oIdx) => {
                  const isSelected = picked === oIdx;
                  const isCorrectOpt = oIdx === q.correctIndex;
                  let btnStyle =
                    'border-neutral-200 dark:border-white/10 bg-white dark:bg-[#26262b] hover:border-neutral-400 dark:hover:border-white/30';
                  if (hasPicked) {
                    if (isCorrectOpt) {
                      btnStyle =
                        'border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200';
                    } else if (isSelected && !isCorrectOpt) {
                      btnStyle = 'border-red-500 bg-red-500/15 text-red-800 dark:text-red-200';
                    } else {
                      btnStyle = 'border-neutral-200/60 dark:border-white/5 opacity-60';
                    }
                  }

                  return (
                    <button
                      key={oIdx}
                      type="button"
                      disabled={hasPicked}
                      onClick={() => setAnswers((prev) => ({ ...prev, [qIdx]: oIdx }))}
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-left text-xs sm:text-[13px] transition-colors ${btnStyle}`}
                    >
                      <span>{opt}</span>
                      {hasPicked && isCorrectOpt && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                      {hasPicked && isSelected && !isCorrectOpt && (
                        <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {hasPicked && q.explanation && (
                <div
                  className={`rounded-lg px-3 py-2 text-xs leading-relaxed border ${
                    isRight
                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-200'
                      : 'bg-neutral-100 dark:bg-white/5 border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
