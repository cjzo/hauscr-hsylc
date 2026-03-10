import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { getConsensusTier } from './tiers';
import { standardizeCategory } from './categories';

const TIER_FILLS: Record<string, ExcelJS.FillPattern> = {
    auto_accept: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } },
    tier_1: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } },
    tier_2: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FE' } },
    tier_3: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } },
    tier_4: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } },
};

const TIER_FONTS: Record<string, Partial<ExcelJS.Font>> = {
    auto_accept: { color: { argb: 'FF047857' }, bold: true },
    tier_1: { color: { argb: 'FF1D4ED8' }, bold: true },
    tier_2: { color: { argb: 'FF6D28D9' }, bold: true },
    tier_3: { color: { argb: 'FFB45309' }, bold: true },
    tier_4: { color: { argb: 'FFDC2626' }, bold: true },
};

const TIER_LABEL: Record<string, string> = {
    auto_accept: 'Auto Accept',
    tier_1: 'Tier 1',
    tier_2: 'Tier 2',
    tier_3: 'Tier 3',
    tier_4: 'Tier 4',
};

const STATUS_FILLS: Record<string, ExcelJS.FillPattern> = {
    approved: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } },
    waitlisted: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } },
    rejected: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } },
};

const HEADER_FILL: ExcelJS.FillPattern = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' },
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
    bold: true, color: { argb: 'FFFFFFFF' }, size: 11,
};
const HEADER_BORDER: Partial<ExcelJS.Borders> = {
    bottom: { style: 'medium', color: { argb: 'FF334155' } },
};

function getWrittenAvg(cand: any): number | null {
    const scores = [
        cand.written_score_interest,
        cand.written_score_teaching,
        cand.written_score_seminar,
        cand.written_score_personal,
    ].filter((s) => typeof s === 'number');
    if (scores.length === 0) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function getInterviewOverall(cand: any): number | null {
    const notes = cand.interviews || [];
    const overalls = notes
        .map((n: any) => (typeof n.score_overall === 'number' ? n.score_overall : null))
        .filter((v: number | null): v is number => v !== null);
    if (overalls.length === 0) return cand.score_overall ?? null;
    return overalls.reduce((a: number, b: number) => a + b, 0) / overalls.length;
}

const COLUMNS = [
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'School', key: 'school', width: 22 },
    { header: 'Class Year', key: 'class_year', width: 12 },
    { header: 'Major', key: 'major', width: 20 },
    { header: 'Nationality', key: 'nationality', width: 16 },
    { header: 'Type', key: 'candidate_type', width: 12 },
    { header: 'Seminar Category', key: 'seminar_category', width: 22 },
    { header: 'Seminar Title', key: 'seminar_title', width: 32 },
    { header: 'Written Score', key: 'written_avg', width: 14 },
    { header: 'Interview Score', key: 'interview_avg', width: 16 },
    { header: 'Consensus Tier', key: 'consensus_tier', width: 16 },
    { header: 'Interviewer Rankings', key: 'rankings_detail', width: 36 },
];

function buildRow(cand: any) {
    const tiers = (cand.interviews || [])
        .map((n: any) => n.interviewer_ranking)
        .filter((r: any): r is string => !!r);
    const consensus = getConsensusTier(tiers);

    const rankingsDetail = (cand.interviews || [])
        .filter((n: any) => n.interviewer_ranking)
        .map((n: any) => `${n.interviewer_name}: ${TIER_LABEL[n.interviewer_ranking] || n.interviewer_ranking}`)
        .join(', ');

    const raw = cand.seminar_category || cand.seminar_title;

    return {
        name: cand.full_name || `${cand.first_name ?? ''} ${cand.last_name ?? ''}`.trim(),
        email: cand.email || '',
        school: cand.school || '',
        class_year: cand.class_year || '',
        major: cand.major || '',
        nationality: cand.nationality || '',
        candidate_type: cand.candidate_type || '',
        seminar_category: raw ? standardizeCategory(raw) : '',
        seminar_title: cand.seminar_title || '',
        written_avg: getWrittenAvg(cand),
        interview_avg: getInterviewOverall(cand),
        consensus_tier: consensus ? TIER_LABEL[consensus] : '',
        rankings_detail: rankingsDetail,
        _consensus_key: consensus,
    };
}

