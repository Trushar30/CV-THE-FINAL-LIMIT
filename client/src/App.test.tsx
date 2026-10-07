import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('Client Smoke & App Suite', () => {
  it('should run a trivial assertion successfully', () => {
    expect(true).toBe(true);
  });

  it('renders CorpVerse heading and component showcase', () => {
    render(<App />);
    const heading = screen.getByRole('heading', { level: 1, name: /corpverse component system/i });
    expect(heading).toBeDefined();

    expect(screen.getByText('CorpVerse Component System')).toBeDefined();
    expect(screen.getByText('Buttons')).toBeDefined();
    expect(screen.getByText('Input Fields')).toBeDefined();
  });
});
