import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useConfirm } from '../components/ui/ConfirmModal';
import {
    User, Mail, GraduationCap, ChevronRight, ChevronLeft,
    ThumbsUp, ThumbsDown, Loader2, Globe, FileText, MessageSquare
} from 'lucide-react';

// Comprehensive Mock Data structured according to the Example.xlsx schema
const MOCK_CANDIDATES = [
    {
        id: 'CAND-001',
        name: 'Alex Johnson',
        email: 'alex.j@example.com',
        school: 'Harvard University',
        major: 'Computer Science & Economics',
        year: 'Junior',
        nationality: 'USA',

        // Seminar Details
        seminarTitle: 'Introduction to Modern Web Architecture',
        seminarCategory: 'STEM',
        seminarDescription: 'A comprehensive journey into building distributed data-intensive applications, focusing on architectural patterns that scale. Students will learn the building blocks of the modern internet.',
        finalProduct: 'A functioning full-stack web application deployed to the cloud, using a React frontend and Node.js backend. Materials needed: laptops with internet access.',
        moreTopics: 'Algorithms, Machine Learning Basics, Product Management',

        // Written Responses
        interestReason: 'I am passionate about cross-cultural exchange and believe that empowering high school students with modern technical skills can bridge gaps in global understanding.',
        teachingExp: 'I was a teaching fellow for CS50 last semester and have tutored high school math for 3 years.',
        advice: 'Never be afraid to ask for help; the most successful people are those who build strong support networks.',
        selfIntro: 'Hi! I am Alex, a junior at Harvard studying CS and Econ. I am the captain of the ultimate frisbee team and love building software that helps people.',

        // Interview Info & Scores (Normalized)
        interviewer: 'David Bae',
        scores: {
            writtenOverall: 8.5,
            understanding: 9.0,
            enthusiasm: 10.0,
            quality: 8.5,
            teaching: 9.0,
            interestEngaging: 9.5,
            overall: 9.1
        },
        interviewNotes: {
            whySL: 'Very articulate about wanting to mentor younger students. Clearly understands the mission.',
            seminar: 'Solid technical background. The final product might be a bit ambitious for 9 days, but they are willing to adapt.',
            extracurricular: 'Excited to lead sports activities and college prep panels.',
            teachMe: 'Taught me how to solve a Rubik\'s cube in 2 minutes. Very patient and clear.',
            comments: 'Strong candidate. Recommend accepting.'
        }
    },
    {
        id: 'CAND-002',
        name: 'Sarah Chen',
        email: 'schen@example.edu',
        school: 'Stanford University',
        major: 'Symbolic Systems',
        year: 'Senior',
        nationality: 'Canada',

        // Seminar Details
        seminarTitle: 'The Ethics of Artificial Intelligence',
        seminarCategory: 'Humanities & Social Sciences',
        seminarDescription: 'Exploring the moral implications of deploying large language models in healthcare and education contexts.',
        finalProduct: 'A policy brief proposing ethical guidelines for AI use in a specific industry. Materials needed: notebooks, laptops for research.',
        moreTopics: 'Cognitive Science, Bioethics, Creative Writing',

        // Written Responses
        interestReason: 'Having attended a similar summit in high school, I know how transformative these experiences are. I want to pay it forward.',
        teachingExp: 'Led debate camps for high schoolers for the past two summers.',
        advice: 'Your major does not define your career. Follow your curiosity.',
        selfIntro: 'I am Sarah! I love debating, philosophy, and hiking. I am currently researching AI alignment at Stanford.',

        // Interview Info & Scores (Normalized)
        interviewer: 'Alice Wang',
        scores: {
            writtenOverall: 9.5,
            understanding: 8.0,
            enthusiasm: 9.5,
            quality: 10.0,
            teaching: 9.5,
            interestEngaging: 8.5,
            overall: 9.2
        },
        interviewNotes: {
            whySL: 'Wants to inspire critical thinking about technology. Very passionate.',
            seminar: 'Fascinating topic, highly relevant. She has great discussion questions prepared.',
            extracurricular: 'Interested in hosting debate workshops and philosophy cafes.',
            teachMe: 'Explained the Trolley Problem variants clearly and engagingly.',
            comments: 'Excellent communicator. Will be a fantastic SL.'
        }
    }
];

