/**
 * ISO 2859-1 (≈ ANSI/ASQ Z1.4) — General inspection level II: lot size → sample-size code letter → sample size.
 * The acceptance number (Ac) for the chosen AQL is taken from the plan, entered by QA from the standard's Table II-A,
 * so the system never guesses a statistical table.
 */
const LEVEL_II: [number, string, number][] = [
  [8, 'A', 2], [15, 'B', 3], [25, 'C', 5], [50, 'D', 8], [90, 'E', 13], [150, 'F', 20], [280, 'G', 32], [500, 'H', 50],
  [1200, 'J', 80], [3200, 'K', 125], [10000, 'L', 200], [35000, 'M', 315], [150000, 'N', 500], [500000, 'P', 800], [Infinity, 'Q', 1250],
];
export function iso2859LevelII(lotSize: number) {
  const r = LEVEL_II.find(([max]) => lotSize <= max)!;
  return { code_letter: r[1], sample_size: Math.min(r[2], Math.ceil(lotSize)) };
}
export const HUNDRED_PERCENT_LIMIT = 500;   // per-unit result entry is impractical beyond this; use sorting + NCR instead

export function sampleSizeFor(plan: { sampling_method: string; sample_size: number | null; sample_percent: number | null }, lotQty: number) {
  const q = Math.ceil(lotQty);
  switch (plan.sampling_method) {
    case 'FIXED': return { sample_size: Math.min(Number(plan.sample_size), q), basis: `Fixed ${plan.sample_size} pcs` };
    case 'PERCENT': return { sample_size: Math.max(1, Math.min(q, Math.ceil((q * Number(plan.sample_percent)) / 100))), basis: `${plan.sample_percent}% of lot` };
    case 'HUNDRED': return { sample_size: q, basis: '100% inspection' };
    default: { const s = iso2859LevelII(q); return { sample_size: s.sample_size, basis: `ISO 2859-1 level II, code ${s.code_letter}` }; }
  }
}
