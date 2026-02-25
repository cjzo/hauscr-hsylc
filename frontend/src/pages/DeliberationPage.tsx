import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useConfirm } from '../components/ui/ConfirmModal';
import {
    User, Mail, GraduationCap, ChevronRight, ChevronLeft,
    ThumbsUp, ThumbsDown, Loader2, FileText, MessageSquare, Clock, BarChart2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { standardizeCategory } from '../utils/categories';
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip,
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

export function DeliberationPage() {
    const [candidates, setCandidates] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction, setDirection] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'seminar' | 'written' | 'interview' | 'visualizations'>('seminar');
    const confirmModal = useConfirm();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [distributionMode, setDistributionMode] = useState<'written' | 'interview'>('interview');

    const { role } = useAuth();
    const isAdmin = role === 'admin';

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
                const mappedData = data.map(cand => ({
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
                        writtenInterest: cand.written_score_interest || 0,
                        writtenTeaching: cand.written_score_teaching || 0,
                        writtenSeminar: cand.written_score_seminar || 0,
                        writtenPersonal: cand.written_score_personal || 0,

                        understanding: cand.score_understanding || 0,
                        enthusiasm: cand.score_enthusiasm || 0,
                        quality: cand.score_quality || 0,
                        teaching: cand.score_teaching || 0,
                        interestEngaging: cand.score_interest || 0,
                        overall: cand.score_overall !== null && cand.score_overall !== undefined ? cand.score_overall : (() => {
                            const s = (cand.interviews || []).map((i: any) => i.score_overall).filter((v: any) => typeof v === 'number');
                            return s.length ? s.reduce((a: number, b: number) => a + b, 0) / s.length : 0;
                        })()
                    },
                    interviewNotes: (cand.interviews || []).map((note: any) => ({
                        interviewer: note.interviewer_name,
                        notes_why_sl: note.notes_why_sl,
                        notes_seminar: note.notes_seminar,
                        notes_extracurricular: note.notes_extracurricular,
                        notes_teach_me: note.notes_teach_me,
                        notes_commitment: note.notes_commitment,
                        notes_comments: note.notes_comments,
                        score_enthusiasm: note.score_enthusiasm,
                        score_quality: note.score_quality,
                        score_teaching: note.score_teaching,
                        score_interest: note.score_interest,
                        score_overall: note.score_overall
                    }))
                }));
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

    // Real-time synchronization
    useEffect(() => {
        if (candidates.length === 0) return;

        // 1. Fetch initial state
        const fetchInitialState = async () => {
            const { data } = await supabase.from('system_state').select('current_candidate_id').eq('id', 1).single();
            if (data?.current_candidate_id) {
                const idx = candidates.findIndex(c => c.id === data.current_candidate_id);
                if (idx !== -1) setCurrentIndex(idx);
            }
        };
        fetchInitialState();

        // 2. Subscribe to changes
        const channel = supabase
            .channel('system_state_changes')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'system_state'
            }, payload => {
                const newId = payload.new.current_candidate_id;
                if (newId) {
                    const idx = candidates.findIndex(c => c.id === newId);
                    if (idx !== -1 && idx !== currentIndex) {
                        setDirection(idx > currentIndex ? 1 : -1);
                        setCurrentIndex(idx);
                        setActiveTab('seminar');
                    }
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [candidates]);

    // Update global state when candidate changes (if admin)
    const syncCurrentCandidateId = async (id: string) => {
        if (!isAdmin) return;
        try {
            await supabase.from('system_state').update({ current_candidate_id: id }).eq('id', 1);
        } catch (err) {
            console.error("Failed to sync system state:", err);
        }
    };

    const candidate = candidates[currentIndex];

    const nextCandidate = () => {
        if (currentIndex < candidates.length - 1) {
            const nextIdx = currentIndex + 1;
            setDirection(1);
            setCurrentIndex(nextIdx);
            setActiveTab('seminar');
            syncCurrentCandidateId(candidates[nextIdx].id);
        }
    };

    const prevCandidate = () => {
        if (currentIndex > 0) {
            const prevIdx = currentIndex - 1;
            setDirection(-1);
            setCurrentIndex(prevIdx);
            setActiveTab('seminar');
            syncCurrentCandidateId(candidates[prevIdx].id);
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

                setCandidates(prev => prev.filter((_, i) => i !== currentIndex));
                if (currentIndex >= candidates.length - 1 && currentIndex > 0) {
                    setCurrentIndex(prev => prev - 1);
                }
                setDirection(1);
                setActiveTab('seminar');
            } catch (err) {
                console.error("Failed to submit decision:", err);
            }
        }
    };

    const variants = {
        enter: (dir: number) => ({ x: dir > 0 ? 50 : -50, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (dir: number) => ({ x: dir < 0 ? 50 : -50, opacity: 0 }),
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
            <div className="h-full flex items-center justify-center text-secondary">
                No more candidates to review.
            </div>
        );
    }

    const renderProgressBar = (label: string, value: number, max: number = 10) => (
        <div className="mb-3 last:mb-0">
            <div className="flex justify-between text-xs mb-1">
                <span className="text-secondary font-medium">{label}</span>
                <span className="font-semibold">{value.toFixed(1)}/{max}</span>
            </div>
            <div className="w-full bg-surfaceHover h-1.5 rounded-full overflow-hidden">
                <div
                    className="bg-accent h-full transition-all duration-500"
                    style={{ width: `${(value / max) * 100}%` }}
                />
            </div>
        </div>
    );

    const radarData = [
        { subject: 'Understanding', A: candidate.scores.understanding, fullMark: 10 },
        { subject: 'Enthusiasm', A: candidate.scores.enthusiasm, fullMark: 10 },
        { subject: 'Seminar Quality', A: candidate.scores.quality, fullMark: 10 },
        { subject: 'Teaching', A: candidate.scores.teaching, fullMark: 10 },
        { subject: 'Extracurriculars', A: candidate.scores.interestEngaging, fullMark: 10 }
    ];

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
        { name: 'Understanding', score: candidate.scores.understanding ?? 0, fullMark: 10 },
        { name: 'Enthusiasm', score: candidate.scores.enthusiasm ?? 0, fullMark: 10 },
        { name: 'Seminar Quality', score: candidate.scores.quality ?? 0, fullMark: 10 },
        { name: 'Teaching', score: candidate.scores.teaching ?? 0, fullMark: 10 },
        { name: 'Interest', score: candidate.scores.interestEngaging ?? 0, fullMark: 10 },
    ];
    const interviewNotes = candidate.interviewNotes || [];
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

    const INTERVIEWER_COLORS = ['#8b5cf6', '#059669', '#d97706', '#dc2626'];

    // Cohort distributions for percentile / PMF charts (all pending candidates)
    const cohortOverallScores = candidates.map(c => c.scores?.overall).filter((v: unknown): v is number => typeof v === 'number');
    const cohortWrittenSums = candidates.map(c =>
        (c.scores?.writtenInterest ?? 0) + (c.scores?.writtenTeaching ?? 0) + (c.scores?.writtenSeminar ?? 0) + (c.scores?.writtenPersonal ?? 0)
    ).filter(s => s > 0);
    const currentOverall = candidate.scores?.overall;
    const currentWrittenSum = (candidate.scores?.writtenInterest ?? 0) + (candidate.scores?.writtenTeaching ?? 0) + (candidate.scores?.writtenSeminar ?? 0) + (candidate.scores?.writtenPersonal ?? 0);
    const overallKdeData = kernelDensity(cohortOverallScores, 0, 10, 0.2, 0.5);
    const writtenSumKdeData = kernelDensity(cohortWrittenSums, 0, 20, 0.25, 0.8);
    const overallCdfData = computeCdf(cohortOverallScores, 0, 10, 0.2);
    const writtenSumCdfData = computeCdf(cohortWrittenSums, 0, 20, 0.25);
    const overallPercentile = typeof currentOverall === 'number' ? percentile(cohortOverallScores, currentOverall) : null;
    const writtenSumPercentile = currentWrittenSum > 0 && cohortWrittenSums.length > 0 ? percentile(cohortWrittenSums, currentWrittenSum) : null;

    const chartTopMargin = 32;

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-primary tracking-tight">
                        Application Review {isAdmin && <span className="ml-2 px-2 py-0.5 bg-accent/20 text-accent text-[10px] uppercase rounded border border-accent/30">Conductor</span>}
                    </h1>
                    <p className="text-sm text-secondary mt-1">Reviewing candidate {currentIndex + 1} of {candidates.length}</p>
                </div>
                <div className="flex gap-2">
                    {isAdmin && (
                        <>
                            <Button variant="secondary" size="sm" onClick={prevCandidate} disabled={currentIndex === 0}>
                                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                            </Button>
                            <Button variant="secondary" size="sm" onClick={nextCandidate} disabled={currentIndex === candidates.length - 1}>
                                Next <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 relative overflow-hidden">
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={candidate.id}
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="h-full absolute inset-0 w-full"
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full pb-2">

                            {/* Left Column: Candidate Profile & Standardized Scores */}
                            {isSidebarOpen && (
                                <div className="lg:col-span-3 flex flex-col gap-6 h-full overflow-y-auto pr-1 relative">
                                    {/* Collapse handle: attached to right edge of sidebar */}
                                    <button
                                        type="button"
                                        onClick={() => setIsSidebarOpen(false)}
                                        className="absolute top-6 right-0 z-10 w-6 h-10 flex items-center justify-center rounded-l-md border border-r-0 border-border bg-surface hover:bg-surfaceHover text-muted hover:text-primary shadow-sm transition-colors"
                                        title="Collapse panel"
                                        aria-label="Collapse panel"
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                    </button>
                                    <Card className="flex flex-col shrink-0">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <h2 className="text-2xl font-bold text-primary">{candidate.name}</h2>
                                                <span className={`px-2 py-1 text-xs font-bold rounded-full ${candidate.candidateType === 'Returning' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                                                    {candidate.candidateType}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-2 mt-2">
                                            <div className="flex items-center text-sm text-secondary">
                                                <GraduationCap className="w-4 h-4 mr-3 text-muted shrink-0" />
                                                {candidate.school}, {formatClassYear(candidate.year)}
                                            </div>
                                            <div className="flex items-center text-sm text-secondary">
                                                <Mail className="w-4 h-4 mr-3 text-muted shrink-0" />
                                                <span className="truncate">{candidate.email}</span>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-border">
                                            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Major / Concentration</p>
                                            <p className="text-sm font-medium text-primary">{candidate.major}</p>
                                        </div>

                                        {/* Travel Preferences */}
                                        {(candidate.flyFrom || candidate.flyTo || candidate.availability) && (
                                            <div className="mt-4 pt-4 border-t border-border">
                                                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Travel & Availability</p>

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

                                    <Card className="flex-1 flex flex-col mb-4">
                                        <div className="mb-4 shrink-0">
                                            <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                                                Overall Evaluation
                                            </p>
                                            <div className="mt-1 flex items-baseline gap-2">
                                                <span className="text-3xl font-semibold text-primary">
                                                    {candidate.scores.overall.toFixed(1)}
                                                </span>
                                                <span className="text-xs text-secondary">/ 10</span>
                                            </div>
                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                {hasWrittenScores && (
                                                    <div className="text-[11px] px-2 py-1 rounded-full bg-surfaceHover text-secondary font-semibold">
                                                        Written Avg {writtenOverall?.toFixed(2)}/5
                                                    </div>
                                                )}
                                                {hasInterviewOverall && (
                                                    <div className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-200 font-semibold">
                                                        Interview Avg {interviewOverallAvg?.toFixed(2)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-1 mb-4">
                                            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Written Scores (out of 5)</p>
                                            {renderProgressBar('Interest', candidate.scores.writtenInterest, 5)}
                                            {renderProgressBar('Teaching', candidate.scores.writtenTeaching, 5)}
                                            {renderProgressBar('Seminar', candidate.scores.writtenSeminar, 5)}
                                            {renderProgressBar('Personal', candidate.scores.writtenPersonal, 5)}

                                            <div className="mt-3 pt-3 border-t border-border">
                                                <p className="text-xs font-semibold text-muted mb-1">Graded By: {candidate.grader}</p>
                                            </div>
                                        </div>

                                        <div className="flex-1 min-h-[200px] -mx-4">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                                    <PolarGrid stroke="#E5E7EB" />
                                                    <PolarAngleAxis
                                                        dataKey="subject"
                                                        tick={{ fill: '#6B7280', fontSize: 10, fontWeight: 500 }}
                                                    />
                                                    <PolarRadiusAxis
                                                        angle={30}
                                                        domain={[0, 10]}
                                                        tick={{ fill: '#9CA3AF', fontSize: 10 }}
                                                        tickCount={6}
                                                    />
                                                    <Radar
                                                        name={candidate.name}
                                                        dataKey="A"
                                                        stroke="#8b5cf6"
                                                        fill="#8b5cf6"
                                                        fillOpacity={0.4}
                                                    />
                                                    <Tooltip
                                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                    />
                                                </RadarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </Card>
                                </div>
                            )}

                            {/* Right Column: Detailed Context Tabs */}
                            <div className={`${isSidebarOpen ? 'lg:col-span-9' : 'lg:col-span-12'} flex flex-col h-full bg-white dark:bg-surface border border-border rounded-xl shadow-sm overflow-hidden transition-all duration-300 relative`}>
                                {/* Expand handle when sidebar is collapsed */}
                                {!isSidebarOpen && (
                                    <button
                                        type="button"
                                        onClick={() => setIsSidebarOpen(true)}
                                        className="absolute top-6 left-0 z-10 w-6 h-10 flex items-center justify-center rounded-r-md border border-l-0 border-border bg-surface hover:bg-surfaceHover text-muted hover:text-primary shadow-sm transition-colors"
                                        title="Expand panel"
                                        aria-label="Expand panel"
                                    >
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {/* Tab Navigation */}
                                <div className="flex border-b border-border px-2 pt-2 bg-surface/50 dark:bg-surfaceHover/30">
                                    <button
                                        onClick={() => setActiveTab('seminar')}
                                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'seminar' ? 'border-accent text-accent' : 'border-transparent text-secondary hover:text-primary hover:border-border'}`}
                                    >
                                        <FileText className="w-4 h-4" /> Seminar Proposal
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('written')}
                                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'written' ? 'border-accent text-accent' : 'border-transparent text-secondary hover:text-primary hover:border-border'}`}
                                    >
                                        <MessageSquare className="w-4 h-4" /> Written App
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('interview')}
                                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'interview' ? 'border-accent text-accent' : 'border-transparent text-secondary hover:text-primary hover:border-border'}`}
                                    >
                                        <User className="w-4 h-4" /> Interview Notes
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('visualizations')}
                                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'visualizations' ? 'border-accent text-accent' : 'border-transparent text-secondary hover:text-primary hover:border-border'}`}
                                    >
                                        <BarChart2 className="w-4 h-4" /> Visualizations
                                    </button>
                                </div>

                                {/* Tab Content Area (Scrollable) */}
                                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                                    {activeTab === 'seminar' && (
                                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div>
                                                <div className="inline-block px-2.5 py-1 bg-accent/10 text-accent rounded-full text-xs font-semibold tracking-wide mb-3">
                                                    {candidate.seminarCategory}
                                                </div>
                                                {/* <h2 className="text-2xl font-bold text-primary">{candidate.seminarTitle}</h2> */}
                                                <h2 className="text-2xl font-bold text-primary truncate max-w-[60ch]">
                                                {candidate.seminarTitle}
                                                </h2>
                                            </div>

                                            <div>
                                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-2">Course Description</h3>
                                                <p className="text-md text-primary leading-relaxed bg-surface/50 dark:bg-surfaceHover p-4 rounded-lg border border-border">
                                                    {candidate.seminarDescription}
                                                </p>
                                            </div>

                                            <div>
                                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-2">Tangible Final Product</h3>
                                                <p className="text-sm text-secondary leading-relaxed bg-surface/50 dark:bg-surfaceHover p-4 rounded-lg border border-border">
                                                    {candidate.finalProduct}
                                                </p>
                                            </div>

                                            <div>
                                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-2">Other Potential Topics</h3>
                                                <p className="text-sm text-secondary p-2">
                                                    {candidate.moreTopics}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'written' && (
                                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div>
                                                <h3 className="text-sm font-semibold text-primary mb-2">Self Introduction & Achievements</h3>
                                                <p className="text-sm text-secondary leading-relaxed p-3 bg-surface rounded-md border border-border">
                                                    {candidate.selfIntro}
                                                </p>
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-semibold text-primary mb-2">Interest in HSYLC Mission</h3>
                                                <p className="text-sm text-secondary leading-relaxed p-3 bg-surface rounded-md border border-border">
                                                    {candidate.interestReason}
                                                </p>
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-semibold text-primary mb-2">Teaching & Mentoring Experience</h3>
                                                <p className="text-sm text-secondary leading-relaxed p-3 bg-surface rounded-md border border-border">
                                                    {candidate.teachingExp}
                                                </p>
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-semibold text-primary mb-2">Advice for a High Schooler</h3>
                                                <p className="text-sm text-secondary leading-relaxed p-3 bg-surface rounded-md border border-border text-center italic">
                                                    "{candidate.advice}"
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'interview' && (
                                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            {candidate.sensitiveIssues && candidate.sensitiveIssues.toLowerCase() !== 'no' && (
                                                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 border border-orange-200 dark:border-orange-800 rounded-lg">
                                                    <h4 className="text-sm font-bold mb-1 flex items-center gap-2">⚠️ Sensitive Topics Alert</h4>
                                                    <p className="text-sm">{candidate.sensitiveIssues}</p>
                                                </div>
                                            )}

                                            {!candidate.interviewNotes || candidate.interviewNotes.length === 0 ? (
                                                <div className="text-center text-secondary py-8">
                                                    No interviews have been recorded for this candidate yet.
                                                </div>
                                            ) : (
                                                <div className={`grid ${candidate.interviewNotes.length === 1 ? 'grid-cols-1' : candidate.interviewNotes.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'} gap-0 md:gap-8 divide-y md:divide-y-0 md:divide-x divide-border`}>
                                                    {candidate.interviewNotes.map((note: any, index: number) => (
                                                        <div key={index} className="first:pl-0 last:pr-0 md:px-6 md:first:px-3 md:last:px-3 pt-6 first:pt-0 md:pt-0 pb-6 md:pb-0">
                                                            <div className="flex items-center justify-between gap-3 mb-4">
                                                                <div className="flex items-center gap-2">
                                                                    <User className="w-4 h-4 text-accent" />
                                                                    <span className="font-semibold text-primary">{note.interviewer || 'Unknown Interviewer'}</span>
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-secondary">
                                                                    <span>Enth <span className="font-semibold text-primary">{formatScore(note.score_enthusiasm)}</span></span>
                                                                    <span>Qual <span className="font-semibold text-primary">{formatScore(note.score_quality)}</span></span>
                                                                    <span>Teach <span className="font-semibold text-primary">{formatScore(note.score_teaching)}</span></span>
                                                                    <span>Int <span className="font-semibold text-primary">{formatScore(note.score_interest)}</span></span>
                                                                    <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold">
                                                                        Overall {formatScore(note.score_overall)}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-6">
                                                                <div>
                                                                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Why SL & Understanding</h4>
                                                                    <p className="text-sm text-primary leading-relaxed">{note.notes_why_sl || '—'}</p>
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Seminar Feedback</h4>
                                                                    <p className="text-sm text-primary leading-relaxed">{note.notes_seminar || '—'}</p>
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Extracurricular Impact</h4>
                                                                    <p className="text-sm text-primary leading-relaxed">{note.notes_extracurricular || '—'}</p>
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">"Teach Me in 2 Minutes"</h4>
                                                                    <p className="text-sm text-primary leading-relaxed">{note.notes_teach_me || '—'}</p>
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Spring/Summer Commitment</h4>
                                                                    <p className="text-sm text-primary leading-relaxed">{note.notes_commitment || '—'}</p>
                                                                </div>
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
                                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            {/* Written vs Interview summary */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="p-4 rounded-xl border border-border bg-surface/50 dark:bg-surfaceHover/30">
                                                    <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Written application (avg)</p>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-2xl font-bold text-primary">{writtenOverall != null ? writtenOverall.toFixed(2) : '—'}</span>
                                                        <span className="text-sm text-secondary">/ 5</span>
                                                    </div>
                                                    {hasWrittenScores && (
                                                        <div className="mt-2 h-2 w-full bg-surfaceHover rounded-full overflow-hidden">
                                                            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${((writtenOverall ?? 0) / 5) * 100}%` }} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="p-4 rounded-xl border border-border bg-surface/50 dark:bg-surfaceHover/30">
                                                    <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Interview (avg overall)</p>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-2xl font-bold text-primary">{interviewOverallAvg != null ? interviewOverallAvg.toFixed(2) : '—'}</span>
                                                        <span className="text-sm text-secondary">/ 10</span>
                                                    </div>
                                                    {hasInterviewOverall && (
                                                        <div className="mt-2 h-2 w-full bg-surfaceHover rounded-full overflow-hidden">
                                                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${((interviewOverallAvg ?? 0) / 10) * 100}%` }} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Cohort distribution: Written vs Interview toggle, PMF + CDF */}
                                            {(cohortOverallScores.length > 0 || cohortWrittenSums.length > 0) && (
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-3 mb-2">
                                                        <h3 className="text-sm font-semibold text-primary">Score distribution (cohort)</h3>
                                                        <div className="flex rounded-lg border border-border bg-surface/50 p-0.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => setDistributionMode('written')}
                                                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${distributionMode === 'written' ? 'bg-accent text-white' : 'text-secondary hover:text-primary'}`}
                                                            >
                                                                Written (sum)
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setDistributionMode('interview')}
                                                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${distributionMode === 'interview' ? 'bg-accent text-white' : 'text-secondary hover:text-primary'}`}
                                                            >
                                                                Interview (avg overall)
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-secondary mb-3">
                                                        {distributionMode === 'interview'
                                                            ? <>Smoothed distribution of interview overall score (average across interviewers) for all {candidates.length} candidates. {typeof currentOverall === 'number' && overallPercentile != null && (<span className="ml-1 font-medium text-primary">{candidate.name} is at <span className="text-accent">{overallPercentile}th percentile</span> (score {currentOverall.toFixed(1)}).</span>)}</>
                                                            : <>Smoothed distribution of written dimension sum (max 20). {currentWrittenSum > 0 && writtenSumPercentile != null && (<span className="ml-1 font-medium text-primary">{candidate.name} is at <span className="text-accent">{writtenSumPercentile}th percentile</span> (sum {currentWrittenSum.toFixed(1)}/20).</span>)}</>
                                                        }
                                                    </p>

                                                    {distributionMode === 'interview' && cohortOverallScores.length > 0 && (
                                                        <>
                                                            <p className="text-[11px] font-medium text-muted uppercase tracking-wider mb-1">Density (KDE)</p>
                                                            <div className="h-52 mb-2" style={{ marginTop: 4 }}>
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <AreaChart data={overallKdeData} margin={{ top: chartTopMargin, right: 16, left: 8, bottom: 24 }}>
                                                                        <defs>
                                                                            <linearGradient id="overallKdeFill" x1="0" y1="0" x2="0" y2="1">
                                                                                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                                                                                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                                                                            </linearGradient>
                                                                        </defs>
                                                                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                                                        <XAxis dataKey="x" type="number" domain={[0, 10]} tick={{ fontSize: 10, fill: '#6B7280' }} />
                                                                        <YAxis hide domain={[0, 1.15]} />
                                                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(v: number | undefined) => ['density', v != null ? v.toFixed(3) : '—']} labelFormatter={(l: unknown) => `Score ${l}`} />
                                                                        <Area type="monotone" dataKey="density" stroke="#8b5cf6" strokeWidth={2} fill="url(#overallKdeFill)" />
                                                                        {typeof currentOverall === 'number' && (
                                                                            <ReferenceLine x={currentOverall} stroke="#dc2626" strokeWidth={2} strokeDasharray="4 2" label={{ value: 'You', position: 'top', fill: '#dc2626', fontSize: 11 }} />
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
                                                                        <Line type="monotone" dataKey="cdf" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                                                                        {typeof currentOverall === 'number' && (
                                                                            <ReferenceLine x={currentOverall} stroke="#dc2626" strokeWidth={2} strokeDasharray="4 2" label={{ value: 'You', position: 'top', fill: '#dc2626', fontSize: 11 }} />
                                                                        )}
                                                                    </LineChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        </>
                                                    )}

                                                    {distributionMode === 'written' && cohortWrittenSums.length > 0 && (
                                                        <>
                                                            <p className="text-[11px] font-medium text-muted uppercase tracking-wider mb-1">Density (KDE)</p>
                                                            <div className="h-52 mb-2" style={{ marginTop: 4 }}>
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <AreaChart data={writtenSumKdeData} margin={{ top: chartTopMargin, right: 16, left: 8, bottom: 24 }}>
                                                                        <defs>
                                                                            <linearGradient id="writtenSumKdeFill" x1="0" y1="0" x2="0" y2="1">
                                                                                <stop offset="0%" stopColor="#059669" stopOpacity={0.4} />
                                                                                <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                                                                            </linearGradient>
                                                                        </defs>
                                                                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                                                        <XAxis dataKey="x" type="number" domain={[0, 20]} tick={{ fontSize: 10, fill: '#6B7280' }} />
                                                                        <YAxis hide domain={[0, 1.15]} />
                                                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(v: number | undefined) => ['density', v != null ? v.toFixed(3) : '—']} labelFormatter={(l: unknown) => `Sum ${l}`} />
                                                                        <Area type="monotone" dataKey="density" stroke="#059669" strokeWidth={2} fill="url(#writtenSumKdeFill)" />
                                                                        {currentWrittenSum > 0 && (
                                                                            <ReferenceLine x={currentWrittenSum} stroke="#dc2626" strokeWidth={2} strokeDasharray="4 2" label={{ value: 'You', position: 'top', fill: '#dc2626', fontSize: 11 }} />
                                                                        )}
                                                                    </AreaChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                            <p className="text-[11px] font-medium text-muted uppercase tracking-wider mb-1">CDF</p>
                                                            <div className="h-52" style={{ marginTop: 4 }}>
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <LineChart data={writtenSumCdfData} margin={{ top: chartTopMargin, right: 16, left: 8, bottom: 24 }}>
                                                                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                                                        <XAxis dataKey="x" type="number" domain={[0, 20]} tick={{ fontSize: 10, fill: '#6B7280' }} />
                                                                        <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: '#6B7280' }} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                                                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(v: number | undefined) => [v != null ? `${(v * 100).toFixed(0)}%` : '—', 'CDF']} labelFormatter={(l: unknown) => `Sum ${l}`} />
                                                                        <Line type="monotone" dataKey="cdf" stroke="#059669" strokeWidth={2} dot={false} />
                                                                        {currentWrittenSum > 0 && (
                                                                            <ReferenceLine x={currentWrittenSum} stroke="#dc2626" strokeWidth={2} strokeDasharray="4 2" label={{ value: 'You', position: 'top', fill: '#dc2626', fontSize: 11 }} />
                                                                        )}
                                                                    </LineChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            {/* Written dimensions bar chart */}
                                            {hasWrittenScores && (
                                                <div>
                                                    <h3 className="text-sm font-semibold text-primary mb-3">Written application dimensions (out of 5)</h3>
                                                    <div className="h-64">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <BarChart data={writtenBarData} layout="vertical" margin={{ top: 14, right: 16, left: 60, bottom: 4 }}>
                                                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                                                <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                                                <YAxis type="category" dataKey="name" width={56} tick={{ fontSize: 11, fill: '#374151' }} />
                                                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(v: number | undefined) => [v != null ? `${v.toFixed(1)} / 5` : '—', 'Score']} />
                                                                <Bar dataKey="score" radius={[0, 4, 4, 0]} fill="#8b5cf6" />
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Interview dimensions bar chart (average) */}
                                            {(hasInterviewOverall || interviewBarData.some(d => d.score > 0)) && (
                                                <div>
                                                    <h3 className="text-sm font-semibold text-primary mb-3">Interview dimensions — average (out of 10)</h3>
                                                    <div className="h-64">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <BarChart data={interviewBarData} layout="vertical" margin={{ top: 14, right: 16, left: 80, bottom: 4 }}>
                                                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                                                <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                                                <YAxis type="category" dataKey="name" width={76} tick={{ fontSize: 11, fill: '#374151' }} />
                                                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(v: number | undefined) => [v != null ? `${v.toFixed(1)} / 10` : '—', 'Score']} />
                                                                <Bar dataKey="score" radius={[0, 4, 4, 0]} fill="#059669" />
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Multi-interviewer comparison */}
                                            {multiInterviewerChartData.length > 0 && (
                                                <div>
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
                                                </div>
                                            )}

                                            {!hasWrittenScores && !hasInterviewOverall && (
                                                <div className="text-center text-secondary py-8">
                                                    No written or interview scores yet. Charts will appear once scores are available.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

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
                            <Button variant="danger" onClick={() => handleDecision('reject')}>
                                <ThumbsDown className="w-4 h-4 mr-2" /> Reject
                            </Button>
                            <Button variant="secondary" onClick={() => handleDecision('waitlist')}>
                                <Clock className="w-4 h-4 mr-2" /> Waitlist
                            </Button>
                            <Button variant="primary" onClick={() => handleDecision('approve')}>
                                <ThumbsUp className="w-4 h-4 mr-2" /> Approve
                            </Button>
                        </>
                    ) : (
                        <div className="px-4 py-2 bg-surfaceHover text-secondary text-sm italic rounded-lg border border-border">
                            Awaiting conductor decision...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
