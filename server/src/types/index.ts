/**
 * Tipos del dominio y persistencia — alineados con CSV y tablas DB.
 */

// --- Policy (CSV + tabla policies) ---

export type PolicyStatus = 'active' | 'expired' | 'cancelled';

export type PolicyType = 'Property' | 'Auto' | string;

/** DTO de entrada (CSV/API). Sin created_at. */
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

/** Entidad persistida en DB (incluye created_at). */
export interface Policy extends PolicyInput {
  created_at: Date;
}

/** Fila parseada del CSV antes de validación (valores pueden venir como string). */
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

// --- Operation (trazabilidad, tabla operations) ---

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

/** DTO para crear una operación (insert). */
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

/** Campos actualizables tras procesar el upload. */
export interface OperationUpdateMetrics {
  status: OperationStatus;
  rows_inserted: number;
  rows_rejected: number;
  duration_ms: number;
  error_summary?: string | null;
}

// --- Errores de reglas de negocio (code, field, message) ---

export interface RuleError {
  code: string;
  field: string;
  message: string;
}

/** Error reportado en respuesta de upload (incluye row_number). */
export interface UploadRowError extends RuleError {
  row_number: number;
}

// --- API de consulta (GET /policies, GET /policies/summary) ---

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
