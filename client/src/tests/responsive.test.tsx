import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';

describe('Showcase Responsiveness & Viewports Suite', () => {
  it('renders correctly at desktop (1280px)', () => {
    window.innerWidth = 1280;
    window.innerHeight = 800;
    render(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
    expect(screen.getByText('CorpVerse Component System')).toBeDefined();
    // Balance pills visible
    expect(screen.getByTitle('Total EXP')).toBeDefined();
    expect(screen.getByTitle('CorpCoin Balance')).toBeDefined();
  });

  it('renders correctly at tablet (768px)', () => {
    window.innerWidth = 768;
    window.innerHeight = 1024;
    render(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
    expect(screen.getByLabelText(/open navigation menu/i)).toBeDefined();
  });

  it('renders correctly at mobile (360px) and toggles mobile drawer', () => {
    window.innerWidth = 360;
    window.innerHeight = 740;
    render(<App />);

    const menuBtn = screen.getByLabelText(/open navigation menu/i);
    expect(menuBtn).toBeDefined();

    // Open mobile menu
    fireEvent.click(menuBtn);
    const closeBtn = screen.getByLabelText(/close menu/i);
    expect(closeBtn).toBeDefined();

    // Close mobile menu
    fireEvent.click(closeBtn);
  });
});
