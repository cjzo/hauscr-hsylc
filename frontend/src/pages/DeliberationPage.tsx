import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useConfirm } from '../components/ui/ConfirmModal';
import {
    User, Mail, GraduationCap, ChevronRight, ChevronLeft,
    ThumbsUp, ThumbsDown, Loader2, FileText, MessageSquare, PanelLeft, Clock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { standardizeCategory } from '../utils/categories';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

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
        seminarCategory: 'Data, Engineering, & Technology',
        seminarDescription: 'A comprehensive journey into building distributed data-intensive applications, focusing on architectural patterns that scale. Students will learn the building blocks of the modern internet.',
        finalProduct: 'A functioning full-stack web application deployed to the cloud, using a React frontend and Node.js backend. Materials needed: laptops with internet access.',
        moreTopics: 'Algorithms, Machine Learning Basics, Product Management',

        // Written Responses
        interestReason: 'I am passionate about cross-cultural exchange and believe that empowering high school students with modern technical skills can bridge gaps in global understanding.',
        teachingExp: 'I was a teaching fellow for CS50 last semester and have tutored high school math for 3 years.',
        advice: 'Never be afraid to ask for help; the most successful people are those who build strong support networks.',
        selfIntro: 'Hi! I am Alex, a junior at Harvard studying CS and Econ. I am the captain of the ultimate frisbee team and love building software that helps people.',

        // Interview Info & Scores (Normalized)
        scores: {
            writtenInterest: 9.0,
            writtenTeaching: 8.5,
            writtenSeminar: 9.0,
            writtenPersonal: 9.5,
            understanding: 9.0,
            enthusiasm: 10.0,
            quality: 8.5,
            teaching: 9.0,
            interestEngaging: 9.5,
            overall: 9.1
        },
        sensitiveIssues: 'No',
        flyFrom: 'BOS',
        flyTo: 'PVG',
        availability: 'Available from Aug 11 - 21',
        interviewNotes: [
            {
                interviewer: 'David Bae',
                notes_why_sl: 'Very articulate about wanting to mentor younger students. Clearly understands the mission.',
                notes_seminar: 'Solid technical background. The final product might be a bit ambitious for 9 days, but they are willing to adapt.',
                notes_extracurricular: 'Excited to lead sports activities and college prep panels.',
                notes_teach_me: 'Taught me how to solve a Rubik\'s cube in 2 minutes. Very patient and clear.',
                notes_commitment: 'Says he can fully commit to the spring and summer deliverables.',
                notes_comments: 'Strong candidate. Recommend accepting.',
                score_enthusiasm: 10.0,
                score_quality: 8.5,
                score_teaching: 9.0,
                score_interest: 9.5,
                score_overall: 9.25
            },
            {
                interviewer: 'Alice Wang',
                notes_why_sl: 'Passionate and ready to commit.',
                notes_seminar: 'We discussed adjusting the final product scope, and he was very receptive.',
                notes_extracurricular: 'Can definitely lead the ultimate frisbee club.',
                notes_teach_me: 'Great presentation.',
                notes_commitment: 'Seems highly organized, confident he can meet deadlines.',
                notes_comments: 'I agree with David, solid accept.',
                score_enthusiasm: 9.5,
                score_quality: 9.0,
                score_teaching: 8.5,
                score_interest: 9.5,
                score_overall: 9.125
            }
        ]
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
        seminarCategory: 'Human Behavior and Ethics',
        seminarDescription: 'Exploring the moral implications of deploying large language models in healthcare and education contexts.',
        finalProduct: 'A policy brief proposing ethical guidelines for AI use in a specific industry. Materials needed: notebooks, laptops for research.',
        moreTopics: 'Cognitive Science, Bioethics, Creative Writing',

        // Written Responses
        interestReason: 'Having attended a similar summit in high school, I know how transformative these experiences are. I want to pay it forward.',
        teachingExp: 'Led debate camps for high schoolers for the past two summers.',
        advice: 'Your major does not define your career. Follow your curiosity.',
        selfIntro: 'I am Sarah! I love debating, philosophy, and hiking. I am currently researching AI alignment at Stanford.',

        // Interview Info & Scores (Normalized)
        scores: {
            writtenInterest: 9.5,
            writtenTeaching: 10.0,
            writtenSeminar: 9.0,
            writtenPersonal: 9.5,
            understanding: 8.0,
            enthusiasm: 9.5,
            quality: 10.0,
            teaching: 9.5,
            interestEngaging: 8.5,
            overall: 9.2
        },
        sensitiveIssues: 'Yes, mentions sensitive political topics. Needs review.',
        flyFrom: 'SFO',
        flyTo: 'PEK',
        availability: 'Available from Aug 13 - 21',
        interviewNotes: [
            {
                interviewer: 'Alice Wang',
                notes_why_sl: 'Wants to inspire critical thinking about technology. Very passionate.',
                notes_seminar: 'Fascinating topic, highly relevant. She has great discussion questions prepared.',
                notes_extracurricular: 'Interested in hosting debate workshops and philosophy cafes.',
                notes_teach_me: 'Explained the Trolley Problem variants clearly and engagingly.',
                notes_commitment: 'She might have an internship, but says she can juggle the work.',
                notes_comments: 'Excellent communicator. Will be a fantastic SL.',
                score_enthusiasm: 9.5,
                score_quality: 10.0,
                score_teaching: 9.5,
                score_interest: 8.5,
                score_overall: 9.375
            }
        ]
    }
];

