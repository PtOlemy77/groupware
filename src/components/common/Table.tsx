'use client';

import React from 'react';
import { Inbox } from 'lucide-react';

export interface TableContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  bordered?: boolean;
}

export function TableContainer({
  children,
  className = '',
  bordered = true,
  ...rest
}: TableContainerProps) {
  return (
    <div
      className={`w-full overflow-hidden bg-white ${
        bordered ? 'rounded-2xl border border-slate-200 shadow-2xs' : ''
      } ${className}`}
      {...rest}
    >
      <div className="w-full overflow-x-auto">{children}</div>
    </div>
  );
}

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className = '', ...rest }: TableProps) {
  return (
    <table className={`w-full text-left border-collapse text-sm ${className}`} {...rest}>
      {children}
    </table>
  );
}

export interface TableHeadProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
  className?: string;
}

export function TableHead({ children, className = '', ...rest }: TableHeadProps) {
  return (
    <thead
      className={`bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-xs select-none ${className}`}
      {...rest}
    >
      {children}
    </thead>
  );
}

export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
  className?: string;
}

export function TableBody({ children, className = '', ...rest }: TableBodyProps) {
  return (
    <tbody className={`divide-y divide-slate-100 ${className}`} {...rest}>
      {children}
    </tbody>
  );
}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children: React.ReactNode;
  className?: string;
  selected?: boolean;
  clickable?: boolean;
}

export function TableRow({
  children,
  className = '',
  selected = false,
  clickable = false,
  ...rest
}: TableRowProps) {
  return (
    <tr
      className={`transition-colors ${
        selected
          ? 'bg-indigo-50/50'
          : clickable
          ? 'hover:bg-slate-50/80 cursor-pointer'
          : 'hover:bg-slate-50/50'
      } ${className}`}
      {...rest}
    >
      {children}
    </tr>
  );
}

export interface TableHeaderCellProps
  extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children?: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export function TableHeaderCell({
  children,
  className = '',
  align = 'left',
  ...rest
}: TableHeaderCellProps) {
  const alignClass =
    align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';
  return (
    <th
      className={`px-4 py-3 text-xs font-bold text-slate-600 whitespace-nowrap ${alignClass} ${className}`}
      {...rest}
    >
      {children}
    </th>
  );
}

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children?: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export function TableCell({
  children,
  className = '',
  align = 'left',
  ...rest
}: TableCellProps) {
  const alignClass =
    align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';
  return (
    <td className={`px-4 py-3.5 text-sm text-slate-700 align-middle ${alignClass} ${className}`} {...rest}>
      {children}
    </td>
  );
}

export interface TableEmptyProps {
  message?: string;
  colSpan?: number;
  icon?: React.ReactNode;
  className?: string;
}

export function TableEmpty({
  message = '조회된 데이터가 없습니다.',
  colSpan = 1,
  icon,
  className = '',
}: TableEmptyProps) {
  return (
    <tr>
      <td colSpan={colSpan} className={`px-4 py-12 text-center text-slate-400 ${className}`}>
        <div className="flex flex-col items-center justify-center gap-2">
          {icon || <Inbox className="w-8 h-8 text-slate-300 stroke-[1.5]" />}
          <p className="text-xs sm:text-sm font-medium">{message}</p>
        </div>
      </td>
    </tr>
  );
}

export default Table;

