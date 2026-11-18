// Token Radar, model radar-3.
//
// One sealed snapshot in, one ranked board out. The board ranks only protocols whose
// snapshot entry records no token (no market cap, no CoinGecko id, no symbol) AND that
// are not a wrapped, staked or bridged product of something else. The exclusion rule
// is the same rule the house applies to its watchlist, applied here to every row: a
// category of Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked
// BTC or CEX; a name carrying the whole word wrapped, staked or staking; a name
// starting with an exchange name; a name ending in a version marker. A bridge token
// or a liquid staking receipt is not a launch waiting to happen, so it never takes
// a rank.
//
// Implied value is computed only from the snapshot's own figures, in five factors:
//
//   catMultiple  = the category's live-token mcap/TVL median, shrunk toward the
//                  global median by peer count: (n*median + 4*global) / (n+4),
//                  clamped to [0.05, 1.0]. A category with one live peer does not
//                  get to pin the whole board to that peer's ratio, and a category
//                  with no live peer falls back to the global median.
//   growthMult   = 1 + g*0.009 for rising TVL, 1 + g*0.012 for falling TVL, with
//                  g = clamp(change_7d, -60, 120). A shrinking protocol loses value
//                  faster than a growing one gains it: users leaving is a louder
//                  signal than users arriving.
//   maturityMult = 0.55 + 0.35 * min(age, 1095)/1095 - 0.10 * decay, where decay is
//                  how far past 1095 days the protocol sits, capped at 1. A protocol
//                  that has run one to three years with no token is prime; a very
//                  young one is unproven, and one past four years has had its chances.
//                  Unknown age counts as 365 days.
//   chainMult    = 1 + 0.015 * min(chains, 8) + 0.02 when Ethereum is one of them.
//                  More chains mean more places to farm and more liquidity to launch
//                  into; Ethereum presence is the deepest pool of all.
//   depthMult    = 0.95 + 0.10 * n/(n+5), where n is the category's live-peer
//                  count. A category where tokens already trade has proven demand.
//
//   implied = max(1, round(tvl_usd * catMultiple * growthMult * maturityMult
//                            * chainMult * depthMult))
//
// No protocol name is ever special-cased: the same function scores every row, and
// every multiple is derived at runtime from the snapshot, not written in by hand.

/** One protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  multiple_floor: number;
  multiple_cap: number;
  prior_strength: number;
  growth_up: number;
  growth_down: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_peak_days: number;
  maturity_decay: number;
  unknown_age_days: number;
  chain_step: number;
  chain_max: number;
  eth_bonus: number;
  depth_base: number;
  depth_range: number;
  depth_half: number;
}

export const MODEL: ModelConstants = {
  multiple_floor: 0.05,
  multiple_cap: 1.0,
  prior_strength: 4,
  growth_up: 0.009,
  growth_down: 0.012,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.55,
  maturity_range: 0.35,
  maturity_peak_days: 1095,
  maturity_decay: 0.1,
  unknown_age_days: 365,
  chain_step: 0.015,
  chain_max: 8,
  eth_bonus: 0.02,
  depth_base: 0.95,
  depth_range: 0.1,
  depth_half: 5,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    category_multiple: number;
    category_peers: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    depth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, farm plan included. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  category_multiple: number;
  category_peers: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  depth_multiplier: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  excluded_size: number;
  live_size: number;
  watchlist_slugs: string[];
  global_multiple: number;
  multiples: Record<string, number>;
  multiple_peers: Record<string, number>;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a sorted number list; the list must be non-empty and already sorted. */
