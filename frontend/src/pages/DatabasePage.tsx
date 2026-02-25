import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { standardizeCategory } from '../utils/categories';
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
    X
} from 'lucide-react';

export function DatabasePage() {
    const [candidates, setCandidates] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'waitlisted' | 'rejected'>('pending');
    const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);

    useEffect(() => {
        async function fetchCandidates() {
            try {
                // Fetch only NEW SL candidates from supabase
                const { data, error } = await supabase
                    .from('candidates')
                    .select('*')
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

    const filteredCandidates = candidates.filter(cand => {
        const matchesTab = cand.deliberation_status === activeTab;
        const searchInput = searchQuery.toLowerCase();
        const matchesSearch =
            (cand.full_name?.toLowerCase().includes(searchInput)) ||
            (cand.first_name?.toLowerCase().includes(searchInput)) ||
            (cand.last_name?.toLowerCase().includes(searchInput)) ||
            (cand.school?.toLowerCase().includes(searchInput));

        return matchesTab && matchesSearch;
    });

    const tabs = [
        { id: 'pending', label: 'Undecided', icon: Clock, color: 'text-blue-500' },
        { id: 'approved', label: 'Accepted', icon: CheckCircle, color: 'text-emerald-500' },
        { id: 'waitlisted', label: 'Waitlisted', icon: PauseCircle, color: 'text-amber-500' },
        { id: 'rejected', label: 'Rejected', icon: XCircle, color: 'text-red-500' },
    ];

    const closeDetails = () => setSelectedCandidate(null);

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
                    <div className="flex bg-surface p-1 rounded-lg border border-border w-full sm:w-auto overflow-x-auto shrink-0">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab.id
                                    ? 'bg-background shadow-sm text-primary'
                                    : 'text-secondary hover:text-primary hover:bg-black/5 dark:hover:bg-white/5'
                                    }`}
                            >
                                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? tab.color : 'opacity-70'}`} />
                                <span className="whitespace-nowrap">{tab.label}</span>
                                <span className={`ml-1.5 px-2 py-0.5 rounded-full text-xs ${activeTab === tab.id ? 'bg-black/5 dark:bg-white/10' : 'bg-transparent'
                                    }`}>
                                    {candidates.filter(c => c.deliberation_status === tab.id).length}
                                </span>
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
                            className="w-full pl-9 pr-4 py-2 text-sm bg-surface border border-border rounded-lg placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-shadow"
                        />
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
                                <th className="px-6 py-4 font-semibold text-secondary text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            <AnimatePresence mode="popLayout">
                                {filteredCandidates.length === 0 ? (
                                    <motion.tr
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                    >
                                        <td colSpan={5} className="px-6 py-12 text-center text-secondary">
                                            No candidates found within this category.
                                        </td>
                                    </motion.tr>
                                ) : (
                                    filteredCandidates.map((cand) => (
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
                                                            {cand.full_name || `${cand.first_name} ${cand.last_name}`}
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
                                                    {(cand.seminar_category || cand.seminar_title)
                                                        ? standardizeCategory(cand.seminar_category || cand.seminar_title)
                                                        : 'N/A'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5 font-medium text-primary">
                                                    <span className="text-muted">Avg:</span>
                                                    {cand.written_score_seminar ?
                                                        ((cand.written_score_interest + cand.written_score_teaching + cand.written_score_seminar + cand.written_score_personal) / 4).toFixed(1)
                                                        : 'N/A'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5 font-medium text-primary">
                                                    <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 inline mr-1" />
                                                    {cand.score_overall ? cand.score_overall.toFixed(1) : 'N/A'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    className="text-xs font-medium text-accent hover:text-accent/80 transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-1 ml-auto"
                                                    onClick={() => setSelectedCandidate(cand)}
                                                >
                                                    View Details <ChevronDown className="w-3 h-3 -rotate-90" />
                                                </button>
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
                    <div className="bg-background dark:bg-surface w-full max-w-4xl max-h-[90vh] rounded-xl shadow-xl border border-border flex flex-col overflow-hidden">
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
                            <button
                                onClick={closeDetails}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-secondary hover:text-primary transition-colors"
                                aria-label="Close details"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-muted uppercase tracking-wider">Email</p>
                                    <p className="text-sm text-primary break-all">{selectedCandidate.email}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-muted uppercase tracking-wider">Nationality</p>
                                    <p className="text-sm text-primary">{selectedCandidate.nationality || 'N/A'}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-muted uppercase tracking-wider">Seminar Category</p>
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
                                    <p className="text-xs font-semibold text-muted uppercase tracking-wider">Overall Score</p>
                                    <p className="text-sm text-primary font-semibold">
                                        {typeof selectedCandidate.score_overall === 'number'
                                            ? selectedCandidate.score_overall.toFixed(1)
                                            : 'N/A'}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Seminar Title & Description</p>
                                <p className="text-sm font-medium text-primary">
                                    {selectedCandidate.seminar_title || 'N/A'}
                                </p>
                                {selectedCandidate.seminar_description && (
                                    <p className="text-sm text-secondary leading-relaxed bg-surface/60 dark:bg-surfaceHover p-3 rounded-lg border border-border">
                                        {selectedCandidate.seminar_description}
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-muted uppercase tracking-wider">Tangible Final Product</p>
                                    <p className="text-sm text-secondary leading-relaxed">
                                        {selectedCandidate.final_product || 'N/A'}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-muted uppercase tracking-wider">Other Potential Topics</p>
                                    <p className="text-sm text-secondary leading-relaxed">
                                        {selectedCandidate.more_topics || 'N/A'}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-muted uppercase tracking-wider">Interest in HSYLC Mission</p>
                                    <p className="text-sm text-secondary leading-relaxed bg-surface/60 dark:bg-surfaceHover p-3 rounded-lg border border-border">
                                        {selectedCandidate.interest_reason || 'N/A'}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-muted uppercase tracking-wider">Teaching & Mentoring Experience</p>
                                    <p className="text-sm text-secondary leading-relaxed bg-surface/60 dark:bg-surfaceHover p-3 rounded-lg border border-border">
                                        {selectedCandidate.teaching_exp || 'N/A'}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-muted uppercase tracking-wider">Self Introduction</p>
                                    <p className="text-sm text-secondary leading-relaxed bg-surface/60 dark:bg-surfaceHover p-3 rounded-lg border border-border">
                                        {selectedCandidate.self_intro || 'N/A'}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-muted uppercase tracking-wider">Advice for a High Schooler</p>
                                    <p className="text-sm text-secondary leading-relaxed bg-surface/60 dark:bg-surfaceHover p-3 rounded-lg border border-border italic">
                                        {selectedCandidate.advice ? `"${selectedCandidate.advice}"` : 'N/A'}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Written Scores (out of 5)</p>
                                <div className="flex flex-wrap gap-3 text-xs">
                                    <span className="px-2 py-1 rounded-full bg-surfaceHover text-secondary">
                                        Interest:{' '}
                                        <span className="font-semibold text-primary">
                                            {selectedCandidate.written_score_interest ?? 'N/A'}
                                        </span>
                                    </span>
                                    <span className="px-2 py-1 rounded-full bg-surfaceHover text-secondary">
                                        Teaching:{' '}
                                        <span className="font-semibold text-primary">
                                            {selectedCandidate.written_score_teaching ?? 'N/A'}
                                        </span>
                                    </span>
                                    <span className="px-2 py-1 rounded-full bg-surfaceHover text-secondary">
                                        Seminar:{' '}
                                        <span className="font-semibold text-primary">
                                            {selectedCandidate.written_score_seminar ?? 'N/A'}
                                        </span>
                                    </span>
                                    <span className="px-2 py-1 rounded-full bg-surfaceHover text-secondary">
                                        Personal:{' '}
                                        <span className="font-semibold text-primary">
                                            {selectedCandidate.written_score_personal ?? 'N/A'}
                                        </span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
