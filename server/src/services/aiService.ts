import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AiInsightsResponse {
  insights: string[];
  recommendations: string[];
}

type AiProvider = 'openai' | 'gemini';

const GEMINI_MODEL_ID = 'gemini-1.5-flash';
const OPENAI_MODEL_ID = 'gpt-4o-mini';

function getAvailableProvider(): AiProvider | null {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()) {
    return 'openai';
  }
  if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY.trim()) {
    return 'gemini';
  }
  return null;
}

function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey || !apiKey.trim()) return null;
  return new GoogleGenerativeAI(apiKey.trim());
}


interface RiskAnalysis {
  totalPolicies: number;
  totalPremium: number;
  statusDistribution: Record<string, number>;
  typeDistribution: Record<string, number>;
  riskFlags: string[];
  averageInsuredValue: number;
  policiesNearMinimum: number;
  concentrationRisk: string[];
}

function analyzeRisks(summaryData: Record<string, unknown>, policiesData?: any[]): RiskAnalysis {
  const totalPolicies = (summaryData.total_policies as number) || 0;
  const totalPremium = (summaryData.total_premium_usd as number) || 0;
  const statusDistribution = (summaryData.count_by_status as Record<string, number>) || {};
  const typeDistribution = (summaryData.premium_by_type as Record<string, number>) || {};
  
  const riskFlags: string[] = [];
  const concentrationRisk: string[] = [];
  let nearMinimum = 0;
  
  const typeCounts: Record<string, number> = {};
  if (policiesData) {
    policiesData.forEach(p => {
      typeCounts[p.policy_type] = (typeCounts[p.policy_type] || 0) + 1;
    });
    
    Object.entries(typeCounts).forEach(([type, count]) => {
      const percentage = (count / totalPolicies) * 100;
      if (percentage > 60) {
        concentrationRisk.push(`${type}: ${percentage.toFixed(1)}%`);
        riskFlags.push(`CONCENTRATION_${type.toUpperCase()}`);
      }
    });
    
    const propertyMin = 5000;
    const autoMin = 10000;
    
    policiesData.forEach(p => {
      const value = Number(p.insured_value_usd);
      if (p.policy_type === 'Property' && value < propertyMin * 1.1) {
        nearMinimum++;
      } else if (p.policy_type === 'Auto' && value < autoMin * 1.1) {
        nearMinimum++;
      }
    });
    
    if (nearMinimum > 0) {
      const percentage = (nearMinimum / totalPolicies) * 100;
      if (percentage > 20) {
        riskFlags.push('VALUES_NEAR_MINIMUM');
      }
    }
  }
  
  const expiredCount = statusDistribution.expired || 0;
  const cancelledCount = statusDistribution.cancelled || 0;
  if (expiredCount + cancelledCount > totalPolicies * 0.3) {
    riskFlags.push('HIGH_EXPIRED_CANCELLED');
  }
  
  const averageInsuredValue = policiesData && policiesData.length > 0
    ? policiesData.reduce((sum, p) => sum + Number(p.insured_value_usd), 0) / policiesData.length
    : 0;
  
  return {
    totalPolicies,
    totalPremium,
    statusDistribution,
    typeDistribution,
    riskFlags,
    averageInsuredValue,
    policiesNearMinimum: nearMinimum,
    concentrationRisk,
  };
}

function buildPrompt(summaryData: Record<string, unknown>, riskAnalysis: RiskAnalysis, filters?: Record<string, string>): string {
  const dataStr = JSON.stringify(summaryData, null, 2);
  const filtersStr = filters && Object.keys(filters).length > 0
    ? ` Applied filters: ${JSON.stringify(filters)}.`
    : '';

  return `Act as an insurance risk analyst. Based on this summarized data:

${dataStr}
${filtersStr}

Generate an analysis in valid JSON format (no markdown, no \`\`\`json) with two fields:

1) "insights": an array of 5 to 10 short lines describing:
   - Risks and anomalies (e.g., many rejections, insured values near the minimum, concentration by policy type, high share of expired/cancelled).
   - Include numbers and percentages where relevant.
   - Each array item can be a sentence or a line.

2) "recommendations": an array with exactly 2 or 3 actionable recommendations (e.g., review thresholds, request more data, implement alerts, diversify the portfolio, manual review when insured_value < 1.1x minimum).

Response format (only this JSON, nothing else):

{
  "insights": [
    "Line 1: detected risk or anomaly",
    "Line 2: ...",
    "Between 5 and 10 lines total"
  ],
  "recommendations": [
    "Actionable recommendation 1",
    "Actionable recommendation 2",
    "Actionable recommendation 3 (must include 2 or 3 recommendations)"
  ]
}

IMPORTANT: You must return exactly 2 or 3 recommendations in "recommendations". Be specific, quantified, and practical using the summary data.`;
}

