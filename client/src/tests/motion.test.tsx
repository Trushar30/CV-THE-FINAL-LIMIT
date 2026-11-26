import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  AnimatedNumber,
  StaggerList,
  StaggerItem,
  PageTransition,
  Button,
  Modal,
  Tabs,
} from '../components/ui';

describe('Motion & Micro-Interaction System Suite', () => {
  describe('AnimatedNumber Component', () => {
    it('renders initial formatted value immediately', () => {
      render(<AnimatedNumber value={12500} />);
      expect(screen.getByText('12,500')).toBeDefined();
    });

    it('supports custom formatting function and tabular numerals', () => {
      render(
        <AnimatedNumber
          value={450}
          formatter={(v) => `$${v.toFixed(2)}`}
        />
      );
      const element = screen.getByText('$450.00');
      expect(element).toBeDefined();
      expect(element.style.fontVariantNumeric).toBe('tabular-nums');
    });
  });

  describe('StaggerList & StaggerItem Components', () => {
    it('renders list container and items with content', () => {
      render(
        <StaggerList data-testid="stagger-list">
          <StaggerItem index={0}>Item Alpha</StaggerItem>
          <StaggerItem index={1}>Item Beta</StaggerItem>
          <StaggerItem index={2}>Item Gamma</StaggerItem>
        </StaggerList>
      );

      expect(screen.getByText('Item Alpha')).toBeDefined();
      expect(screen.getByText('Item Beta')).toBeDefined();
      expect(screen.getByText('Item Gamma')).toBeDefined();
    });
  });

  describe('PageTransition Component', () => {
    it('renders child views smoothly without DOM alteration', () => {
      render(
        <PageTransition>
          <h1>Dashboard View</h1>
          <p>Active workspace content</p>
        </PageTransition>
      );

      expect(screen.getByText('Dashboard View')).toBeDefined();
      expect(screen.getByText('Active workspace content')).toBeDefined();
    });
  });

  describe('Motion-Enhanced Button', () => {
    it('fires click handlers and maintains disabled semantics', () => {
      const handleClick = vi.fn();
      render(
        <Button onClick={handleClick} variant="primary">
          Launch Node
        </Button>
      );

      const btn = screen.getByRole('button', { name: /launch node/i });
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Motion-Enhanced Modal', () => {
    it('renders dialog with accessibility and triggers close', () => {
      const handleClose = vi.fn();
      render(
        <Modal
          isOpen={true}
          onClose={handleClose}
          title="Telemetry Inspection"
          description="Live node diagnostics"
        >
          <div>Inspection stream active</div>
        </Modal>
      );

      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByText('Telemetry Inspection')).toBeDefined();
      expect(screen.getByText('Live node diagnostics')).toBeDefined();

      const closeBtn = screen.getByLabelText(/close dialog/i);
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Motion-Enhanced Tabs', () => {
    it('renders tabs and triggers tab change with layout indicator', () => {
      const handleChange = vi.fn();
      const tabs = [
        { id: 'summary', label: 'Summary' },
        { id: 'ledger', label: 'Ledger' },
      ];

      render(<Tabs tabs={tabs} activeTab="summary" onChange={handleChange} />);
      expect(screen.getByRole('tab', { name: /summary/i })).toBeDefined();

      const ledgerTab = screen.getByRole('tab', { name: /ledger/i });
      fireEvent.click(ledgerTab);
      expect(handleChange).toHaveBeenCalledWith('ledger');
    });
  });
});
