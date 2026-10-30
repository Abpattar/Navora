import { listShipments, listDisruptionAlerts, saveDisruptionAlert } from '@/lib/db';
import type { DisruptionAlert } from '@/lib/types';

export interface DisruptionSearchResponse {
  success: boolean;
  alerts: DisruptionAlert[];
  sourceService: 'tinyfish_search' | 'cached_intelligence';
  limitationNote?: string;
}

export async function fetchDisruptionIntelligence(query = 'port congestion shipping disruptions weather'): Promise<DisruptionSearchResponse> {
  const apiKey = process.env.TINYFISH_API_KEY;

  // Retrieve any existing persisted disruption alerts
  const existingAlerts = listDisruptionAlerts();

  if (!apiKey) {
    return {
      success: false,
      alerts: existingAlerts,
      sourceService: 'cached_intelligence',
      limitationNote: 'TinyFish API key not configured. Showing local cached disruption records.',
    };
  }

  try {
    // Check if TinyFish Search endpoint is accessible
    const response = await fetch('https://agent.tinyfish.ai/v1/search/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        query: `maritime logistics ${query} terminal delays`,
        limit: 5,
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        alerts: existingAlerts,
        sourceService: 'cached_intelligence',
        limitationNote: `TinySearch service returned HTTP ${response.status}. Feature may require account plan permissions.`,
      };
    }

    const json = await response.json() as { results?: Array<{ title?: string; snippet?: string; url?: string; date?: string; location?: string }> };
    const rawResults = json.results || [];

    const shipments = listShipments();

    const newAlerts: DisruptionAlert[] = rawResults.map((item, idx) => {
      const title = item.title || 'Maritime Supply Chain Advisory';
      const summary = item.snippet || 'Port or transit delay reported in regional advisory.';
      const affectedLocation = item.location || 'Global Maritime Corridor';

      // Find matching shipments routed through this location
      const related = shipments.filter((s) => {
        const loc = affectedLocation.toLowerCase();
        return (
          (s.origin && s.origin.toLowerCase().includes(loc)) ||
          (s.destination && s.destination.toLowerCase().includes(loc))
        );
      }).map((s) => s.id);

      const alert: DisruptionAlert = {
        id: `alert-${Date.now()}-${idx}`,
        title,
        category: /strike/i.test(title + summary)
          ? 'LABOR_STRIKE'
          : /weather|cyclone|typhoon|fog/i.test(title + summary)
          ? 'WEATHER'
          : /customs/i.test(title + summary)
          ? 'CUSTOMS'
          : 'PORT_CONGESTION',
        affectedLocation,
        severity: /closure|shut|strike|critical/i.test(title + summary) ? 'CRITICAL' : 'HIGH',
        summary,
        source: item.url || 'TinySearch Public Maritime Feed',
        publishedAt: item.date || new Date().toISOString(),
        relatedShipmentIds: related,
      };

      saveDisruptionAlert(alert);
      return alert;
    });

    return {
      success: true,
      alerts: [...newAlerts, ...existingAlerts],
      sourceService: 'tinyfish_search',
    };
  } catch (error) {
    return {
      success: false,
      alerts: existingAlerts,
      sourceService: 'cached_intelligence',
      limitationNote: error instanceof Error ? error.message : 'Disruption intelligence lookup failed',
    };
  }
}
