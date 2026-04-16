// lib/performance.ts
//
// Self-contained Alpaca-backed performance reporting for the Discord bot.
// Uses fetch (Node 18+) to call the Alpaca REST API directly — no firebase,
// no elite-entries dependency. Credentials are read from process.env.
//
// Public API:
//   getPerformance(timeframe, symbols?)  -> string  (Discord-formatted)
//   chunkForDiscord(text)                -> string[] (≤2000 char chunks)

export type Timeframe = 'weekly' | 'monthly' | 'ytd';

const ALPACA_BASE = 'https://api.alpaca.markets';
const DATA_BASE = 'https://data.alpaca.markets';

// ── Credential helpers ─────────────────────────────────
function creds(): { key: string; secret: string } {
    // Tolerate values wrapped in quotes / surrounding whitespace, since the
    // production .env stores them as `ALPACA_KEY = 'xxx'`.
    const clean = (v: string | undefined) =>
        (v ?? '').trim().replace(/^['"]|['"]$/g, '').trim();
    const key = clean(process.env.ALPACA_KEY);
    const secret = clean(process.env.ALPACA_SECRET);
    if (!key || !secret) {
        throw new Error('ALPACA_KEY / ALPACA_SECRET not set in environment');
    }
    return { key, secret };
}

function authHeaders(): Record<string, string> {
    const { key, secret } = creds();
    return {
        'APCA-API-KEY-ID': key,
        'APCA-API-SECRET-KEY': secret,
    };
}

async function alpacaGet<T = any>(url: string): Promise<T> {
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Alpaca ${res.status} on ${url}: ${body.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}

// ── Date helpers ───────────────────────────────────────
function getYTDStart(): Date {
    const now = new Date();
    const jan2 = new Date(now.getFullYear(), 0, 2);
    const day = jan2.getDay();
    if (day === 0) jan2.setDate(3); // Sunday → Monday
    if (day === 6) jan2.setDate(4); // Saturday → Monday
    return jan2;
}

function fmtDollar(n: number, opts: Intl.NumberFormatOptions = {}): string {
    return n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        ...opts,
    });
}

function emojiFor(pct: number): string {
    return pct >= 0 ? '🟢' : '🔴';
}

function signed(n: number, digits = 2): string {
    return (n >= 0 ? '+' : '') + n.toFixed(digits);
}

// ── Alpaca types ───────────────────────────────────────
interface PortfolioHistory {
    timestamp: number[];      // unix seconds
    equity: number[];
    profit_loss: number[];
    profit_loss_pct: number[];
    base_value: number;
    timeframe: string;
}

interface AlpacaAccount {
    equity: string;
    last_equity: string;
    cash: string;
    portfolio_value: string;
    long_market_value: string;
    short_market_value: string;
}

interface AlpacaPosition {
    symbol: string;
    qty: string;
    avg_entry_price: string;
    market_value: string;
    cost_basis: string;
    unrealized_pl: string;
    unrealized_plpc: string;
    current_price: string;
    change_today: string;
}

interface LatestBar {
    bars: Record<string, { c: number; h: number; l: number; o: number; t: string; v: number }>;
}

interface HistoricalBars {
    bars: Record<string, Array<{ c: number; h: number; l: number; o: number; t: string; v: number }>>;
    next_page_token?: string | null;
}

// ── Fetchers ───────────────────────────────────────────
async function getAccount(): Promise<AlpacaAccount> {
    return alpacaGet<AlpacaAccount>(`${ALPACA_BASE}/v2/account`);
}

async function getPositions(): Promise<AlpacaPosition[]> {
    return alpacaGet<AlpacaPosition[]>(`${ALPACA_BASE}/v2/positions`);
}

// Pull a generous window of daily portfolio history so we can slice for any
// requested timeframe. period=1A gives ~1 year of daily points.
async function getPortfolioHistory(): Promise<PortfolioHistory> {
    const url =
        `${ALPACA_BASE}/v2/account/portfolio/history` +
        `?period=1A&timeframe=1D&extended_hours=false`;
    return alpacaGet<PortfolioHistory>(url);
}

// Latest trade price for a set of symbols.
async function getLatestPrices(symbols: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (symbols.length === 0) return out;
    const url =
        `${DATA_BASE}/v2/stocks/bars/latest?symbols=${symbols.join(',')}&feed=iex`;
    const data = await alpacaGet<LatestBar>(url);
    for (const sym of symbols) {
        const bar = data.bars?.[sym];
        if (bar) out.set(sym, bar.c);
    }
    return out;
}

// Daily bars for symbols starting at `start`. Returns the first bar at/after start.
async function getStartPrices(symbols: string[], start: Date): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (symbols.length === 0) return out;
    const startIso = start.toISOString().split('T')[0];
    // Fetch up to 7 trading days from start so we always catch the first available.
    const endDate = new Date(start.getTime() + 10 * 24 * 60 * 60 * 1000);
    const endIso = endDate.toISOString().split('T')[0];
    const url =
        `${DATA_BASE}/v2/stocks/bars` +
        `?symbols=${symbols.join(',')}` +
        `&timeframe=1Day&start=${startIso}&end=${endIso}&limit=10&feed=iex&adjustment=all`;
    try {
        const data = await alpacaGet<HistoricalBars>(url);
        for (const sym of symbols) {
            const bars = data.bars?.[sym];
            if (bars && bars.length > 0) out.set(sym, bars[0].c);
        }
    } catch {
        // Fall back to per-symbol if multi-symbol failed
        for (const sym of symbols) {
            try {
                const single = await alpacaGet<HistoricalBars>(
                    `${DATA_BASE}/v2/stocks/bars?symbols=${sym}&timeframe=1Day` +
                    `&start=${startIso}&end=${endIso}&limit=10&feed=iex&adjustment=all`,
                );
                const bars = single.bars?.[sym];
                if (bars && bars.length > 0) out.set(sym, bars[0].c);
            } catch { /* skip */ }
        }
    }
    return out;
}

