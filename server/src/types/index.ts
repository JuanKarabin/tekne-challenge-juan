export type PolicyStatus = 'active' | 'expired' | 'cancelled';

export type PolicyType = 'Property' | 'Auto' | string;

export interface PolicyInput {
  policy_number: string;
  customer: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  premium_usd: number;
  status: PolicyStatus;
  insured_value_usd: number;
}

export interface Policy extends PolicyInput {
  created_at: Date;
}

export interface PolicyRow {
  policy_number: string;
  customer: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  premium_usd: number;
  status: string;
  insured_value_usd: number;
}


export type OperationStatus = 'RECEIVED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface Operation {
  id: string;
  created_at: Date;
  endpoint: string;
  status: OperationStatus;
  correlation_id: string;
  rows_inserted: number | null;
  rows_rejected: number | null;
  duration_ms: number | null;
  error_summary: string | null;
}

export interface OperationInsert {
  id: string;
  endpoint: string;
  status: OperationStatus;
  correlation_id: string;
  rows_inserted?: number | null;
  rows_rejected?: number | null;
  duration_ms?: number | null;
  error_summary?: string | null;
}

export interface OperationUpdateMetrics {
  status: OperationStatus;
  rows_inserted: number;
  rows_rejected: number;
  duration_ms: number;
  error_summary?: string | null;
}


export interface RuleError {
  code: string;
  field: string;
  message: string;
}

export interface UploadRowError extends RuleError {
  row_number: number;
}


export interface PoliciesListResult {
  items: Policy[];
  total: number;
}

export interface PolicySummary {
  total_policies: number;
  total_premium_usd: number;
  count_by_status: Record<string, number>;
  count_by_type: Record<string, number>;
  premium_by_type: Record<string, number>;
}

export interface GetPoliciesFilters {
  search?: string;
  status?: string;
  policy_type?: string;
}
