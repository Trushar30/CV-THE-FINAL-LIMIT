import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('Client Smoke & App Suite', () => {
  it('should run a trivial assertion successfully', () => {
    expect(true).toBe(true);
  });

  it('renders CorpVerse landing page on /landing route', () => {
    window.history.pushState({}, '', '/landing');
    render(<App />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeDefined();
    expect(heading.textContent).toContain('Experience the Corporate Ladder');
    expect(screen.getByText('Open Career Hub')).toBeDefined();
  });

  it('redirects authenticated session on root route to role dashboard', () => {
    window.history.pushState({}, '', '/');
    render(<App />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeDefined();
    expect(heading.textContent).toContain('Hiring Journey & Applications');
  });

  it('renders component showcase at /showcase route', () => {
    window.history.pushState({}, '', '/showcase');
    render(<App />);
    const heading = screen.getByRole('heading', { level: 1, name: /corpverse component system/i });
    expect(heading).toBeDefined();

    expect(screen.getByText('CorpVerse Component System')).toBeDefined();
    expect(screen.getByText('Buttons')).toBeDefined();
    expect(screen.getByText('Input Fields')).toBeDefined();
  });
});