// ── Timeframe slicing ──────────────────────────────────
interface Slice {
    label: string;
    startEquity: number;
    endEquity: number;
    startDate: Date;
    endDate: Date;
}

function sliceHistory(history: PortfolioHistory, timeframe: Timeframe): Slice {
    const ts = history.timestamp;
    const eq = history.equity;
    if (!ts.length || !eq.length) {
        throw new Error('Empty portfolio history from Alpaca');
    }

    const lastIdx = ts.length - 1;
    const endEquity = eq[lastIdx];
    const endDate = new Date(ts[lastIdx] * 1000);

    let startIdx: number;
    let label: string;

    if (timeframe === 'weekly') {
        // last 5 trading day points (close 5 sessions back), so we get a 5-day return
        startIdx = Math.max(0, lastIdx - 5);
        label = 'Weekly (5 trading days)';
    } else if (timeframe === 'monthly') {
        // last ~22 trading days
        startIdx = Math.max(0, lastIdx - 22);
        label = 'Monthly (~22 trading days)';
    } else {
        // YTD: find first index whose date is >= Jan 1 of current year
        const jan1 = new Date(new Date().getFullYear(), 0, 1).getTime() / 1000;
        startIdx = ts.findIndex((t) => t >= jan1);
        if (startIdx <= 0) startIdx = 0;
        // Use the index just before the first YTD point as the baseline (Dec 31 close).
        // If no prior point exists, use the first YTD point itself.
        if (startIdx > 0) startIdx -= 1;
        label = `YTD ${new Date().getFullYear()}`;
    }

    return {
        label,
        startEquity: eq[startIdx],
        endEquity,
        startDate: new Date(ts[startIdx] * 1000),
        endDate,
    };
}

// ── Reports ────────────────────────────────────────────
async function fundReport(timeframe: Timeframe): Promise<string> {
    const [history, account, positions] = await Promise.all([
        getPortfolioHistory(),
        getAccount(),
        getPositions(),
    ]);

    const slice = sliceHistory(history, timeframe);
    const change = slice.endEquity - slice.startEquity;
    const pct = slice.startEquity > 0 ? (change / slice.startEquity) * 100 : 0;

    const cash = parseFloat(account.cash);
    const equity = parseFloat(account.equity);
    const longMv = parseFloat(account.long_market_value);
    const cashPct = equity > 0 ? (cash / equity) * 100 : 0;
    const equitiesPct = equity > 0 ? (longMv / equity) * 100 : 0;

    const lines: string[] = [];
    lines.push(`**📈 Fund Performance — ${slice.label}**`);
    lines.push(
        `${emojiFor(pct)} **${signed(pct)}%** ($${fmtDollar(slice.startEquity, { maximumFractionDigits: 0, minimumFractionDigits: 0 })} → $${fmtDollar(slice.endEquity, { maximumFractionDigits: 0, minimumFractionDigits: 0 })})`,
    );
    const plSign = change >= 0 ? '+' : '-';
    lines.push(`P/L: ${plSign}$${fmtDollar(Math.abs(change))}`);
    lines.push(
        `Window: ${slice.startDate.toISOString().slice(0, 10)} → ${slice.endDate.toISOString().slice(0, 10)}`,
    );
    lines.push('');
    lines.push(
        `**Account:** $${fmtDollar(equity, { maximumFractionDigits: 0, minimumFractionDigits: 0 })} · ${cashPct.toFixed(0)}% cash · ${equitiesPct.toFixed(0)}% equities`,
    );

    if (positions.length > 0) {
        lines.push('');
        lines.push(`**Positions (${positions.length}):**`);
        const sorted = [...positions].sort(
            (a, b) => parseFloat(b.market_value) - parseFloat(a.market_value),
        );
        for (const p of sorted) {
            const mv = parseFloat(p.market_value);
            const upl = parseFloat(p.unrealized_pl);
            const uplPct = parseFloat(p.unrealized_plpc) * 100;
            const dayPct = parseFloat(p.change_today) * 100;
            const e = emojiFor(upl);
            lines.push(
                `  ${e} \`${p.symbol.padEnd(5)}\` $${fmtDollar(mv, { maximumFractionDigits: 0, minimumFractionDigits: 0 })} · ${signed(uplPct)}% (${signed(upl)}) · today ${signed(dayPct)}%`,
            );
        }
    }

    return lines.join('\n');
}

