const TIER_VALUES: Record<string, number> = {
    auto_accept: 0,
    tier_1: 1,
    tier_2: 2,
    tier_3: 3,
    tier_4: 4,
};

const VALUE_TO_TIER = ['auto_accept', 'tier_1', 'tier_2', 'tier_3', 'tier_4'];

export const TIER_COLOR: Record<string, string> = {
    auto_accept: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    tier_1: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    tier_2: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    tier_3: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    tier_4: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export const TIER_LABEL: Record<string, string> = {
    auto_accept: 'Auto Accept',
    tier_1: 'Tier 1',
    tier_2: 'Tier 2',
    tier_3: 'Tier 3',
    tier_4: 'Tier 4',
};

/**
 * Raw numeric average of tier values. Returns null when no rankings exist.
 * Lower = better (auto_accept=0, tier_1=1, ..., tier_4=4).
 */
export function getTierAverage(rankings: (string | null | undefined)[]): number | null {
    const values = rankings
        .filter((r): r is string => !!r && r in TIER_VALUES)
        .map(r => TIER_VALUES[r]);

    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Compute a consensus tier from an array of ranking strings.
 * Averages the numeric values and rounds toward the better (lower) tier on .5.
 */
export function getConsensusTier(rankings: (string | null | undefined)[]): string | null {
    const avg = getTierAverage(rankings);
    if (avg === null) return null;

    const rounded = Math.ceil(avg - 0.5);
    const clamped = Math.max(0, Math.min(4, rounded));
    return VALUE_TO_TIER[clamped];
}
