/**
 * POST /upload — Recibe CSV, valida filas, persiste válidas y registra operación.
 * Logs estructurados: correlation_id, operation_id, endpoint, duration_ms, inserted/rejected.
 */

import { Request, Response } from 'express';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import { createOperation, updateOperationMetrics } from '../repositories/operationRepository';
import { insertPolicies, checkExistingPolicyNumbers } from '../repositories/policyRepository';
import { createDefaultPolicyValidator } from '../domain/rules';
import type { PolicyInput, PolicyStatus } from '../types';

/** Log estructurado para observabilidad (correlation_id, operation_id, endpoint, duration_ms, inserted/rejected). */
function logUploadStructured(
  level: 'info' | 'error',
  payload: {
    correlation_id: string;
    operation_id: string;
    endpoint: string;
    duration_ms: number;
    inserted_count?: number;
    rejected_count?: number;
    status?: string;
    error?: string;
  }
): void {
  const line = JSON.stringify({ level, ...payload, message: level === 'error' ? payload.error : 'upload' });
  if (level === 'error') console.error(line);
  else console.log(line);
}

const VALID_STATUSES: PolicyStatus[] = ['active', 'expired', 'cancelled'];

/** Códigos de error para validaciones técnicas. */
const CODES = {
  POLICY_NUMBER_REQUIRED: 'POLICY_NUMBER_REQUIRED',
  INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',
  INVALID_STATUS: 'INVALID_STATUS',
  DUPLICATE_POLICY_NUMBER: 'DUPLICATE_POLICY_NUMBER',
} as const;

const TECHNICAL_ERROR_MESSAGES: Record<string, string> = {
  [CODES.POLICY_NUMBER_REQUIRED]: 'El número de póliza es obligatorio',
  [CODES.INVALID_DATE_RANGE]: 'La fecha de inicio debe ser anterior a la fecha de fin',
  [CODES.INVALID_STATUS]: 'El estado debe ser: active, expired o cancelled',
  [CODES.DUPLICATE_POLICY_NUMBER]: 'El número de póliza ya existe en la base de datos',
  INVALID_NUMBER: 'Los valores numéricos no son válidos',
};

export interface UploadResponse {
  operation_id: string;
  correlation_id: string;
  inserted_count: number;
  rejected_count: number;
  errors: Array<{ row_number: number; field: string; code: string; message: string }>;
}

/**
 * Parsea un buffer CSV a filas (objetos con claves del header).
 */
function parseCsvBuffer(buffer: Buffer): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = [];
    const stream = Readable.from(buffer);
    stream
      .pipe(
        csv({
          mapHeaders: ({ header }) => header.trim().toLowerCase().replace(/\s+/g, '_'),
        })
      )
      .on('data', (row: Record<string, string>) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

/**
 * Normaliza y valida una fila cruda del CSV.
 * Devuelve { policy, technicalErrors }. Si technicalErrors.length > 0, no usar policy.
 */
type UploadRowErrorItem = { row_number: number; field: string; code: string; message: string };

function normalizeAndValidateTechnical(
  raw: Record<string, string>,
  rowNumber: number
): {
  policy: PolicyInput | null;
  technicalErrors: UploadRowErrorItem[];
} {
  const technicalErrors: UploadRowErrorItem[] = [];

  const policyNumber = (raw.policy_number ?? raw['policy number'] ?? '').trim();
  if (!policyNumber) {
    technicalErrors.push({
      row_number: rowNumber,
      field: 'policy_number',
      code: CODES.POLICY_NUMBER_REQUIRED,
      message: TECHNICAL_ERROR_MESSAGES[CODES.POLICY_NUMBER_REQUIRED],
    });
  }

  const startDate = (raw.start_date ?? raw['start date'] ?? '').trim();
  const endDate = (raw.end_date ?? raw['end date'] ?? '').trim();
  if (startDate && endDate) {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || start >= end) {
      technicalErrors.push({
        row_number: rowNumber,
        field: 'start_date,end_date',
        code: CODES.INVALID_DATE_RANGE,
        message: TECHNICAL_ERROR_MESSAGES[CODES.INVALID_DATE_RANGE],
      });
    }
  }

  const statusRaw = (raw.status ?? '').trim().toLowerCase();
  if (!VALID_STATUSES.includes(statusRaw as PolicyStatus)) {
    technicalErrors.push({
      row_number: rowNumber,
      field: 'status',
      code: CODES.INVALID_STATUS,
      message: TECHNICAL_ERROR_MESSAGES[CODES.INVALID_STATUS],
    });
  }

  const premiumUsd = Number(raw.premium_usd ?? raw['premium usd'] ?? NaN);
  const insuredValueUsd = Number(raw.insured_value_usd ?? raw['insured value usd'] ?? NaN);
  if (Number.isNaN(premiumUsd) || Number.isNaN(insuredValueUsd)) {
    if (technicalErrors.length === 0) {
      technicalErrors.push({
        row_number: rowNumber,
        field: 'premium_usd|insured_value_usd',
        code: 'INVALID_NUMBER',
        message: TECHNICAL_ERROR_MESSAGES.INVALID_NUMBER,
      });
    }
  }

  if (technicalErrors.length > 0) {
    return { policy: null, technicalErrors };
  }

  const policy: PolicyInput = {
    policy_number: policyNumber,
    customer: (raw.customer ?? '').trim(),
    policy_type: (raw.policy_type ?? raw['policy type'] ?? '').trim(),
    start_date: startDate,
    end_date: endDate,
    premium_usd: premiumUsd,
    status: statusRaw as PolicyStatus,
    insured_value_usd: insuredValueUsd,
  };
  return { policy, technicalErrors: [] };
}