async function symbolsReport(timeframe: Timeframe, symbols: string[]): Promise<string> {
    const upper = symbols.map((s) => s.toUpperCase());

    // Determine the start date for the requested window.
    let startDate: Date;
    let label: string;
    const now = new Date();
    if (timeframe === 'weekly') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        label = 'Weekly (7 days)';
    } else if (timeframe === 'monthly') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        label = 'Monthly (30 days)';
    } else {
        startDate = getYTDStart();
        label = `YTD ${now.getFullYear()}`;
    }

    const [startPrices, currentPrices, positions] = await Promise.all([
        getStartPrices(upper, startDate),
        getLatestPrices(upper),
        getPositions(),
    ]);
    const posMap = new Map(positions.map((p) => [p.symbol, p]));

    const lines: string[] = [];
    lines.push(`**📊 Symbol Performance — ${label}**`);
    lines.push(`Baseline: ${startDate.toISOString().slice(0, 10)}`);
    lines.push('');

    interface Row {
        symbol: string;
        startPrice: number | null;
        currentPrice: number | null;
        pct: number | null;
        change: number | null;
        position?: AlpacaPosition;
    }
    const rows: Row[] = upper.map((sym) => {
        const sp = startPrices.get(sym) ?? null;
        const cp = currentPrices.get(sym) ?? null;
        if (sp != null && cp != null && sp > 0) {
            const change = cp - sp;
            const pct = (change / sp) * 100;
            return { symbol: sym, startPrice: sp, currentPrice: cp, pct, change, position: posMap.get(sym) };
        }
        return { symbol: sym, startPrice: sp, currentPrice: cp, pct: null, change: null, position: posMap.get(sym) };
    });

    rows.sort((a, b) => (b.pct ?? -Infinity) - (a.pct ?? -Infinity));

    for (const r of rows) {
        if (r.pct == null || r.startPrice == null || r.currentPrice == null) {
            lines.push(`❓ **${r.symbol}** — No data available for this window`);
            continue;
        }
        lines.push(
            `${emojiFor(r.pct)} **${r.symbol}** ${signed(r.pct)}% ($${r.startPrice.toFixed(2)} → $${r.currentPrice.toFixed(2)})`,
        );
        if (r.position) {
            const qty = parseFloat(r.position.qty);
            const avg = parseFloat(r.position.avg_entry_price);
            const mv = parseFloat(r.position.market_value);
            const upl = parseFloat(r.position.unrealized_pl);
            const uplPct = parseFloat(r.position.unrealized_plpc) * 100;
            lines.push(
                `  ↳ Held: ${qty} @ avg $${avg.toFixed(2)} · MV $${fmtDollar(mv)} · cost-basis ${signed(uplPct)}% (${signed(upl)})`,
            );
        }
    }

    return lines.join('\n');
}

// ── Public entry point ─────────────────────────────────
export async function getPerformance(
    timeframe: Timeframe = 'ytd',
    symbols?: string[],
): Promise<string> {
    if (symbols && symbols.length > 0) {
        return symbolsReport(timeframe, symbols);
    }
    return fundReport(timeframe);
}

// Discord caps messages at 2000 chars. Split on line boundaries.
export function chunkForDiscord(text: string, max = 1900): string[] {
    if (text.length <= max) return [text];
    const out: string[] = [];
    const lines = text.split('\n');
    let buf = '';
    for (const line of lines) {
        if ((buf + '\n' + line).length > max) {
            if (buf) out.push(buf);
            buf = line;
        } else {
            buf = buf ? buf + '\n' + line : line;
        }
    }
    if (buf) out.push(buf);
    return out;
}
