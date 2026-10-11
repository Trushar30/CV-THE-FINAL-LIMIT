import { useEffect } from 'react';

/**
 * Custom hook to dynamically update document title and announce route updates.
 * Standardizes page title format to: `<Page Title> | CorpVerse`
 */
export function useDocumentTitle(title: string, prevailOnUnmount = false): void {
  useEffect(() => {
    const previousTitle = document.title;
    const formattedTitle = title ? `${title} | CorpVerse` : 'CorpVerse — Virtual Corporate Simulation';
    document.title = formattedTitle;

    return () => {
      if (!prevailOnUnmount) {
        document.title = previousTitle;
      }
    };
  }, [title, prevailOnUnmount]);
}
