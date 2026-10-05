import type { ReactNode } from 'react';
import { shortId } from '../lib/types';

export type Column<T> = {
  title: string;
  render: (row: T) => ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading: boolean;
  error: string | null;
  emptyMessage: string;
  page: number;
  pageCount: number;
  count: number;
  onPageChange: (page: number) => void;
  onRetry: () => void;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  emptyMessage,
  page,
  pageCount,
  count,
  onPageChange,
  onRetry,
}: DataTableProps<T>) {
  return (
    <section className="table-card">
      {error ? (
        <div className="state-panel state-error" role="alert">
          <span>{error}</span>
          <button className="button button-secondary" onClick={onRetry}>Try again</button>
        </div>
      ) : loading ? (
        <div className="state-panel" role="status"><span className="spinner" />Loading records…</div>
      ) : rows.length === 0 ? (
        <div className="state-panel">{emptyMessage}</div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>{columns.map((column) => <th className={column.className} key={column.title}>{column.title}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((column) => (
                    <td className={column.className} key={column.title}>{column.render(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!error && !loading && count > 0 ? (
        <div className="pagination">
          <span>{count.toLocaleString()} records</span>
          <div className="pagination-actions">
            <button className="button button-secondary" disabled={page === 0} onClick={() => onPageChange(page - 1)}>Previous</button>
            <span>Page {page + 1} of {pageCount}</span>
            <button className="button button-secondary" disabled={page + 1 >= pageCount} onClick={() => onPageChange(page + 1)}>Next</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function StatusBadge({ value }: { value: string | null | undefined }) {
  const tone = value === 'AVAILABLE' || value === 'COMPLETED' || value === 'ACCEPTED'
    ? 'success'
    : value === 'REJECTED' || value === 'CANCELLED'
      ? 'danger'
      : value === 'ON_JOURNEY'
        ? 'info'
        : value === 'PENDING' || value === 'RESERVED' || value === 'VERIFICATION_PENDING'
          ? 'warning'
          : 'neutral';
  const label = value
    ? value === 'ON_JOURNEY' ? 'In trip' : value === 'VERIFICATION_PENDING' ? 'Verification pending' : value[0] + value.slice(1).toLowerCase()
    : 'Unknown';
  return <span className={`badge badge-${tone}`}>{label}</span>;
}

export function RecordId({ id }: { id: string }) {
  return <span className="record-id" title={id}>{shortId(id)}</span>;
}
