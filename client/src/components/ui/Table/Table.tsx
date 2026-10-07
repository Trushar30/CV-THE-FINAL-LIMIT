import type { ReactElement, ReactNode } from 'react';
import styles from './Table.module.css';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T, index: number) => ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string | number;
  hoverable?: boolean;
  striped?: boolean;
  emptyText?: string;
  className?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  hoverable = true,
  striped = false,
  emptyText = 'No data available',
  className = '',
}: TableProps<T>): ReactElement {
  return (
    <div className={`${styles.container} ${className}`}>
      <table
        className={`${styles.table} ${hoverable ? styles.hoverable : ''} ${striped ? styles.striped : ''}`}
      >
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className={`${styles.th} ${styles[`align-${col.align || 'left'}`]}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={styles.emptyCell}>
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr key={keyExtractor(row, index)} className={styles.tr}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`${styles.td} ${styles[`align-${col.align || 'left'}`]}`}
                  >
                    {col.render
                      ? col.render(row, index)
                      : ((row as Record<string, unknown>)[col.key] as ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
