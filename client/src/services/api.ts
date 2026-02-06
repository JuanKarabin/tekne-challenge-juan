import axios from 'axios';

// --- TIPOS (INTERFACES) ---

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

/** Respuesta de GET /policies/summary (alineada con el servidor). */
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
  recommendations?: string[]; // Opcional por si el backend lo manda separado
  highlights: {
    total_policies: number;
    risk_flags: number;
  };
}

// --- CLIENTE API ---

const api = axios.create({
  baseURL: '/api', // El proxy de Vite redirige esto a localhost:3000
});

export const uploadFile = async (file: File): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  try {
    const response = await api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error: any) {
    // Si la respuesta tiene datos (incluso con errores), devolverlos
    if (error.response?.data) {
      // Si tiene estructura de UploadResponse, devolverla
      if (error.response.data.operation_id !== undefined) {
        throw error; // Re-lanzar para que el componente maneje el resultado
      }
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

export const getAiInsights = async (filters?: any): Promise<AiInsightsResponse> => {
  const response = await api.post('/ai/insights', filters || {});
  return response.data;
};

export default {
  uploadFile,
  getPolicies,
  getSummary,
  getAiInsights,
};