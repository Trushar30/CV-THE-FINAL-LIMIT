import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { GradientASCII } from '../components/ui/GradientASCII/GradientASCII';

describe('GradientASCII Component Suite', () => {
  it('renders canvas element with aria-hidden="true"', () => {
    const { container } = render(<GradientASCII />);
    const wrapper = container.querySelector('.gradient-ascii-container');
    const canvas = container.querySelector('canvas');

    expect(wrapper).toBeDefined();
    expect(canvas).toBeDefined();
    expect(canvas?.getAttribute('aria-hidden')).toBe('true');
  });

  it('applies custom className and style props correctly', () => {
    const { container } = render(
      <GradientASCII
        className="custom-ascii-test"
        style={{ height: '300px', opacity: 0.8 }}
      />
    );
    const wrapper = container.querySelector('.gradient-ascii-container') as HTMLElement;

    expect(wrapper.classList.contains('custom-ascii-test')).toBe(true);
    expect(wrapper.style.height).toBe('300px');
    expect(wrapper.style.opacity).toBe('0.8');
  });

  it('renders without error in lightMode', () => {
    const { container } = render(
      <GradientASCII
        lightMode={true}
        shape="horizon"
        characters=" 01+-·:;=*#@"
      />
    );
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeDefined();
  });

  it('mounts and unmounts cleanly without throwing', () => {
    const { unmount } = render(
      <GradientASCII
        shape="pinch"
        glow={0.2}
        speed={1}
      />
    );
    expect(() => unmount()).not.toThrow();
  });
});
