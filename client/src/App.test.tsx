import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('Client Smoke & App Suite', () => {
  it('should run a trivial assertion successfully', () => {
    expect(true).toBe(true);
  });

  it('renders CorpVerse heading', () => {
    render(<App />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeDefined();
    expect(heading.textContent).toBe('CorpVerse');
  });
});
