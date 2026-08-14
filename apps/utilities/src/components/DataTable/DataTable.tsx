import type {ReactNode} from 'react';
import Mapping from '../Mapping/Mapping';
import {Skeleton} from '../Skeleton/Skeleton';
import {cn} from '../../utils/cn';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** If provided, the header renders as a link (e.g. to a sorted-URL variant of the current page)
   * instead of plain text — matches this app's URL-driven, server-rendered filtering convention
   * rather than introducing client-side sort state. */
  headerHref?: string;
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  /** null = loading (renders skeleton rows), [] = loaded-but-empty (renders emptyMessage). */
  data: readonly T[] | null;
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
  skeletonRows?: number;
  className?: string;
}

/**
 * No 'use client' — same reasoning as Mapping: this needs to render inside Server Components
 * (every admin list page today is one), and a render-prop `cell` function can't cross the
 * Server→Client boundary. Pagination and sorting stay the caller's responsibility (URL params,
 * same pattern the existing /courses page already uses) — this component only renders the table
 * itself, not a full data-grid state machine.
 */
export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No results found.',
  skeletonRows = 5,
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn('bg-surface rounded-lg border border-border overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-background text-left text-xs font-semibold text-text-secondary uppercase">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={cn('px-4 py-3', col.className)}>
                  {col.headerHref ? (
                    <a href={col.headerHref} className="hover:underline">{col.header}</a>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data === null ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <Skeleton variant="text" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-text-secondary">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              <Mapping array={data} keyExtractor={keyExtractor} wrapper={false}>
                {(row) => (
                  <tr className="border-t border-border hover:bg-surface-hover transition-colors">
                    {columns.map((col) => (
                      <td key={col.key} className={cn('px-4 py-3', col.className)}>{col.cell(row)}</td>
                    ))}
                  </tr>
                )}
              </Mapping>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
