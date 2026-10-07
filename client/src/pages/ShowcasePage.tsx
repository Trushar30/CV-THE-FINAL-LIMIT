import { useState, type ReactElement } from 'react';
import {
  Button,
  Input,
  Card,
  Modal,
  Table,
  Badge,
  useToast,
  Spinner,
  EmptyState,
  ProgressBar,
  Tabs,
  type TabItem,
  type Column,
} from '../components/ui';
import styles from './ShowcasePage.module.css';

interface DemoTableRow {
  id: string;
  name: string;
  role: string;
  domain: string;
  level: number;
  exp: number;
  status: 'ACTIVE' | 'PENDING' | 'INTERVIEWING' | 'REJECTED';
}

const DEMO_TABLE_DATA: DemoTableRow[] = [
  {
    id: 'APP-101',
    name: 'Elena Rostova',
    role: 'Senior Backend Engineer',
    domain: 'SOFTWARE_ENGINEERING',
    level: 7,
    exp: 6850,
    status: 'ACTIVE',
  },
  {
    id: 'APP-102',
    name: 'Marcus Vance',
    role: 'Cloud Architect',
    domain: 'CLOUD_ENGINEERING',
    level: 8,
    exp: 9200,
    status: 'INTERVIEWING',
  },
  {
    id: 'APP-103',
    name: 'Aria Thorne',
    role: 'AI Model Specialist',
    domain: 'AI_ENGINEERING',
    level: 5,
    exp: 3400,
    status: 'PENDING',
  },
  {
    id: 'APP-104',
    name: 'David Kim',
    role: 'DevOps Specialist',
    domain: 'CLOUD_ENGINEERING',
    level: 3,
    exp: 1350,
    status: 'REJECTED',
  },
];