/**
 * POST /upload — handler.
 * Expecta multer con campo 'file' (o el nombre que se use en la ruta).
 */
export async function handleUpload(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const correlationId = (req.headers['x-correlation-id'] as string)?.trim() || uuidv4();
  const operationId = uuidv4();

  logUploadStructured('info', {
    correlation_id: correlationId,
    operation_id: operationId,
    endpoint: '/upload',
    duration_ms: 0,
  });

  try {
    await createOperation({
      id: operationId,
      endpoint: '/upload',
      status: 'PROCESSING',
      correlation_id: correlationId,
    });
  } catch (err) {
    const durationMs = Date.now() - startTime;
    logUploadStructured('error', {
      correlation_id: correlationId,
      operation_id: operationId,
      endpoint: '/upload',
      duration_ms: durationMs,
      inserted_count: 0,
      rejected_count: 0,
      status: 'FAILED',
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({
      operation_id: operationId,
      correlation_id: correlationId,
      inserted_count: 0,
      rejected_count: 0,
      errors: [],
      error: 'Failed to register operation',
    });
    return;
  }

  const file = req.file;
  if (!file || !(file as Express.Multer.File & { buffer?: Buffer }).buffer) {
    const durationMs = Date.now() - startTime;
    await updateOperationMetrics(operationId, {
      status: 'FAILED',
      rows_inserted: 0,
      rows_rejected: 0,
      duration_ms: durationMs,
      error_summary: 'No file uploaded',
    });
    logUploadStructured('info', {
      correlation_id: correlationId,
      operation_id: operationId,
      endpoint: '/upload',
      duration_ms: durationMs,
      inserted_count: 0,
      rejected_count: 0,
      status: 'FAILED',
    });
    res.status(400).json({
      operation_id: operationId,
      correlation_id: correlationId,
      inserted_count: 0,
      rejected_count: 0,
      errors: [],
      error: 'No file uploaded',
    });
    return;
  }

  const buffer = (file as Express.Multer.File & { buffer: Buffer }).buffer;
  if (!buffer || buffer.length === 0) {
    const durationMs = Date.now() - startTime;
    await updateOperationMetrics(operationId, {
      status: 'FAILED',
      rows_inserted: 0,
      rows_rejected: 0,
      duration_ms: durationMs,
      error_summary: 'Empty file',
    });
    logUploadStructured('info', {
      correlation_id: correlationId,
      operation_id: operationId,
      endpoint: '/upload',
      duration_ms: durationMs,
      inserted_count: 0,
      rejected_count: 0,
      status: 'FAILED',
    });
    res.status(400).json({
      operation_id: operationId,
      correlation_id: correlationId,
      inserted_count: 0,
      rejected_count: 0,
      errors: [],
      error: 'Empty file',
    });
    return;
  }

  const validator = createDefaultPolicyValidator();
  const validPolicies: PolicyInput[] = [];
  const errors: UploadRowErrorItem[] = [];

  try {
    const rows = await parseCsvBuffer(buffer);
    
    // Primera pasada: validar todas las filas (polimorfismo: validator no conoce las reglas concretas)
    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 1;
      const raw = rows[i];
      const { policy, technicalErrors } = normalizeAndValidateTechnical(raw, rowNumber);
      errors.push(...technicalErrors);

      if (policy) {
        const ruleErrors = validator.validate({
          policy_type: policy.policy_type,
          insured_value_usd: policy.insured_value_usd,
        });
        if (ruleErrors.length > 0) {
          for (const e of ruleErrors) {
            errors.push({
              row_number: rowNumber,
              field: e.field,
              code: e.code,
              message: e.message,
            });
          }
        } else {
          validPolicies.push(policy);
        }
      }
    }

    // Verificar duplicados antes de insertar
    if (validPolicies.length > 0) {
      const policyNumbers = validPolicies.map(p => p.policy_number);
      const existingNumbers = await checkExistingPolicyNumbers(policyNumbers);
      
      // Crear un mapa de policy_number a row_number para encontrar fácilmente la fila original
      const policyToRowNumber = new Map<string, number>();
      for (let i = 0; i < rows.length; i++) {
        const rowNumber = i + 1;
        const raw = rows[i];
        const policyNumber = (raw.policy_number ?? raw['policy number'] ?? '').trim();
        if (policyNumber && !policyToRowNumber.has(policyNumber)) {
          policyToRowNumber.set(policyNumber, rowNumber);
        }
      }
      
      // Filtrar políticas duplicadas y agregarlas como errores
      const policiesToInsert: PolicyInput[] = [];
      for (const policy of validPolicies) {
        if (existingNumbers.has(policy.policy_number)) {
          const rowNumber = policyToRowNumber.get(policy.policy_number) || 1;
          errors.push({
            row_number: rowNumber,
            field: 'policy_number',
            code: CODES.DUPLICATE_POLICY_NUMBER,
            message: TECHNICAL_ERROR_MESSAGES[CODES.DUPLICATE_POLICY_NUMBER],
          });
        } else {
          policiesToInsert.push(policy);
        }
      }

      // Insertar solo las políticas no duplicadas
      if (policiesToInsert.length > 0) {
        await insertPolicies(policiesToInsert);
      }
    }

    const insertedCount = validPolicies.length - (errors.filter(e => e.code === CODES.DUPLICATE_POLICY_NUMBER).length);
    const durationMs = Date.now() - startTime;
    await updateOperationMetrics(operationId, {
      status: 'COMPLETED',
      rows_inserted: insertedCount,
      rows_rejected: errors.length,
      duration_ms: durationMs,
      error_summary: errors.length > 0 ? `${errors.length} row(s) rejected` : null,
    });
    logUploadStructured('info', {
      correlation_id: correlationId,
      operation_id: operationId,
      endpoint: '/upload',
      duration_ms: durationMs,
      inserted_count: insertedCount,
      rejected_count: errors.length,
      status: 'COMPLETED',
    });

    const response: UploadResponse = {
      operation_id: operationId,
      correlation_id: correlationId,
      inserted_count: insertedCount,
      rejected_count: errors.length,
      errors: errors.map((e) => ({ row_number: e.row_number, field: e.field, code: e.code, message: e.message })),
    };
    res.status(200).json(response);
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const message = err instanceof Error ? err.message : String(err);
    
    // Detectar errores de duplicado de PostgreSQL
    const isDuplicateError = message.includes('duplicate key') || message.includes('unique constraint') || message.includes('policies_pkey');
    
    if (isDuplicateError) {
      // Si es un error de duplicado, tratarlo como un error de validación (200 con errores)
      // Esto no debería pasar si verificamos antes, pero por si acaso
      await updateOperationMetrics(operationId, {
        status: 'COMPLETED',
        rows_inserted: 0,
        rows_rejected: errors.length + validPolicies.length,
        duration_ms: durationMs,
        error_summary: 'Duplicate policy numbers detected',
      }).catch((updateErr) => console.error('Failed to update operation on error', updateErr));
      
      logUploadStructured('info', {
        correlation_id: correlationId,
        operation_id: operationId,
        endpoint: '/upload',
        duration_ms: durationMs,
        inserted_count: 0,
        rejected_count: errors.length + validPolicies.length,
        status: 'COMPLETED',
      });
      res.status(200).json({
        operation_id: operationId,
        correlation_id: correlationId,
        inserted_count: 0,
        rejected_count: errors.length + validPolicies.length,
        errors: [
          ...errors.map((e) => ({ row_number: e.row_number, field: e.field, code: e.code, message: e.message })),
          ...validPolicies.map((p, idx) => ({
            row_number: idx + 1,
            field: 'policy_number',
            code: CODES.DUPLICATE_POLICY_NUMBER,
            message: TECHNICAL_ERROR_MESSAGES[CODES.DUPLICATE_POLICY_NUMBER],
          })),
        ],
      });
    } else {
      // Otros errores son errores del servidor
      await updateOperationMetrics(operationId, {
        status: 'FAILED',
        rows_inserted: 0,
        rows_rejected: errors.length,
        duration_ms: durationMs,
        error_summary: message,
      }).catch((updateErr) => console.error('Failed to update operation on error', updateErr));
      logUploadStructured('error', {
        correlation_id: correlationId,
        operation_id: operationId,
        endpoint: '/upload',
        duration_ms: durationMs,
        inserted_count: 0,
        rejected_count: errors.length,
        status: 'FAILED',
        error: message,
      });
      
      res.status(500).json({
        operation_id: operationId,
        correlation_id: correlationId,
        inserted_count: 0,
        rejected_count: errors.length,
        errors: errors.map((e) => ({ row_number: e.row_number, field: e.field, code: e.code, message: e.message })),
        error: 'Error interno del servidor al procesar el archivo',
      });
    }
  }
}