export function DeliberationPage() {
    const [candidates] = useState(MOCK_CANDIDATES);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction, setDirection] = useState(0);
    const [isLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'seminar' | 'written' | 'interview'>('seminar');
    const confirmModal = useConfirm();

    const candidate = candidates[currentIndex];

    const nextCandidate = () => {
        if (currentIndex < candidates.length - 1) {
            setDirection(1);
            setCurrentIndex(i => i + 1);
            setActiveTab('seminar'); // Reset tab on change
        }
    };

    const prevCandidate = () => {
        if (currentIndex > 0) {
            setDirection(-1);
            setCurrentIndex(i => i - 1);
            setActiveTab('seminar'); // Reset tab on change
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
            // Logic for supabase save goes here
            nextCandidate();
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
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full pb-8">

                            {/* Left Column: Candidate Profile & Standardized Scores */}
                            <div className="lg:col-span-4 flex flex-col gap-6 h-full overflow-y-auto pr-1">
                                <Card className="flex flex-col shrink-0">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="w-16 h-16 rounded-full bg-surfaceHover flex items-center justify-center border border-border">
                                            <User className="w-8 h-8 text-secondary" />
                                        </div>
                                    </div>
                                    <h2 className="text-2xl font-bold text-primary">{candidate.name}</h2>

                                    <div className="space-y-2 mt-4">
                                        <div className="flex items-center text-sm text-secondary">
                                            <GraduationCap className="w-4 h-4 mr-3 text-muted" />
                                            {candidate.school}, {candidate.year}
                                        </div>
                                        <div className="flex items-center text-sm text-secondary">
                                            <Globe className="w-4 h-4 mr-3 text-muted" />
                                            {candidate.nationality}
                                        </div>
                                        <div className="flex items-center text-sm text-secondary">
                                            <Mail className="w-4 h-4 mr-3 text-muted" />
                                            <span className="truncate">{candidate.email}</span>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-border">
                                        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Major / Concentration</p>
                                        <p className="text-sm font-medium text-primary">{candidate.major}</p>
                                    </div>

                                    {/* Decision Buttons inside Profile Card */}
                                    <div className="mt-6 flex flex-col gap-2">
                                        <Button variant="primary" className="w-full justify-center" onClick={() => handleDecision('approve')}>
                                            <ThumbsUp className="w-4 h-4 mr-2" /> Approve
                                        </Button>
                                        <Button variant="danger" className="w-full justify-center" onClick={() => handleDecision('reject')}>
                                            <ThumbsDown className="w-4 h-4 mr-2" /> Reject
                                        </Button>
                                    </div>
                                </Card>

                                <Card className="shrink-0 mb-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-sm font-semibold text-primary">Standardized Scores</h3>
                                        <div className="text-xs px-2 py-1 bg-surfaceHover text-secondary rounded font-medium">
                                            Overall: {candidate.scores.overall.toFixed(1)}
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        {renderProgressBar('Written App', candidate.scores.writtenOverall)}
                                        {renderProgressBar('Understanding of HSYLC', candidate.scores.understanding)}
                                        {renderProgressBar('Enthusiasm', candidate.scores.enthusiasm)}
                                        {renderProgressBar('Seminar Quality', candidate.scores.quality)}
                                        {renderProgressBar('Teaching Level', candidate.scores.teaching)}
                                        {renderProgressBar('Extracurricular Interest', candidate.scores.interestEngaging)}
                                    </div>
                                </Card>
                            </div>

                            {/* Right Column: Detailed Context Tabs */}
                            <div className="lg:col-span-8 flex flex-col h-full bg-white dark:bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
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
                                </div>

                                {/* Tab Content Area (Scrollable) */}
                                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                                    {activeTab === 'seminar' && (
                                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div>
                                                <div className="inline-block px-2.5 py-1 bg-accent/10 text-accent rounded-full text-xs font-semibold tracking-wide mb-3">
                                                    {candidate.seminarCategory}
                                                </div>
                                                <h2 className="text-2xl font-bold text-primary">{candidate.seminarTitle}</h2>
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
                                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div className="flex items-center gap-2 mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-100 dark:border-blue-800">
                                                <User className="w-4 h-4" />
                                                <span className="text-sm font-medium">Interviewed by: <strong>{candidate.interviewer}</strong></span>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="p-4 rounded-lg border border-border">
                                                    <h4 className="text-sm font-semibold text-primary mb-1">Why SL & HSYLC Understanding</h4>
                                                    <p className="text-sm text-secondary">{candidate.interviewNotes.whySL}</p>
                                                </div>
                                                <div className="p-4 rounded-lg border border-border">
                                                    <h4 className="text-sm font-semibold text-primary mb-1">Seminar Feedback</h4>
                                                    <p className="text-sm text-secondary">{candidate.interviewNotes.seminar}</p>
                                                </div>
                                                <div className="p-4 rounded-lg border border-border">
                                                    <h4 className="text-sm font-semibold text-primary mb-1">Extracurricular Impact</h4>
                                                    <p className="text-sm text-secondary">{candidate.interviewNotes.extracurricular}</p>
                                                </div>
                                                <div className="p-4 rounded-lg border border-border">
                                                    <h4 className="text-sm font-semibold text-primary mb-1">"Teach Me in 2 Minutes" Performance</h4>
                                                    <p className="text-sm text-secondary">{candidate.interviewNotes.teachMe}</p>
                                                </div>
                                                <div className="p-4 rounded-lg border border-border bg-surface dark:bg-surfaceHover/50">
                                                    <h4 className="text-sm font-semibold text-primary mb-1">Overall Comments</h4>
                                                    <p className="text-sm text-primary font-medium">{candidate.interviewNotes.comments}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