export function ShowcasePage(): ReactElement {
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('components');
  const [inputValue, setInputValue] = useState<string>('');
  const [hasInputError, setHasInputError] = useState<boolean>(false);
  const [buttonLoading, setButtonLoading] = useState<boolean>(false);
  const [progressVal, setProgressVal] = useState<number>(68);

  const demoTabs: TabItem[] = [
    { id: 'components', label: 'All UI Components', icon: '🧩', badge: '11' },
    { id: 'typography', label: 'Design System Tokens', icon: '🎨' },
    { id: 'interactive', label: 'State & Overlays', icon: '⚡' },
  ];

  const tableColumns: Column<DemoTableRow>[] = [
    {
      key: 'id',
      header: 'ID',
      width: '90px',
      render: (row) => (
        <code style={{ fontSize: '0.75rem', color: 'var(--cv-accent-cyan-400)' }}>{row.id}</code>
      ),
    },
    {
      key: 'name',
      header: 'Candidate / Employee',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--cv-text-muted)' }}>{row.role}</div>
        </div>
      ),
    },
    {
      key: 'domain',
      header: 'Domain',
      render: (row) => {
        const variant =
          row.domain === 'SOFTWARE_ENGINEERING'
            ? 'primary'
            : row.domain === 'CLOUD_ENGINEERING'
              ? 'cyan'
              : 'purple';
        return (
          <Badge variant={variant} size="sm">
            {row.domain.replace('_', ' ')}
          </Badge>
        );
      },
    },
    {
      key: 'level',
      header: 'Level',
      align: 'center',
      render: (row) => (
        <Badge variant="gold" size="sm">
          L{row.level}
        </Badge>
      ),
    },
    {
      key: 'exp',
      header: 'Total EXP',
      align: 'right',
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--cv-violet-400)' }}>
          {row.exp.toLocaleString()} EXP
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (row) => {
        const variant =
          row.status === 'ACTIVE'
            ? 'success'
            : row.status === 'INTERVIEWING'
              ? 'info'
              : row.status === 'PENDING'
                ? 'warning'
                : 'danger';
        return (
          <Badge variant={variant} size="sm" dot>
            {row.status}
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => toast.info(`Viewing record for ${row.name}`, row.id)}
        >
          Inspect
        </Button>
      ),
    },
  ];

  return (
    <div className={styles.showcaseContainer}>
      {/* Hero Header */}
      <section className={styles.heroSection}>
        <div className={styles.heroBadge}>
          <Badge variant="cyan" size="md" dot>
            Phase 1 Foundation • Client System
          </Badge>
        </div>
        <h1 className={styles.heroTitle}>CorpVerse Component System</h1>
        <p className={styles.heroSubtitle}>
          Professional corporate-tech design system built with Vanilla CSS design tokens, modular
          components, responsive layouts, and strict authoritative error handling.
        </p>
      </section>

      {/* Tabs Switcher */}
      <Tabs tabs={demoTabs} activeTab={activeTab} onChange={setActiveTab} variant="pills">
        {activeTab === 'components' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cv-space-8)' }}>
            {/* Buttons Section */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Buttons</h2>
                <span className={styles.sectionDesc}>Variants, sizes, states, and icons</span>
              </div>

              <div className={styles.interactiveBox}>
                <div className={styles.boxLabel}>Variants</div>
                <div className={styles.flexWrap}>
                  <Button variant="primary">Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="danger">Danger</Button>
                  <Button variant="cyan">Cyber Cyan</Button>
                  <Button variant="gold">CorpCoin Gold</Button>
                </div>
              </div>

              <div className={styles.grid}>
                <div className={styles.interactiveBox}>
                  <div className={styles.boxLabel}>Sizes</div>
                  <div className={styles.flexWrap}>
                    <Button size="sm">Small</Button>
                    <Button size="md">Medium</Button>
                    <Button size="lg">Large</Button>
                  </div>
                </div>

                <div className={styles.interactiveBox}>
                  <div className={styles.boxLabel}>States & Icons</div>
                  <div className={styles.flexWrap}>
                    <Button
                      loading={buttonLoading}
                      onClick={() => {
                        setButtonLoading(true);
                        setTimeout(() => setButtonLoading(false), 1500);
                      }}
                    >
                      {buttonLoading ? 'Loading' : 'Click for Loading State'}
                    </Button>
                    <Button disabled>Disabled</Button>
                    <Button leftIcon="🚀" variant="cyan">
                      With Left Icon
                    </Button>
                    <Button rightIcon="→" variant="outline">
                      With Right Icon
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            {/* Inputs Section */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Input Fields</h2>
                <span className={styles.sectionDesc}>Labels, validation states, and icons</span>
              </div>

              <div className={styles.grid}>
                <Input
                  label="Standard Text Input"
                  placeholder="Enter employee handle..."
                  helperText="Alphanumeric characters only"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />

                <Input
                  label="With Prefix Icon"
                  placeholder="name@corpverse.dev"
                  leftIcon="📧"
                  type="email"
                />

                <Input
                  label="Validation Error State"
                  placeholder="Enter password..."
                  error={
                    hasInputError
                      ? 'Invalid credentials format. Minimum 8 characters required.'
                      : undefined
                  }
                  helperText={
                    !hasInputError ? 'Toggle error button to test validation message' : undefined
                  }
                  type="password"
                />

                <Input
                  label="Disabled State"
                  value="SYSTEM_IMMUTABLE_IDENTIFIER"
                  disabled
                  helperText="Read-only authoritative platform field"
                />
              </div>

              <div style={{ marginTop: 'var(--cv-space-2)' }}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setHasInputError((prev) => !prev)}
                >
                  {hasInputError ? 'Clear Input Error' : 'Trigger Input Error State'}
                </Button>
              </div>
            </section>

            {/* Badges & Spinners Section */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Badges & Spinners</h2>
                <span className={styles.sectionDesc}>Status tags and loader primitives</span>
              </div>

              <div className={styles.interactiveBox}>
                <div className={styles.boxLabel}>Badge Variants</div>
                <div className={styles.flexWrap}>
                  <Badge variant="default">Default</Badge>
                  <Badge variant="primary">Primary</Badge>
                  <Badge variant="success" dot>
                    Success
                  </Badge>
                  <Badge variant="warning" dot>
                    Warning
                  </Badge>
                  <Badge variant="danger" dot>
                    Danger
                  </Badge>
                  <Badge variant="info" dot>
                    Information
                  </Badge>
                  <Badge variant="purple">Violet EXP</Badge>
                  <Badge variant="gold">CorpCoin Gold</Badge>
                  <Badge variant="cyan">Cyber Cyan</Badge>
                </div>
              </div>

              <div className={styles.interactiveBox}>
                <div className={styles.boxLabel}>Spinners (sm, md, lg, xl)</div>
                <div className={styles.flexWrap}>
                  <Spinner size="sm" color="primary" />
                  <Spinner size="md" color="cyan" />
                  <Spinner size="lg" color="emerald" />
                  <Spinner size="xl" color="gold" />
                  <Spinner size="md" color="muted" />
                </div>
              </div>
            </section>

            {/* Cards Section */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Cards</h2>
                <span className={styles.sectionDesc}>
                  Glassmorphic, elevated, default, and interactive
                </span>
              </div>

              <div className={styles.grid}>
                <Card
                  variant="default"
                  title="Default Surface"
                  subtitle="Standard border and subtle shadow"
                  footer={<Button size="sm">Action</Button>}
                >
                  <p style={{ color: 'var(--cv-text-secondary)', fontSize: '0.875rem' }}>
                    Used for standard content containers, profile sections, and non-elevated views.
                  </p>
                </Card>

                <Card
                  variant="glass"
                  title="Glassmorphism Card"
                  subtitle="Backdrop blur + translucent fill"
                  hoverable
                  headerAction={
                    <Badge variant="cyan" size="sm">
                      Glass
                    </Badge>
                  }
                  footer={
                    <Button size="sm" variant="cyan">
                      Explore
                    </Button>
                  }
                >
                  <p style={{ color: 'var(--cv-text-secondary)', fontSize: '0.875rem' }}>
                    Features backdrop blur and glow hover effect. Perfect for executive dashboards.
                  </p>
                </Card>

                <Card
                  variant="elevated"
                  title="Elevated Card"
                  subtitle="High-contrast elevation"
                  footer={
                    <Button size="sm" variant="secondary">
                      Details
                    </Button>
                  }
                >
                  <p style={{ color: 'var(--cv-text-secondary)', fontSize: '0.875rem' }}>
                    Used for modal dialogues, prominent telemetry, and critical notifications.
                  </p>
                </Card>

                <Card
                  variant="outlined"
                  title="Outlined Card"
                  subtitle="Transparent background"
                  hoverable
                >
                  <p style={{ color: 'var(--cv-text-secondary)', fontSize: '0.875rem' }}>
                    Minimal footprint card for list items, secondary metric clusters, and tables.
                  </p>
                </Card>
              </div>
            </section>

            {/* Progress Bars Section */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Progress Bars</h2>
                <span className={styles.sectionDesc}>Levels, economy gauges, and task metrics</span>
              </div>

              <div className={styles.interactiveBox}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cv-space-4)' }}>
                  <ProgressBar
                    value={progressVal}
                    max={100}
                    label="Career Level Progression (L4 -> L5)"
                    showPercentage
                    colorVariant="violet"
                    glow
                    animated
                  />

                  <ProgressBar
                    value={85}
                    max={100}
                    label="Company Financial Health (Solvency Rating)"
                    showPercentage
                    colorVariant="emerald"
                  />

                  <ProgressBar
                    value={42}
                    max={100}
                    label="Daily AI Tasks Completed"
                    showPercentage
                    colorVariant="cyan"
                    size="sm"
                  />

                  <ProgressBar
                    value={15}
                    max={100}
                    label="System Warning Danger Gauge"
                    showPercentage
                    colorVariant="rose"
                    size="lg"
                  />
                </div>

                <div className={styles.flexWrap} style={{ marginTop: 'var(--cv-space-2)' }}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setProgressVal((prev) => Math.max(0, prev - 15))}
                  >
                    - 15%
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setProgressVal((prev) => Math.min(100, prev + 15))}
                  >
                    + 15%
                  </Button>
                </div>
              </div>
            </section>

            {/* Table Section */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Data Table</h2>
                <span className={styles.sectionDesc}>
                  Responsive horizontal scroll, alignment, and badges
                </span>
              </div>

              <Table
                columns={tableColumns}
                data={DEMO_TABLE_DATA}
                keyExtractor={(item) => item.id}
                striped
                hoverable
              />
            </section>

            {/* Empty State Section */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Empty State</h2>
                <span className={styles.sectionDesc}>Clean zero-data placeholder</span>
              </div>

              <EmptyState
                icon="📊"
                title="No Active Job Applications"
                description="You have not submitted applications to any virtual company yet. Explore the Platform Job Board to begin your career progression."
                action={
                  <Button
                    variant="primary"
                    onClick={() => toast.info('Navigating to Job Board stub')}
                  >
                    Browse Open Requisitions
                  </Button>
                }
              />
            </section>
          </div>
        )}

        {/* Design System Tokens Tab */}
        {activeTab === 'typography' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cv-space-6)' }}>
            <Card title="Color Palette Tokens" subtitle="Tailored HSL / Hex cyber-corporate colors">
              <div className={styles.colorSwatchGrid}>
                <div
                  className={styles.colorSwatch}
                  style={{ backgroundColor: 'var(--cv-brand-primary-600)', color: '#fff' }}
                >
                  <span className={styles.colorSwatchName}>Brand Primary</span>
                  <span className={styles.colorSwatchValue}>#4f46e5</span>
                </div>
                <div
                  className={styles.colorSwatch}
                  style={{ backgroundColor: 'var(--cv-accent-cyan-500)', color: '#fff' }}
                >
                  <span className={styles.colorSwatchName}>Cyber Cyan</span>
                  <span className={styles.colorSwatchValue}>#06b6d4</span>
                </div>
                <div
                  className={styles.colorSwatch}
                  style={{ backgroundColor: 'var(--cv-accent-emerald-500)', color: '#fff' }}
                >
                  <span className={styles.colorSwatchName}>Success Emerald</span>
                  <span className={styles.colorSwatchValue}>#10b981</span>
                </div>
                <div
                  className={styles.colorSwatch}
                  style={{ backgroundColor: 'var(--cv-gold-500)', color: '#0f172a' }}
                >
                  <span className={styles.colorSwatchName}>CorpCoin Gold</span>
                  <span className={styles.colorSwatchValue}>#f59e0b</span>
                </div>
                <div
                  className={styles.colorSwatch}
                  style={{ backgroundColor: 'var(--cv-violet-500)', color: '#fff' }}
                >
                  <span className={styles.colorSwatchName}>EXP Violet</span>
                  <span className={styles.colorSwatchValue}>#8b5cf6</span>
                </div>
                <div
                  className={styles.colorSwatch}
                  style={{ backgroundColor: 'var(--cv-status-danger-text)', color: '#fff' }}
                >
                  <span className={styles.colorSwatchName}>Danger Rose</span>
                  <span className={styles.colorSwatchValue}>#ef4444</span>
                </div>
              </div>
            </Card>

            <Card
              title="Typography Hierarchy Scale"
              subtitle="Inter font family with crisp geometric weights"
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cv-space-4)' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--cv-text-muted)' }}>
                    Display 3XL (30px / 800)
                  </div>
                  <div style={{ fontSize: 'var(--cv-text-3xl)', fontWeight: 800 }}>
                    The Virtual Corporate Metaverse
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--cv-text-muted)' }}>
                    Heading 2XL (24px / 700)
                  </div>
                  <div style={{ fontSize: 'var(--cv-text-2xl)', fontWeight: 700 }}>
                    Executive Management Headquarters
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--cv-text-muted)' }}>
                    Heading XL (20px / 600)
                  </div>
                  <div style={{ fontSize: 'var(--cv-text-xl)', fontWeight: 600 }}>
                    Autonomous AI Bot Procurement
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--cv-text-muted)' }}>
                    Body Base (16px / 400)
                  </div>
                  <div
                    style={{ fontSize: 'var(--cv-text-base)', color: 'var(--cv-text-secondary)' }}
                  >
                    Each transaction increments or decrements balances with authoritative ledger
                    integrity.
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--cv-text-muted)' }}>
                    Monospace Code (14px)
                  </div>
                  <code
                    style={{
                      fontSize: 'var(--cv-text-sm)',
                      color: 'var(--cv-accent-cyan-400)',
                      fontFamily: 'var(--cv-font-mono)',
                    }}
                  >
                    POST /api/v1/applications/:id/interview/messages
                  </code>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Interactive Overlays Tab */}
        {activeTab === 'interactive' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cv-space-6)' }}>
            <Card
              title="Interactive Toast Notifications"
              subtitle="Floating stacked alerts with auto-dismiss"
            >
              <div className={styles.flexWrap}>
                <Button
                  variant="primary"
                  onClick={() =>
                    toast.success(
                      'EXP award ledger record written successfully!',
                      'Transaction Confirmed'
                    )
                  }
                >
                  Trigger Success Toast
                </Button>
                <Button
                  variant="danger"
                  onClick={() =>
                    toast.error(
                      'Debit rejected: Insufficient CorpCoin balance.',
                      'Overdraft Prevented'
                    )
                  }
                >
                  Trigger Error Toast
                </Button>
                <Button
                  variant="gold"
                  onClick={() =>
                    toast.warning(
                      'Employee has received 3 active performance warnings.',
                      'Review Threshold Alert'
                    )
                  }
                >
                  Trigger Warning Toast
                </Button>
                <Button
                  variant="cyan"
                  onClick={() =>
                    toast.info('AI Gateway switched provider to OpenAI gpt-4o.', 'Routing Notice')
                  }
                >
                  Trigger Info Toast
                </Button>
              </div>
            </Card>

            <Card
              title="Interactive Modal Dialog"
              subtitle="Backdrop blur, keyboard accessibility & focus handling"
            >
              <p
                style={{
                  color: 'var(--cv-text-secondary)',
                  marginBottom: 'var(--cv-space-4)',
                  fontSize: '0.875rem',
                }}
              >
                Modals trap scroll, close on ESC key, and support custom header, body, and action
                footer.
              </p>
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                Open Modal Demonstration
              </Button>
            </Card>
          </div>
        )}
      </Tabs>

      {/* Modal Instance */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Promote Candidate to Employee"
        description="Authoritative action will write ledger entries and update user role."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setModalOpen(false);
                toast.success(
                  'Candidate successfully hired! Level 1 Intern role assigned.',
                  'Offer Accepted'
                );
              }}
            >
              Confirm Promotion
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cv-space-4)' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--cv-text-secondary)' }}>
            You are about to accept job offer for candidate <strong>Elena Rostova</strong>. This
            will update their <code>careerRole</code> from <code>JOB_SEEKER</code> to{' '}
            <code>EMPLOYEE</code>.
          </p>
          <div
            style={{
              padding: 'var(--cv-space-3)',
              background: 'var(--cv-bg-surface-elevated)',
              borderRadius: 'var(--cv-radius-md)',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--cv-text-muted)' }}>
              Initial Onboarding Reward
            </div>
            <div
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--cv-violet-400)',
                marginTop: '2px',
              }}
            >
              + 100 Starter CorpCoin • Level 1 Onboarding Task Assigned
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ShowcasePage;
