import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Button,
  Input,
  Card,
  Modal,
  Table,
  Badge,
  ProgressBar,
  Tabs,
  EmptyState,
  Spinner,
} from '../components/ui';

describe('Reusable UI Components Suite', () => {
  describe('Button Component', () => {
    it('renders with label and fires onClick', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click Me</Button>);
      const btn = screen.getByRole('button', { name: /click me/i });
      expect(btn).toBeDefined();
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('shows loading state and is disabled when loading', () => {
      render(<Button loading>Submit</Button>);
      const btn = screen.getByRole('button');
      expect((btn as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByRole('status')).toBeDefined();
    });

    it('disables button when disabled prop is passed', () => {
      const handleClick = vi.fn();
      render(
        <Button disabled onClick={handleClick}>
          Disabled
        </Button>
      );
      const btn = screen.getByRole('button');
      expect((btn as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Input Component', () => {
    it('renders input with label and helper text', () => {
      render(<Input label="Test Label" helperText="Helper info" placeholder="Enter text..." />);
      expect(screen.getByLabelText(/test label/i)).toBeDefined();
      expect(screen.getByText('Helper info')).toBeDefined();
    });

    it('displays error message and sets aria-invalid', () => {
      render(<Input label="Username" error="Username is required" />);
      const input = screen.getByLabelText(/username/i);
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByText('Username is required')).toBeDefined();
    });
  });

  describe('Card Component', () => {
    it('renders card title, body, and footer', () => {
      render(
        <Card
          title="Telemetry Data"
          subtitle="Real-time metrics"
          footer={<button type="button">Footer Action</button>}
        >
          <p>Card body content</p>
        </Card>
      );
      expect(screen.getByText('Telemetry Data')).toBeDefined();
      expect(screen.getByText('Real-time metrics')).toBeDefined();
      expect(screen.getByText('Card body content')).toBeDefined();
      expect(screen.getByText('Footer Action')).toBeDefined();
    });
  });

  describe('Modal Component', () => {
    it('renders when isOpen is true and calls onClose when clicking close button', () => {
      const handleClose = vi.fn();
      render(
        <Modal
          isOpen={true}
          onClose={handleClose}
          title="Confirm Action"
          description="Are you sure?"
        >
          <p>Modal body</p>
        </Modal>
      );

      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByText('Confirm Action')).toBeDefined();
      expect(screen.getByText('Are you sure?')).toBeDefined();

      const closeBtn = screen.getByLabelText(/close dialog/i);
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('does not render when isOpen is false', () => {
      render(
        <Modal isOpen={false} onClose={vi.fn()} title="Hidden Modal">
          <p>Hidden body</p>
        </Modal>
      );
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('Table Component', () => {
    interface TestRow {
      id: string;
      title: string;
    }

    it('renders table headers and rows correctly', () => {
      const columns = [
        { key: 'id', header: 'ID' },
        { key: 'title', header: 'Title' },
      ];
      const data: TestRow[] = [
        { id: '1', title: 'Task Alpha' },
        { id: '2', title: 'Task Beta' },
      ];

      render(<Table columns={columns} data={data} keyExtractor={(item) => item.id} />);

      expect(screen.getByText('Task Alpha')).toBeDefined();
      expect(screen.getByText('Task Beta')).toBeDefined();
    });

    it('renders empty message when data is empty', () => {
      render(
        <Table
          columns={[{ key: 'id', header: 'ID' }]}
          data={[]}
          keyExtractor={(item) => String(item)}
          emptyText="No records found"
        />
      );
      expect(screen.getByText('No records found')).toBeDefined();
    });
  });

  describe('Badge Component', () => {
    it('renders badge content with dot', () => {
      render(
        <Badge variant="success" dot>
          Active
        </Badge>
      );
      expect(screen.getByText('Active')).toBeDefined();
    });
  });

  describe('ProgressBar Component', () => {
    it('renders progress bar with label and aria values', () => {
      render(<ProgressBar value={75} max={100} label="Completion" showPercentage />);
      const pb = screen.getByRole('progressbar');
      expect(pb.getAttribute('aria-valuenow')).toBe('75');
      expect(screen.getByText('Completion')).toBeDefined();
      expect(screen.getByText('75%')).toBeDefined();
    });
  });

  describe('Tabs Component', () => {
    it('renders tab list and triggers onChange', () => {
      const handleTabChange = vi.fn();
      const tabs = [
        { id: 'tab1', label: 'First Tab' },
        { id: 'tab2', label: 'Second Tab' },
      ];

      render(
        <Tabs tabs={tabs} activeTab="tab1" onChange={handleTabChange}>
          <div>Panel Content</div>
        </Tabs>
      );

      expect(screen.getByRole('tab', { name: /first tab/i })).toBeDefined();
      const secondTab = screen.getByRole('tab', { name: /second tab/i });
      fireEvent.click(secondTab);
      expect(handleTabChange).toHaveBeenCalledWith('tab2');
    });
  });

  describe('EmptyState Component', () => {
    it('renders empty state title, description and action', () => {
      render(
        <EmptyState
          icon="📦"
          title="No Items"
          description="Nothing here"
          action={<button type="button">Create Item</button>}
        />
      );
      expect(screen.getByText('No Items')).toBeDefined();
      expect(screen.getByText('Nothing here')).toBeDefined();
      expect(screen.getByText('Create Item')).toBeDefined();
    });
  });

  describe('Spinner Component', () => {
    it('renders spinner with accessible status role', () => {
      render(<Spinner label="Processing..." />);
      expect(screen.getByRole('status')).toBeDefined();
      expect(screen.getByLabelText('Processing...')).toBeDefined();
    });
  });
});