function medianOf(sorted: number[]): number {
  const n = sorted.length;
  if (n % 2 === 1) return sorted[(n - 1) / 2]!;
  return (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * The category multiples, derived from the snapshot's own live-token peers: for each
 * category, the median of mcap_usd / tvl_usd over the protocols in that category that
 * record a market cap and a positive TVL, shrunk toward the global median by the
 * peer count, then clamped to the model's band. Categories with no live peer fall
 * back to the global median over all live peers. The returned map is keyed by
 * category name, with the global median under the empty key ''.
 */
export function categoryMultiples(snapshot: Snapshot, model: ModelConstants = MODEL): {
  byCategory: Map<string, number>;
  peers: Map<string, number>;
  global: number;
} {
  const byCat = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    all.push(ratio);
    const key = p.category ?? '';
    const list = byCat.get(key);
    if (list === undefined) byCat.set(key, [ratio]);
    else list.push(ratio);
  }
  all.sort((a, b) => a - b);
  const global = all.length > 0 ? clamp(medianOf(all), model.multiple_floor, model.multiple_cap) : model.multiple_floor;
  const byCategory = new Map<string, number>();
  const peers = new Map<string, number>();
  for (const [key, list] of [...byCat.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    list.sort((a, b) => a - b);
    const n = list.length;
    const shrunk = (n * medianOf(list) + model.prior_strength * global) / (n + model.prior_strength);
    byCategory.set(key, clamp(shrunk, model.multiple_floor, model.multiple_cap));
    peers.set(key, n);
  }
  return { byCategory, peers, global };
}

/** The multiple one category gets: its own shrunk median, or the global median when it has no live peer. */
export function multipleFor(category: string | null, multiples: { byCategory: Map<string, number>; global: number }): number {
  const hit = multiples.byCategory.get(category ?? '');
  return hit === undefined ? multiples.global : hit;
}

/** The live-peer count of one category: 0 when it has no live peer. */
export function peersFor(category: string | null, multiples: { peers: Map<string, number> }): number {
  return multiples.peers.get(category ?? '') ?? 0;
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  multiples: { byCategory: Map<string, number>; peers: Map<string, number>; global: number },
  model: ModelConstants = MODEL,
): {
  implied: number;
  catMultiple: number;
  catPeers: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  chainMult: number;
  depthMult: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const catMultiple = multipleFor(protocol.category, multiples);
  const catPeers = peersFor(protocol.category, multiples);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = clamp(rawGrowth, model.growth_floor, model.growth_cap);
  const growthMult = growthPct >= 0 ? 1 + growthPct * model.growth_up : 1 + growthPct * model.growth_down;
  const ageForModel = age ?? model.unknown_age_days;
  const ramp = Math.min(Math.max(ageForModel, 0), model.maturity_peak_days) / model.maturity_peak_days;
  const decay = Math.max(0, Math.min((ageForModel - model.maturity_peak_days) / model.maturity_peak_days, 1));
  const maturityMult = model.maturity_floor + ramp * model.maturity_range - decay * model.maturity_decay;
  const chainCount = Math.min(Math.max(protocol.chains.length, 0), model.chain_max);
  const chainMult = 1 + chainCount * model.chain_step + (protocol.chains.includes('Ethereum') ? model.eth_bonus : 0);
  const depthMult = model.depth_base + model.depth_range * (catPeers / (catPeers + model.depth_half));
  const implied = Math.max(1, Math.round(protocol.tvl_usd * catMultiple * growthMult * maturityMult * chainMult * depthMult));
  return { implied, catMultiple, catPeers, growthPct, growthMult, maturityMult, chainMult, depthMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A whole wrapped, staked or staking word in the name: a receipt, not a launch. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Categories that are a bridge, a staking receipt, a restaking receipt or an exchange. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Exchange names: a protocol named after one is the exchange's own product. */
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: it records no token, and it is not a
 * wrapped, staked, bridged or exchange product under the watchlist's own rule.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  for (const prefix of EXCHANGE_PREFIXES) {
    if (p.name.startsWith(prefix)) return false;
  }
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const multiples = categoryMultiples(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names, when the snapshot carries it and
  // the exclusion rule lets it rank. A watchlist slug the rule excludes is reported by
  // boardIssue through the coverage check, never silently dropped.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined && isRankable(p)) chosen.set(slug, p);
  }
  // The rest of the radar: every other rankable protocol in the snapshot, above or
  // below the watchlist floor. A complete radar, not a top-N cut.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, multiples, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      category_multiple: round4(s.catMultiple),
      category_peers: s.catPeers,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      chain_multiplier: round4(s.chainMult),
      depth_multiplier: round4(s.depthMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The typical cost of one simple transaction on a chain, in whole US dollars. */
const GAS_USD: Record<string, number> = {
  Ethereum: 12,
  Bitcoin: 5,
  Arbitrum: 0.5,
  Avalanche: 0.5,
  Base: 0.3,
  Optimism: 0.4,
  Binance: 0.3,
  Polygon: 0.1,
  Solana: 0.02,
  Sui: 0.02,
  Aptos: 0.02,
  'Hyperliquid L1': 0.1,
  'zkSync Era': 0.3,
  Linea: 0.3,
  Scroll: 0.3,
  Mantle: 0.2,
  Blast: 0.2,
  Berachain: 0.1,
  Sonic: 0.1,
  Fantom: 0.1,
  Gnosis: 0.1,
  Cronos: 0.1,
  Tron: 0.5,
};

/** The typical gas of one transaction on a chain, as a short dollar phrase. */
function gasOn(chain: string): string {
  const g = GAS_USD[chain] ?? 1;
  return g < 1 ? `about $${g} of gas` : `about $${g} of gas`;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 300;
  if (p.tvl_usd >= 1_000_000_000) return 200;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow, naming chain, asset and size. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Deposit $${capital} of USDC into the largest ${name} curator vault on ${chain} and hold the vault shares; pick the vault with the most TVL, not the highest quoted yield.`;
  if (c.includes('rwa') || c.includes('real world')) return `Mint $${capital} of ${name}'s tokenised yield asset on ${chain} with USDC and hold it in the farming wallet through one full yield payout.`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} as collateral, borrow no more than a third of it in the same asset, and keep the loan healthy.`;
  if (c.includes('dex') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s deepest pool on ${chain} in a tight range, collect the fees, and keep the position open.`;
  if (c.includes('yield') || c.includes('aggregator') || c.includes('farm')) return `Deposit $${capital} of USDC into ${name}'s top vault on ${chain}, leave the auto-compounding position running, and do not move it between vaults.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Deposit $${capital} of USDC as margin on ${name} on ${chain}, open one small hedged trade, and close it inside the same week.`;
  if (c.includes('prediction')) return `Fund $${capital} of USDC on ${name} and place one small market position on ${chain}, then settle it before the market expires.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it in the farming wallet, not on an exchange.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} for the farming wallet's main position and keep the policy active for the whole hold.`;
  if (c.includes('launchpad')) return `Stake $${capital} of USDC in ${name}'s launch pool on ${chain} and join one sale with the staked balance when it opens.`;
  if (c.includes('chain')) return `Use $${capital} of USDC across ${name}'s native apps on ${chain}: one swap, one deposit and one vote, each from the same wallet.`;
  if (c.includes('payment') || c.includes('card')) return `Spend $${capital} through ${name} on ${chain} in small weekly payments and keep the receipts on chain in the farming wallet.`;
  if (c.includes('basis')) return `Deposit $${capital} of USDC into ${name}'s basis vault on ${chain} and hold the position through one full funding cycle.`;
  if (c.includes('governance')) return `Lock $${capital} of USDC in ${name}'s governance vault on ${chain} and vote on one live proposal from the farming wallet.`;
  if (c.includes('staking pool')) return `Stake $${capital} of USDC in ${name}'s staking pool on ${chain} and leave the stake earning through the whole hold.`;
  if (c.includes('restak')) return `Restake $${capital} of USDC through ${name} on ${chain} into its main restaking vault and keep the position receipt in the farming wallet.`;
  if (c.includes('cede')) return `Deposit $${capital} of USDC into ${name}'s custodial yield product on ${chain} and keep the balance untouched for the whole hold.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The second chain a protocol names, for the cross-chain step. */
function secondChain(p: SnapshotProtocol): string | null {
  return p.chains.length > 1 ? p.chains[1]! : null;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan
 * is derived from the protocol's own record (category, chains, TVL, age), never from a
 * hand-written list of names. Gas is priced per chain, capital per TVL band, and the
 * hold per the protocol's age.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const gasMain = gasOn(chain);
  const extra = secondChain(p);
  const step3: FarmStep = extra === null
    ? {
        text: `Open a second, smaller position of $${Math.round(capital / 2)} of USDC in the same protocol on ${chain} so the wallet shows two distinct actions, not one deposit.`,
        cost: `${gasMain} for the second deposit`,
        time: '10 minutes',
      }
    : {
        text: `Repeat the same action on ${extra} with $${Math.round(capital / 2)} of USDC, so the wallet is active on two chains the protocol runs on.`,
        cost: `${gasOn(extra)} for the second-chain deposit`,
        time: '10 minutes',
      };
  return [
    {
      text: `Use a fresh wallet that holds only the $${capital} you plan to farm, and keep its seed phrase offline on paper, never in a screenshot or a chat.`,
      cost: `${gasMain} for the first transaction`,
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and ${gasMain}`,
      time: '15 minutes to set up',
    },
    step3,
    {
      text: `Repeat one qualifying action each week on ${chain}: a deposit, a borrow, a swap or a vote, always from the same wallet.`,
      cost: `${gasMain} a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot, and do not withdraw early.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open ${p.name}'s own points or rewards page from the link the protocol itself publishes and check the balance; never pay anyone to claim for you.`,
      cost: 'no fee to check',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction hash in a farm log, then unwind the position in two withdrawals a day apart so a failed exit cannot trap the funds.`,
      cost: `${gasMain} per withdrawal`,
      time: '10 minutes to log and exit',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || (b.tvl_usd - a.tvl_usd) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, farm plan included. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    category_multiple: row.model.category_multiple,
    category_peers: row.model.category_peers,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    depth_multiplier: row.model.depth_multiplier,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const multiples = categoryMultiples(snapshot, model);
  const excluded = snapshot.protocols.filter((p) => isPreToken(p) && !isRankable(p)).length;
  const multiplesObj: Record<string, number> = {};
  const peersObj: Record<string, number> = {};
  for (const [k, v] of multiples.byCategory) {
    multiplesObj[k] = v;
    peersObj[k] = multiples.peers.get(k) ?? 0;
  }
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    excluded_size: excluded,
    live_size: live.length,
    watchlist_slugs: [...snapshot.watchlist].sort(),
    global_multiple: multiples.global,
    multiples: multiplesObj,
    multiple_peers: peersObj,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
