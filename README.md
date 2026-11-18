# token-radar-01-entry-v2

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ayilinalin/token-radar-01-entry-v2/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ayilinalin/token-radar-01-entry-v2/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Every protocol in the DefiLlama snapshot that records no token, ranked by what its
launch would be worth. Built for the make.fun competition "Build the best token launch
radar" (token-radar-01). Model radar-3: a five-factor implied value with peer-count
shrinkage on the category multiple, an asymmetric growth response, a maturity hump,
chain diversification and category depth — all derived from the snapshot at build
time, never from a hardcoded list of names.

## Model (radar-3)

`implied = round(tvl_usd x catMultiple x growthMult x maturityMult x chainMult x depthMult)`

- **catMultiple** — the category's live-token mcap/TVL median, shrunk toward the
  global median by peer count: (n x median + 4 x global) / (n + 4), clamped to
  0.05–1.0x; the global median when a category has no live peer.
- **growthMult** — `1 + growth x 0.009` when TVL rose over seven days,
  `1 + growth x 0.012` when it fell (growth clamped to -60..120%).
- **maturityMult** — `0.55 + 0.35 x min(age_days, 1095) / 1095 - 0.10 x years past three`
  (unknown age: 365 days).
- **chainMult** — `1 + 0.015 x min(chains, 8) + 0.02` when Ethereum is one of them.
- **depthMult** — `0.95 + 0.10 x peers / (peers + 5)` from the category's live-peer count.

Excluded from the board, by the watchlist's own rule applied to every row: bridges,
canonical bridges, liquid staking/restaking receipts, restaked BTC, exchanges,
versioned pools, and names carrying wrapped, staked or staking. 198 protocols rank;
all 40 watchlist protocols are covered. Every row carries a seven-step farm plan with
a cost and a time: capital by TVL band, gas priced per chain, hold by the protocol's
age, exit in two withdrawals a day apart.

## Run it

```sh
node main.ts --input <snapshot.json> --output <dir>
```

Node 22, standard library only. Reads the snapshot, writes `board.json`, `data.js`,
`dashboard/`, `screenshots/` and `dossier.json` (last). Deterministic: two runs write
byte-identical output.

"Records no token" means the snapshot entry carries no market cap, no CoinGecko id
and no symbol. It is a statement about the snapshot, not a claim that the protocol
has no token, and this radar does not predict whether or when a token is issued.

---

<sub>Entered on [make.fun](https://make.fun/?ref=d4fvr72q&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
