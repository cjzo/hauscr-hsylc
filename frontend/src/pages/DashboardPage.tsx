import { Card } from '../components/ui/Card';
import { Users, CheckCircle2, Clock, XCircle, TrendingUp, Loader2 } from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { standardizeCategory } from '../utils/categories';

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#f43f5e', '#14b8a6', '#f97316'];

export function DashboardPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [summaryStats, setSummaryStats] = useState([
        { label: 'Total Applicants', value: 0, trend: '', icon: Users, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
        { label: 'Accepted', value: 0, trend: '', icon: CheckCircle2, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
        { label: 'Waitlisted', value: 0, trend: '', icon: Clock, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
        { label: 'Rejected', value: 0, trend: '', icon: XCircle, color: 'text-rose-500', bgColor: 'bg-rose-500/10' },
    ]);
    const [seminarDist, setSeminarDist] = useState<{ name: string, value: number }[]>([]);
    const [classYearDist, setClassYearDist] = useState<{ name: string, applicants: number }[]>([]);
    const [scoreDist, setScoreDist] = useState<{ scoreRange: string, count: number }[]>([]);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [selectedReviewer, setSelectedReviewer] = useState<string>('all');
    const [reviewers, setReviewers] = useState<string[]>([]);
    const [writtenInterestDist, setWrittenInterestDist] = useState<{ scoreRange: string, count: number }[]>([]);
    const [writtenTeachingDist, setWrittenTeachingDist] = useState<{ scoreRange: string, count: number }[]>([]);
    const [writtenSeminarDist, setWrittenSeminarDist] = useState<{ scoreRange: string, count: number }[]>([]);
    const [writtenPersonalDist, setWrittenPersonalDist] = useState<{ scoreRange: string, count: number }[]>([]);

    useEffect(() => {
        async function fetchData() {
            try {
                const { data, error } = await supabase.from('candidates').select('*');
                if (error) throw error;

                if (data) {
                    setCandidates(data);

                    // Update Stats
                    const total = data.length;
                    const accepted = data.filter(c => c.deliberation_status === 'approved').length;
                    const waitlisted = data.filter(c => c.deliberation_status === 'waitlisted').length;
                    const rejected = data.filter(c => c.deliberation_status === 'rejected').length;

                    setSummaryStats([
                        { label: 'Total Applicants', value: total, trend: '', icon: Users, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
                        { label: 'Accepted', value: accepted, trend: '', icon: CheckCircle2, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
                        { label: 'Waitlisted', value: waitlisted, trend: '', icon: Clock, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
                        { label: 'Rejected', value: rejected, trend: '', icon: XCircle, color: 'text-rose-500', bgColor: 'bg-rose-500/10' },
                    ]);

                    // Update Seminar Distribution
                    const catCounts: Record<string, number> = {};
                    data.forEach(c => {
                        const stdCat = standardizeCategory(c.seminar_category || c.seminar_title);
                        catCounts[stdCat] = (catCounts[stdCat] || 0) + 1;
                    });
                    setSeminarDist(Object.entries(catCounts).map(([name, value]) => ({ name, value })));

                    // Reviewer List (for written PMFs)
                    const graderNames = Array.from(
                        new Set(
                            data
                                .map(c => (c.grader_name || '').trim())
                                .filter((name: string) => name && name.toLowerCase() !== 'not available')
                        )
                    ).sort();
                    setReviewers(graderNames);

                    // Update Class Year Distribution
                    const yearCounts: Record<string, number> = {};
                    data.forEach(c => {
                        const yr = c.class_year ? c.class_year.trim() : 'Unknown';
                        yearCounts[yr] = (yearCounts[yr] || 0) + 1;
                    });
                    setClassYearDist(Object.entries(yearCounts).map(([name, applicants]) => ({ name, applicants })));

                    // Update Score Function (PMF)
                    const tempScoreDist: Record<string, number> = {
                        '0-2': 0, '2-4': 0, '4-6': 0, '6-8': 0, '8-10': 0
                    };
                    data.forEach(c => {
                        const s = c.score_overall;
                        if (s !== null && s !== undefined) {
                            if (s < 2) tempScoreDist['0-2']++;
                            else if (s < 4) tempScoreDist['2-4']++;
                            else if (s < 6) tempScoreDist['4-6']++;
                            else if (s < 8) tempScoreDist['6-8']++;
                            else tempScoreDist['8-10']++;
                        }
                    });
                    setScoreDist(Object.entries(tempScoreDist).map(([scoreRange, count]) => ({ scoreRange, count })));
                }

            } catch (err) {
                console.error("Failed to fetch dashboard stats", err);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    useEffect(() => {
        if (!candidates.length) {
            setWrittenInterestDist([]);
            setWrittenTeachingDist([]);
            setWrittenSeminarDist([]);
            setWrittenPersonalDist([]);
            return;
        }

        const dataset = selectedReviewer === 'all'
            ? candidates
            : candidates.filter(c => c.grader_name === selectedReviewer);

        const makeEmptyBins = () => ({
            '0-1': 0,
            '1-2': 0,
            '2-3': 0,
            '3-4': 0,
            '4-5': 0,
        });

        const interestBins = makeEmptyBins();
        const teachingBins = makeEmptyBins();
        const seminarBins = makeEmptyBins();
        const personalBins = makeEmptyBins();

        const addToBins = (bins: Record<string, number>, value: number | null | undefined) => {
            if (value === null || value === undefined) return;
            const v = Number(value);
            if (Number.isNaN(v)) return;
            if (v < 1) bins['0-1'] += 1;
            else if (v < 2) bins['1-2'] += 1;
            else if (v < 3) bins['2-3'] += 1;
            else if (v < 4) bins['3-4'] += 1;
            else bins['4-5'] += 1;
        };

        dataset.forEach((c: any) => {
            addToBins(interestBins, c.written_score_interest);
            addToBins(teachingBins, c.written_score_teaching);
            addToBins(seminarBins, c.written_score_seminar);
            addToBins(personalBins, c.written_score_personal);
        });

        const binsToArray = (bins: Record<string, number>) =>
            Object.entries(bins).map(([scoreRange, count]) => ({ scoreRange, count }));

        setWrittenInterestDist(binsToArray(interestBins));
        setWrittenTeachingDist(binsToArray(teachingBins));
        setWrittenSeminarDist(binsToArray(seminarBins));
        setWrittenPersonalDist(binsToArray(personalBins));
    }, [candidates, selectedReviewer]);

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col gap-6 overflow-y-auto pb-8 pr-2">
            <div>
                <h1 className="text-2xl font-bold text-primary tracking-tight">Dashboard Overview</h1>
                <p className="text-sm text-secondary mt-1">Key metrics and distribution of the current applicant pool.</p>
            </div>

            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {summaryStats.map((stat) => (
                    <Card key={stat.label} className="p-6 flex flex-col gap-4 relative overflow-hidden group">
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-secondary">{stat.label}</p>
                                <p className="text-3xl font-bold text-primary">{stat.value}</p>
                            </div>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${stat.bgColor} ${stat.color} transition-transform group-hover:scale-110`}>
                                <stat.icon className="w-5 h-5" />
                            </div>
                        </div>
                        {stat.trend && (
                            <div className="flex items-center text-xs font-medium text-emerald-500">
                                <TrendingUp className="w-3 h-3 mr-1" />
                                {stat.trend} from last year
                            </div>
                        )}
                        {/* Decorative background gradient */}
                        <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full ${stat.bgColor} blur-2xl opacity-50 pointer-events-none transition-opacity group-hover:opacity-80`} />
                    </Card>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                {/* Seminar Category Distribution */}
                <Card className="p-6 flex flex-col min-h-[460px]">
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-primary">Seminar Category Distribution</h3>
                        <p className="text-sm text-secondary">Breakdown of proposed seminars by category.</p>
                    </div>
                    <div className="flex-1 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={seminarDist}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={120}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="transparent"
                                >
                                    {seminarDist.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ color: '#111827', fontWeight: 500 }}
                                />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    iconType="circle"
                                    wrapperStyle={{ fontSize: '14px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Class Year Distribution */}
                <Card className="p-6 flex flex-col min-h-[400px]">
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-primary">Class Year Distribution</h3>
                        <p className="text-sm text-secondary">Number of applicants by current college year.</p>
                    </div>
                    <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={classYearDist}
                                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#6B7280', fontSize: 12 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#6B7280', fontSize: 12 }}
                                    dx={-10}
                                />
                                <Tooltip
                                    cursor={{ fill: '#F3F4F6' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar
                                    dataKey="applicants"
                                    fill="#ec4899"
                                    radius={[4, 4, 0, 0]}
                                    barSize={40}
                                    animationDuration={1500}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Overall Score Distribution (PMF) */}
                <Card className="p-6 flex flex-col min-h-[400px] xl:col-span-2">
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-primary">Candidate Assessment Scores PMF</h3>
                        <p className="text-sm text-secondary">Distribution of Overall Standardized Scores from 0 to 10.</p>
                    </div>
                    <div className="flex-1 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={scoreDist}
                                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis
                                    dataKey="scoreRange"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#6B7280', fontSize: 12 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#6B7280', fontSize: 12 }}
                                    dx={-10}
                                    allowDecimals={false}
                                />
                                <Tooltip
                                    cursor={{ fill: '#F3F4F6' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar
                                    dataKey="count"
                                    fill="#8b5cf6"
                                    radius={[4, 4, 0, 0]}
                                    barSize={60}
                                    animationDuration={1500}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Written Score Distributions (PMFs) */}
                <Card className="p-6 flex flex-col min-h-[420px] xl:col-span-2">
                    <div className="mb-4 md:mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                            <h3 className="text-lg font-semibold text-primary">Written Application Score PMFs</h3>
                            <p className="text-sm text-secondary">
                                Distributions of written rubric scores (0–5) by component. Use the filter to see a specific reviewer.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-secondary whitespace-nowrap">Filter by reviewer</span>
                            <select
                                value={selectedReviewer}
                                onChange={(e) => setSelectedReviewer(e.target.value)}
                                className="border border-border rounded-md px-3 py-1.5 bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
                            >
                                <option value="all">All reviewers</option>
                                {reviewers.map((name) => (
                                    <option key={name} value={name}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                        <div className="flex flex-col">
                            <p className="text-sm font-semibold text-primary mb-2">Interest</p>
                            <div className="h-40 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={writtenInterestDist}
                                        margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis
                                            dataKey="scoreRange"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#6B7280', fontSize: 11 }}
                                            dy={8}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#6B7280', fontSize: 11 }}
                                            dx={-8}
                                            allowDecimals={false}
                                        />
                                        <Tooltip
                                            cursor={{ fill: '#F3F4F6' }}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Bar
                                            dataKey="count"
                                            fill="#3b82f6"
                                            radius={[4, 4, 0, 0]}
                                            barSize={24}
                                            animationDuration={1500}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <p className="text-sm font-semibold text-primary mb-2">Teaching</p>
                            <div className="h-40 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={writtenTeachingDist}
                                        margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis
                                            dataKey="scoreRange"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#6B7280', fontSize: 11 }}
                                            dy={8}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#6B7280', fontSize: 11 }}
                                            dx={-8}
                                            allowDecimals={false}
                                        />
                                        <Tooltip
                                            cursor={{ fill: '#F3F4F6' }}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Bar
                                            dataKey="count"
                                            fill="#8b5cf6"
                                            radius={[4, 4, 0, 0]}
                                            barSize={24}
                                            animationDuration={1500}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <p className="text-sm font-semibold text-primary mb-2">Seminar</p>
                            <div className="h-40 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={writtenSeminarDist}
                                        margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis
                                            dataKey="scoreRange"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#6B7280', fontSize: 11 }}
                                            dy={8}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#6B7280', fontSize: 11 }}
                                            dx={-8}
                                            allowDecimals={false}
                                        />
                                        <Tooltip
                                            cursor={{ fill: '#F3F4F6' }}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Bar
                                            dataKey="count"
                                            fill="#f97316"
                                            radius={[4, 4, 0, 0]}
                                            barSize={24}
                                            animationDuration={1500}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <p className="text-sm font-semibold text-primary mb-2">Personal</p>
                            <div className="h-40 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={writtenPersonalDist}
                                        margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis
                                            dataKey="scoreRange"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#6B7280', fontSize: 11 }}
                                            dy={8}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#6B7280', fontSize: 11 }}
                                            dx={-8}
                                            allowDecimals={false}
                                        />
                                        <Tooltip
                                            cursor={{ fill: '#F3F4F6' }}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Bar
                                            dataKey="count"
                                            fill="#10b981"
                                            radius={[4, 4, 0, 0]}
                                            barSize={24}
                                            animationDuration={1500}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </Card>

            </div>
        </div>
    );
}
