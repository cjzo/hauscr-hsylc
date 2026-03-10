import { useState, useEffect, useCallback, useId, useLayoutEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { useConfirm } from '../components/ui/ConfirmModal';
import {
    User, Mail, GraduationCap, ChevronRight, ChevronLeft, MapPin,
    ThumbsUp, ThumbsDown, Loader2, FileText, MessageSquare, Clock, BarChart2, RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { standardizeCategory } from '../utils/categories';
import {
    ResponsiveContainer, Tooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area, LineChart, Line, ReferenceLine
} from 'recharts';

/** Gaussian KDE: returns smoothed density points for charting. */
function kernelDensity(samples: number[], domainMin: number, domainMax: number, step: number, bandwidth: number): { x: number; density: number }[] {
    if (samples.length === 0) return [];
    const gaussian = (u: number) => (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * u * u);
    const h = bandwidth;
    const n = samples.length;
    const points: { x: number; density: number }[] = [];
    for (let x = domainMin; x <= domainMax; x += step) {
        let sum = 0;
        for (const xi of samples) {
            sum += gaussian((x - xi) / h);
        }
        const density = sum / (n * h);
        points.push({ x: Math.round(x * 100) / 100, density });
    }
    const maxD = Math.max(...points.map(p => p.density));
    if (maxD > 0) {
        points.forEach(p => { p.density = p.density / maxD; });
    }
    return points;
}

function percentile(samples: number[], value: number): number {
    if (samples.length === 0) return 0;
    const countBelow = samples.filter(s => s < value).length;
    return Math.round((100 * countBelow) / samples.length);
}

function mean(values: number[]): number {
    if (!values.length) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const m = mean(values);
    const variance = values.reduce((sum, v) => sum + (v - m) * (v - m), 0) / values.length;
    return Math.sqrt(variance);
}

/** CDF at grid points: proportion of samples <= x. */
function computeCdf(samples: number[], domainMin: number, domainMax: number, step: number): { x: number; cdf: number }[] {
    if (samples.length === 0) return [];
    const n = samples.length;
    const points: { x: number; cdf: number }[] = [];
    for (let x = domainMin; x <= domainMax; x += step) {
        const count = samples.filter(s => s <= x).length;
        points.push({ x: Math.round(x * 100) / 100, cdf: count / n });
    }
    return points;
}
import { useAuth } from '../context/AuthContext';
import { TIER_COLOR, TIER_LABEL, getConsensusTier, getTierAverage } from '../utils/tiers';

type DeliberationTab = 'seminar' | 'written' | 'interview' | 'visualizations';

function ScoreTooltip({
    label,
    lines,
    children,
}: {
    label: string;
    lines: string[];
    children: React.ReactNode;
}) {
    const id = useId();
    const triggerRef = useRef<HTMLSpanElement | null>(null);
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const recompute = useCallback(() => {
        const el = triggerRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const desiredWidth = 280;
        const padding = 8;
        const maxLeft = Math.max(padding, window.innerWidth - desiredWidth - padding);
        const left = Math.min(Math.max(padding, r.left), maxLeft);
        const top = r.bottom + 8;
        setPos({ left, top, width: desiredWidth });
    }, []);

    useLayoutEffect(() => {
        if (!open) return;
        recompute();
        const onScroll = () => recompute();
        const onResize = () => recompute();
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onResize);
        };
    }, [open, recompute]);

    return (
        <>
            <span
                ref={triggerRef}
                className="relative inline-flex items-center"
                aria-describedby={open ? id : undefined}
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
            >
                {children}
            </span>
            {mounted && open && pos != null && createPortal(
                <span
                    id={id}
                    role="tooltip"
                    className="pointer-events-none fixed z-[9999] rounded-sm border border-border bg-white/90 p-3 text-xs text-secondary shadow-xl backdrop-blur-md dark:bg-surface/90"
                    style={{ left: pos.left, top: pos.top, width: pos.width }}
                >
                    <span className="block text-[11px] font-semibold text-primary mb-1">{label}</span>
                    <span className="block whitespace-pre-line leading-relaxed">
                        {lines.map((l, i) => (i === 0 ? l : `\n${l}`)).join('')}
                    </span>
                </span>,
                document.body
            )}
        </>
    );
}

function PercentileMini({
    percentileValue,
    color,
    label,
}: {
    percentileValue: number | null;
    color: string;
    label: string;
}) {
    if (percentileValue == null) return null;
    const clamped = Math.max(0, Math.min(100, percentileValue));
    const dotLeft = Math.max(2, Math.min(98, clamped));

    return (
        <ScoreTooltip
            label={`${label} percentile`}
            lines={[
                `${clamped}th percentile vs current cohort (pending candidates).`,
                'Higher is better.',
            ]}
        >
            <span className="inline-flex items-center gap-2 shrink-0 tabular-nums">
                <span className="text-[11px] font-semibold opacity-90" style={{ color }}>
                    P{clamped}
                </span>
                <span className="relative h-2 w-24 rounded-sm bg-surfaceHover overflow-hidden">
                    <span
                        className="absolute inset-y-0 left-0 opacity-25"
                        style={{ width: `${clamped}%`, backgroundColor: color }}
                    />
                    <span
                        className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm ring-1 ring-black/10 dark:ring-white/10"
                        style={{ left: `${dotLeft}%`, backgroundColor: color }}
                    />
                </span>
            </span>
        </ScoreTooltip>
    );
}

