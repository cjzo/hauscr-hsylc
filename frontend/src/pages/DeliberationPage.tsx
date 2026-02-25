import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useConfirm } from '../components/ui/ConfirmModal';
import { User, Mail, GraduationCap, ChevronRight, ChevronLeft, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
// import { supabase } from '../lib/supabase'; // Will use this later

// Placeholder mock data to use until Supabase is populated
const MOCK_CANDIDATES = [
    {
        id: 'CAND-001',
        name: 'Alex Johnson',
        email: 'alex.j@example.com',
        school: 'Harvard University',
        major: 'Computer Science & Economics',
        year: 'Junior',
        seminarTitle: 'Introduction to Modern Web Architecture',
        seminarDescription: 'A comprehensive journey into building distributed data-intensive applications, focusing on architectural patterns that scale.',
        interviewScores: { communication: 9, content: 8, enthusiasm: 10 }
    },
    {
        id: 'CAND-002',
        name: 'Sarah Chen',
        email: 'schen@example.edu',
        school: 'Stanford University',
        major: 'Symbolic Systems',
        year: 'Senior',
        seminarTitle: 'The Ethics of Artificial Intelligence',
        seminarDescription: 'Exploring the moral implications of deploying large language models in healthcare and education contexts.',
        interviewScores: { communication: 10, content: 9, enthusiasm: 9 }
    }
];

export function DeliberationPage() {
    const [candidates] = useState(MOCK_CANDIDATES);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction, setDirection] = useState(0);
    const [isLoading] = useState(false);
    const confirmModal = useConfirm();

    // In a real scenario, fetch candidates here
    // useEffect(() => {
    //   const fetchCandidates = async () => { ... }
    // }, []);

    const candidate = candidates[currentIndex];

    const nextCandidate = () => {
        if (currentIndex < candidates.length - 1) {
            setDirection(1);
            setCurrentIndex(i => i + 1);
        }
    };

    const prevCandidate = () => {
        if (currentIndex > 0) {
            setDirection(-1);
            setCurrentIndex(i => i - 1);
        }
    };

    const handleDecision = async (decision: 'approve' | 'reject') => {
        const isConfirmed = await confirmModal.confirm({
            title: `Confirm Decision`,
            message: `Are you sure you want to ${decision} ${candidate.name}'s application?`,
            confirmText: decision === 'approve' ? 'Approve' : 'Reject',
            destructive: decision === 'reject'
        });

        if (isConfirmed) {
            console.log(`Decision: ${decision} for ${candidate.name}`);
            nextCandidate();
        }
    };

    const variants = {
        enter: (dir: number) => ({
            x: dir > 0 ? 50 : -50,
            opacity: 0,
        }),
        center: {
            x: 0,
            opacity: 1,
        },
        exit: (dir: number) => ({
            x: dir < 0 ? 50 : -50,
            opacity: 0,
        }),
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

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-primary tracking-tight">Application Review</h1>
                    <p className="text-sm text-secondary mt-1">Reviewing candidate {currentIndex + 1} of {candidates.length}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={prevCandidate} disabled={currentIndex === 0}>
                        <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                    </Button>
                    <Button variant="secondary" size="sm" onClick={nextCandidate} disabled={currentIndex === candidates.length - 1}>
                        Next <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
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
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full pb-8">
                            {/* Left Column: Candidate Info */}
                            <div className="col-span-1 flex flex-col gap-6 h-full">
                                <Card className="flex flex-col">
                                    <div className="w-16 h-16 rounded-full bg-surfaceHover flex items-center justify-center mb-4 border border-border">
                                        <User className="w-8 h-8 text-secondary" />
                                    </div>
                                    <h2 className="text-xl font-bold text-primary">{candidate.name}</h2>
                                    <div className="flex items-center text-sm text-secondary mt-3">
                                        <Mail className="w-4 h-4 mr-2 text-muted" />
                                        {candidate.email}
                                    </div>
                                    <div className="flex items-center text-sm text-secondary mt-2">
                                        <GraduationCap className="w-4 h-4 mr-2 text-muted" />
                                        {candidate.school}, {candidate.year}
                                    </div>
                                    <div className="mt-2 text-sm text-secondary pl-6">
                                        {candidate.major}
                                    </div>
                                </Card>

                                <Card className="flex-1 max-h-fit">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">Interview Scores</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex justify-between text-sm mb-1.5">
                                                <span className="text-secondary font-medium">Communication</span>
                                                <span className="font-semibold">{candidate.interviewScores.communication}/10</span>
                                            </div>
                                            <div className="w-full bg-surfaceHover h-1.5 rounded-full overflow-hidden">
                                                <div className="bg-accent h-full transition-all duration-500" style={{ width: `${candidate.interviewScores.communication * 10}%` }} />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-sm mb-1.5">
                                                <span className="text-secondary font-medium">Content Quality</span>
                                                <span className="font-semibold">{candidate.interviewScores.content}/10</span>
                                            </div>
                                            <div className="w-full bg-surfaceHover h-1.5 rounded-full overflow-hidden">
                                                <div className="bg-accent h-full transition-all duration-500" style={{ width: `${candidate.interviewScores.content * 10}%` }} />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-sm mb-1.5">
                                                <span className="text-secondary font-medium">Enthusiasm</span>
                                                <span className="font-semibold">{candidate.interviewScores.enthusiasm}/10</span>
                                            </div>
                                            <div className="w-full bg-surfaceHover h-1.5 rounded-full overflow-hidden">
                                                <div className="bg-accent h-full transition-all duration-500" style={{ width: `${candidate.interviewScores.enthusiasm * 10}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </div>

                            {/* Right Column: Seminar Info and Action */}
                            <div className="col-span-1 md:col-span-2 flex flex-col gap-6 h-full">
                                <Card className="flex-1 flex flex-col overflow-hidden">
                                    <div className="h-full flex flex-col overflow-y-auto pr-2">
                                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">Proposed Seminar Content</h3>
                                        <h4 className="text-xl font-bold text-primary mb-3 leading-tight">{candidate.seminarTitle}</h4>
                                        <div className="bg-surface rounded-md p-4 border border-border text-sm text-secondary leading-relaxed whitespace-pre-wrap">
                                            {candidate.seminarDescription}
                                        </div>
                                    </div>
                                </Card>
                                <Card className="bg-surface/30 border-dashed shrink-0">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">Deliberation Decision</h3>
                                    <div className="flex gap-4">
                                        <Button variant="danger" className="flex-1 h-12 text-base shadow-sm" onClick={() => handleDecision('reject')}>
                                            <ThumbsDown className="w-4 h-4 mr-2" />
                                            Reject Candidate
                                        </Button>
                                        <Button variant="primary" className="flex-1 h-12 text-base" onClick={() => handleDecision('approve')}>
                                            <ThumbsUp className="w-4 h-4 mr-2" />
                                            Approve Candidate
                                        </Button>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