export function DeliberationPage() {
    const [candidates, setCandidates] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction, setDirection] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'seminar' | 'written' | 'interview'>('seminar');
    const confirmModal = useConfirm();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const formatClassYear = (year: string) => {
        if (!year) return 'Other';
        const yearLower = String(year).toLowerCase();
        if (yearLower.includes('freshman')) return `${year} (Freshman)`;
        if (yearLower.includes('sophomore')) return `${year} (Sophomore)`;
        if (yearLower.includes('junior')) return `${year} (Junior)`;
        if (yearLower.includes('senior')) return `${year} (Senior)`;

        const match = String(year).match(/\b(202[0-9]|203[0-9])\b/);
        if (match) {
            const num = parseInt(match[1], 10);
            if (num === 2026) return `${year} (Senior)`;
            if (num === 2027) return `${year} (Junior)`;
            if (num === 2028) return `${year} (Sophomore)`;
            if (num === 2029) return `${year} (Freshman)`;
        }
        return `${year} (Other)`;
    };

    useEffect(() => {
        async function fetchCandidates() {
            try {
                const { data, error } = await supabase
                    .from('candidates')
                    .select('*')
                    .eq('deliberation_status', 'pending');

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
                                const s = [cand.interviewer1_score_overall, cand.interviewer2_score_overall].filter(v => typeof v === 'number');
                                return s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;
                            })()
                        },
                        interviewNotes: [
                            ...(cand.interviewer1_name ? [{
                                interviewer: cand.interviewer1_name,
                                notes_why_sl: cand.interviewer1_notes_why_sl,
                                notes_seminar: cand.interviewer1_notes_seminar,
                                notes_extracurricular: cand.interviewer1_notes_extracurricular,
                                notes_teach_me: cand.interviewer1_notes_teach_me,
                                notes_commitment: cand.interviewer1_notes_commitment,
                                notes_comments: cand.interviewer1_notes_comments,
                                score_enthusiasm: cand.interviewer1_score_enthusiasm,
                                score_quality: cand.interviewer1_score_quality,
                                score_teaching: cand.interviewer1_score_teaching,
                                score_interest: cand.interviewer1_score_interest,
                                score_overall: cand.interviewer1_score_overall,
                            }] : []),
                            ...(cand.interviewer2_name ? [{
                                interviewer: cand.interviewer2_name,
                                notes_why_sl: cand.interviewer2_notes_why_sl,
                                notes_seminar: cand.interviewer2_notes_seminar,
                                notes_extracurricular: cand.interviewer2_notes_extracurricular,
                                notes_teach_me: cand.interviewer2_notes_teach_me,
                                notes_commitment: cand.interviewer2_notes_commitment,
                                notes_comments: cand.interviewer2_notes_comments,
                                score_enthusiasm: cand.interviewer2_score_enthusiasm,
                                score_quality: cand.interviewer2_score_quality,
                                score_teaching: cand.interviewer2_score_teaching,
                                score_interest: cand.interviewer2_score_interest,
                                score_overall: cand.interviewer2_score_overall,
                            }] : [])
                        ]
                    }));
                    setCandidates(mappedData);
                } else {
                    console.warn("No pending candidates found in Supabase. Using MOCK data.");
                    setCandidates(MOCK_CANDIDATES);
                }
            } catch (err) {
                console.error("Failed to fetch candidates. Falling back to mock data.", err);
                setCandidates(MOCK_CANDIDATES);
            } finally {
                setIsLoading(false);
            }
        }
        fetchCandidates();
    }, []);

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
                    const { error } = await supabase
                        .from('candidates')
                        .update({ deliberation_status: status })
                        .eq('id', candidate.id);
                    if (error) throw error;
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

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="secondary" size="sm" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                        <PanelLeft className="w-4 h-4 mr-1" />
                        {isSidebarOpen ? 'Collapse' : 'Expand'}
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-primary tracking-tight">Application Review</h1>
                        <p className="text-sm text-secondary mt-1">Reviewing candidate {currentIndex + 1} of {candidates.length}</p>
                    </div>
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
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full pb-2">

                            {/* Left Column: Candidate Profile & Standardized Scores */}
                            {isSidebarOpen && (
                                <div className="lg:col-span-3 flex flex-col gap-6 h-full overflow-y-auto pr-1">
                                    <Card className="flex flex-col shrink-0">
                                        <div className="flex items-center justify-between mb-2">
                                            <h2 className="text-2xl font-bold text-primary">{candidate.name}</h2>
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
                                        <div className="flex items-center justify-between mb-2 shrink-0">
                                            <h3 className="text-sm font-semibold text-primary">Assessment Scores</h3>
                                            <div className="text-xs px-2 py-1 bg-accent/10 text-accent rounded font-bold">
                                                Overall: {candidate.scores.overall.toFixed(1)}
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

                                        <div className="space-y-1 mt-4 pt-4 border-t border-border">
                                            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Written Scores</p>
                                            {renderProgressBar('Interest', candidate.scores.writtenInterest)}
                                            {renderProgressBar('Teaching', candidate.scores.writtenTeaching)}
                                            {renderProgressBar('Seminar', candidate.scores.writtenSeminar)}
                                            {renderProgressBar('Personal', candidate.scores.writtenPersonal)}

                                            <div className="mt-4 pt-4 border-t border-border">
                                                <p className="text-xs font-semibold text-muted mb-1">Graded By: {candidate.grader}</p>
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                            )}

                            {/* Right Column: Detailed Context Tabs */}
                            <div className={`${isSidebarOpen ? 'lg:col-span-9' : 'lg:col-span-12'} flex flex-col h-full bg-white dark:bg-surface border border-border rounded-xl shadow-sm overflow-hidden transition-all duration-300`}>
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
                                                        <div key={index} className="first:pl-0 last:pr-0 md:px-6 md:first:px-0 md:last:px-0 pt-6 first:pt-0 md:pt-0 pb-6 md:pb-0">
                                                            <div className="flex items-center gap-2 mb-6">
                                                                <User className="w-4 h-4 text-accent" />
                                                                <span className="font-semibold text-primary">{note.interviewer || 'Unknown Interviewer'}</span>
                                                            </div>

                                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                                                                <div className="p-3 rounded-lg border border-border bg-surface text-center">
                                                                    <div className="text-xs text-muted mb-1">Enthusiasm</div>
                                                                    <div className="font-bold text-accent">{note.score_enthusiasm ?? 'N/A'}</div>
                                                                </div>
                                                                <div className="p-3 rounded-lg border border-border bg-surface text-center">
                                                                    <div className="text-xs text-muted mb-1">Quality</div>
                                                                    <div className="font-bold text-accent">{note.score_quality ?? 'N/A'}</div>
                                                                </div>
                                                                <div className="p-3 rounded-lg border border-border bg-surface text-center">
                                                                    <div className="text-xs text-muted mb-1">Teaching</div>
                                                                    <div className="font-bold text-accent">{note.score_teaching ?? 'N/A'}</div>
                                                                </div>
                                                                <div className="p-3 rounded-lg border border-border bg-surface text-center">
                                                                    <div className="text-xs text-muted mb-1">Interest</div>
                                                                    <div className="font-bold text-accent">{note.score_interest ?? 'N/A'}</div>
                                                                </div>
                                                                <div className="p-3 rounded-lg border border-accent/20 bg-accent/5 text-center">
                                                                    <div className="text-xs text-accent font-semibold mb-1">Overall</div>
                                                                    <div className="font-bold text-accent">{note.score_overall ?? 'N/A'}</div>
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
                    <Button variant="danger" onClick={() => handleDecision('reject')}>
                        <ThumbsDown className="w-4 h-4 mr-2" /> Reject
                    </Button>
                    <Button variant="secondary" onClick={() => handleDecision('waitlist')}>
                        <Clock className="w-4 h-4 mr-2" /> Waitlist
                    </Button>
                    <Button variant="primary" onClick={() => handleDecision('approve')}>
                        <ThumbsUp className="w-4 h-4 mr-2" /> Approve
                    </Button>
                </div>
            </div>
        </div>
    );
}
