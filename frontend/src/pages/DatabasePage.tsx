import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { useConfirm } from '../components/ui/ConfirmModal';
import { standardizeCategory } from '../utils/categories';
import { useAuth } from '../context/AuthContext';
import {
    Search,
    CheckCircle,
    XCircle,
    Clock,
    PauseCircle,
    ChevronDown,
    GraduationCap,
    MapPin,
    Loader2,
    Star,
    X,
    ExternalLink,
    ArrowUpDown,
    SlidersHorizontal
} from 'lucide-react';

const TIER_OPTIONS = [
    { value: '', label: '—' },
    { value: 'auto_accept', label: 'Auto Accept' },
    { value: 'tier_1', label: 'Tier 1' },
    { value: 'tier_2', label: 'Tier 2' },
    { value: 'tier_3', label: 'Tier 3' },
    { value: 'tier_4', label: 'Tier 4' },
] as const;

const TIER_LABEL: Record<string, string> = {
    auto_accept: 'Auto Accept',
    tier_1: 'Tier 1',
    tier_2: 'Tier 2',
    tier_3: 'Tier 3',
    tier_4: 'Tier 4',
};

const TIER_COLOR: Record<string, string> = {
    auto_accept: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    tier_1: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    tier_2: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    tier_3: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    tier_4: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export function DatabasePage() {
    const [candidates, setCandidates] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'waitlisted' | 'rejected'>('pending');
    const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
    const [settingCurrentId, setSettingCurrentId] = useState<string | null>(null);
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [candidateTypeFilter, setCandidateTypeFilter] = useState<'all' | 'New' | 'Returning'>('all');
    const [tierFilter, setTierFilter] = useState<string>('all');
    const [interviewerFilter, setInterviewerFilter] = useState<string>('all');
    const [writtenScoreRange, setWrittenScoreRange] = useState<string>('all');
    const [interviewScoreRange, setInterviewScoreRange] = useState<string>('all');
    const [sortKey, setSortKey] = useState<'score_overall' | 'written_avg' | 'name'>('score_overall');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [savingRankingId, setSavingRankingId] = useState<string | null>(null);
    const confirmModal = useConfirm();
    const navigate = useNavigate();
    const { role } = useAuth();
    const isAdmin = role === 'admin';

    const getWrittenAvg = (cand: any) => {
        const scores = [
            cand.written_score_interest,
            cand.written_score_teaching,
            cand.written_score_seminar,
            cand.written_score_personal,
        ].filter((score) => typeof score === 'number');
        if (scores.length === 0) return null;
        const total = scores.reduce((sum, score) => sum + score, 0);
        return total / scores.length;
    };

    const getInterviewOverall = (cand: any) => {
        const notes = cand.interviews || [];
        const overalls = notes
            .map((n: any) => (typeof n.score_overall === 'number' ? n.score_overall : null))
            .filter((v: number | null): v is number => v !== null);
        if (overalls.length === 0) return cand.score_overall ?? null;
        return overalls.reduce((a: number, b: number) => a + b, 0) / overalls.length;
    };

    const getDisplayName = (cand: any) =>
        cand.full_name || `${cand.first_name ?? ''} ${cand.last_name ?? ''}`.trim();

    const getCategory = (cand: any) => {
        const raw = cand.seminar_category || cand.seminar_title;
        return raw ? standardizeCategory(raw) : 'Uncategorized';
    };

    const getInterviewerRankings = (cand: any): { interviewerId: string; name: string; ranking: string | null }[] => {
        const interviews = cand.interviews || [];
        return interviews.map((n: any) => ({
            interviewerId: n.id,
            name: n.interviewer_name || 'Unknown',
            ranking: n.interviewer_ranking || null,
        }));
    };

    const getCandidateTiers = (cand: any): string[] => {
        const interviews = cand.interviews || [];
        return interviews
            .map((n: any) => n.interviewer_ranking)
            .filter((r: any): r is string => !!r);
    };

    const updateInterviewerRanking = async (interviewId: string, candidateId: string, ranking: string | null) => {
        setSavingRankingId(interviewId);
        try {
            const { error } = await supabase
                .from('interviews')
                .update({ interviewer_ranking: ranking || null })
                .eq('id', interviewId);
            if (error) throw error;

            setCandidates(prev =>
                prev.map(c => {
                    if (c.id !== candidateId) return c;
                    return {
                        ...c,
                        interviews: (c.interviews || []).map((iv: any) =>
                            iv.id === interviewId ? { ...iv, interviewer_ranking: ranking || null } : iv
                        ),
                    };
                })
            );
            if (selectedCandidate?.id === candidateId) {
                setSelectedCandidate((prev: any) => prev ? {
                    ...prev,
                    interviews: (prev.interviews || []).map((iv: any) =>
                        iv.id === interviewId ? { ...iv, interviewer_ranking: ranking || null } : iv
                    ),
                } : prev);
            }
        } catch (err) {
            console.error('Failed to update interviewer ranking:', err);
        } finally {
            setSavingRankingId(null);
        }
    };

    useEffect(() => {
        async function fetchCandidates() {
            try {
                // Fetch only NEW SL candidates from supabase
                const { data, error } = await supabase
                    .from('candidates')
                    .select('*, interviews(*)')
                    .eq('candidate_type', 'New')
                    .order('score_overall', { ascending: false, nullsFirst: false });

                if (error) throw error;
                if (data) {
                    setCandidates(data);
                }
            } catch (err) {
                console.error("Error fetching candidates for database view:", err);
            } finally {
                setIsLoading(false);
            }
        }

        fetchCandidates();
    }, []);

    const categoryOptions = useMemo(() => {
        const unique = new Set<string>();
        candidates.forEach((cand) => {
            unique.add(getCategory(cand));
        });
        return Array.from(unique).sort((a, b) => a.localeCompare(b));
    }, [candidates]);

    const interviewerOptions = useMemo(() => {
        const unique = new Set<string>();
        candidates.forEach((cand) => {
            (cand.interviews || []).forEach((iv: any) => {
                if (iv.interviewer_name) unique.add(iv.interviewer_name);
            });
        });
        return Array.from(unique).sort((a, b) => a.localeCompare(b));
    }, [candidates]);

    const filteredCandidates = candidates.filter((cand) => {
        const matchesTab = cand.deliberation_status === activeTab;
        const searchInput = searchQuery.toLowerCase();
        const matchesSearch =
            (cand.full_name?.toLowerCase().includes(searchInput)) ||
            (cand.first_name?.toLowerCase().includes(searchInput)) ||
            (cand.last_name?.toLowerCase().includes(searchInput)) ||
            (cand.school?.toLowerCase().includes(searchInput));
        const matchesCategory = categoryFilter === 'all' || getCategory(cand) === categoryFilter;
        const matchesCandidateType =
            candidateTypeFilter === 'all' || cand.candidate_type === candidateTypeFilter;

        let matchesInterviewer = true;
        if (interviewerFilter !== 'all') {
            const interviewers = (cand.interviews || []).map((iv: any) => iv.interviewer_name);
            matchesInterviewer = interviewers.includes(interviewerFilter);
        }

        let matchesTier = true;
        if (tierFilter !== 'all') {
            const tiers = getCandidateTiers(cand);
            if (tierFilter === 'unranked') {
                matchesTier = tiers.length === 0;
            } else {
                matchesTier = tiers.includes(tierFilter);
            }
        }

        let matchesWrittenRange = true;
        if (writtenScoreRange !== 'all') {
            const [lo, hi] = writtenScoreRange.split('-').map(Number);
            const writtenAvg = getWrittenAvg(cand);
            matchesWrittenRange = writtenAvg != null && writtenAvg >= lo && writtenAvg <= hi;
        }

        let matchesInterviewRange = true;
        if (interviewScoreRange !== 'all') {
            const [lo, hi] = interviewScoreRange.split('-').map(Number);
            const interviewOverall = getInterviewOverall(cand);
            matchesInterviewRange = interviewOverall != null && interviewOverall >= lo && interviewOverall <= hi;
        }

        return matchesTab && matchesSearch && matchesCategory && matchesCandidateType && matchesInterviewer && matchesTier && matchesWrittenRange && matchesInterviewRange;
    });

    const sortedCandidates = useMemo(() => {
        const sorted = [...filteredCandidates];
        sorted.sort((a, b) => {
            let av: any;
            let bv: any;
            if (sortKey === 'score_overall') {
                av = getInterviewOverall(a);
                bv = getInterviewOverall(b);
            } else if (sortKey === 'written_avg') {
                av = getWrittenAvg(a);
                bv = getWrittenAvg(b);
            } else {
                av = getDisplayName(a).toLowerCase();
                bv = getDisplayName(b).toLowerCase();
            }

            if (av == null && bv == null) return 0;
            if (av == null) return 1;
            if (bv == null) return -1;

            if (typeof av === 'number' && typeof bv === 'number') {
                return sortDir === 'asc' ? av - bv : bv - av;
            }

            const comparison = String(av).localeCompare(String(bv));
            return sortDir === 'asc' ? comparison : -comparison;
        });
        return sorted;
    }, [filteredCandidates, sortKey, sortDir]);

    const hasActiveFilters =
        searchQuery.trim().length > 0 ||
        categoryFilter !== 'all' ||
        candidateTypeFilter !== 'all' ||
        interviewerFilter !== 'all' ||
        tierFilter !== 'all' ||
        writtenScoreRange !== 'all' ||
        interviewScoreRange !== 'all' ||
        sortKey !== 'score_overall' ||
        sortDir !== 'desc';

    const tabs = [
        { id: 'pending', label: 'Undecided', icon: Clock, color: 'text-blue-500' },
        { id: 'approved', label: 'Accepted', icon: CheckCircle, color: 'text-emerald-500' },
        { id: 'waitlisted', label: 'Waitlisted', icon: PauseCircle, color: 'text-amber-500' },
        { id: 'rejected', label: 'Rejected', icon: XCircle, color: 'text-red-500' },
    ];

    const closeDetails = () => setSelectedCandidate(null);

    const setAsCurrentForDeliberation = async (candidateId: string, goToDeliberation = false) => {
        setSettingCurrentId(candidateId);
        try {
            const { error } = await supabase
                .from('system_state')
                .update({ current_candidate_id: candidateId })
                .eq('id', 1);
            if (error) throw error;
            if (goToDeliberation) {
                navigate('/deliberate');
            }
        } catch (err) {
            console.error('Failed to set current candidate:', err);
        } finally {
            setSettingCurrentId(null);
        }
    };

    const updateDecision = async (candidateId: string, decision: 'pending' | 'approved' | 'waitlisted' | 'rejected') => {
        if (!isAdmin) return;
        const actionText = decision === 'approved'
            ? 'Approve'
            : decision === 'rejected'
                ? 'Reject'
                : decision === 'waitlisted'
                    ? 'Waitlist'
                    : 'Move to Undecided';
        const isConfirmed = await confirmModal.confirm({
            title: 'Confirm Decision Change',
            message: `Are you sure you want to ${actionText.toLowerCase()} this candidate?`,
            confirmText: actionText,
            destructive: decision === 'rejected',
        });

        if (!isConfirmed) return;

        try {
            const { data, error } = await supabase
                .from('candidates')
                .update({ deliberation_status: decision })
                .eq('id', candidateId)
                .select('id, deliberation_status')
                .single();

            if (error) throw error;

            setCandidates(prev =>
                prev.map(c => (c.id === candidateId ? { ...c, deliberation_status: data.deliberation_status } : c)),
            );
            setSelectedCandidate((prev: any | null) =>
                prev && prev.id === candidateId ? { ...prev, deliberation_status: data.deliberation_status } : prev,
            );
        } catch (err) {
            console.error('Failed to update deliberation decision:', err);
        }
    };

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="shrink-0 space-y-4">
                <div>
                    <h1 className="text-2xl font-bold text-primary tracking-tight">Candidate Database</h1>
                    <p className="text-sm text-secondary mt-1">View and manage all candidates categorized by their deliberation decisions.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    {/* Tabs */}
                    <div className="flex bg-surface p-1 rounded-lg border border-border w-full sm:w-auto overflow-x-auto shrink-0 relative">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`relative flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id
                                    ? 'text-primary'
                                    : 'text-secondary hover:text-primary hover:bg-black/5 dark:hover:bg-white/5'
                                    }`}
                            >
                                {activeTab === tab.id && (
                                    <motion.div
                                        layoutId="db-tab-highlight"
                                        className="absolute inset-0 bg-background shadow-sm rounded-md"
                                        initial={false}
                                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                                    />
                                )}
                                <div className="relative z-10 flex items-center gap-2">
                                    <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? tab.color : 'opacity-70'}`} />
                                    <span className="whitespace-nowrap">{tab.label}</span>
                                    <span className={`ml-1.5 px-2 py-0.5 rounded-full text-xs transition-colors ${activeTab === tab.id ? 'bg-black/5 dark:bg-white/10' : 'bg-transparent'
                                        }`}>
                                        {candidates.filter(c => c.deliberation_status === tab.id).length}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative w-full sm:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                        <input
                            type="text"
                            placeholder="Search by name or school..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm bg-surface border border-border rounded-sm placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-shadow"
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-secondary uppercase tracking-wider">
                        <SlidersHorizontal className="w-4 h-4" />
                        Filters & Sorting
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Category</label>
                            <div className="w-48 shrink-0 z-20">
                                <Select
                                    value={categoryFilter}
                                    onChange={(val) => setCategoryFilter(val)}
                                    options={[
                                        { value: 'all', label: 'All categories' },
                                        ...categoryOptions.map((category) => ({ value: category, label: category }))
                                    ]}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Type</label>
                            <div className="w-40 shrink-0 z-20">
                                <Select
                                    value={candidateTypeFilter}
                                    onChange={(val) => setCandidateTypeFilter(val as any)}
                                    options={[
                                        { value: 'all', label: 'All types' },
                                        { value: 'New', label: 'New' },
                                        { value: 'Returning', label: 'Returning' }
                                    ]}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Interviewer</label>
                            <div className="w-44 shrink-0 z-20">
                                <Select
                                    value={interviewerFilter}
                                    onChange={(val) => setInterviewerFilter(val)}
                                    options={[
                                        { value: 'all', label: 'All interviewers' },
                                        ...interviewerOptions.map((name) => ({ value: name, label: name }))
                                    ]}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Tier</label>
                            <div className="w-40 shrink-0 z-20">
                                <Select
                                    value={tierFilter}
                                    onChange={(val) => setTierFilter(val)}
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
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Sort</label>
                            <div className="w-48 shrink-0 z-30">
                                <Select
                                    value={sortKey}
                                    onChange={(val) => setSortKey(val as any)}
                                    options={[
                                        { value: 'score_overall', label: 'Score (Interview)' },
                                        { value: 'written_avg', label: 'Score (Written)' },
                                        { value: 'name', label: 'Name (A-Z)' }
                                    ]}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                                className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-surface border border-border rounded-lg text-primary hover:bg-surfaceHover transition-colors"
                                aria-label="Toggle sort order"
                            >
                                <ArrowUpDown className="w-4 h-4" />
                                {sortDir === 'asc' ? 'Asc' : 'Desc'}
                            </button>
                        </div>

                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery('');
                                    setCategoryFilter('all');
                                    setCandidateTypeFilter('all');
                                    setInterviewerFilter('all');
                                    setTierFilter('all');
                                    setWrittenScoreRange('all');
                                    setInterviewScoreRange('all');
                                    setSortKey('score_overall');
                                    setSortDir('desc');
                                }}
                                className="px-3 py-2 text-sm font-medium text-secondary hover:text-primary border border-border rounded-lg hover:bg-surfaceHover transition-colors"
                            >
                                Clear all
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Written Score</label>
                            <div className="w-36 shrink-0 z-10">
                                <Select
                                    value={writtenScoreRange}
                                    onChange={(val) => setWrittenScoreRange(val)}
                                    options={[
                                        { value: 'all', label: 'All scores' },
                                        { value: '0-1', label: '0.0 – 1.0' },
                                        { value: '1.1-2', label: '1.1 – 2.0' },
                                        { value: '2.1-3', label: '2.1 – 3.0' },
                                        { value: '3.1-4', label: '3.1 – 4.0' },
                                        { value: '4.1-5', label: '4.1 – 5.0' },
                                    ]}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Interview Score</label>
                            <div className="w-36 shrink-0 z-10">
                                <Select
                                    value={interviewScoreRange}
                                    onChange={(val) => setInterviewScoreRange(val)}
                                    options={[
                                        { value: 'all', label: 'All scores' },
                                        { value: '0-1', label: '0.0 – 1.0' },
                                        { value: '1.1-2', label: '1.1 – 2.0' },
                                        { value: '2.1-3', label: '2.1 – 3.0' },
                                        { value: '3.1-4', label: '3.1 – 4.0' },
                                        { value: '4.1-5', label: '4.1 – 5.0' },
                                        { value: '5.1-6', label: '5.1 – 6.0' },
                                        { value: '6.1-7', label: '6.1 – 7.0' },
                                        { value: '7.1-8', label: '7.1 – 8.0' },
                                        { value: '8.1-9', label: '8.1 – 9.0' },
                                        { value: '9.1-10', label: '9.1 – 10.0' },
                                    ]}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Card className="flex-1 flex flex-col overflow-hidden p-0">
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-surface/50 border-b border-border sticky top-0 z-10 backdrop-blur-sm">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-secondary">Candidate</th>
                                <th className="px-6 py-4 font-semibold text-secondary">Seminar Category</th>
                                <th className="px-6 py-4 font-semibold text-secondary">Score (Written)</th>
                                <th className="px-6 py-4 font-semibold text-secondary">Score (Interview)</th>
                                <th className="px-6 py-4 font-semibold text-secondary">Interviewer Rankings</th>
                                <th className="px-6 py-4 font-semibold text-secondary text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            <AnimatePresence mode="popLayout">
                                {sortedCandidates.length === 0 ? (
                                    <motion.tr
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                    >
                                        <td colSpan={6} className="px-6 py-12 text-center text-secondary">
                                            No candidates found within this category.
                                        </td>
                                    </motion.tr>
                                ) : (
                                    sortedCandidates.map((cand) => (
                                        <motion.tr
                                            key={cand.id}
                                            layout
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ duration: 0.2 }}
                                            className="hover:bg-surfaceHover/30 transition-colors group"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-semibold flex-shrink-0">
                                                        {(cand.first_name?.[0] || '') + (cand.last_name?.[0] || '')}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-primary flex items-center gap-2">
                                                            {getDisplayName(cand)}
                                                            {cand.candidate_type === 'Returning' && (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-semibold uppercase tracking-wider">Returning</span>
                                                            )}
                                                        </div>
                                                        <div className="text-secondary text-xs flex items-center gap-3 mt-1.5">
                                                            <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" /> {cand.school} '{cand.class_year}</span>
                                                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {cand.nationality}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-secondary">
                                                <div
                                                    className="truncate max-w-[220px] sm:max-w-[260px] md:max-w-[320px]"
                                                    title={cand.seminar_category || cand.seminar_title || undefined}
                                                >
                                                    {getCategory(cand)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5 font-medium text-primary">
                                                    <span className="text-muted">Avg:</span>
                                                    {getWrittenAvg(cand) !== null ? getWrittenAvg(cand)!.toFixed(1) : 'N/A'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5 font-medium text-primary">
                                                    <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 inline mr-1" />
                                                    {getInterviewOverall(cand) != null ? getInterviewOverall(cand)!.toFixed(1) : 'N/A'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-2">
                                                    {getInterviewerRankings(cand).length === 0 ? (
                                                        <span className="text-xs text-muted">No interviews</span>
                                                    ) : (
                                                        getInterviewerRankings(cand).map((iv) => (
                                                            <div key={iv.interviewerId} className="flex items-center gap-2">
                                                                <span className="text-[11px] text-secondary truncate shrink-0 max-w-[5rem]" title={iv.name}>
                                                                    {iv.name}
                                                                </span>
                                                                <select
                                                                    value={iv.ranking || ''}
                                                                    onChange={(e) => updateInterviewerRanking(iv.interviewerId, cand.id, e.target.value)}
                                                                    disabled={savingRankingId === iv.interviewerId}
                                                                    className={`text-xs px-2 py-1 rounded-full font-medium border focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 cursor-pointer transition-colors ${
                                                                        iv.ranking
                                                                            ? TIER_COLOR[iv.ranking] + ' border-transparent'
                                                                            : 'bg-surface border-border text-secondary'
                                                                    }`}
                                                                >
                                                                    {TIER_OPTIONS.map(opt => (
                                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {isAdmin && (
                                                        <button
                                                            className="text-xs font-medium text-accent hover:text-accent/80 transition-colors flex items-center gap-1 disabled:opacity-50"
                                                            onClick={() => setAsCurrentForDeliberation(cand.id, true)}
                                                            disabled={settingCurrentId === cand.id}
                                                            title="Set as current candidate and open Deliberation"
                                                        >
                                                            {settingCurrentId === cand.id ? (
                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                            ) : (
                                                                <ExternalLink className="w-3 h-3" />
                                                            )}
                                                            Open in deliberation
                                                        </button>
                                                    )}
                                                    <button
                                                        className="text-xs font-medium text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
                                                        onClick={() => setSelectedCandidate(cand)}
                                                    >
                                                        View Details <ChevronDown className="w-3 h-3 -rotate-90" />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </Card>

            {selectedCandidate && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
                    <div className="bg-background dark:bg-surface w-full max-w-4xl max-h-[90vh] rounded-md shadow-xl border border-border flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface/70 dark:bg-surfaceHover/40 backdrop-blur-sm">
                            <div>
                                <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
                                    {selectedCandidate.full_name || `${selectedCandidate.first_name} ${selectedCandidate.last_name}`}
                                    {selectedCandidate.candidate_type && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 font-semibold uppercase tracking-wider">
                                            {selectedCandidate.candidate_type}
                                        </span>
                                    )}
                                </h2>
                                <p className="text-xs text-secondary mt-1">
                                    {selectedCandidate.school} &middot; Class of {selectedCandidate.class_year} &middot; {selectedCandidate.major}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {isAdmin && (
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => {
                                            setAsCurrentForDeliberation(selectedCandidate.id, true);
                                            closeDetails();
                                        }}
                                        disabled={settingCurrentId === selectedCandidate.id}
                                    >
                                        {settingCurrentId === selectedCandidate.id ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                        ) : (
                                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                                        )}
                                        Open in deliberation
                                    </Button>
                                )}
                                <button
                                    onClick={closeDetails}
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-sm hover:bg-black/5 dark:hover:bg-white/10 text-secondary hover:text-primary transition-colors"
                                    aria-label="Close details"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="text-xs font-semibold text-secondary uppercase tracking-wider">Decision</span>
                                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-surfaceHover text-secondary">
                                    {selectedCandidate.deliberation_status || 'pending'}
                                </span>
                                {isAdmin && (
                                    <div className="flex flex-wrap items-center gap-2 ml-auto">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => updateDecision(selectedCandidate.id, 'pending')}
                                        >
                                            Undecided
                                        </Button>
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            onClick={() => updateDecision(selectedCandidate.id, 'rejected')}
                                        >
                                            Reject
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => updateDecision(selectedCandidate.id, 'waitlisted')}
                                        >
                                            Waitlist
                                        </Button>
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            onClick={() => updateDecision(selectedCandidate.id, 'approved')}
                                        >
                                            Approve
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Interviewer Rankings */}
                            {selectedCandidate.interviews && selectedCandidate.interviews.length > 0 && (
                                <div className="space-y-3">
                                    <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Interviewer Rankings</p>
                                    <div className="flex flex-wrap gap-3">
                                        {getInterviewerRankings(selectedCandidate).map((iv) => (
                                            <div key={iv.interviewerId} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface/30">
                                                <span className="text-sm font-medium text-primary">{iv.name}</span>
                                                <select
                                                    value={iv.ranking || ''}
                                                    onChange={(e) => updateInterviewerRanking(iv.interviewerId, selectedCandidate.id, e.target.value)}
                                                    disabled={savingRankingId === iv.interviewerId}
                                                    className={`text-sm px-3 py-1.5 rounded-full font-medium border focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 cursor-pointer transition-colors ${
                                                        iv.ranking
                                                            ? TIER_COLOR[iv.ranking] + ' border-transparent'
                                                            : 'bg-background border-border text-secondary'
                                                    }`}
                                                >
                                                    {TIER_OPTIONS.map(opt => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Email</p>
                                    <p className="text-sm text-primary break-all">{selectedCandidate.email}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Nationality</p>
                                    <p className="text-sm text-primary">{selectedCandidate.nationality || 'N/A'}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Seminar Category</p>
                                    <p
                                        className="inline-block px-2.5 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold"
                                        title={selectedCandidate.seminar_category || selectedCandidate.seminar_title || undefined}
                                    >
                                        {(selectedCandidate.seminar_category || selectedCandidate.seminar_title)
                                            ? standardizeCategory(selectedCandidate.seminar_category || selectedCandidate.seminar_title)
                                            : 'N/A'}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Interview Overall (avg)</p>
                                    <p className="text-sm text-primary font-semibold">
                                        {getInterviewOverall(selectedCandidate) != null
                                            ? `${getInterviewOverall(selectedCandidate)!.toFixed(1)} / 10`
                                            : 'N/A'}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Seminar Title & Description</p>
                                <p className="text-sm font-medium text-primary">
                                    {selectedCandidate.seminar_title || 'N/A'}
                                </p>
                                {selectedCandidate.seminar_description && (
                                    <p className="text-sm text-primary leading-relaxed bg-surface/60 dark:bg-surfaceHover p-3 rounded-lg border border-border">
                                        {selectedCandidate.seminar_description}
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Tangible Final Product</p>
                                    <p className="text-sm text-primary leading-relaxed">
                                        {selectedCandidate.final_product || 'N/A'}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Other Potential Topics</p>
                                    <p className="text-sm text-primary leading-relaxed">
                                        {selectedCandidate.more_topics || 'N/A'}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Interest in HSYLC Mission</p>
                                    <p className="text-sm text-primary leading-relaxed bg-surface/60 dark:bg-surfaceHover p-3 rounded-lg border border-border">
                                        {selectedCandidate.interest_reason || 'N/A'}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Teaching & Mentoring Experience</p>
                                    <p className="text-sm text-primary leading-relaxed bg-surface/60 dark:bg-surfaceHover p-3 rounded-lg border border-border">
                                        {selectedCandidate.teaching_exp || 'N/A'}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Self Introduction</p>
                                    <p className="text-sm text-primary leading-relaxed bg-surface/60 dark:bg-surfaceHover p-3 rounded-lg border border-border">
                                        {selectedCandidate.self_intro || 'N/A'}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Advice for a High Schooler</p>
                                    <p className="text-sm text-primary leading-relaxed bg-surface/60 dark:bg-surfaceHover p-3 rounded-lg border border-border italic">
                                        {selectedCandidate.advice ? `"${selectedCandidate.advice}"` : 'N/A'}
                                    </p>
                                </div>
                            </div>

                            {/* Scores overview */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-3 rounded-lg border border-border bg-surface/50">
                                    <p className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-1">Written Avg</p>
                                    <p className="text-xl font-bold text-primary">
                                        {getWrittenAvg(selectedCandidate) != null ? `${getWrittenAvg(selectedCandidate)!.toFixed(2)}` : '—'}
                                        <span className="text-xs font-normal text-secondary ml-1">/ 5</span>
                                    </p>
                                </div>
                                <div className="p-3 rounded-lg border border-border bg-surface/50">
                                    <p className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-1">Interview Overall (avg)</p>
                                    <p className="text-xl font-bold text-primary">
                                        {getInterviewOverall(selectedCandidate) != null ? `${getInterviewOverall(selectedCandidate)!.toFixed(1)}` : '—'}
                                        <span className="text-xs font-normal text-secondary ml-1">/ 10</span>
                                    </p>
                                </div>
                                <div className="p-3 rounded-lg border border-border bg-surface/50">
                                    <p className="text-[10px] font-semibold text-secondary uppercase tracking-wider mb-1">Empirical</p>
                                    <p className="text-xl font-bold text-primary">
                                        {typeof selectedCandidate.score_empirical === 'number' ? `${selectedCandidate.score_empirical.toFixed(1)}` : '—'}
                                        <span className="text-xs font-normal text-secondary ml-1">/ 10</span>
                                    </p>
                                </div>
                            </div>

                            {/* Written scores */}
                            <div className="space-y-3">
                                <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Written Scores (out of 5)</p>
                                <div className="space-y-2">
                                    {[
                                        { label: 'Interest', value: selectedCandidate.written_score_interest },
                                        { label: 'Teaching', value: selectedCandidate.written_score_teaching },
                                        { label: 'Seminar', value: selectedCandidate.written_score_seminar },
                                        { label: 'Personal', value: selectedCandidate.written_score_personal },
                                    ].map(({ label, value }) => (
                                        <div key={label} className="flex items-center gap-3">
                                            <span className="text-xs text-secondary w-16 shrink-0">{label}</span>
                                            <div className="flex-1 h-2 bg-surfaceHover rounded-full overflow-hidden">
                                                <motion.div
                                                    className="h-full rounded-full bg-gray-400 dark:bg-gray-500"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: typeof value === 'number' ? `${(value / 5) * 100}%` : '0%' }}
                                                    transition={{ type: 'spring', stiffness: 160, damping: 22 }}
                                                />
                                            </div>
                                            <span className="text-xs font-semibold text-primary w-8 text-right tabular-nums">
                                                {typeof value === 'number' ? value.toFixed(1) : '—'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Interview notes per interviewer */}
                            {selectedCandidate.interviews && selectedCandidate.interviews.length > 0 && (
                                <div className="space-y-3">
                                    <p className="text-xs font-semibold text-secondary uppercase tracking-wider">
                                        Interview Notes ({selectedCandidate.interviews.length} interviewer{selectedCandidate.interviews.length > 1 ? 's' : ''})
                                    </p>
                                    <div className={`grid ${selectedCandidate.interviews.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} gap-4`}>
                                        {selectedCandidate.interviews.map((note: any, idx: number) => {
                                            const dims = [
                                                { label: 'Understanding', value: note.score_understanding },
                                                { label: 'Enthusiasm', value: note.score_enthusiasm },
                                                { label: 'Quality', value: note.score_quality },
                                                { label: 'Teaching', value: note.score_teaching },
                                                { label: 'Interest', value: note.score_interest },
                                            ];
                                            return (
                                                <div key={idx} className="p-4 rounded-lg border border-border bg-surface/30 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-semibold text-primary">
                                                            {note.interviewer_name || `Interviewer ${idx + 1}`}
                                                        </span>
                                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                                                            Overall {typeof note.score_overall === 'number' ? note.score_overall.toFixed(1) : '—'}/10
                                                        </span>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        {dims.map(({ label, value }) => (
                                                            <div key={label} className="flex items-center gap-2">
                                                                <span className="text-[11px] text-secondary w-20 shrink-0">{label}</span>
                                                                <div className="flex-1 h-1.5 bg-surfaceHover rounded-full overflow-hidden">
                                                                    <motion.div
                                                                        className="h-full rounded-full bg-accent/70"
                                                                        initial={{ width: 0 }}
                                                                        animate={{ width: typeof value === 'number' ? `${(value / 5) * 100}%` : '0%' }}
                                                                        transition={{ type: 'spring', stiffness: 160, damping: 22 }}
                                                                    />
                                                                </div>
                                                                <span className="text-[11px] font-semibold text-primary w-6 text-right tabular-nums">
                                                                    {typeof value === 'number' ? value.toFixed(1) : '—'}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {note.notes_comments && (
                                                        <div className="pt-2 border-t border-border">
                                                            <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Comments</p>
                                                            <p className="text-xs text-primary leading-relaxed">{note.notes_comments}</p>
                                                        </div>
                                                    )}
                                                    {note.sensitive_flag && (
                                                        <div className="px-2 py-1 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-200 text-[11px] font-medium">
                                                            Sensitive topics flagged
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