export function DeliberationPage() {
    const [candidates, setCandidates] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction, setDirection] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<DeliberationTab>('seminar');
    const [tabDirection, setTabDirection] = useState(0);
    const confirmModal = useConfirm();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [sidebarHasSpace, setSidebarHasSpace] = useState(true);
    const [distributionMode, setDistributionMode] = useState<'written' | 'interview' | 'empirical'>('interview');
    const [percentileInterviewer, setPercentileInterviewer] = useState<'all' | string>('all');
    const [tierFilter, setTierFilter] = useState<string>('all');

    const { role } = useAuth();
    const isAdmin = role === 'admin';
    const tabOrder: DeliberationTab[] = ['seminar', 'written', 'interview', 'visualizations'];
    const COLOR_WRITTEN = '#8b5cf6'; // tailwind violet-500
    const COLOR_OVERALL = '#10b981'; // tailwind emerald-500
    const COLOR_EMPIRICAL = '#f97316'; // tailwind orange-500
    const COLOR_CANDIDATE = '#dc2626'; // tailwind red-600
    const INTERVIEWER_COLORS = [COLOR_OVERALL, COLOR_WRITTEN, '#d97706', COLOR_CANDIDATE];

    const formatClassYear = (input: string | null | undefined) => {
        if (!input) return 'Other';

        const raw = String(input).trim();
        if (!raw) return 'Other';

        const lower = raw.toLowerCase();

        const extractStandingFromText = () => {
            if (lower.includes('freshman')) return 'Freshman';
            if (lower.includes('sophomore')) return 'Sophomore';
            if (lower.includes('junior')) return 'Junior';
            if (lower.includes('senior')) return 'Senior';
            return null;
        };

        const extractYearFromString = () => {
            // Look for a 4-digit graduation year first (e.g. 2026)
            const fourDigit = raw.match(/\b(202[0-9]|203[0-9])\b/);
            if (fourDigit) {
                return parseInt(fourDigit[1], 10);
            }

            // Handle shortened formats like '26 or 26, mapping to 2026–2029
            const twoDigit = raw.match(/'?(\d{2})\b/);
            if (twoDigit) {
                const num = parseInt(twoDigit[1], 10);
                if (num >= 26 && num <= 29) {
                    return 2000 + num; // 2026–2029
                }
            }

            return null;
        };

        const standingFromYear = (year: number | null) => {
            if (!year) return null;
            if (year === 2026) return 'Senior';
            if (year === 2027) return 'Junior';
            if (year === 2028) return 'Sophomore';
            if (year === 2029) return 'Freshman';
            return null;
        };

        const yearFromStanding = (standing: string | null) => {
            if (!standing) return null;
            if (standing === 'Senior') return 2026;
            if (standing === 'Junior') return 2027;
            if (standing === 'Sophomore') return 2028;
            if (standing === 'Freshman') return 2029;
            return null;
        };

        const textStanding = extractStandingFromText();
        let yearNum = extractYearFromString();
        let standing = textStanding;

        // If we have a year but no standing, infer standing from year
        if (!standing && yearNum) {
            standing = standingFromYear(yearNum);
        }

        // If we have a standing but no year, optionally infer year
        if (!yearNum && standing) {
            yearNum = yearFromStanding(standing);
        }

        const gradYear = yearNum ? String(yearNum) : null;

        if (gradYear && standing) {
            // Standard format: "2026 (Senior)"
            return `${gradYear} (${standing})`;
        }

        if (gradYear) {
            return gradYear;
        }

        if (standing) {
            // Avoid "Junior (Junior)" — just show the standing
            return standing;
        }

        // Sensible fallback for "Other" or unknown formats
        if (lower.includes('other')) return 'Other';

        // If we can't confidently parse, return the raw string
        return raw;
    };

    const fetchCandidates = useCallback(async (options?: { preserveId?: string; showLoader?: boolean }) => {
        const { preserveId, showLoader } = options || {};
        if (showLoader) setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('candidates')
                .select('*, interviews(*)')
                .eq('deliberation_status', 'pending')
                .eq('candidate_type', 'New');

            if (error) throw error;

            if (data && data.length > 0) {
                const mappedData = data.map(cand => {
                    const toNum = (value: unknown): number | null => {
                        if (value === null || value === undefined) return null;
                        const n = typeof value === 'number' ? value : Number(value);
                        return Number.isFinite(n) ? n : null;
                    };

                    const interviews: any[] = Array.isArray((cand as any).interviews) ? (cand as any).interviews : [];

                    const interviewOverallVals = interviews
                        .map((i: any) => toNum(i?.score_overall))
                        .filter((v: number | null): v is number => v !== null);
                    const interviewEmpiricalVals = interviews
                        .map((i: any) => toNum(i?.score_empirical))
                        .filter((v: number | null): v is number => v !== null);

                    const interviewUnderstandingVals = interviews
                        .map((i: any) => toNum(i?.score_understanding))
                        .filter((v: number | null): v is number => v !== null);
                    const interviewEnthusiasmVals = interviews
                        .map((i: any) => toNum(i?.score_enthusiasm))
                        .filter((v: number | null): v is number => v !== null);
                    const interviewQualityVals = interviews
                        .map((i: any) => toNum(i?.score_quality))
                        .filter((v: number | null): v is number => v !== null);
                    const interviewTeachingVals = interviews
                        .map((i: any) => toNum(i?.score_teaching))
                        .filter((v: number | null): v is number => v !== null);
                    const interviewInterestVals = interviews
                        .map((i: any) => toNum(i?.score_interest))
                        .filter((v: number | null): v is number => v !== null);

                    const candOverall = toNum((cand as any).score_overall);
                    const overallFromInterviews =
                        interviewOverallVals.length > 0
                            ? interviewOverallVals.reduce((a, b) => a + b, 0) / interviewOverallVals.length
                            : 0;

                    const candEmpirical = toNum((cand as any).score_empirical);
                    const empiricalFromInterviews =
                        interviewEmpiricalVals.length > 0
                            ? interviewEmpiricalVals.reduce((a, b) => a + b, 0) / interviewEmpiricalVals.length
                            : null;

                    const candUnderstanding = toNum((cand as any).score_understanding);
                    const understandingFromInterviews =
                        interviewUnderstandingVals.length > 0
                            ? interviewUnderstandingVals.reduce((a, b) => a + b, 0) / interviewUnderstandingVals.length
                            : null;

                    const candEnthusiasm = toNum((cand as any).score_enthusiasm);
                    const enthusiasmFromInterviews =
                        interviewEnthusiasmVals.length > 0
                            ? interviewEnthusiasmVals.reduce((a, b) => a + b, 0) / interviewEnthusiasmVals.length
                            : null;

                    const candQuality = toNum((cand as any).score_quality);
                    const qualityFromInterviews =
                        interviewQualityVals.length > 0
                            ? interviewQualityVals.reduce((a, b) => a + b, 0) / interviewQualityVals.length
                            : null;

                    const candTeaching = toNum((cand as any).score_teaching);
                    const teachingFromInterviews =
                        interviewTeachingVals.length > 0
                            ? interviewTeachingVals.reduce((a, b) => a + b, 0) / interviewTeachingVals.length
                            : null;

                    const candInterest = toNum((cand as any).score_interest);
                    const interestFromInterviews =
                        interviewInterestVals.length > 0
                            ? interviewInterestVals.reduce((a, b) => a + b, 0) / interviewInterestVals.length
                            : null;

                    return ({
                        id: cand.id,
                        name: cand.full_name || `${cand.first_name} ${cand.last_name}`,
                        email: cand.email,
                        school: cand.school,
                        major: cand.major,
                        year: cand.class_year,
                        nationality: cand.nationality,
                        candidateType: cand.candidate_type || 'New',

                        seminarTitle: cand.seminar_title,
                        seminarCategory: standardizeCategory(cand.seminar_category || cand.seminar_title),
                        seminarDescription: cand.seminar_description || (cand.seminar_title?.includes('\n') ? cand.seminar_title : cand.seminar_title),
                        finalProduct: cand.final_product,
                        moreTopics: cand.more_topics,

                        interestReason: cand.interest_reason,
                        teachingExp: cand.teaching_exp,
                        advice: cand.advice,
                        selfIntro: cand.self_intro,

                        grader: cand.grader_name || 'Not Available',
                        tier: cand.tier_level || 'N/A',
                        sensitiveIssues: cand.sensitive_issues,
                        flyFrom: cand.fly_from,
                        flyTo: cand.fly_to,
                        availability: cand.availability,
                        scores: {
                            writtenInterest: toNum((cand as any).written_score_interest) ?? 0,
                            writtenTeaching: toNum((cand as any).written_score_teaching) ?? 0,
                            writtenSeminar: toNum((cand as any).written_score_seminar) ?? 0,
                            writtenPersonal: toNum((cand as any).written_score_personal) ?? 0,

                            understanding: (candUnderstanding ?? understandingFromInterviews ?? 0),
                            enthusiasm: (candEnthusiasm ?? enthusiasmFromInterviews ?? 0),
                            quality: (candQuality ?? qualityFromInterviews ?? 0),
                            teaching: (candTeaching ?? teachingFromInterviews ?? 0),
                            interestEngaging: (candInterest ?? interestFromInterviews ?? 0),
                            overall: candOverall ?? overallFromInterviews,
                            empirical: candEmpirical ?? empiricalFromInterviews,
                        },
                        interviewNotes: interviews.map((note: any) => ({
                            id: note.id,
                            interviewer: note.interviewer_name,
                            interviewer_ranking: note.interviewer_ranking || null,
                            notes_why_sl: note.notes_why_sl,
                            notes_seminar: note.notes_seminar,
                            notes_extracurricular: note.notes_extracurricular,
                            notes_cross_cultural: note.notes_cross_cultural,
                            notes_teach_me: note.notes_teach_me,
                            notes_commitment: note.notes_commitment,
                            notes_comments: note.notes_comments,
                            availabilityAnswer: note.availability_answer,
                            availabilityShenzhen: note.availability_shenzhen,
                            availabilityShanghai: note.availability_shanghai,
                            availabilityHangzhou: note.availability_hangzhou,
                            availabilityBeijing: note.availability_beijing,
                            flyFromInterview: note.fly_from_interview,
                            flyToInterview: note.fly_to_interview,
                            sensitiveFlag: note.sensitive_flag,
                            score_understanding: toNum(note.score_understanding),
                            score_enthusiasm: toNum(note.score_enthusiasm),
                            score_quality: toNum(note.score_quality),
                            score_teaching: toNum(note.score_teaching),
                            score_interest: toNum(note.score_interest),
                            score_overall: toNum(note.score_overall),
                            score_empirical: toNum(note.score_empirical)
                        }))
                    });
                });
                setCandidates(mappedData);
                if (preserveId) {
                    const idx = mappedData.findIndex(c => c.id === preserveId);
                    setCurrentIndex(idx >= 0 ? idx : 0);
                } else if (currentIndex >= mappedData.length) {
                    setCurrentIndex(0);
                }
            } else {
                console.warn("No pending candidates found in Supabase.");
                setCandidates([]);
                setCurrentIndex(0);
            }
        } catch (err) {
            console.error("Failed to fetch candidates from Supabase.", err);
            setCandidates([]);
            setCurrentIndex(0);
        } finally {
            if (showLoader) setIsLoading(false);
        }
    }, [currentIndex]);

    useEffect(() => {
        fetchCandidates({ showLoader: true });
    }, [fetchCandidates]);

    const displayCandidates = useMemo(() => {
        const getTiers = (cand: any) =>
            (cand.interviewNotes || [])
                .map((n: any) => n.interviewer_ranking)
                .filter((r: any): r is string => !!r);

        const filtered = tierFilter === 'all'
            ? candidates
            : candidates.filter((cand) => {
                const tiers = getTiers(cand);
                if (tierFilter === 'unranked') return tiers.length === 0;
                return getConsensusTier(tiers) === tierFilter;
            });

        return [...filtered].sort((a, b) => {
            const tiersA = getTiers(a);
            const tiersB = getTiers(b);

            if (tierFilter !== 'all' && tierFilter !== 'unranked') {
                const countA = tiersA.filter((t: string) => t === tierFilter).length;
                const countB = tiersB.filter((t: string) => t === tierFilter).length;
                if (countA !== countB) return countB - countA;
            }

            const avgA = getTierAverage(tiersA);
            const avgB = getTierAverage(tiersB);
            if (avgA === null && avgB === null) return 0;
            if (avgA === null) return 1;
            if (avgB === null) return -1;
            return avgA - avgB;
        });
    }, [candidates, tierFilter]);

    // Real-time synchronization
    useEffect(() => {
        if (displayCandidates.length === 0) return;

        const fetchInitialState = async () => {
            const { data } = await supabase.from('system_state').select('current_candidate_id').eq('id', 1).single();
            if (data?.current_candidate_id) {
                const idx = displayCandidates.findIndex(c => c.id === data.current_candidate_id);
                if (idx !== -1) setCurrentIndex(idx);
            }
        };
        fetchInitialState();

        const channel = supabase
            .channel('system_state_changes')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'system_state'
            }, payload => {
                const newId = payload.new.current_candidate_id;
                if (newId) {
                    const idx = displayCandidates.findIndex(c => c.id === newId);
                    if (idx !== -1 && idx !== currentIndex) {
                        setDirection(idx > currentIndex ? 1 : -1);
                        setCurrentIndex(idx);
                        setTabDirection(0);
                        setActiveTab('seminar');
                    }
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [displayCandidates]);

    // Poll every 15 seconds + refetch on tab focus + realtime fallback
    useEffect(() => {
        const interval = setInterval(() => fetchCandidates(), 15000);

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                fetchCandidates();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        const channel = supabase
            .channel('delib_interviews_sync')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'interviews',
            }, () => {
                fetchCandidates();
            })
            .subscribe();

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibility);
            supabase.removeChannel(channel);
        };
    }, [fetchCandidates]);

    // Update global state when candidate changes (if admin)
    const syncCurrentCandidateId = async (id: string) => {
        if (!isAdmin) return;
        try {
            await supabase.from('system_state').update({ current_candidate_id: id }).eq('id', 1);
        } catch (err) {
            console.error("Failed to sync system state:", err);
        }
    };

    const safeIndex = displayCandidates.length === 0 ? 0 : Math.min(currentIndex, displayCandidates.length - 1);
    const candidate = displayCandidates[safeIndex];

    const hasSidebarSpace = sidebarHasSpace;

    const nextCandidate = () => {
        if (safeIndex < displayCandidates.length - 1) {
            setDirection(1);
            setCurrentIndex(safeIndex + 1);
            setTabDirection(0);
            setActiveTab('seminar');
            syncCurrentCandidateId(displayCandidates[safeIndex + 1].id);
        }
    };

    const prevCandidate = () => {
        if (safeIndex > 0) {
            setDirection(-1);
            setCurrentIndex(safeIndex - 1);
            setTabDirection(0);
            setActiveTab('seminar');
            syncCurrentCandidateId(displayCandidates[safeIndex - 1].id);
        }
    };

    const handleDecision = async (decision: 'approve' | 'reject' | 'waitlist') => {
        const actionText = decision === 'approve' ? 'Approve' : decision === 'reject' ? 'Reject' : 'Waitlist';
        const isConfirmed = await confirmModal.confirm({
            title: `Confirm Decision`,
            message: `Are you sure you want to ${decision} ${candidate.name}'s application?`,
            confirmText: actionText,
            destructive: decision === 'reject'
        });

        if (isConfirmed) {
            try {
                if (candidate.id && !candidate.id.startsWith('CAND-')) {
                    const status = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'waitlisted';
                    const { data, error } = await supabase
                        .from('candidates')
                        .update({ deliberation_status: status })
                        .eq('id', candidate.id)
                        .eq('deliberation_status', 'pending')
                        .select('id, deliberation_status');
                    if (error) throw error;

                    if (!data || data.length === 0) {
                        console.warn("Decision skipped: candidate already decided by another conductor.");
                        await fetchCandidates({ preserveId: candidate.id });
                        return;
                    }
                }

                const removedId = candidate.id;
                setCandidates(prev => prev.filter(c => c.id !== removedId));
                if (safeIndex >= displayCandidates.length - 1 && safeIndex > 0) {
                    setCurrentIndex(prev => prev - 1);
                }
                setDirection(1);
                setTabDirection(0);
                setActiveTab('seminar');
            } catch (err) {
                console.error("Failed to submit decision:", err);
            }
        }
    };

    const handleTabChange = (nextTab: DeliberationTab) => {
        if (nextTab === activeTab) return;
        const currentIndex = tabOrder.indexOf(activeTab);
        const nextIndex = tabOrder.indexOf(nextTab);
        setTabDirection(nextIndex > currentIndex ? 1 : -1);
        setActiveTab(nextTab);
    };

    const variants = {
        enter: (dir: number) => ({ x: dir > 0 ? 50 : -50, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (dir: number) => ({ x: dir < 0 ? 50 : -50, opacity: 0 }),
    };

    const tabVariants = {
        enter: (dir: number) => ({ x: dir === 0 ? 0 : dir > 0 ? 40 : -40, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (dir: number) => ({ x: dir === 0 ? 0 : dir < 0 ? 40 : -40, opacity: 0 }),
    };

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
        );
    }

    if (!candidate) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-secondary">
                <p>{tierFilter !== 'all' ? 'No candidates match the selected tier filter.' : 'No more candidates to review.'}</p>
                {tierFilter !== 'all' && (
                    <Button variant="secondary" size="sm" onClick={() => { setTierFilter('all'); setCurrentIndex(0); }}>
                        Clear filter
                    </Button>
                )}
            </div>
        );
    }

    const renderProgressBar = (label: string, value: number, max: number = 10, color: string = COLOR_OVERALL) => (
        <div className="mb-3 last:mb-0">
            <div className="flex justify-between text-xs mb-1">
                <span className="text-secondary font-medium">{label}</span>
                <span className="font-semibold">{value.toFixed(1)}/{max}</span>
            </div>
            <div className="w-full bg-surfaceHover h-1.5 rounded-sm overflow-hidden">
                <motion.div
                    className="h-full"
                    style={{ backgroundColor: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(value / max) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 160, damping: 22 }}
                />
            </div>
        </div>
    );

    const writtenScores = [
        candidate.scores.writtenInterest,
        candidate.scores.writtenTeaching,
        candidate.scores.writtenSeminar,
        candidate.scores.writtenPersonal
    ];
    const hasWrittenScores = writtenScores.some(s => s && s > 0);
    const writtenOverall = hasWrittenScores
        ? writtenScores.reduce((sum: number, val: number | undefined) => sum + (val || 0), 0) / writtenScores.length
        : null;

    const interviewOverallScores = (candidate.interviewNotes || [])
        .map((note: any) => (typeof note.score_overall === 'number' ? note.score_overall : null))
        .filter((v: number | null): v is number => v !== null);

    const hasInterviewOverall = interviewOverallScores.length > 0;
    const interviewOverallAvg = hasInterviewOverall
        ? interviewOverallScores.reduce((sum: number, val: number) => sum + val, 0) / interviewOverallScores.length
        : null;

    const overallStandardized =
        interviewOverallAvg != null
            ? interviewOverallAvg
            : typeof candidate.scores.overall === 'number'
                ? candidate.scores.overall
                : null;

    const formatScore = (val: number | null | undefined) => {
        if (val === null || val === undefined) return 'N/A';
        return val.toFixed(1);
    };

    // Chart data for Visualizations tab
    const writtenBarData = [
        { name: 'Interest', score: candidate.scores.writtenInterest ?? 0, fullMark: 5 },
        { name: 'Teaching', score: candidate.scores.writtenTeaching ?? 0, fullMark: 5 },
        { name: 'Seminar', score: candidate.scores.writtenSeminar ?? 0, fullMark: 5 },
        { name: 'Personal', score: candidate.scores.writtenPersonal ?? 0, fullMark: 5 },
    ];
    const interviewBarData = [
        { name: 'Understanding', score: candidate.scores.understanding ?? 0, fullMark: 5 },
        { name: 'Enthusiasm', score: candidate.scores.enthusiasm ?? 0, fullMark: 5 },
        { name: 'Seminar Quality', score: candidate.scores.quality ?? 0, fullMark: 5 },
        { name: 'Teaching', score: candidate.scores.teaching ?? 0, fullMark: 5 },
        { name: 'Interest', score: candidate.scores.interestEngaging ?? 0, fullMark: 5 },
    ];
    const interviewNotesRaw = candidate.interviewNotes || [];

    const interviewerOverallStats: Record<string, { mean: number; std: number; count: number }> = {};
    const scoresByInterviewer: Record<string, number[]> = {};

    candidates.forEach(c => {
        const notes = c.interviewNotes || [];
        notes.forEach((note: any) => {
            const name = note.interviewer || 'Unknown Interviewer';
            const v = typeof note.score_overall === 'number' ? note.score_overall : null;
            if (v == null || Number.isNaN(v)) return;
            if (!scoresByInterviewer[name]) scoresByInterviewer[name] = [];
            scoresByInterviewer[name].push(v);
        });
    });

    Object.entries(scoresByInterviewer).forEach(([name, values]) => {
        if (values.length < 3) return;
        const m = mean(values);
        const sd = stdDev(values);
        interviewerOverallStats[name] = { mean: m, std: sd, count: values.length };
    });

    const interviewNotes = interviewNotesRaw.map((note: any) => {
        const name = note.interviewer || 'Unknown Interviewer';
        const stats = interviewerOverallStats[name];
        let outlier: null | {
            direction: 'high' | 'low';
            zScore: number;
            baselineMean: number;
            baselineCount: number;
        } = null;

        if (stats && typeof note.score_overall === 'number' && stats.std > 0) {
            const z = (note.score_overall - stats.mean) / stats.std;
            if (z >= 2) {
                outlier = {
                    direction: 'high',
                    zScore: z,
                    baselineMean: stats.mean,
                    baselineCount: stats.count,
                };
            } else if (z <= -2) {
                outlier = {
                    direction: 'low',
                    zScore: z,
                    baselineMean: stats.mean,
                    baselineCount: stats.count,
                };
            }
        }

        return {
            ...note,
            outlier,
        };
    });

    // Disagreement across multiple interview dimensions (0–10 standardized scale)
    const disagreementDimensions: { key: keyof any; label: string }[] = [
        { key: 'score_overall', label: 'Overall' },
        { key: 'score_enthusiasm', label: 'Enthusiasm' },
        { key: 'score_quality', label: 'Seminar Quality' },
        { key: 'score_teaching', label: 'Teaching' },
        { key: 'score_interest', label: 'Interest / Engagement' },
    ];

    let maxDisagreementRange = 0;
    let maxDisagreementLabel: string | null = null;

    disagreementDimensions.forEach(dim => {
        const vals = interviewNotes
            .map((note: any) => (typeof note[dim.key] === 'number' ? note[dim.key] : null))
            .filter((v: number | null): v is number => v !== null);
        if (vals.length < 2) return;
        const range = Math.max(...vals) - Math.min(...vals);
        if (range > maxDisagreementRange) {
            maxDisagreementRange = range;
            maxDisagreementLabel = dim.label;
        }
    });

    const hasInterviewerDisagreement = maxDisagreementRange >= 2;
    const disagreementRange = hasInterviewerDisagreement ? maxDisagreementRange : null;
    const disagreementDimension = hasInterviewerDisagreement ? maxDisagreementLabel : null;

    const multiInterviewerChartData = interviewNotes.length >= 2
        ? (['Enthusiasm', 'Quality', 'Teaching', 'Interest', 'Overall'] as const).map(dim => {
            const key = dim === 'Overall' ? 'score_overall' : dim === 'Enthusiasm' ? 'score_enthusiasm' : dim === 'Quality' ? 'score_quality' : dim === 'Teaching' ? 'score_teaching' : 'score_interest';
            const point: Record<string, string | number> = { dimension: dim };
            interviewNotes.forEach((note: any, i: number) => {
                const label = note.interviewer || `Interviewer ${i + 1}`;
                point[label] = typeof (note as any)[key] === 'number' ? (note as any)[key] : 0;
            });
            return point;
        })
        : [];

    // Cohort distributions for percentile / PMF charts (all pending candidates)
    const cohortOverallScores = candidates
        .map(c => {
            const notes = c.interviewNotes || [];
            const perInterview = notes
                .map((note: any) => (typeof note.score_overall === 'number' ? note.score_overall : null))
                .filter((v: number | null): v is number => v !== null);

            if (perInterview.length > 0) {
                return perInterview.reduce((sum: number, v: number) => sum + v, 0) / perInterview.length;
            }

            const fallback = c.scores?.overall;
            return typeof fallback === 'number' ? fallback : null;
        })
        .filter((v: number | null): v is number => v !== null);

    const cohortWrittenAverages = candidates
        .map(c => {
            const vals = [
                c.scores?.writtenInterest ?? null,
                c.scores?.writtenTeaching ?? null,
                c.scores?.writtenSeminar ?? null,
                c.scores?.writtenPersonal ?? null,
            ].filter((v: number | null) => typeof v === 'number' && v > 0) as number[];

            if (!vals.length) return null;
            return vals.reduce((sum, v) => sum + v, 0) / vals.length;
        })
        .filter((v: number | null): v is number => v !== null);

    const cohortEmpiricalScores = candidates
        .map(c => c.scores?.empirical)
        .filter((v: unknown): v is number => typeof v === 'number');

    let currentOverall = overallStandardized;
    let currentEmpirical = typeof candidate.scores?.empirical === 'number' ? candidate.scores.empirical : null;
    const currentWrittenAvg = writtenOverall;

    if (percentileInterviewer !== 'all') {
        const note = interviewNotes.find(
            (n: any) => (n.interviewer || 'Unknown Interviewer') === percentileInterviewer
        );
        if (note) {
            if (typeof note.score_overall === 'number') {
                currentOverall = note.score_overall;
            }
            if (typeof note.score_empirical === 'number') {
                currentEmpirical = note.score_empirical;
            }
        }
    }

    const overallKdeData = kernelDensity(cohortOverallScores, 0, 10, 0.2, 0.5);
    const writtenAvgKdeData = kernelDensity(cohortWrittenAverages, 0, 5, 0.1, 0.25);
    const empiricalKdeData = kernelDensity(cohortEmpiricalScores, 0, 10, 0.2, 0.5);

    const overallCdfData = computeCdf(cohortOverallScores, 0, 10, 0.2);
    const writtenAvgCdfData = computeCdf(cohortWrittenAverages, 0, 5, 0.1);
    const empiricalCdfData = computeCdf(cohortEmpiricalScores, 0, 10, 0.2);

    const overallPercentile = currentOverall != null ? percentile(cohortOverallScores, currentOverall) : null;
    const writtenAvgPercentile =
        currentWrittenAvg != null && cohortWrittenAverages.length > 0 ? percentile(cohortWrittenAverages, currentWrittenAvg) : null;
    const empiricalPercentile =
        currentEmpirical != null && cohortEmpiricalScores.length > 0 ? percentile(cohortEmpiricalScores, currentEmpirical) : null;

    const chartTopMargin = 32;

    const resyncFromConductor = async () => {
        if (!displayCandidates.length) return;
        try {
            const { data, error } = await supabase
                .from('system_state')
                .select('current_candidate_id')
                .eq('id', 1)
                .single();

            if (error) {
                console.error('Failed to fetch system_state for resync:', error);
                return;
            }

            const newId = data?.current_candidate_id;
            if (!newId) return;

            const idx = displayCandidates.findIndex(c => c.id === newId);
            if (idx === -1 || idx === currentIndex) return;

            setDirection(idx > currentIndex ? 1 : -1);
            setCurrentIndex(idx);
            setTabDirection(0);
            setActiveTab('seminar');
        } catch (err) {
            console.error('Error during resyncFromConductor:', err);
        }
    };

    return (
        <div className="h-full min-h-0 flex flex-col gap-6">
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-primary tracking-tight">
                        Application Review {isAdmin && <span className="ml-2 px-2 py-0.5 bg-accent/20 text-accent text-[10px] uppercase rounded border border-accent/30">Conductor</span>}
                    </h1>
                    <p className="text-sm text-secondary mt-1">Reviewing candidate {safeIndex + 1} of {displayCandidates.length}{tierFilter !== 'all' ? ` (filtered)` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-40 shrink-0">
                        <Select
                            value={tierFilter}
                            onChange={(val) => { setTierFilter(val); setCurrentIndex(0); }}
                            options={[
                                { value: 'all', label: 'All tiers' },
                                { value: 'auto_accept', label: 'Auto Accept' },
                                { value: 'tier_1', label: 'Tier 1' },
                                { value: 'tier_2', label: 'Tier 2' },
                                { value: 'tier_3', label: 'Tier 3' },
                                { value: 'tier_4', label: 'Tier 4' },
                                { value: 'unranked', label: 'Unranked' },
                            ]}
                        />
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={resyncFromConductor}
                    >
                        <RefreshCw className="w-4 h-4 mr-1" /> Sync to Conductor
                    </Button>
                    {isAdmin && (
                        <>
                            <Button variant="secondary" size="sm" onClick={prevCandidate} disabled={safeIndex === 0}>
                                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                            </Button>
                            <Button variant="secondary" size="sm" onClick={nextCandidate} disabled={safeIndex === displayCandidates.length - 1}>
                                Next <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 min-h-0 relative overflow-hidden">
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={candidate.id}
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="h-full absolute inset-0 w-full min-h-0"
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-0 pb-2">

                            {/* Left Column: Candidate Profile & Standardized Scores */}
                            <AnimatePresence
                                initial={false}
                                onExitComplete={() => setSidebarHasSpace(false)}
                            >
                                {isSidebarOpen && (
                                    <motion.div
                                        key="deliberation-sidebar"
                                        initial={{ opacity: 0, x: -12 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -12 }}
                                        transition={{ type: 'spring', stiffness: 220, damping: 26 }}
                                        className="lg:col-span-3 flex flex-col h-full min-h-0 relative overflow-visible"
                                    >
                                        {/* Collapse handle: attached to right edge of sidebar */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsSidebarOpen(false);
                                            }}
                                            className="absolute top-6 right-0 z-10 w-6 h-10 flex items-center justify-center rounded-l-sm border border-r-0 border-border bg-surface hover:bg-surfaceHover text-muted hover:text-primary shadow-sm transition-colors"
                                            title="Collapse panel"
                                            aria-label="Collapse panel"
                                        >
                                            <ChevronLeft className="w-3.5 h-3.5" />
                                        </button>
                                        <div className="flex flex-col gap-3 h-full min-h-0 overflow-y-auto overflow-x-visible pr-1">
                                            <Card className="flex flex-col shrink-0">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-3">
                                                        <h2 className="text-2xl font-bold text-primary">{candidate.name}</h2>
                                                        {/* <span className={`px-2 py-1 text-xs font-bold rounded-full ${candidate.candidateType === 'Returning' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                                                            {candidate.candidateType}
                                                        </span> */}
                                                        {hasInterviewerDisagreement && disagreementRange != null && (
                                                            <ScoreTooltip
                                                                label="Interviewer disagreement"
                                                                lines={[
                                                                    'Interviewers significantly disagree on this candidate on at least one interview dimension.',
                                                                    disagreementDimension
                                                                        ? `Largest disagreement is on ${disagreementDimension}: range ${disagreementRange.toFixed(1)} (scale 0–10).`
                                                                        : `Range across interviews: ${disagreementRange.toFixed(1)} (scale 0–10).`,
                                                                ]}
                                                            >
                                                                <span className="px-2 py-0.5 rounded-sm bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-100 text-[10px] font-semibold tracking-wide uppercase">
                                                                    Interviewer disagreement
                                                                </span>
                                                            </ScoreTooltip>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="space-y-2 mt-2">
                                                    <div className="flex items-center text-sm text-secondary">
                                                        <GraduationCap className="w-4 h-4 mr-3 text-muted shrink-0" />
                                                        {candidate.school}, {formatClassYear(candidate.year)}
                                                    </div>
                                                    {candidate.nationality && (
                                                        <div className="flex items-center text-sm text-secondary">
                                                            <MapPin className="w-4 h-4 mr-3 text-muted shrink-0" />
                                                            <span className="truncate">From {candidate.nationality}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center text-sm text-secondary">
                                                        <Mail className="w-4 h-4 mr-3 text-muted shrink-0" />
                                                        <span className="truncate">{candidate.email}</span>
                                                    </div>
                                                </div>
                                                <div className="mt-4 pt-4 border-t border-border">
                                                    <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-1">Major / Concentration</p>
                                                    <p className="text-sm font-medium text-primary">{candidate.major}</p>
                                                </div>

                                                {candidate.interviewNotes && candidate.interviewNotes.some((n: any) => n.interviewer_ranking) && (
                                                    <div className="mt-4 pt-4 border-t border-border">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Interviewer Rankings</p>
                                                            {(() => {
                                                                const consensus = getConsensusTier(
                                                                    candidate.interviewNotes.map((n: any) => n.interviewer_ranking)
                                                                );
                                                                if (!consensus) return null;
                                                                return (
                                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${TIER_COLOR[consensus]}`}>
                                                                        Avg: {TIER_LABEL[consensus]}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </div>
                                                        <div className="flex flex-col gap-1.5">
                                                            {candidate.interviewNotes
                                                                .filter((n: any) => n.interviewer_ranking)
                                                                .map((n: any, i: number) => (
                                                                    <div key={i} className="flex items-center justify-between gap-2">
                                                                        <span className="text-xs text-secondary truncate">{n.interviewer || 'Unknown'}</span>
                                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${TIER_COLOR[n.interviewer_ranking] || 'bg-surface text-secondary'}`}>
                                                                            {TIER_LABEL[n.interviewer_ranking] || n.interviewer_ranking}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Travel Preferences */}
                                                {(candidate.flyFrom || candidate.flyTo || candidate.availability) && (
                                                    <div className="mt-4 pt-4 border-t border-border">
                                                        <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">Travel & Availability</p>

                                                        {candidate.flyFrom && (
                                                            <div className="flex items-center justify-between text-sm text-secondary mb-1">
                                                                <span>Fly From:</span>
                                                                <span className="font-medium text-primary">{candidate.flyFrom}</span>
                                                            </div>
                                                        )}
                                                        {candidate.flyTo && (
                                                            <div className="flex items-center justify-between text-sm text-secondary mb-1">
                                                                <span>Fly To:</span>
                                                                <span className="font-medium text-primary">{candidate.flyTo}</span>
                                                            </div>
                                                        )}
                                                        {candidate.availability && (
                                                            <div className="flex items-center justify-between text-sm text-secondary mb-1">
                                                                <span>Availability:</span>
                                                                <span className="font-medium text-primary text-right max-w-[150px]">{candidate.availability}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Removed Decision Buttons from here */}
                                            </Card>

                                            {interviewNotes.length >= 2 && (
                                                <div className="flex items-center justify-center gap-1 py-0.5 overflow-visible relative">
                                                    {[
                                                        { key: 'all', label: 'All' },
                                                        ...interviewNotes.map((note: any, idx: number) => ({
                                                            key: note.interviewer || `Interviewer ${idx + 1}`,
                                                            label: note.interviewer || `Interviewer ${idx + 1}`,
                                                        })),
                                                    ].map((opt) => {
                                                        const isSelected = percentileInterviewer === opt.key;
                                                        return (
                                                            <button
                                                                key={opt.key}
                                                                type="button"
                                                                onClick={() => setPercentileInterviewer(opt.key)}
                                                                className="relative px-2 py-0.5 rounded-sm text-[10px] font-medium truncate min-w-0"
                                                            >
                                                                {isSelected && (
                                                                    <motion.span
                                                                        layoutId="percentilePill"
                                                                        className="absolute inset-0 rounded-sm bg-surfaceHover border border-border"
                                                                        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                                                                    />
                                                                )}
                                                                <span className={`relative z-10 ${isSelected ? 'text-primary' : 'text-secondary hover:text-primary'}`}>
                                                                    {opt.label}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            <Card className="flex-1 flex flex-col mb-4">
                                                <div className="mb-4 shrink-0">
                                                    <div className="flex items-center gap-3">
                                                        <span className="block flex-1 border-t border-border" aria-hidden="true" />
                                                        <p className="text-[11px] font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                                                            Standardized Scores
                                                        </p>
                                                        <span className="block flex-1 border-t border-border" aria-hidden="true" />
                                                    </div>

                                                    <div className="mt-2 grid grid-cols-1 gap-3">
                                                        {/* Overall standardized (interview-based) */}
                                                        <div>
                                                            <div className="mb-0.5">
                                                                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Overall</span>
                                                            </div>
                                                            <div className="flex items-baseline w-full gap-2">
                                                                <div className="flex items-baseline gap-2">
                                                                    <ScoreTooltip
                                                                        label="Overall"
                                                                        lines={[
                                                                            'Average standardized overall score across all interviews for this candidate.',
                                                                            'Standardized by interviewer.',
                                                                            'Scale: 0–10.',
                                                                        ]}
                                                                    >
                                                                        <span className="text-3xl font-semibold text-primary">
                                                                            {currentOverall != null ? currentOverall.toFixed(1) : '—'}
                                                                        </span>
                                                                    </ScoreTooltip>
                                                                    <span className="text-xs text-secondary">/ 10</span>
                                                                </div>
                                                                <span className="ml-auto">
                                                                    <PercentileMini percentileValue={overallPercentile} color={COLOR_OVERALL} label="Overall" />
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Empirical standardized score */}
                                                        {currentEmpirical != null && (
                                                            <div>
                                                                <div className="mb-0.5">
                                                                    <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Empirical</span>
                                                                </div>
                                                                <div className="flex items-baseline w-full gap-2">
                                                                    <div className="flex items-baseline gap-2">
                                                                        <ScoreTooltip
                                                                            label="Empirical"
                                                                            lines={[
                                                                                'Weighted standardized metric combining written + interview + overall into one score.',
                                                                                'Standardized by interviewer.',
                                                                                'Scale: 0–10.',
                                                                            ]}
                                                                        >
                                                                            <span className="text-3xl font-semibold text-primary">
                                                                                {currentEmpirical.toFixed(1)}
                                                                            </span>
                                                                        </ScoreTooltip>
                                                                        <span className="text-xs text-secondary">/ 10</span>
                                                                    </div>
                                                                    <span className="ml-auto">
                                                                        <PercentileMini
                                                                            percentileValue={empiricalPercentile}
                                                                            color={COLOR_EMPIRICAL}
                                                                            label="Empirical"
                                                                        />
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Written overall (average of dimensions) */}
                                                        {hasWrittenScores && (
                                                            <div>
                                                                <div className="mb-0.5">
                                                                    <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Written</span>
                                                                </div>
                                                                <div className="flex items-baseline w-full gap-2">
                                                                    <div className="flex items-baseline gap-2">
                                                                        <ScoreTooltip
                                                                            label="Written"
                                                                            lines={[
                                                                                'Average of the 4 written scores (interest, teaching, seminar, personal).',
                                                                                'Standardized across the cohort.',
                                                                                'Scale: 0–5.',
                                                                            ]}
                                                                        >
                                                                            <span className="text-3xl font-semibold text-primary">
                                                                                {writtenOverall != null ? writtenOverall.toFixed(2) : '—'}
                                                                            </span>
                                                                        </ScoreTooltip>
                                                                        <span className="text-xs text-secondary">/ 5</span>
                                                                    </div>
                                                                    <span className="ml-auto">
                                                                        <PercentileMini
                                                                            percentileValue={writtenAvgPercentile}
                                                                            color={COLOR_WRITTEN}
                                                                            label="Written"
                                                                        />
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="space-y-1 mb-4">
                                                    <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">Written Scores (out of 5)</p>
                                                    {renderProgressBar('Interest', candidate.scores.writtenInterest, 5, COLOR_WRITTEN)}
                                                    {renderProgressBar('Teaching', candidate.scores.writtenTeaching, 5, COLOR_WRITTEN)}
                                                    {renderProgressBar('Seminar', candidate.scores.writtenSeminar, 5, COLOR_WRITTEN)}
                                                    {renderProgressBar('Personal', candidate.scores.writtenPersonal, 5, COLOR_WRITTEN)}

                                                    <div className="mt-3 pt-3 border-t border-border">
                                                        <p className="text-xs font-semibold text-muted mb-1">Graded By: {candidate.grader}</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-1 mb-2">
                                                    <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                                                        Interview Scores{percentileInterviewer !== 'all' ? ` — ${percentileInterviewer}` : ''} (out of 5)
                                                    </p>
                                                    {(() => {
                                                        const selectedNote = percentileInterviewer !== 'all'
                                                            ? interviewNotes.find((n: any) => (n.interviewer || 'Unknown Interviewer') === percentileInterviewer)
                                                            : null;
                                                        const u = selectedNote ? (selectedNote.score_understanding ?? 0) : (candidate.scores.understanding ?? 0);
                                                        const e = selectedNote ? (selectedNote.score_enthusiasm ?? 0) : (candidate.scores.enthusiasm ?? 0);
                                                        const q = selectedNote ? (selectedNote.score_quality ?? 0) : (candidate.scores.quality ?? 0);
                                                        const t = selectedNote ? (selectedNote.score_teaching ?? 0) : (candidate.scores.teaching ?? 0);
                                                        const i = selectedNote ? (selectedNote.score_interest ?? 0) : (candidate.scores.interestEngaging ?? 0);
                                                        return (
                                                            <>
                                                                {renderProgressBar('Understanding', u, 5, COLOR_OVERALL)}
                                                                {renderProgressBar('Enthusiasm', e, 5, COLOR_OVERALL)}
                                                                {renderProgressBar('Seminar Quality', q, 5, COLOR_OVERALL)}
                                                                {renderProgressBar('Teaching', t, 5, COLOR_OVERALL)}
                                                                {renderProgressBar('Extracurriculars / Interest', i, 5, COLOR_OVERALL)}
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </Card>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Right Column: Detailed Context Tabs */}
                            <motion.div
                                layout
                                transition={{ layout: { duration: 0.28, ease: 'easeOut' }, delay: 0.08 }}
                                className={`${hasSidebarSpace ? 'lg:col-span-9' : 'lg:col-span-12'} flex flex-col h-full bg-white dark:bg-surface border border-border rounded-sm shadow-sm overflow-hidden transition-all duration-300 relative`}
                                initial={false}
                            >
                                {/* Expand handle when sidebar is fully collapsed */}
                                {!sidebarHasSpace && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSidebarHasSpace(true);
                                            setIsSidebarOpen(true);
                                        }}
                                        className="absolute top-6 left-0 z-10 w-6 h-10 flex items-center justify-center rounded-r-sm border border-l-0 border-border bg-surface hover:bg-surfaceHover text-muted hover:text-primary shadow-sm transition-colors"
                                        title="Expand panel"
                                        aria-label="Expand panel"
                                    >
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {/* Tab Navigation */}
                                <div className="flex border-b border-border px-2 pt-2 bg-surface/50 dark:bg-surfaceHover/30">
                                    {[
                                        { id: 'seminar', label: 'Seminar Proposal', icon: FileText },
                                        { id: 'written', label: 'Written App', icon: MessageSquare },
                                        { id: 'interview', label: 'Interview Notes', icon: User },
                                        { id: 'visualizations', label: 'Visualizations', icon: BarChart2 }
                                    ].map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => handleTabChange(tab.id as any)}
                                            className={`relative px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === tab.id ? 'text-accent' : 'text-secondary hover:text-primary'}`}
                                        >
                                            {activeTab === tab.id && (
                                                <motion.div
                                                    layoutId="delib-tab-highlight"
                                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"
                                                    initial={false}
                                                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                                                />
                                            )}
                                            <tab.icon className="w-4 h-4 relative z-10" />
                                            <span className="relative z-10">{tab.label}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* Tab Content Area (Scrollable) */}
                                <div className="flex-1 min-h-0 relative overflow-hidden">
                                    <AnimatePresence mode="wait" custom={tabDirection}>
                                        <motion.div
                                            key={activeTab}
                                            custom={tabDirection}
                                            variants={tabVariants}
                                            initial="enter"
                                            animate="center"
                                            exit="exit"
                                            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                                            className="h-full min-h-0 overflow-y-auto p-6 md:p-8"
                                        >
                                            {activeTab === 'seminar' && (
                                                <div className="space-y-8">
                                                    <div>
                                                        <div className="inline-block px-2.5 py-1 bg-accent/10 text-accent rounded-sm text-xs font-semibold tracking-wide mb-3">
                                                            {candidate.seminarCategory}
                                                        </div>
                                                        {/* <h2 className="text-2xl font-bold text-primary">{candidate.seminarTitle}</h2> */}
                                                        <h2 className="text-2xl font-bold text-primary truncate max-w-[60ch]">
                                                            {candidate.seminarTitle}
                                                        </h2>
                                                    </div>

                                                    <div>
                                                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-2">Course Description</h3>
                                                        <p className="text-md text-primary leading-relaxed bg-surface/50 dark:bg-surfaceHover p-4 rounded-sm border border-border">
                                                            {candidate.seminarDescription}
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-2">Tangible Final Product</h3>
                                                        <p className="text-sm text-primary leading-relaxed bg-surface/50 dark:bg-surfaceHover p-4 rounded-sm border border-border">
                                                            {candidate.finalProduct}
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-2">Other Potential Topics</h3>
                                                        <p className="text-sm text-primary p-2">
                                                            {candidate.moreTopics}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {activeTab === 'written' && (
                                                <div className="space-y-8">
                                                    <div>
                                                        <h3 className="text-sm font-semibold text-primary mb-2">Self Introduction & Achievements</h3>
                                                        <p className="text-sm text-primary leading-relaxed p-3 bg-surface rounded-sm border border-border">
                                                            {candidate.selfIntro}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-semibold text-primary mb-2">Interest in HSYLC Mission</h3>
                                                        <p className="text-sm text-primary leading-relaxed p-3 bg-surface rounded-sm border border-border">
                                                            {candidate.interestReason}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-semibold text-primary mb-2">Teaching & Mentoring Experience</h3>
                                                        <p className="text-sm text-primary leading-relaxed p-3 bg-surface rounded-sm border border-border">
                                                            {candidate.teachingExp}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-semibold text-primary mb-2">Advice for a High Schooler</h3>
                                                        <p className="text-sm text-primary leading-relaxed p-3 bg-surface rounded-sm border border-border text-center italic">
                                                            "{candidate.advice}"
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {activeTab === 'interview' && (
                                                <div className="space-y-8">
                                                    {candidate.sensitiveIssues && candidate.sensitiveIssues.toLowerCase() !== 'no' && (
                                                        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 border border-orange-200 dark:border-orange-800 rounded-sm">
                                                            <h4 className="text-sm font-bold mb-1 flex items-center gap-2">⚠️ Sensitive Topics Alert</h4>
                                                            <p className="text-sm">{candidate.sensitiveIssues}</p>
                                                        </div>
                                                    )}

                                                    {!candidate.interviewNotes || candidate.interviewNotes.length === 0 ? (
                                                        <div className="text-center text-secondary py-8">
                                                            No interviews have been recorded for this candidate yet.
                                                        </div>
                                                    ) : (
                                                        <div className={`grid ${interviewNotes.length === 1 ? 'grid-cols-1' : interviewNotes.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'} gap-0 md:gap-8 divide-y md:divide-y-0 md:divide-x divide-border`}>
                                                            {interviewNotes.map((note: any, index: number) => (
                                                                <div key={index} className="first:pl-0 last:pr-0 md:px-6 md:first:px-3 md:last:px-3 pt-6 first:pt-0 md:pt-0 pb-6 md:pb-0">
                                                                    <div className="flex items-center justify-between gap-3 mb-4">
                                                                        <div className="flex items-center gap-2">
                                                                            <User className="w-4 h-4 text-accent" />
                                                                            <span className="font-semibold text-primary">{note.interviewer || 'Unknown Interviewer'}</span>
                                                                            {note.interviewer_ranking && (
                                                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${TIER_COLOR[note.interviewer_ranking] || 'bg-surface text-secondary'}`}>
                                                                                    {TIER_LABEL[note.interviewer_ranking] || note.interviewer_ranking}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-secondary">
                                                                            <span>Enth <span className="font-semibold text-primary">{formatScore(note.score_enthusiasm)}</span></span>
                                                                            <span>Qual <span className="font-semibold text-primary">{formatScore(note.score_quality)}</span></span>
                                                                            <span>Teach <span className="font-semibold text-primary">{formatScore(note.score_teaching)}</span></span>
                                                                            <span>Int <span className="font-semibold text-primary">{formatScore(note.score_interest)}</span></span>
                                                                            <span className="px-2 py-0.5 rounded-sm bg-accent/10 text-accent font-semibold">
                                                                                Overall {formatScore(note.score_overall)}
                                                                            </span>
                                                                            {note.outlier && note.outlier.direction === 'high' && (
                                                                                <ScoreTooltip
                                                                                    label="Anomalously high score for this interviewer"
                                                                                    lines={[
                                                                                        'This interviewer usually scores candidates lower than this.',
                                                                                        `Their typical standardized overall score is around ${note.outlier.baselineMean.toFixed(1)} across ${note.outlier.baselineCount} candidates.`,
                                                                                        `This candidate is ${note.outlier.zScore.toFixed(1)} standard deviations above that.`,
                                                                                    ]}
                                                                                >
                                                                                    <span className="px-2 py-0.5 rounded-sm bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-100 font-semibold">
                                                                                        Unusually high for this interviewer
                                                                                    </span>
                                                                                </ScoreTooltip>
                                                                            )}
                                                                            {note.sensitiveFlag && (
                                                                                <span className="px-2 py-0.5 rounded-sm bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-100 font-semibold">
                                                                                    Sensitive
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-6">
                                                                        <div>
                                                                            <h4 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">Why SL & Understanding</h4>
                                                                            <p className="text-sm text-primary leading-relaxed">{note.notes_why_sl || '—'}</p>
                                                                        </div>
                                                                        <div>
                                                                            <h4 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">Seminar Feedback</h4>
                                                                            <p className="text-sm text-primary leading-relaxed">{note.notes_seminar || '—'}</p>
                                                                        </div>
                                                                        <div>
                                                                            <h4 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">Extracurricular Impact</h4>
                                                                            <p className="text-sm text-primary leading-relaxed">{note.notes_extracurricular || '—'}</p>
                                                                        </div>
                                                                        <div>
                                                                            <h4 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">Cross-Cultural Exchange</h4>
                                                                            <p className="text-sm text-primary leading-relaxed">{note.notes_cross_cultural || '—'}</p>
                                                                        </div>
                                                                        <div>
                                                                            <h4 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">"Teach Me in 2 Minutes"</h4>
                                                                            <p className="text-sm text-primary leading-relaxed">{note.notes_teach_me || '—'}</p>
                                                                        </div>
                                                                        <div>
                                                                            <h4 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">Spring/Summer Commitment</h4>
                                                                            <p className="text-sm text-primary leading-relaxed">{note.notes_commitment || '—'}</p>
                                                                        </div>
                                                                        {(note.availabilityAnswer || note.flyFromInterview || note.flyToInterview) && (
                                                                            <div>
                                                                                <h4 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">Logistics (Interview)</h4>
                                                                                {note.availabilityAnswer && (
                                                                                    <p className="text-sm text-primary leading-relaxed mb-1">
                                                                                        {note.availabilityAnswer}
                                                                                    </p>
                                                                                )}
                                                                                {(note.availabilityShenzhen || note.availabilityShanghai || note.availabilityHangzhou || note.availabilityBeijing) && (
                                                                                    <p className="text-xs text-secondary mb-1">
                                                                                        Cities:{' '}
                                                                                        <span className="font-medium text-primary">
                                                                                            {[
                                                                                                note.availabilityShenzhen && 'Shenzhen',
                                                                                                note.availabilityShanghai && 'Shanghai',
                                                                                                note.availabilityHangzhou && 'Hangzhou',
                                                                                                note.availabilityBeijing && 'Beijing',
                                                                                            ]
                                                                                                .filter(Boolean)
                                                                                                .join(', ')}
                                                                                        </span>
                                                                                    </p>
                                                                                )}
                                                                                {note.flyFromInterview && (
                                                                                    <p className="text-xs text-secondary mb-1">
                                                                                        Fly from:{' '}
                                                                                        <span className="font-medium text-primary">{note.flyFromInterview}</span>
                                                                                    </p>
                                                                                )}
                                                                                {note.flyToInterview && (
                                                                                    <p className="text-xs text-secondary">
                                                                                        Fly to:{' '}
                                                                                        <span className="font-medium text-primary">{note.flyToInterview}</span>
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                        <div className="pt-4 border-t border-border">
                                                                            <h4 className="text-xs font-semibold text-accent uppercase tracking-wider mb-2">Overall Comments</h4>
                                                                            <p className="text-sm font-medium text-primary leading-relaxed">{note.notes_comments || '—'}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {activeTab === 'visualizations' && (
                                                <div className="space-y-10">
                                                    {/* Written vs Interview vs Empirical summary */}
                                                    <div className="flex flex-col gap-3">
                                                        {interviewNotes.length >= 2 && (
                                                            <div className="flex items-center justify-end gap-2">
                                                                <span className="text-[11px] text-secondary uppercase tracking-wide">
                                                                    Percentiles based on
                                                                </span>
                                                                <div className="flex flex-wrap gap-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setPercentileInterviewer('all')}
                                                                        className={`px-2 py-0.5 rounded-sm text-[10px] font-medium border ${
                                                                            percentileInterviewer === 'all'
                                                                                ? 'bg-surfaceHover text-primary border-border'
                                                                                : 'bg-transparent text-secondary border-border/60 hover:bg-surfaceHover/60'
                                                                        }`}
                                                                    >
                                                                        All interviews
                                                                    </button>
                                                                    {interviewNotes.map((note: any, idx: number) => {
                                                                        const name = note.interviewer || `Interviewer ${idx + 1}`;
                                                                        const selected = percentileInterviewer === name;
                                                                        return (
                                                                            <button
                                                                                key={name || idx}
                                                                                type="button"
                                                                                onClick={() => setPercentileInterviewer(name)}
                                                                                className={`px-2 py-0.5 rounded-sm text-[10px] font-medium border ${
                                                                                    selected
                                                                                        ? 'bg-surfaceHover text-primary border-border'
                                                                                        : 'bg-transparent text-secondary border-border/60 hover:bg-surfaceHover/60'
                                                                                }`}
                                                                            >
                                                                                {name}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                            <motion.div
                                                            initial={{ opacity: 0, y: 8 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ type: 'spring', stiffness: 220, damping: 26 }}
                                                            className="p-4 rounded-sm border border-border bg-surface/50 dark:bg-surfaceHover/30"
                                                        >
                                                            <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">Written application (avg)</p>
                                                            <div className="flex items-baseline gap-2">
                                                                <span className="text-2xl font-bold text-primary">{writtenOverall != null ? writtenOverall.toFixed(2) : '—'}</span>
                                                                <span className="text-sm text-secondary">/ 5</span>
                                                            </div>
                                                            <p className="mt-1 text-xs text-secondary">
                                                                Percentile: {writtenAvgPercentile != null ? `${writtenAvgPercentile}th` : '—'}
                                                            </p>
                                                            {hasWrittenScores && (
                                                                <div className="mt-3 space-y-2">
                                                                    <div className="flex items-center justify-between text-[11px] text-secondary">
                                                                        <span>Absolute score</span>
                                                                        <span className="tabular-nums">
                                                                            {writtenOverall != null ? writtenOverall.toFixed(2) : '—'}/5
                                                                        </span>
                                                                    </div>
                                                                    <div className="h-2 w-full bg-surfaceHover rounded-sm overflow-hidden">
                                                                        <motion.div
                                                                            className="h-full rounded-sm bg-gray-400/80 dark:bg-gray-300/70"
                                                                            initial={{ width: 0 }}
                                                                            animate={{ width: String(((writtenOverall ?? 0) / 5) * 100) + '%' }}
                                                                            transition={{ type: 'spring', stiffness: 160, damping: 22 }}
                                                                        />
                                                                    </div>
                                                                    <div className="flex items-center justify-between text-[11px] text-secondary">
                                                                        <span>Percentile</span>
                                                                        <span className="tabular-nums">
                                                                            {writtenAvgPercentile != null ? `${writtenAvgPercentile}th` : '—'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="h-2 w-full bg-surfaceHover rounded-sm overflow-hidden">
                                                                        <motion.div
                                                                            className="h-full rounded-sm"
                                                                            style={{ backgroundColor: COLOR_WRITTEN }}
                                                                            initial={{ width: 0 }}
                                                                            animate={{ width: String(writtenAvgPercentile ?? 0) + '%' }}
                                                                            transition={{ type: 'spring', stiffness: 160, damping: 22 }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </motion.div>
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 8 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ type: 'spring', stiffness: 220, damping: 26, delay: 0.05 }}
                                                            className="p-4 rounded-sm border border-border bg-surface/50 dark:bg-surfaceHover/30"
                                                        >
                                                            <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                                                                Interview ({percentileInterviewer !== 'all' ? percentileInterviewer : 'avg overall'})
                                                            </p>
                                                            <div className="flex items-baseline gap-2">
                                                                <span className="text-2xl font-bold text-primary">{currentOverall != null ? currentOverall.toFixed(2) : '—'}</span>
                                                                <span className="text-sm text-secondary">/ 10</span>
                                                            </div>
                                                            <p className="mt-1 text-xs text-secondary">
                                                                Percentile: {overallPercentile != null ? `${overallPercentile}th` : '—'}
                                                            </p>
                                                            {currentOverall != null && (
                                                                <div className="mt-3 space-y-2">
                                                                    <div className="flex items-center justify-between text-[11px] text-secondary">
                                                                        <span>Absolute score</span>
                                                                        <span className="tabular-nums">
                                                                            {currentOverall != null ? currentOverall.toFixed(2) : '—'}/10
                                                                        </span>
                                                                    </div>
                                                                    <div className="h-2 w-full bg-surfaceHover rounded-sm overflow-hidden">
                                                                        <motion.div
                                                                            className="h-full rounded-sm bg-gray-400/80 dark:bg-gray-300/70"
                                                                            initial={{ width: 0 }}
                                                                            animate={{ width: String(((currentOverall ?? 0) / 10) * 100) + '%' }}
                                                                            transition={{ type: 'spring', stiffness: 160, damping: 22 }}
                                                                        />
                                                                    </div>
                                                                    <div className="flex items-center justify-between text-[11px] text-secondary">
                                                                        <span>Percentile</span>
                                                                        <span className="tabular-nums">
                                                                            {overallPercentile != null ? `${overallPercentile}th` : '—'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="h-2 w-full bg-surfaceHover rounded-sm overflow-hidden">
                                                                        <motion.div
                                                                            className="h-full rounded-sm"
                                                                            style={{ backgroundColor: COLOR_OVERALL }}
                                                                            initial={{ width: 0 }}
                                                                            animate={{ width: String(overallPercentile ?? 0) + '%' }}
                                                                            transition={{ type: 'spring', stiffness: 160, damping: 22 }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </motion.div>
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 8 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ type: 'spring', stiffness: 220, damping: 26, delay: 0.1 }}
                                                            className="p-4 rounded-sm border border-border bg-surface/50 dark:bg-surfaceHover/30"
                                                        >
                                                            <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                                                                Empirical ({percentileInterviewer !== 'all' ? percentileInterviewer : 'overall'})
                                                            </p>
                                                            <div className="flex items-baseline gap-2">
                                                                <span className="text-2xl font-bold text-primary">{currentEmpirical != null ? currentEmpirical.toFixed(1) : '—'}</span>
                                                                <span className="text-sm text-secondary">/ 10</span>
                                                            </div>
                                                            <p className="mt-1 text-xs text-secondary">
                                                                Percentile: {empiricalPercentile != null ? `${empiricalPercentile}th` : '—'}
                                                            </p>
                                                            {currentEmpirical != null && (
                                                                <div className="mt-3 space-y-2">
                                                                    <div className="flex items-center justify-between text-[11px] text-secondary">
                                                                        <span>Absolute score</span>
                                                                        <span className="tabular-nums">
                                                                            {currentEmpirical != null ? currentEmpirical.toFixed(1) : '—'}/10
                                                                        </span>
                                                                    </div>
                                                                    <div className="h-2 w-full bg-surfaceHover rounded-sm overflow-hidden">
                                                                        <motion.div
                                                                            className="h-full rounded-sm bg-gray-400/80 dark:bg-gray-300/70"
                                                                            initial={{ width: 0 }}
                                                                            animate={{ width: String((currentEmpirical / 10) * 100) + '%' }}
                                                                            transition={{ type: 'spring', stiffness: 160, damping: 22 }}
                                                                        />
                                                                    </div>
                                                                    <div className="flex items-center justify-between text-[11px] text-secondary">
                                                                        <span>Percentile</span>
                                                                        <span className="tabular-nums">
                                                                            {empiricalPercentile != null ? `${empiricalPercentile}th` : '—'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="h-2 w-full bg-surfaceHover rounded-sm overflow-hidden">
                                                                        <motion.div
                                                                            className="h-full rounded-sm"
                                                                            style={{ backgroundColor: COLOR_EMPIRICAL }}
                                                                            initial={{ width: 0 }}
                                                                            animate={{ width: String(empiricalPercentile ?? 0) + '%' }}
                                                                            transition={{ type: 'spring', stiffness: 160, damping: 22 }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </motion.div>
                                                    </div>
                                                    </div>

                                                    {/* Cohort distribution: Written vs Interview vs Empirical toggle, PMF + CDF */}
                                                    {(cohortOverallScores.length > 0 || cohortWrittenAverages.length > 0 || cohortEmpiricalScores.length > 0) && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 8 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ type: 'spring', stiffness: 220, damping: 26, delay: 0.06 }}
                                                        >
                                                            <div className="flex flex-wrap items-center gap-3 mb-2">
                                                                <h3 className="text-sm font-semibold text-primary">Score distribution (cohort)</h3>
                                                                <div className="flex rounded-sm border border-border bg-surface/50 p-0.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setDistributionMode('written')}
                                                                        className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${distributionMode === 'written' ? 'text-white' : 'text-secondary hover:text-primary'}`}
                                                                        style={distributionMode === 'written' ? { backgroundColor: COLOR_WRITTEN } : undefined}
                                                                    >
                                                                        Written (avg)
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setDistributionMode('interview')}
                                                                        className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${distributionMode === 'interview' ? 'text-white' : 'text-secondary hover:text-primary'}`}
                                                                        style={distributionMode === 'interview' ? { backgroundColor: COLOR_OVERALL } : undefined}
                                                                    >
                                                                        Interview (avg overall)
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setDistributionMode('empirical')}
                                                                        className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${distributionMode === 'empirical' ? 'text-white' : 'text-secondary hover:text-primary'}`}
                                                                        style={distributionMode === 'empirical' ? { backgroundColor: COLOR_EMPIRICAL } : undefined}
                                                                    >
                                                                        Empirical overall
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <p className="text-xs text-secondary mb-3">
                                                                {distributionMode === 'interview' && (
                                                                    <>
                                                                        Smoothed distribution of interview overall score (average across interviewers) for all{' '}
                                                                        {candidates.length} candidates.
                                                                        {currentOverall != null && overallPercentile != null && (
                                                                            <span className="ml-1 font-medium text-primary">
                                                                                {candidate.name} is at{' '}
                                                                                <span style={{ color: COLOR_OVERALL }}>{overallPercentile}th percentile</span> (score{' '}
                                                                                {currentOverall.toFixed(1)}).
                                                                            </span>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {distributionMode === 'written' && (
                                                                    <>
                                                                        Smoothed distribution of written overall average (0–5) across all candidates.
                                                                        {currentWrittenAvg != null && writtenAvgPercentile != null && (
                                                                            <span className="ml-1 font-medium text-primary">
                                                                                {candidate.name} is at{' '}
                                                                                <span style={{ color: COLOR_WRITTEN }}>{writtenAvgPercentile}th percentile</span> (avg{' '}
                                                                                {currentWrittenAvg.toFixed(2)}/5).
                                                                            </span>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {distributionMode === 'empirical' && (
                                                                    <>
                                                                        Smoothed distribution of empirical standardized score for all {candidates.length} candidates.
                                                                        {currentEmpirical != null && empiricalPercentile != null && (
                                                                            <span className="ml-1 font-medium text-primary">
                                                                                {candidate.name} is at{' '}
                                                                                <span style={{ color: COLOR_EMPIRICAL }}>{empiricalPercentile}th percentile</span> (score{' '}
                                                                                {currentEmpirical.toFixed(1)}).
                                                                            </span>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </p>

                                                            {distributionMode === 'interview' && cohortOverallScores.length > 0 && (
                                                                <>
                                                                    <p className="text-[11px] font-medium text-muted uppercase tracking-wider mb-1">Density (KDE)</p>
                                                                    <div className="h-52 mb-2" style={{ marginTop: 4 }}>
                                                                        <ResponsiveContainer width="100%" height="100%">
                                                                            <AreaChart data={overallKdeData} margin={{ top: chartTopMargin, right: 16, left: 8, bottom: 24 }}>
                                                                                <defs>
                                                                                    <linearGradient id="overallKdeFill" x1="0" y1="0" x2="0" y2="1">
                                                                                        <stop offset="0%" stopColor={COLOR_OVERALL} stopOpacity={0.4} />
                                                                                        <stop offset="100%" stopColor={COLOR_OVERALL} stopOpacity={0} />
                                                                                    </linearGradient>
                                                                                </defs>
                                                                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                                                                <XAxis dataKey="x" type="number" domain={[0, 10]} tick={{ fontSize: 10, fill: '#6B7280' }} />
                                                                                <YAxis hide domain={[0, 1.15]} />
                                                                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(v: number | undefined) => ['density', v != null ? v.toFixed(3) : '—']} labelFormatter={(l: unknown) => `Score ${l}`} />
                                                                                <Area type="monotone" dataKey="density" stroke={COLOR_OVERALL} strokeWidth={2} fill="url(#overallKdeFill)" />
                                                                                {typeof currentOverall === 'number' && (
                                                                                    <ReferenceLine x={currentOverall} stroke={COLOR_CANDIDATE} strokeWidth={2} strokeDasharray="4 2" label={{ value: 'Candidate', position: 'top', fill: COLOR_CANDIDATE, fontSize: 11 }} />
                                                                                )}
                                                                            </AreaChart>
                                                                        </ResponsiveContainer>
                                                                    </div>
                                                                    <p className="text-[11px] font-medium text-muted uppercase tracking-wider mb-1">CDF</p>
                                                                    <div className="h-52" style={{ marginTop: 4 }}>
                                                                        <ResponsiveContainer width="100%" height="100%">
                                                                            <LineChart data={overallCdfData} margin={{ top: chartTopMargin, right: 16, left: 8, bottom: 24 }}>
                                                                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                                                                <XAxis dataKey="x" type="number" domain={[0, 10]} tick={{ fontSize: 10, fill: '#6B7280' }} />
                                                                                <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: '#6B7280' }} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                                                                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(v: number | undefined) => [v != null ? `${(v * 100).toFixed(0)}%` : '—', 'CDF']} labelFormatter={(l: unknown) => `Score ${l}`} />
                                                                                <Line type="monotone" dataKey="cdf" stroke={COLOR_OVERALL} strokeWidth={2} dot={false} />
                                                                                {typeof currentOverall === 'number' && (
                                                                                    <ReferenceLine x={currentOverall} stroke={COLOR_CANDIDATE} strokeWidth={2} strokeDasharray="4 2" label={{ value: 'Candidate', position: 'top', fill: COLOR_CANDIDATE, fontSize: 11 }} />
                                                                                )}
                                                                            </LineChart>
                                                                        </ResponsiveContainer>
                                                                    </div>
                                                                </>
                                                            )}

                                                            {distributionMode === 'written' && cohortWrittenAverages.length > 0 && (
                                                                <>
                                                                    <p className="text-[11px] font-medium text-muted uppercase tracking-wider mb-1">Density (KDE)</p>
                                                                    <div className="h-52 mb-2" style={{ marginTop: 4 }}>
                                                                        <ResponsiveContainer width="100%" height="100%">
                                                                            <AreaChart data={writtenAvgKdeData} margin={{ top: chartTopMargin, right: 16, left: 8, bottom: 24 }}>
                                                                                <defs>
                                                                                    <linearGradient id="writtenAvgKdeFill" x1="0" y1="0" x2="0" y2="1">
                                                                                        <stop offset="0%" stopColor={COLOR_WRITTEN} stopOpacity={0.4} />
                                                                                        <stop offset="100%" stopColor={COLOR_WRITTEN} stopOpacity={0} />
                                                                                    </linearGradient>
                                                                                </defs>
                                                                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                                                                <XAxis dataKey="x" type="number" domain={[0, 5]} tick={{ fontSize: 10, fill: '#6B7280' }} />
                                                                                <YAxis hide domain={[0, 1.15]} />
                                                                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(v: number | undefined) => ['density', v != null ? v.toFixed(3) : '—']} labelFormatter={(l: unknown) => `Avg ${l}`} />
                                                                                <Area type="monotone" dataKey="density" stroke={COLOR_WRITTEN} strokeWidth={2} fill="url(#writtenAvgKdeFill)" />
                                                                                {currentWrittenAvg != null && (
                                                                                    <ReferenceLine x={currentWrittenAvg} stroke={COLOR_CANDIDATE} strokeWidth={2} strokeDasharray="4 2" label={{ value: 'Candidate', position: 'top', fill: COLOR_CANDIDATE, fontSize: 11 }} />
                                                                                )}
                                                                            </AreaChart>
                                                                        </ResponsiveContainer>
                                                                    </div>
                                                                    <p className="text-[11px] font-medium text-muted uppercase tracking-wider mb-1">CDF</p>
                                                                    <div className="h-52" style={{ marginTop: 4 }}>
                                                                        <ResponsiveContainer width="100%" height="100%">
                                                                            <LineChart data={writtenAvgCdfData} margin={{ top: chartTopMargin, right: 16, left: 8, bottom: 24 }}>
                                                                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                                                                <XAxis dataKey="x" type="number" domain={[0, 5]} tick={{ fontSize: 10, fill: '#6B7280' }} />
                                                                                <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: '#6B7280' }} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                                                                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(v: number | undefined) => [v != null ? `${(v * 100).toFixed(0)}%` : '—', 'CDF']} labelFormatter={(l: unknown) => `Sum ${l}`} />
                                                                                <Line type="monotone" dataKey="cdf" stroke={COLOR_WRITTEN} strokeWidth={2} dot={false} />
                                                                                {currentWrittenAvg != null && (
                                                                                    <ReferenceLine x={currentWrittenAvg} stroke={COLOR_CANDIDATE} strokeWidth={2} strokeDasharray="4 2" label={{ value: 'Candidate', position: 'top', fill: COLOR_CANDIDATE, fontSize: 11 }} />
                                                                                )}
                                                                            </LineChart>
                                                                        </ResponsiveContainer>
                                                                    </div>
                                                                </>
                                                            )}

                                                            {distributionMode === 'empirical' && cohortEmpiricalScores.length > 0 && (
                                                                <>
                                                                    <p className="text-[11px] font-medium text-muted uppercase tracking-wider mb-1">Density (KDE)</p>
                                                                    <div className="h-52 mb-2" style={{ marginTop: 4 }}>
                                                                        <ResponsiveContainer width="100%" height="100%">
                                                                            <AreaChart data={empiricalKdeData} margin={{ top: chartTopMargin, right: 16, left: 8, bottom: 24 }}>
                                                                                <defs>
                                                                                    <linearGradient id="empiricalKdeFill" x1="0" y1="0" x2="0" y2="1">
                                                                                        <stop offset="0%" stopColor={COLOR_EMPIRICAL} stopOpacity={0.4} />
                                                                                        <stop offset="100%" stopColor={COLOR_EMPIRICAL} stopOpacity={0} />
                                                                                    </linearGradient>
                                                                                </defs>
                                                                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                                                                <XAxis dataKey="x" type="number" domain={[0, 10]} tick={{ fontSize: 10, fill: '#6B7280' }} />
                                                                                <YAxis hide domain={[0, 1.15]} />
                                                                                <Tooltip
                                                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                                                    formatter={(v: number | undefined) => ['density', v != null ? v.toFixed(3) : '—']}
                                                                                    labelFormatter={(l: unknown) => `Score ${l}`}
                                                                                />
                                                                                <Area type="monotone" dataKey="density" stroke={COLOR_EMPIRICAL} strokeWidth={2} fill="url(#empiricalKdeFill)" />
                                                                                {currentEmpirical != null && (
                                                                                    <ReferenceLine
                                                                                        x={currentEmpirical}
                                                                                        stroke={COLOR_CANDIDATE}
                                                                                        strokeWidth={2}
                                                                                        strokeDasharray="4 2"
                                                                                        label={{ value: 'Candidate', position: 'top', fill: COLOR_CANDIDATE, fontSize: 11 }}
                                                                                    />
                                                                                )}
                                                                            </AreaChart>
                                                                        </ResponsiveContainer>
                                                                    </div>
                                                                    <p className="text-[11px] font-medium text-muted uppercase tracking-wider mb-1">CDF</p>
                                                                    <div className="h-52" style={{ marginTop: 4 }}>
                                                                        <ResponsiveContainer width="100%" height="100%">
                                                                            <LineChart data={empiricalCdfData} margin={{ top: chartTopMargin, right: 16, left: 8, bottom: 24 }}>
                                                                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                                                                <XAxis dataKey="x" type="number" domain={[0, 10]} tick={{ fontSize: 10, fill: '#6B7280' }} />
                                                                                <YAxis
                                                                                    domain={[0, 1]}
                                                                                    tick={{ fontSize: 10, fill: '#6B7280' }}
                                                                                    tickFormatter={(v) => `${Math.round(v * 100)}%`}
                                                                                />
                                                                                <Tooltip
                                                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                                                    formatter={(v: number | undefined) => [v != null ? `${(v * 100).toFixed(0)}%` : '—', 'CDF']}
                                                                                    labelFormatter={(l: unknown) => `Score ${l}`}
                                                                                />
                                                                                <Line type="monotone" dataKey="cdf" stroke={COLOR_EMPIRICAL} strokeWidth={2} dot={false} />
                                                                                {currentEmpirical != null && (
                                                                                    <ReferenceLine
                                                                                        x={currentEmpirical}
                                                                                        stroke={COLOR_CANDIDATE}
                                                                                        strokeWidth={2}
                                                                                        strokeDasharray="4 2"
                                                                                        label={{ value: 'Candidate', position: 'top', fill: COLOR_CANDIDATE, fontSize: 11 }}
                                                                                    />
                                                                                )}
                                                                            </LineChart>
                                                                        </ResponsiveContainer>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </motion.div>
                                                    )}

                                                    {/* Written dimensions bar chart */}
                                                    {hasWrittenScores && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 8 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ type: 'spring', stiffness: 220, damping: 26, delay: 0.08 }}
                                                        >
                                                            <h3 className="text-sm font-semibold text-primary mb-3">Written application dimensions (out of 5)</h3>
                                                            <div className="h-64">
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <BarChart data={writtenBarData} layout="vertical" margin={{ top: 14, right: 16, left: 60, bottom: 4 }}>
                                                                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                                                        <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                                                        <YAxis type="category" dataKey="name" width={56} tick={{ fontSize: 11, fill: '#374151' }} />
                                                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(v: number | undefined) => [v != null ? `${v.toFixed(1)} / 5` : '—', 'Score']} />
                                                                        <Bar dataKey="score" radius={[0, 4, 4, 0]} fill={COLOR_WRITTEN} />
                                                                    </BarChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        </motion.div>
                                                    )}

                                                    {/* Interview dimensions bar chart (average) */}
                                                    {(hasInterviewOverall || interviewBarData.some(d => d.score > 0)) && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 8 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ type: 'spring', stiffness: 220, damping: 26, delay: 0.1 }}
                                                        >
                                                            <h3 className="text-sm font-semibold text-primary mb-3">Interview dimensions — average (out of 5)</h3>
                                                            <div className="h-64">
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <BarChart data={interviewBarData} layout="vertical" margin={{ top: 14, right: 16, left: 80, bottom: 4 }}>
                                                                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                                                        <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                                                        <YAxis type="category" dataKey="name" width={76} tick={{ fontSize: 11, fill: '#374151' }} />
                                                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(v: number | undefined) => [v != null ? `${v.toFixed(1)} / 5` : '—', 'Score']} />
                                                                        <Bar dataKey="score" radius={[0, 4, 4, 0]} fill={COLOR_OVERALL} />
                                                                    </BarChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        </motion.div>
                                                    )}

                                                    {/* Multi-interviewer comparison */}
                                                    {multiInterviewerChartData.length > 0 && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 8 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ type: 'spring', stiffness: 220, damping: 26, delay: 0.12 }}
                                                        >
                                                            <h3 className="text-sm font-semibold text-primary mb-3">Interviewer comparison by dimension</h3>
                                                            <div className="h-72">
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <BarChart data={multiInterviewerChartData} margin={{ top: 16, right: 16, left: 8, bottom: 24 }}>
                                                                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                                                        <XAxis dataKey="dimension" tick={{ fontSize: 10, fill: '#374151' }} />
                                                                        <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                                        <Legend />
                                                                        {interviewNotes.slice(0, 4).map((note: any, i: number) => {
                                                                            const label = note.interviewer || `Interviewer ${i + 1}`;
                                                                            return (
                                                                                <Bar key={label} dataKey={label} fill={INTERVIEWER_COLORS[i % INTERVIEWER_COLORS.length]} radius={[2, 2, 0, 0]} />
                                                                            );
                                                                        })}
                                                                    </BarChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        </motion.div>
                                                    )}

                                                    {!hasWrittenScores && !hasInterviewOverall ? (
                                                        <div className="text-center text-secondary py-8">
                                                            No written or interview scores yet. Charts will appear once scores are available.
                                                        </div>
                                                    ) : null}

                                                </div>
                                            )}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            </motion.div>

                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Always-present Action Bar */}
            <div className="shrink-0 flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-border mt-auto">
                <div className="text-sm font-medium text-secondary mb-3 sm:mb-0">
                    Make a final decision for <span className="text-primary font-bold">{candidate.name}</span>
                </div>
                <div className="flex items-center gap-3">
                    {isAdmin ? (
                        <>
                            <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                                <Button variant="danger" onClick={() => handleDecision('reject')}>
                                    <ThumbsDown className="w-4 h-4 mr-2" /> Reject
                                </Button>
                            </motion.div>
                            <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                                <Button variant="secondary" onClick={() => handleDecision('waitlist')}>
                                    <Clock className="w-4 h-4 mr-2" /> Waitlist
                                </Button>
                            </motion.div>
                            <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                                <Button variant="primary" onClick={() => handleDecision('approve')}>
                                    <ThumbsUp className="w-4 h-4 mr-2" /> Approve
                                </Button>
                            </motion.div>
                        </>
                    ) : (
                        <div className="px-4 py-2 bg-surfaceHover text-secondary text-sm italic rounded-sm border border-border">
                            Awaiting conductor decision...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
