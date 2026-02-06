import { Request, Response } from 'express';
import { getPolicies, getPolicySummary } from '../repositories/policyRepository';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export async function listPolicies(req: Request, res: Response): Promise<void> {
  try {
    let limit = parseInt(String(req.query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT;
    limit = Math.min(Math.max(1, limit), MAX_LIMIT);
    
    let offset = parseInt(String(req.query.offset ?? 0), 10) || 0;
    offset = Math.max(0, offset);

    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const policy_type = typeof req.query.policy_type === 'string' ? req.query.policy_type : undefined;

    const { items, total } = await getPolicies({
      limit,
      offset,
      search: q,
      status,
      policy_type,
    });

    res.json({
      items,
      pagination: {
        limit,
        offset,
        total,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('listPolicies error:', err);
    res.status(500).json({ error: message });
  }
}

export async function getSummary(req: Request, res: Response): Promise<void> {
  try {
    const summary = await getPolicySummary();
    res.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('getSummary error:', err);
    res.status(500).json({ error: message });
  }
}
