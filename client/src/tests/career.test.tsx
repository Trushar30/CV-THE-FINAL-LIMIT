import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CompaniesPage } from '../pages/CompaniesPage';
import { CompanyDetailPage } from '../pages/CompanyDetailPage';
import { JobsPage } from '../pages/JobsPage';
import { JobDetailPage } from '../pages/JobDetailPage';
import {
  careerApi,
  type CompanyListItem,
  type CompanyWithJobsResponse,
  type JobListItem,
  type JobDetails,
} from '../api/career';

const baseCompany: CompanyListItem = {
  _id: 'comp-1',
  name: 'Nexus Enterprise Systems',
  type: 'PLATFORM',
  isPlatformCompany: true,
  description: 'High-throughput enterprise backends and automated reasoning pipelines.',
  domainsHired: ['SOFTWARE_ENGINEERING', 'CLOUD_ENGINEERING', 'AI_ENGINEERING'],
  status: 'ACTIVE',
  ratings: {
    overall: 4.8,
    culture: 4.7,
    workLife: 4.6,
    technicalExcellence: 4.9,
    reviewCount: 38,
  },
  companyRating: 4.8,
  employeeCount: 12,
  maxEmployees: 20,
  openJobCount: 3,
};

const secondCompany: CompanyListItem = {
  _id: 'comp-2',
  name: 'CloudScale Infrastructure',
  type: 'PLATFORM',
  isPlatformCompany: true,
  description: 'Distributed multi-cloud orchestration and site reliability engineering.',
  domainsHired: ['CLOUD_ENGINEERING', 'SOFTWARE_ENGINEERING'],
  status: 'ACTIVE',
  ratings: {
    overall: 4.6,
    culture: 4.5,
    workLife: 4.4,
    technicalExcellence: 4.8,
    reviewCount: 24,
  },
  companyRating: 4.6,
  employeeCount: 8,
  maxEmployees: 20,
  openJobCount: 2,
};

const mockCompanies: CompanyListItem[] = [baseCompany, secondCompany];

const mockCompanyDetails: CompanyWithJobsResponse = {
  company: {
    ...baseCompany,
    financialHealth: 0,
    aiProviderPool: 'PIPELINE',
  },
  openJobs: [
    {
      _id: 'job-1',
      companyId: 'comp-1',
      domain: 'SOFTWARE_ENGINEERING',
      minLevel: 1,
      maxLevel: 4,
      title: 'Distributed Systems Associate',
      description: 'Design and optimize backend event-driven services.',
      requiredSkills: ['Node.js', 'TypeScript', 'MongoDB'],
      openings: 2,
      status: 'OPEN',
      isOpen: true,
    },
  ],
};

const job1: JobListItem = {
  _id: 'job-1',
  companyId: {
    _id: 'comp-1',
    name: 'Nexus Enterprise Systems',
    type: 'PLATFORM',
    companyRating: 4.8,
    status: 'ACTIVE',
  },
  domain: 'SOFTWARE_ENGINEERING',
  minLevel: 1,
  maxLevel: 4,
  title: 'Distributed Systems Associate',
  description: 'Design and optimize backend event-driven services.',
  requiredSkills: ['Node.js', 'TypeScript', 'MongoDB'],
  openings: 2,
  status: 'OPEN',
  isOpen: true,
};

const job2: JobListItem = {
  _id: 'job-2',
  companyId: {
    _id: 'comp-2',
    name: 'CloudScale Infrastructure',
    type: 'PLATFORM',
    companyRating: 4.6,
    status: 'ACTIVE',
  },
  domain: 'CLOUD_ENGINEERING',
  minLevel: 7,
  maxLevel: 9,
  title: 'Principal Cloud Reliability Architect',
  description: 'Architect multi-region Kubernetes clusters.',
  requiredSkills: ['Kubernetes', 'Terraform', 'AWS'],
  openings: 1,
  status: 'OPEN',
  isOpen: true,
};

const mockJobs: JobListItem[] = [job1, job2];

