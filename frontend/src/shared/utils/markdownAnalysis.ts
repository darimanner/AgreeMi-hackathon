import type { AiIssue } from '../types';

export type DocumentBlock = {
  id: string;
  startLine: number;
  endLine: number;
  content: string;
  kind: 'table' | 'kv-table' | 'req-table' | 'step-table' | 'text';
  rows?: string[][];
};

function isMarkdownTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function isMarkdownTableRow(line: string): boolean {
  return line.includes('|') && line.trim().split('|').filter(cell => cell.trim()).length >= 2;
}

function parseMarkdownTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
}

function getSingleRowKvTable(block: DocumentBlock): string[] | null {
  if (block.kind !== 'table') return null;
  const rows = block.content
    .split('\n')
    .filter(l => isMarkdownTableRow(l) && !isMarkdownTableSeparator(l))
    .map(parseMarkdownTableRow);
  if (rows.length !== 1 || rows[0].length < 3 || rows[0].length > 4) return null;
  return [...rows[0], '', '', '', ''].slice(0, 4);
}

function isTableContinuationText(block: DocumentBlock): boolean {
  const v = block.content.trim();
  if (!v || block.kind !== 'text') return false;
  if (/^#{1,6}\s/.test(v) || /^\d+\.\s/.test(v) || /^[-*+]\s/.test(v)) return false;
  return v.length <= 80;
}

function appendCellValue(a: string, b: string): string {
  return [a, b].filter(Boolean).join(' ').trim();
}

function getTableRows(block: DocumentBlock): string[][] {
  if (block.kind !== 'table') return [];
  return block.content
    .split('\n')
    .filter(l => isMarkdownTableRow(l) && !isMarkdownTableSeparator(l))
    .map(parseMarkdownTableRow);
}

function getNonEmptyCells(row: string[]): string[] {
  return row.map(c => c.trim()).filter(Boolean);
}

function getRequirementHeader(block: DocumentBlock): string[] | null {
  const rows = getTableRows(block);
  if (rows.length !== 1) return null;
  const n = getNonEmptyCells(rows[0]).join(' ').toLowerCase();
  if (!n.includes('id') || !n.includes('user story') || !n.includes('acceptance')) return null;
  return ['ID', 'User story', 'Acceptance criteria'];
}

function getStepHeader(block: DocumentBlock): string[] | null {
  const rows = getTableRows(block);
  if (rows.length !== 1) return null;
  const n = getNonEmptyCells(rows[0]).join(' ').toLowerCase();
  if (!n.includes('step') || !n.includes('name')) return null;
  if (!n.includes('behaviour') && !n.includes('behavior')) return null;
  return ['Step', 'Name', 'Behaviour & rules'];
}

function getContinuationCells(block: DocumentBlock): string[] {
  const rows = getTableRows(block);
  if (rows.length !== 1) return [];
  return getNonEmptyCells(rows[0]);
}

function parseRequirementLine(value: string): string[] | null {
  const m = value.trim().match(/^([A-Z]{2,}(?:-[A-Z]+)?\d{1,3})\s+(.+)$/);
  return m ? [m[1], m[2], ''] : null;
}

function parseStepLine(value: string): string[] | null {
  const m = value.trim().match(/^(\d{1,2})\s+(.+)$/);
  if (!m) return null;
  const rest = m[2].trim();
  const twoWord = rest.match(/^(Cart review)\s+(.+)$/i);
  if (twoWord) return [m[1], twoWord[1], twoWord[2]];
  const firstWord = rest.match(/^(\S+)\s+(.+)$/);
  return firstWord ? [m[1], firstWord[1], firstWord[2]] : [m[1], rest, ''];
}

function isSectionHeadingBlock(block: DocumentBlock): boolean {
  return block.kind === 'text' && /^\s*\d+(?:\.\d+)*\s+/.test(block.content);
}

function repairRequirementTables(blocks: DocumentBlock[]): DocumentBlock[] {
  const out: DocumentBlock[] = [];
  let i = 0;
  while (i < blocks.length) {
    const header = getRequirementHeader(blocks[i]);
    if (!header) { out.push(blocks[i++]); continue; }
    const rows = [header];
    const startLine = blocks[i].startLine;
    let endLine = blocks[i].endLine;
    let cursor = i + 1;
    let cur: string[] | null = null;
    while (cursor < blocks.length) {
      const b = blocks[cursor];
      if (isSectionHeadingBlock(b)) break;
      if (b.kind === 'text') {
        const p = parseRequirementLine(b.content);
        if (p) { if (cur) rows.push(cur); cur = p; endLine = b.endLine; cursor++; continue; }
        if (cur && isTableContinuationText(b)) { cur[1] = appendCellValue(cur[1], b.content.trim()); endLine = b.endLine; cursor++; continue; }
        break;
      }
      const cells = getContinuationCells(b);
      if (cur && cells.length > 0 && cells.length <= 3) {
        if (cells[0]) cur[1] = appendCellValue(cur[1], cells[0]);
        if (cells[1]) cur[2] = appendCellValue(cur[2], cells[1]);
        if (cells[2]) cur[2] = appendCellValue(cur[2], cells[2]);
        endLine = b.endLine; cursor++; continue;
      }
      break;
    }
    if (cur) rows.push(cur);
    if (rows.length > 1) {
      out.push({ id: `req-table-${startLine}`, startLine, endLine, content: '', kind: 'req-table', rows });
      i = cursor;
    } else { out.push(blocks[i++]); }
  }
  return out;
}

function repairStepTables(blocks: DocumentBlock[]): DocumentBlock[] {
  const out: DocumentBlock[] = [];
  let i = 0;
  while (i < blocks.length) {
    const header = getStepHeader(blocks[i]);
    if (!header) { out.push(blocks[i++]); continue; }
    const rows = [header];
    const startLine = blocks[i].startLine;
    let endLine = blocks[i].endLine;
    let cursor = i + 1;
    let cur: string[] | null = null;
    while (cursor < blocks.length) {
      const b = blocks[cursor];
      if (isSectionHeadingBlock(b)) break;
      if (b.kind === 'text') {
        const p = parseStepLine(b.content);
        if (p) { if (cur) rows.push(cur); cur = p; endLine = b.endLine; cursor++; continue; }
        if (cur && isTableContinuationText(b)) { cur[2] = appendCellValue(cur[2], b.content.trim()); endLine = b.endLine; cursor++; continue; }
        break;
      }
      const cells = getContinuationCells(b);
      if (cur && cells.length > 0 && cells.length <= 3) {
        if (cells[0]) cur[1] = appendCellValue(cur[1], cells[0]);
        if (cells[1]) cur[2] = appendCellValue(cur[2], cells[1]);
        if (cells[2]) cur[2] = appendCellValue(cur[2], cells[2]);
        endLine = b.endLine; cursor++; continue;
      }
      break;
    }
    if (cur) rows.push(cur);
    if (rows.length > 1) {
      out.push({ id: `step-table-${startLine}`, startLine, endLine, content: '', kind: 'step-table', rows });
      i = cursor;
    } else { out.push(blocks[i++]); }
  }
  return out;
}

function repairDocumentBlocks(blocks: DocumentBlock[]): DocumentBlock[] {
  const out: DocumentBlock[] = [];
  let i = 0;
  while (i < blocks.length) {
    const firstRow = getSingleRowKvTable(blocks[i]);
    if (!firstRow) { out.push(blocks[i++]); continue; }
    const rows = [firstRow];
    const startLine = blocks[i].startLine;
    let endLine = blocks[i].endLine;
    let cursor = i + 1;
    let pending: string[] = [];
    while (cursor < blocks.length) {
      const row = getSingleRowKvTable(blocks[cursor]);
      if (row) {
        if (pending.length > 0) {
          const p = pending.join(' ');
          if (!row[3]) row[3] = p; else rows[rows.length - 1][3] = appendCellValue(rows[rows.length - 1][3], p);
          pending = [];
        }
        rows.push(row); endLine = blocks[cursor].endLine; cursor++; continue;
      }
      if (isTableContinuationText(blocks[cursor])) { pending.push(blocks[cursor].content.trim()); endLine = blocks[cursor].endLine; cursor++; continue; }
      break;
    }
    if (pending.length > 0) rows[rows.length - 1][3] = appendCellValue(rows[rows.length - 1][3], pending.join(' '));
    if (rows.length > 1) {
      out.push({ id: `kv-table-${startLine}`, startLine, endLine, content: '', kind: 'kv-table', rows });
      i = cursor;
    } else { out.push(blocks[i++]); }
  }
  return repairStepTables(repairRequirementTables(out));
}

export function createDocumentBlocks(markdown: string): DocumentBlock[] {
  const lines = markdown.split('\n');
  const blocks: DocumentBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const next = lines[i + 1] ?? '';
    if (isMarkdownTableRow(line) && isMarkdownTableSeparator(next)) {
      const start = i;
      i += 2;
      while (i < lines.length && isMarkdownTableRow(lines[i])) i++;
      blocks.push({ id: `table-${start + 1}`, startLine: start + 1, endLine: i, content: lines.slice(start, i).join('\n'), kind: 'table' });
      continue;
    }
    blocks.push({ id: `line-${i + 1}`, startLine: i + 1, endLine: i + 1, content: line, kind: 'text' });
    i++;
  }
  return repairDocumentBlocks(blocks);
}

export function getIssueForBlock(block: DocumentBlock, issues: AiIssue[]): AiIssue | undefined {
  return issues.find(issue => {
    if (!issue.startLine) return false;
    const end = issue.endLine ?? issue.startLine;
    return issue.startLine <= block.endLine && end >= block.startLine;
  });
}

export function isIssuePopoverAnchor(block: DocumentBlock, issue: AiIssue): boolean {
  if (!issue.startLine) return false;
  return issue.startLine >= block.startLine && issue.startLine <= block.endLine;
}
