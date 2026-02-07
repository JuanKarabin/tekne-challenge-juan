import axios from 'axios';

export interface Policy {
  policy_number: string;
  customer: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  premium_usd: number | string;
  status: string;
  insured_value_usd: number | string;
  created_at?: string;
}

export interface PoliciesResponse {
  items: Policy[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface GetPoliciesParams {
  limit?: number;
  offset?: number;
  q?: string;
  status?: string;
  policy_type?: string;
}

export interface PolicySummary {
  total_policies: number;
  total_premium_usd: number;
  count_by_status: Record<string, number>;
  count_by_type: Record<string, number>;
  premium_by_type: Record<string, number>;
}

export interface UploadResponse {
  operation_id: string;
  inserted_count: number;
  rejected_count: number;
  errors: Array<{ row_number: number; field: string; code: string; message?: string }>;
}

export interface AiInsightsResponse {
  insights: string[];
  recommendations?: string[];
  highlights: {
    total_policies: number;
    risk_flags: number;
  };
}


const api = axios.create({
  baseURL: '/api',
});

export const uploadFile = async (file: File): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  try {
    const response = await api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      if (error.response?.data && (error.response.data as { operation_id?: string }).operation_id !== undefined) {
        throw error;
      }
      throw error;
    }
    throw error;
  }
};

export const getPolicies = async (params?: GetPoliciesParams): Promise<PoliciesResponse> => {
  const response = await api.get('/policies', { params });
  return response.data;
};

export const getSummary = async (): Promise<PolicySummary> => {
  const response = await api.get('/policies/summary');
  return response.data;
};

export interface AiInsightsFilters {
  filters?: {
    status?: string;
    policy_type?: string;
    q?: string;
  };
}

export const getAiInsights = async (filters?: AiInsightsFilters): Promise<AiInsightsResponse> => {
  const response = await api.post('/ai/insights', filters || {});
  return response.data;
};

export default {
  uploadFile,
  getPolicies,
  getSummary,
  getAiInsights,
};