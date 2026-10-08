import { apiClient } from './client';
import type { CareerDomain } from './onboarding';

export type { CareerDomain };

export type CompanyType = 'PLATFORM' | 'FOUNDER';
export type CompanyStatus = 'ACTIVE' | 'BANKRUPT' | 'SUSPENDED';
export type JobStatus = 'OPEN' | 'CLOSED';

export interface CompanyRatings {
  overall: number;
  culture: number;
  workLife: number;
  technicalExcellence: number;
  reviewCount: number;
}

export interface CompanyListItem {
  _id: string;
  type: CompanyType;
  isPlatformCompany: boolean;
  name: string;
  description?: string;
  domainsHired: CareerDomain[];
  status: CompanyStatus;
  ratings: CompanyRatings;
  companyRating: number;
  employeeCount: number;
  maxEmployees: number;
  openJobCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanyJobSummary {
  _id: string;
  companyId: string;
  domain: CareerDomain;
  minLevel: number;
  maxLevel: number;
  title: string;
  description: string;
  requiredSkills: string[];
  openings: number;
  status: JobStatus;
  isOpen: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanyDetails extends CompanyListItem {
  financialHealth: number;
  aiProviderPool?: string;
}

export interface CompanyWithJobsResponse {
  company: CompanyDetails;
  openJobs: CompanyJobSummary[];
}

export interface JobListItem {
  _id: string;
  companyId: {
    _id: string;
    name: string;
    type: CompanyType;
    companyRating: number;
    ratings?: CompanyRatings;
    status: CompanyStatus;
  };
  domain: CareerDomain;
  minLevel: number;
  maxLevel: number;
  title: string;
  description: string;
  requiredSkills: string[];
  openings: number;
  status: JobStatus;
  isOpen: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface JobDetails {
  _id: string;
  companyId: {
    _id: string;
    name: string;
    type: CompanyType;
    companyRating: number;
    ratings?: CompanyRatings;
    status: CompanyStatus;
    description?: string;
    domainsHired?: CareerDomain[];
    employeeCount?: number;
    maxEmployees?: number;
  };
  domain: CareerDomain;
  minLevel: number;
  maxLevel: number;
  title: string;
  description: string;
  requiredSkills: string[];
  openings: number;
  status: JobStatus;
  isOpen: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ListCompaniesParams {
  domain?: CareerDomain | string;
  type?: CompanyType | string;
  status?: CompanyStatus | string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListJobsParams {
  domain?: CareerDomain | string;
  minLevel?: number;
  maxLevel?: number;
  companyId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const careerApi = {
  /**
   * List/search companies with domain filter, search keyword, and pagination.
   */
  async getCompanies(params?: ListCompaniesParams): Promise<CompanyListItem[]> {
    return apiClient.get<CompanyListItem[]>('/companies', {
      params: params as Record<string, string | number | boolean | undefined>,
    });
  },

  /**
   * Get company details by ID along with its active job openings.
   */
  async getCompany(id: string): Promise<CompanyWithJobsResponse> {
    return apiClient.get<CompanyWithJobsResponse>(`/companies/${id}`);
  },

  /**
   * List/search open jobs with domain, level, and keyword filters.
   */
  async getJobs(params?: ListJobsParams): Promise<JobListItem[]> {
    return apiClient.get<JobListItem[]>('/jobs', {
      params: params as Record<string, string | number | boolean | undefined>,
    });
  },

  /**
   * Get single job details by ID populated with company summary.
   */
  async getJob(id: string): Promise<JobDetails> {
    return apiClient.get<JobDetails>(`/jobs/${id}`);
  },
};