const DEFAULT_RECOMMENDATIONS = [
  'Review insured value and premium thresholds periodically.',
  'Implement alerts when indicators approach defined limits.',
  'Request additional data or manual review when anomalies are detected.',
];


function parseModelJson(text: string): AiInsightsResponse {
  let raw = text.trim();
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) raw = codeBlockMatch[1].trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) raw = jsonMatch[0];

  const parsed = JSON.parse(raw) as AiInsightsResponse;
  let insights = Array.isArray(parsed.insights) ? parsed.insights : [];
  let recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];

  if (recommendations.length < 2) {
    const extra = DEFAULT_RECOMMENDATIONS.slice(0, 2 - recommendations.length);
    recommendations = [...recommendations, ...extra];
  }
  if (recommendations.length > 3) {
    recommendations = recommendations.slice(0, 3);
  }

  return { insights, recommendations };
}

async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL_ID,
      messages: [
        {
          role: 'system',
          content: 'You are an insurance risk analyst. Respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}


export async function generateInsights(
  summaryData: Record<string, unknown>,
  policiesData?: any[],
  filters?: Record<string, string>
): Promise<AiInsightsResponse | null> {
  const provider = getAvailableProvider();
  
  if (!provider) {
    console.log('[aiService] No AI provider available (OPENAI_API_KEY or GOOGLE_API_KEY)');
    return generateFallbackInsights(summaryData, policiesData);
  }

  const riskAnalysis = analyzeRisks(summaryData, policiesData);
  const prompt = buildPrompt(summaryData, riskAnalysis, filters);

  try {
    let responseText: string;

    if (provider === 'openai') {
      console.log('[aiService] Usando OpenAI (ChatGPT)');
      responseText = await callOpenAI(prompt);
    } else {
      console.log('[aiService] Usando Google Gemini');
      const genAI = getGeminiClient();
      if (!genAI) {
        return generateFallbackInsights(summaryData, policiesData);
      }
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_ID });
      const result = await model.generateContent(prompt);
      const response = result.response;
      if (!response?.text) {
        console.log('[aiService] Gemini response sin .text()');
        return generateFallbackInsights(summaryData, policiesData);
      }
      responseText = response.text();
    }

    return parseModelJson(responseText);
  } catch (err) {
    console.error('[aiService] Error calling AI provider:', err);
    if (err instanceof Error) {
      console.error('[aiService] message:', err.message);
    }
    return generateFallbackInsights(summaryData, policiesData);
  }
}


function generateFallbackInsights(
  summaryData: Record<string, unknown>,
  policiesData?: any[]
): AiInsightsResponse {
  const riskAnalysis = analyzeRisks(summaryData, policiesData);
  const insights: string[] = [];
  const recommendations: string[] = [];

  if (riskAnalysis.totalPolicies === 0) {
    insights.push('No policies are registered in the system.');
    recommendations.push('Upload policies using the upload endpoint.');
    recommendations.push('Review thresholds and validation rules once data exists.');
    return { insights, recommendations };
  }

  if (riskAnalysis.concentrationRisk.length > 0) {
    insights.push(`High concentration detected: ${riskAnalysis.concentrationRisk.join(', ')}. This may increase exposure risk.`);
    recommendations.push('Diversify the portfolio to reduce concentration risk.');
  }

  if (riskAnalysis.policiesNearMinimum > 0) {
    const percentage = ((riskAnalysis.policiesNearMinimum / riskAnalysis.totalPolicies) * 100).toFixed(1);
    insights.push(`${percentage}% of policies have insured values close to the minimum allowed.`);
    recommendations.push('Implement alerts when insured_value < 1.1x the minimum for manual review.');
  }

  const expiredCount = riskAnalysis.statusDistribution.expired || 0;
  const cancelledCount = riskAnalysis.statusDistribution.cancelled || 0;
  if (expiredCount + cancelledCount > riskAnalysis.totalPolicies * 0.3) {
    const percentage = (((expiredCount + cancelledCount) / riskAnalysis.totalPolicies) * 100).toFixed(1);
    insights.push(`${percentage}% of policies are expired or cancelled.`);
    recommendations.push('Review customer retention strategies for active policies.');
  }

  if (insights.length === 0) {
    insights.push(`Portfolio of ${riskAnalysis.totalPolicies} policies with total premium of $${riskAnalysis.totalPremium.toLocaleString()}.`);
    insights.push('Risk distribution appears balanced.');
    recommendations.push('Continue monitoring key metrics regularly.');
  }

  if (recommendations.length < 2) {
    recommendations.push('Review insured value and premium thresholds periodically.');
  }
  if (recommendations.length < 3) {
    recommendations.push('Set alerts when indicators approach defined limits.');
  }
  if (recommendations.length > 3) {
    recommendations.length = 3;
  }

  return { insights, recommendations };
}
