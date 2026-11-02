import type { ReportRow, RepoStatus } from './types';

export interface ResultSummary {
  ok: number;
  skipped: number;
  failed: number;
}

export function summarizeResults(rows: readonly ReportRow[]): ResultSummary {
  const summary: ResultSummary = { ok: 0, skipped: 0, failed: 0 };
  for (const row of rows) {
    summary[row.result] += 1;
  }
  return summary;
}

export function formatReport(rows: readonly ReportRow[]): string {
  return formatTable(
    ['repo', 'before', 'after', 'action', 'result', 'error'],
    rows.map((row) => [row.repo, row.before, row.after, row.action, row.result, row.error]),
  );
}

export function formatStatus(repos: readonly RepoStatus[]): string {
  return formatTable(
    ['repo', 'branch', 'dirty', 'ahead', 'behind'],
    repos.map((repo) => [
      repo.name,
      repo.branch,
      repo.dirty ? 'yes' : 'no',
      repo.ahead === null ? '-' : String(repo.ahead),
      repo.behind === null ? '-' : String(repo.behind),
    ]),
  );
}

export function formatTable(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const widths = headers.map((header, index) => {
    const cellWidth = rows.reduce((widest, row) => Math.max(widest, (row[index] ?? '').length), header.length);
    return cellWidth;
  });
  const render = (cells: readonly string[]): string =>
    cells.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join(' | ');
  const divider = widths.map((width) => '-'.repeat(width)).join(' | ');
  return [render(headers), divider, ...rows.map((row) => render(row))].join('\n');
}

export function mergeFetchErrors(fetchRows: readonly ReportRow[], switchRows: readonly ReportRow[]): ReportRow[] {
  const errors = new Map<string, string>();
  for (const row of fetchRows) {
    if (row.result !== 'ok' && row.error) {
      errors.set(row.repo, row.error);
    }
  }
  return switchRows.map((row) => {
    const fetchError = errors.get(row.repo);
    if (!fetchError || row.result === 'ok') {
      return row;
    }
    const error = row.error ? `fetch failed: ${fetchError}; ${row.error}` : `fetch failed: ${fetchError}`;
    return { ...row, error };
  });
}
