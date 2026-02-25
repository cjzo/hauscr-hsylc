export const SEMINAR_CATEGORIES = [
    'History, Economics, & Current Affairs',
    'Entrepreneurship and Leadership',
    'Data, Engineering, & Technology',
    'Aesthetics and Culture',
    'Human Behavior and Ethics',
    'Natural Sciences in the Modern World',
    'Other'
] as const;

export type StandardCategory = typeof SEMINAR_CATEGORIES[number];

export function standardizeCategory(rawCategory: string | null | undefined): StandardCategory {
    if (!rawCategory) return 'Other';

    const lower = rawCategory.toLowerCase();

    if (lower.includes('stem') || lower.includes('data') || lower.includes('engineering') || lower.includes('computer') || lower.includes('technology')) {
        return 'Data, Engineering, & Technology';
    }
    if (lower.includes('science') || lower.includes('physics') || lower.includes('chemistry') || lower.includes('biology') || lower.includes('natural')) {
        return 'Natural Sciences in the Modern World';
    }
    if (lower.includes('history') || lower.includes('economics') || lower.includes('current affairs') || lower.includes('political') || lower.includes('government')) {
        return 'History, Economics, & Current Affairs';
    }
    if (lower.includes('entrepreneurship') || lower.includes('leadership') || lower.includes('business')) {
        return 'Entrepreneurship and Leadership';
    }
    if (lower.includes('art') || lower.includes('culture') || lower.includes('humanities') || lower.includes('literature') || lower.includes('aesthetics')) {
        return 'Aesthetics and Culture';
    }
    if (lower.includes('human behavior') || lower.includes('ethics') || lower.includes('psychology') || lower.includes('sociology') || lower.includes('social sciences')) {
        return 'Human Behavior and Ethics';
    }

    return 'Other';
}
