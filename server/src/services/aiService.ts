/**
 * Servicio de IA — Soporta OpenAI (ChatGPT) y Google Gemini para generar insights.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AiInsightsResponse {
  insights: string[];
  recommendations: string[];
}

type AiProvider = 'openai' | 'gemini';

const GEMINI_MODEL_ID = 'gemini-1.5-flash';
const OPENAI_MODEL_ID = 'gpt-4o-mini';

/**
 * Detecta qué proveedor de IA está disponible basado en las variables de entorno.
 */
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

/**
 * Analiza los datos y calcula métricas de riesgo antes de enviarlos a la IA.
 */
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
  
  // Análisis de concentración por tipo
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
    
    // Análisis de valores cerca del mínimo
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
  
  // Análisis de distribución de status
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

/**
 * Construye el prompt alineado con el requerimiento: texto corto (5-10 líneas) con riesgos/anomalías y 2-3 recomendaciones accionables.
 */
function buildPrompt(summaryData: Record<string, unknown>, riskAnalysis: RiskAnalysis, filters?: Record<string, string>): string {
  const dataStr = JSON.stringify(summaryData, null, 2);
  const filtersStr = filters && Object.keys(filters).length > 0
    ? ` Filtros aplicados: ${JSON.stringify(filters)}.`
    : '';

  return `Actúa como un analista de riesgos de seguros. Basado en estos datos resumidos:

${dataStr}
${filtersStr}

Genera un análisis en formato JSON válido (sin markdown, sin \`\`\`json) con dos campos:

1) "insights": un array de 5 a 10 líneas cortas que describan:
   - Riesgos y anomalías (ej. muchos rechazos, valores asegurados cerca del mínimo, concentración por tipo de póliza, alta proporción de expiradas/canceladas).
   - Incluye números y porcentajes cuando sea relevante.
   - Cada elemento del array puede ser una frase o línea.

2) "recommendations": un array con exactamente 2 o 3 recomendaciones accionables (ej. revisar umbrales, pedir más data, implementar alertas, diversificar portafolio, revisión manual cuando insured_value < 1.1x mínimo).

Formato de respuesta (solo este JSON, nada más):

{
  "insights": [
    "Línea 1: riesgo o anomalía detectada",
    "Línea 2: ...",
    "Entre 5 y 10 líneas en total"
  ],
  "recommendations": [
    "Recomendación accionable 1",
    "Recomendación accionable 2",
    "Recomendación accionable 3 (obligatorio incluir 2 o 3 recomendaciones)"
  ]
}

IMPORTANTE: Debes devolver exactamente 2 o 3 recomendaciones en "recommendations". Sé específico, cuantificado y práctico usando los datos del summary.`;
}

const DEFAULT_RECOMMENDATIONS = [
  'Revisar umbrales de valores asegurados y primas de forma periódica.',
  'Implementar alertas cuando los indicadores se acerquen a los límites definidos.',
  'Solicitar datos adicionales o revisión manual en casos de anomalías detectadas.',
];

/**
 * Parsea la respuesta del modelo y extrae el JSON (tolera markdown alrededor).
 * Garantiza al menos 2 recomendaciones (rellena con genéricas si el modelo devuelve menos).
 */
function parseModelJson(text: string): AiInsightsResponse {
  let raw = text.trim();
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) raw = codeBlockMatch[1].trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) raw = jsonMatch[0];

  const parsed = JSON.parse(raw) as AiInsightsResponse;
  let insights = Array.isArray(parsed.insights) ? parsed.insights : [];
  let recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];

  // Garantizar 2-3 recomendaciones: si hay 0 o 1, completar con genéricas
  if (recommendations.length < 2) {
    const extra = DEFAULT_RECOMMENDATIONS.slice(0, 2 - recommendations.length);
    recommendations = [...recommendations, ...extra];
  }
  if (recommendations.length > 3) {
    recommendations = recommendations.slice(0, 3);
  }

  return { insights, recommendations };
}