const mockJobDetails: JobDetails = {
  _id: 'job-1',
  companyId: {
    _id: 'comp-1',
    name: 'Nexus Enterprise Systems',
    type: 'PLATFORM',
    companyRating: 4.8,
    status: 'ACTIVE',
    description: 'High-throughput enterprise backends and automated reasoning pipelines.',
    domainsHired: ['SOFTWARE_ENGINEERING', 'CLOUD_ENGINEERING', 'AI_ENGINEERING'],
    employeeCount: 12,
    maxEmployees: 20,
  },
  domain: 'SOFTWARE_ENGINEERING',
  minLevel: 1,
  maxLevel: 4,
  title: 'Distributed Systems Associate',
  description: 'Design and optimize backend event-driven services.',
  requiredSkills: ['Node.js', 'TypeScript', 'MongoDB'],
  openings: 2,
  status: 'OPEN',
  isOpen: true,
};

describe('Career & Enterprise Browsing Suite (TASK P5.2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. CompaniesPage (Company List)', () => {
    it('renders company list with cards, domain tags, employee counts, and ratings', async () => {
      vi.spyOn(careerApi, 'getCompanies').mockResolvedValue(mockCompanies);

      render(
        <MemoryRouter>
          <CompaniesPage />
        </MemoryRouter>
      );

      // Loading state initially
      expect(screen.getByTestId('loading-state')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Nexus Enterprise Systems')).toBeInTheDocument();
        expect(screen.getByText('CloudScale Infrastructure')).toBeInTheDocument();
      });

      // Verification of cards
      expect(screen.getByTestId('company-card-comp-1')).toBeInTheDocument();
      expect(screen.getByTestId('company-card-comp-2')).toBeInTheDocument();

      // Ratings & employee count
      expect(screen.getByText('4.8')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('3 Open Positions')).toBeInTheDocument();
    });

    it('filters companies by domain chip click', async () => {
      const getCompaniesSpy = vi.spyOn(careerApi, 'getCompanies').mockResolvedValue([baseCompany]);

      render(
        <MemoryRouter>
          <CompaniesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Nexus Enterprise Systems')).toBeInTheDocument();
      });

      // Click Software Engineering filter chip
      const softwareChip = screen.getByRole('button', { name: 'Software Engineering' });
      fireEvent.click(softwareChip);

      await waitFor(() => {
        expect(getCompaniesSpy).toHaveBeenCalledWith(
          expect.objectContaining({ domain: 'SOFTWARE_ENGINEERING' })
        );
      });
    });

    it('filters companies by search input', async () => {
      const getCompaniesSpy = vi.spyOn(careerApi, 'getCompanies').mockResolvedValue([baseCompany]);

      render(
        <MemoryRouter>
          <CompaniesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Nexus Enterprise Systems')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText('Search companies');
      fireEvent.change(searchInput, { target: { value: 'Nexus' } });

      await waitFor(() => {
        expect(getCompaniesSpy).toHaveBeenCalledWith(expect.objectContaining({ search: 'Nexus' }));
      });
    });

    it('renders empty state when no companies match filter criteria', async () => {
      vi.spyOn(careerApi, 'getCompanies').mockResolvedValue([]);

      render(
        <MemoryRouter>
          <CompaniesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('No companies found')).toBeInTheDocument();
      });
    });
  });

  describe('2. CompanyDetailPage (Company Detail)', () => {
    it('renders company details with executive banner, ratings breakdown, and open jobs', async () => {
      vi.spyOn(careerApi, 'getCompany').mockResolvedValue(mockCompanyDetails);

      render(
        <MemoryRouter initialEntries={['/companies/comp-1']}>
          <Routes>
            <Route path="/companies/:id" element={<CompanyDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Nexus Enterprise Systems')).toBeInTheDocument();
      });

      // Rating breakdowns
      expect(screen.getByText('Engineering Culture')).toBeInTheDocument();
      expect(screen.getByText('Work-Life Balance')).toBeInTheDocument();
      expect(screen.getByText('Technical Excellence')).toBeInTheDocument();

      // Open requisitions
      expect(screen.getByText('Active Job Requisitions (1)')).toBeInTheDocument();
      expect(screen.getByText('Distributed Systems Associate')).toBeInTheDocument();
      expect(screen.getByTestId('company-job-card-job-1')).toBeInTheDocument();
    });

    it('renders empty state if company has no open jobs', async () => {
      vi.spyOn(careerApi, 'getCompany').mockResolvedValue({
        ...mockCompanyDetails,
        openJobs: [],
      });

      render(
        <MemoryRouter initialEntries={['/companies/comp-1']}>
          <Routes>
            <Route path="/companies/:id" element={<CompanyDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('No active requisitions')).toBeInTheDocument();
      });
    });
  });

  describe('3. JobsPage (Job List)', () => {
    it('renders open job cards with title, company, level, and required skills', async () => {
      vi.spyOn(careerApi, 'getJobs').mockResolvedValue(mockJobs);

      render(
        <MemoryRouter>
          <JobsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Distributed Systems Associate')).toBeInTheDocument();
        expect(screen.getByText('Principal Cloud Reliability Architect')).toBeInTheDocument();
      });

      expect(screen.getByTestId('job-card-job-1')).toBeInTheDocument();
      expect(screen.getByTestId('job-card-job-2')).toBeInTheDocument();
      expect(
        screen.getByText(
          (_, el) =>
            el?.tagName.toLowerCase() === 'span' && el?.textContent?.trim() === '2 openings'
        )
      ).toBeInTheDocument();
    });

    it('filters jobs by domain chip click', async () => {
      const getJobsSpy = vi
        .spyOn(careerApi, 'getJobs')
        .mockResolvedValueOnce(mockJobs)
        .mockResolvedValueOnce([job2]);

      render(
        <MemoryRouter>
          <JobsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Distributed Systems Associate')).toBeInTheDocument();
      });

      const cloudChip = screen.getByRole('button', { name: 'Cloud Engineering' });
      fireEvent.click(cloudChip);

      await waitFor(() => {
        expect(getJobsSpy).toHaveBeenCalledWith(
          expect.objectContaining({ domain: 'CLOUD_ENGINEERING' })
        );
      });
    });

    it('filters jobs by seniority level preset dropdown', async () => {
      const getJobsSpy = vi
        .spyOn(careerApi, 'getJobs')
        .mockResolvedValueOnce(mockJobs)
        .mockResolvedValueOnce([job2]);

      render(
        <MemoryRouter>
          <JobsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Distributed Systems Associate')).toBeInTheDocument();
      });

      const select = screen.getByLabelText('Filter by seniority level');
      fireEvent.change(select, { target: { value: '3' } }); // Senior & Lead (L7 - L10)

      await waitFor(() => {
        expect(getJobsSpy).toHaveBeenCalledWith(
          expect.objectContaining({ minLevel: 7, maxLevel: 10 })
        );
      });
    });
  });

  describe('4. JobDetailPage (Job Detail & Apply CTA)', () => {
    it('renders job requirements, company overview, and disabled Apply button with x/5 quota', async () => {
      vi.spyOn(careerApi, 'getJob').mockResolvedValue(mockJobDetails);

      render(
        <MemoryRouter initialEntries={['/jobs/job-1']}>
          <Routes>
            <Route path="/jobs/:id" element={<JobDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Distributed Systems Associate')).toBeInTheDocument();
      });

      // Role description and required skills
      expect(screen.getByText('Required Technical Competencies')).toBeInTheDocument();
      expect(screen.getByText('Node.js')).toBeInTheDocument();
      expect(screen.getByText('TypeScript')).toBeInTheDocument();
      expect(screen.getByText('MongoDB')).toBeInTheDocument();

      // Apply CTA Card
      expect(screen.getByTestId('apply-cta-card')).toBeInTheDocument();

      // Active application quota counter (0 / 5)
      expect(screen.getByTestId('application-quota-counter')).toBeInTheDocument();
      expect(screen.getByTestId('quota-count')).toHaveTextContent('0 / 5');

      // Disabled Apply button
      const applyBtn = screen.getByTestId('apply-button');
      expect(applyBtn).toBeInTheDocument();
      expect(applyBtn).toBeDisabled();
      expect(applyBtn).toHaveTextContent('Apply for Position');

      // Phase 6.1 unlocking note
      expect(screen.getByTestId('apply-notice')).toHaveTextContent(
        'Application submission unlocks in Phase 6.1'
      );
    });

    it('renders error state when job ID is not found', async () => {
      vi.spyOn(careerApi, 'getJob').mockRejectedValue(new Error('Job not found'));

      render(
        <MemoryRouter initialEntries={['/jobs/non-existent-id']}>
          <Routes>
            <Route path="/jobs/:id" element={<JobDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Job not found')).toBeInTheDocument();
      });
    });
  });
});
