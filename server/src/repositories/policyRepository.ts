import { pool } from '../db';
import type { PolicyInput, Policy, PoliciesListResult, PolicySummary } from '../types';

const TABLE = 'policies';


export async function insertPolicy(policy: PolicyInput): Promise<void> {
  const query = `
    INSERT INTO ${TABLE} (
      policy_number,
      customer,
      policy_type,
      start_date,
      end_date,
      premium_usd,
      status,
      insured_value_usd
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `;
  const values = [
    policy.policy_number,
    policy.customer,
    policy.policy_type,
    policy.start_date,
    policy.end_date,
    policy.premium_usd,
    policy.status,
    policy.insured_value_usd,
  ];
  await pool.query(query, values);
}


export async function checkExistingPolicyNumbers(policyNumbers: string[]): Promise<Set<string>> {
  if (policyNumbers.length === 0) return new Set();
  
  const placeholders = policyNumbers.map((_, i) => `$${i + 1}`).join(',');
  const query = `SELECT policy_number FROM ${TABLE} WHERE policy_number IN (${placeholders})`;
  const result = await pool.query(query, policyNumbers);
  return new Set(result.rows.map((row) => row.policy_number));
}


export async function insertPolicies(policies: PolicyInput[]): Promise<void> {
  if (policies.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const policy of policies) {
      await client.query(
        `INSERT INTO ${TABLE} (
          policy_number, customer, policy_type, start_date, end_date,
          premium_usd, status, insured_value_usd
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          policy.policy_number,
          policy.customer,
          policy.policy_type,
          policy.start_date,
          policy.end_date,
          policy.premium_usd,
          policy.status,
          policy.insured_value_usd,
        ]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}


export interface GetPoliciesParams {
  limit: number;
  offset: number;
  search?: string;
  status?: string;
  policy_type?: string;
}


export async function getPolicies(params: GetPoliciesParams): Promise<PoliciesListResult> {
  const { limit, offset, search, status, policy_type } = params;
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (search && search.trim()) {
    conditions.push(`(policy_number ILIKE $${paramIndex} OR customer ILIKE $${paramIndex})`);
    values.push(`%${search.trim()}%`);
    paramIndex++;
  }
  if (status && status.trim()) {
    conditions.push(`status = $${paramIndex}`);
    values.push(status.trim());
    paramIndex++;
  }
  if (policy_type && policy_type.trim()) {
    conditions.push(`policy_type = $${paramIndex}`);
    values.push(policy_type.trim());
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const countQuery = `SELECT COUNT(*)::int AS total FROM ${TABLE} ${whereClause}`;
  const countResult = await pool.query(countQuery, values);
  const total = countResult.rows[0]?.total ?? 0;

  values.push(limit, offset);
  const listQuery = `
    SELECT policy_number, customer, policy_type, start_date, end_date,
           premium_usd, status, insured_value_usd, created_at
    FROM ${TABLE}
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  const listResult = await pool.query(listQuery, values);
  const items = (listResult.rows as unknown[]) as Policy[];

  return { items, total };
}


export async function getPolicySummary(): Promise<PolicySummary> {
  const [countResult, sumResult, statusResult, countByTypeResult, typeResult] = await Promise.all([
    pool.query<{ total_policies: string }>(`SELECT COUNT(*) AS total_policies FROM ${TABLE}`),
    pool.query<{ total_premium_usd: string }>(`SELECT COALESCE(SUM(premium_usd), 0) AS total_premium_usd FROM ${TABLE}`),
    pool.query<{ status: string; count: string }>(`SELECT status, COUNT(*)::int AS count FROM ${TABLE} GROUP BY status`),
    pool.query<{ policy_type: string; count: string }>(`SELECT policy_type, COUNT(*)::int AS count FROM ${TABLE} GROUP BY policy_type`),
    pool.query<{ policy_type: string; premium_usd: string }>(`SELECT policy_type, COALESCE(SUM(premium_usd), 0) AS premium_usd FROM ${TABLE} GROUP BY policy_type`),
  ]);

  const total_policies = parseInt(countResult.rows[0]?.total_policies ?? '0', 10);
  const total_premium_usd = parseFloat(sumResult.rows[0]?.total_premium_usd ?? '0');
  const count_by_status: Record<string, number> = {};
  for (const row of statusResult.rows) {
    count_by_status[row.status] = parseInt(row.count, 10);
  }
  const count_by_type: Record<string, number> = {};
  for (const row of countByTypeResult.rows) {
    count_by_type[row.policy_type] = parseInt(row.count, 10);
  }
  const premium_by_type: Record<string, number> = {};
  for (const row of typeResult.rows) {
    premium_by_type[row.policy_type] = parseFloat(row.premium_usd);
  }

  return {
    total_policies,
    total_premium_usd,
    count_by_status,
    count_by_type,
    premium_by_type,
  };
}