/**
 * Llama a OpenAI API usando fetch (sin dependencia adicional).
 */
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
          content: 'Eres un analista de riesgos de seguros experto. Responde solo con JSON válido.',
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

/**
 * Genera insights y recomendaciones usando OpenAI o Gemini.
 * Si no hay API key o la llamada falla, devuelve insights calculados basados en datos.
 */
export async function generateInsights(
  summaryData: Record<string, unknown>,
  policiesData?: any[],
  filters?: Record<string, string>
): Promise<AiInsightsResponse | null> {
  const provider = getAvailableProvider();
  
  if (!provider) {
    console.log('[aiService] No hay proveedor de IA disponible (OPENAI_API_KEY o GOOGLE_API_KEY)');
    return generateFallbackInsights(summaryData, policiesData);
  }

  // Analizar riesgos antes de llamar a la IA
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
    console.error('[aiService] Error al llamar a la API de IA:', err);
    if (err instanceof Error) {
      console.error('[aiService] message:', err.message);
    }
    // Fallback a insights calculados
    return generateFallbackInsights(summaryData, policiesData);
  }
}

/**
 * Genera insights basados en análisis de datos cuando la IA no está disponible.
 * Siempre devuelve 2-3 recomendaciones accionables.
 */
function generateFallbackInsights(
  summaryData: Record<string, unknown>,
  policiesData?: any[]
): AiInsightsResponse {
  const riskAnalysis = analyzeRisks(summaryData, policiesData);
  const insights: string[] = [];
  const recommendations: string[] = [];

  if (riskAnalysis.totalPolicies === 0) {
    insights.push('No hay pólizas registradas en el sistema.');
    recommendations.push('Cargar pólizas mediante el endpoint de upload.');
    recommendations.push('Revisar umbrales y reglas de validación una vez existan datos.');
    return { insights, recommendations };
  }

  if (riskAnalysis.concentrationRisk.length > 0) {
    insights.push(`Alta concentración detectada: ${riskAnalysis.concentrationRisk.join(', ')}. Esto puede aumentar el riesgo de exposición.`);
    recommendations.push('Diversificar el portafolio para reducir la concentración de riesgo.');
  }

  if (riskAnalysis.policiesNearMinimum > 0) {
    const percentage = ((riskAnalysis.policiesNearMinimum / riskAnalysis.totalPolicies) * 100).toFixed(1);
    insights.push(`${percentage}% de las pólizas tienen valores asegurados cercanos al mínimo permitido.`);
    recommendations.push('Implementar alertas cuando insured_value < 1.1x del mínimo para revisión manual.');
  }

  const expiredCount = riskAnalysis.statusDistribution.expired || 0;
  const cancelledCount = riskAnalysis.statusDistribution.cancelled || 0;
  if (expiredCount + cancelledCount > riskAnalysis.totalPolicies * 0.3) {
    const percentage = (((expiredCount + cancelledCount) / riskAnalysis.totalPolicies) * 100).toFixed(1);
    insights.push(`${percentage}% de las pólizas están expiradas o canceladas.`);
    recommendations.push('Revisar estrategias de retención de clientes para pólizas activas.');
  }

  if (insights.length === 0) {
    insights.push(`Portafolio de ${riskAnalysis.totalPolicies} pólizas con prima total de $${riskAnalysis.totalPremium.toLocaleString()}.`);
    insights.push('Distribución de riesgos parece equilibrada.');
    recommendations.push('Continuar monitoreando métricas clave regularmente.');
  }

  // Garantizar 2-3 recomendaciones
  if (recommendations.length < 2) {
    recommendations.push('Revisar umbrales de valores asegurados y primas de forma periódica.');
  }
  if (recommendations.length < 3) {
    recommendations.push('Establecer alertas cuando los indicadores se acerquen a los límites definidos.');
  }
  if (recommendations.length > 3) {
    recommendations.length = 3;
  }

  return { insights, recommendations };
}
