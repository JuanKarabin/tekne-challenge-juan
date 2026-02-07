import { Request, Response } from 'express';
import { getPolicySummary, getPolicies } from '../repositories/policyRepository';
import { generateInsights } from '../services/aiService';
import type { PolicySummary } from '../types';

export interface InsightsRequest {
  filters?: {
    status?: string;
    policy_type?: string;
    q?: string;
  };
}

export interface InsightsResponse {
  insights: string[];
  recommendations?: string[];
  highlights: {
    total_policies: number;
    risk_flags: number;
  };
}

function calculateRiskFlags(summary: PolicySummary, policiesData?: any[]): number {
  let flags = 0;
  
  // Flag 1: Alta concentración por tipo
  const typeCounts: Record<string, number> = {};
  if (policiesData) {
    policiesData.forEach(p => {
      typeCounts[p.policy_type] = (typeCounts[p.policy_type] || 0) + 1;
    });
    
    Object.values(typeCounts).forEach(count => {
      const percentage = (count / summary.total_policies) * 100;
      if (percentage > 60) flags++;
    });
  }
  
  // Flag 2: Valores cerca del mínimo
  if (policiesData) {
    const propertyMin = 5000;
    const autoMin = 10000;
    let nearMinimum = 0;
    
    policiesData.forEach(p => {
      const value = Number(p.insured_value_usd);
      if (p.policy_type === 'Property' && value < propertyMin * 1.1) {
        nearMinimum++;
      } else if (p.policy_type === 'Auto' && value < autoMin * 1.1) {
        nearMinimum++;
      }
    });
    
    const percentage = (nearMinimum / summary.total_policies) * 100;
    if (percentage > 20) flags++;
  }
  
  // Flag 3: Alta proporción de expiradas/canceladas
  const expiredCount = summary.count_by_status.expired || 0;
  const cancelledCount = summary.count_by_status.cancelled || 0;
  if (expiredCount + cancelledCount > summary.total_policies * 0.3) {
    flags++;
  }
  
  // Flag 4: Baja diversidad de tipos
  const typeCount = Object.keys(summary.premium_by_type).length;
  if (typeCount < 2 && summary.total_policies > 10) {
    flags++;
  }
  
  return flags;
}

export async function getInsights(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as InsightsRequest;
    const filters = body.filters;
    
    const summary: PolicySummary = await getPolicySummary();
    
    let policiesData: any[] | undefined;
    if (filters && (filters.status || filters.policy_type || filters.q)) {
      const policiesResult = await getPolicies({
        limit: 100,
        offset: 0,
        status: filters.status,
        policy_type: filters.policy_type,
        search: filters.q,
      });
      policiesData = policiesResult.items;
    } else {
      const policiesResult = await getPolicies({
        limit: 100,
        offset: 0,
      });
      policiesData = policiesResult.items;
    }
    
    const aiResult = await generateInsights(
      summary as unknown as Record<string, unknown>,
      policiesData,
      filters
    );

    if (!aiResult) {
      throw new Error('Failed to generate insights');
    }

    const riskFlags = calculateRiskFlags(summary, policiesData);

    const response: InsightsResponse = {
      insights: aiResult.insights,
      recommendations: aiResult.recommendations,
      highlights: {
        total_policies: summary.total_policies,
        risk_flags: riskFlags,
      },
    };

    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('getInsights error:', err);
    
    try {
      const summary: PolicySummary = await getPolicySummary();
      const riskFlags = calculateRiskFlags(summary);
      
      res.status(500).json({
        error: message,
        insights: [
          'Error generating insights with AI. Verify the configuration of OPENAI_API_KEY or GOOGLE_API_KEY.',
          'The data is available but could not be analyzed with AI.',
        ],
        recommendations: [
          'Review API key configuration in environment variables.',
          'Verify connectivity with the AI provider.',
        ],
        highlights: {
          total_policies: summary.total_policies,
          risk_flags: riskFlags,
        },
      });
    } catch (fallbackErr) {
      res.status(500).json({
        error: message,
        insights: ['Error processing the request.'],
        highlights: {
          total_policies: 0,
          risk_flags: 0,
        },
      });
    }
  }
}