function addSheet(workbook: ExcelJS.Workbook, name: string, candidates: any[]) {
    const sheet = workbook.addWorksheet(name);
    sheet.columns = COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width }));

    const headerRow = sheet.getRow(1);
    headerRow.eachCell(cell => {
        cell.fill = HEADER_FILL;
        cell.font = HEADER_FONT;
        cell.border = HEADER_BORDER;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    headerRow.height = 28;

    for (const cand of candidates) {
        const data = buildRow(cand);
        const row = sheet.addRow(data);

        if (data._consensus_key && TIER_FILLS[data._consensus_key]) {
            const tierCell = row.getCell('consensus_tier');
            tierCell.fill = TIER_FILLS[data._consensus_key];
            tierCell.font = TIER_FONTS[data._consensus_key] || {};
        }

        row.eachCell(cell => {
            cell.alignment = { vertical: 'middle', wrapText: true };
            cell.border = {
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            };
        });

        if (typeof data.written_avg === 'number') {
            row.getCell('written_avg').numFmt = '0.00';
        }
        if (typeof data.interview_avg === 'number') {
            row.getCell('interview_avg').numFmt = '0.0';
        }
    }

    sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + COLUMNS.length)}1` };
}

export type ExportScope = 'all' | 'approved' | 'waitlisted' | 'rejected';

export async function exportDecisionsSpreadsheet(allCandidates: any[], scope: ExportScope = 'all') {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'HAUSCR Deliberation';
    workbook.created = new Date();

    const approved = allCandidates.filter(c => c.deliberation_status === 'approved');
    const waitlisted = allCandidates.filter(c => c.deliberation_status === 'waitlisted');
    const rejected = allCandidates.filter(c => c.deliberation_status === 'rejected');
    const pending = allCandidates.filter(c => c.deliberation_status === 'pending');

    let candidatesToExport = allCandidates;
    let sheetName = 'All Candidates';
    let fileNameSuffix = 'Decisions';

    if (scope === 'approved') {
        candidatesToExport = approved;
        sheetName = 'Accepted';
        fileNameSuffix = 'Accepted';
    } else if (scope === 'waitlisted') {
        candidatesToExport = waitlisted;
        sheetName = 'Waitlisted';
        fileNameSuffix = 'Waitlisted';
    } else if (scope === 'rejected') {
        candidatesToExport = rejected;
        sheetName = 'Rejected';
        fileNameSuffix = 'Rejected';
    }

    if (scope === 'all') {
        addSheet(workbook, 'Approved', approved);
        addSheet(workbook, 'Waitlisted', waitlisted);
        addSheet(workbook, 'Rejected', rejected);
        if (pending.length > 0) {
            addSheet(workbook, 'Pending', pending);
        }

        const allSheet = workbook.addWorksheet('All Candidates');
        allSheet.columns = [
            { header: 'Decision', key: 'decision', width: 14 },
            ...COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width })),
        ];
        const allHeaderRow = allSheet.getRow(1);
        allHeaderRow.eachCell(cell => {
            cell.fill = HEADER_FILL;
            cell.font = HEADER_FONT;
            cell.border = HEADER_BORDER;
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        allHeaderRow.height = 28;
        for (const cand of allCandidates) {
            const data = buildRow(cand);
            const status = cand.deliberation_status || 'pending';
            const row = allSheet.addRow({ decision: status.charAt(0).toUpperCase() + status.slice(1), ...data });
            const decisionCell = row.getCell('decision');
            if (STATUS_FILLS[status]) decisionCell.fill = STATUS_FILLS[status];
            decisionCell.font = { bold: true };
            if (data._consensus_key && TIER_FILLS[data._consensus_key]) {
                const tierCell = row.getCell('consensus_tier');
                tierCell.fill = TIER_FILLS[data._consensus_key];
                tierCell.font = TIER_FONTS[data._consensus_key] || {};
            }
            row.eachCell(cell => {
                cell.alignment = { vertical: 'middle', wrapText: true };
                cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
            });
        }
        allSheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(65 + COLUMNS.length)}1` };
    } else {
        addSheet(workbook, sheetName, candidatesToExport);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const date = new Date().toISOString().slice(0, 10);
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `HAUSCR_${fileNameSuffix}_${date}.xlsx`);
}
