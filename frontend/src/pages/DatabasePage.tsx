import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import {
    Search, CheckCircle, XCircle, Clock, PauseCircle,
    ChevronDown, GraduationCap, MapPin, Loader2, Star
} from 'lucide-react';

export function DatabasePage() {
    const [candidates, setCandidates] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'waitlisted' | 'rejected'>('pending');

    useEffect(() => {
        async function fetchCandidates() {
            try {
                // Fetch all candidates from supabase
                const { data, error } = await supabase
                    .from('candidates')
                    .select('*')
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
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left text-sm whitespace-nowrap">
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
                                                <div className="truncate max-w-[300px] xl:max-w-[450px] 2xl:max-w-[600px]" title={cand.seminar_category}>
                                                    {cand.seminar_category || 'N/A'}
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
                                                <button className="text-xs font-medium text-accent hover:text-accent/80 transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-1 ml-auto">
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
        </div>
    );
}
