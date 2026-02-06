/**
 * Repositorio de operaciones — trazabilidad en tabla operations.
 */

import { pool } from '../db';
import type { OperationInsert, OperationStatus, OperationUpdateMetrics } from '../types';

const TABLE = 'operations';

/**
 * Crea una nueva operación (estado inicial RECEIVED o PROCESSING).
 * La tabla tiene id y operation_id; se rellena ambos con el mismo UUID.
 */
export async function createOperation(data: OperationInsert): Promise<void> {
  const query = `
    INSERT INTO ${TABLE} (
      id, operation_id, endpoint, status, correlation_id,
      rows_inserted, rows_rejected, duration_ms, error_summary
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `;
  await pool.query(query, [
    data.id,
    data.id,
    data.endpoint,
    data.status,
    data.correlation_id,
    data.rows_inserted ?? null,
    data.rows_rejected ?? null,
    data.duration_ms ?? null,
    data.error_summary ?? null,
  ]);
}

/**
 * Actualiza el estado de una operación (por operation_id / id).
 */
export async function updateOperationStatus(
  operationId: string,
  status: OperationStatus
): Promise<void> {
  await pool.query(
    `UPDATE ${TABLE} SET status = $1 WHERE operation_id = $2`,
    [status, operationId]
  );
}

/**
 * Actualiza métricas y estado final de la operación (COMPLETED o FAILED).
 */
export async function updateOperationMetrics(
  operationId: string,
  metrics: OperationUpdateMetrics
): Promise<void> {
  const query = `
    UPDATE ${TABLE}
    SET status = $1, rows_inserted = $2, rows_rejected = $3, duration_ms = $4, error_summary = $5
    WHERE operation_id = $6
  `;
  await pool.query(query, [
    metrics.status,
    metrics.rows_inserted,
    metrics.rows_rejected,
    metrics.duration_ms,
    metrics.error_summary ?? null,
    operationId,
  ]);
}

/**
 * Obtiene una operación por id (opcional, para lecturas).
 */
export async function getOperationById(operationId: string): Promise<{
  id: string;
  created_at: Date;
  endpoint: string;
  status: string;
  correlation_id: string;
  rows_inserted: number | null;
  rows_rejected: number | null;
  duration_ms: number | null;
  error_summary: string | null;
} | null> {
  const result = await pool.query(
    `SELECT id, operation_id, created_at, endpoint, status, correlation_id,
            rows_inserted, rows_rejected, duration_ms, error_summary
     FROM ${TABLE} WHERE operation_id = $1`,
    [operationId]
  );
  const row = result.rows[0];
  return row ? (row as typeof row) : null;
}
