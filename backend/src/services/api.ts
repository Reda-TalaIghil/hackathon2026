import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import { mongoStore } from '../storage/mongo-store.js';
import { RedisStore } from '../storage/redis-store.js';

/**
 * Dashboard API
 * Serves hotspots, sentiment, evidence, and insights to admin dashboard
 * Integrates with OpenAI for AI-powered insights generation
 */

const app = express();
const redisStore = new RedisStore();
redisStore.connect(process.env.REDIS_URL).catch(console.error);

// CORS for dashboard
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Get hotspots for a project
app.get('/api/hotspots', async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string || 'default';
  const page = req.query.page as string;

  try {
    const hotspots = await mongoStore.getHotspots(projectId);
    const filtered = page ? hotspots.filter((h: any) => h.page === page) : hotspots;

    res.json({
      hotspots: filtered,
      count: filtered.length,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error fetching hotspots:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get sentiment trend
app.get('/api/sentiment', async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string || 'default';
  const from = parseInt(req.query.from as string) || Date.now() - 7 * 24 * 60 * 60 * 1000;
  const to = parseInt(req.query.to as string) || Date.now();

  try {
    const trend = await mongoStore.getSentimentTrend(projectId, from, to);

    // Transform to dashboard format
    const grouped: Record<string, Record<string, number>> = {};
    for (const row of trend as any[]) {
      if (!grouped[row.date]) {
        grouped[row.date] = { positive: 0, negative: 0, neutral: 0 };
      }
      grouped[row.date][row.reaction] = row.count || 0;
    }

    res.json({
      trend: grouped,
      count: trend.length,
      period: { from, to },
    });
  } catch (error) {
    console.error('Error fetching sentiment trend:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get evidence (anonymized session snippets)
app.get('/api/evidence', async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string || 'default';

  try {
    const evidence = await mongoStore.getEvidence(projectId);

    res.json({
      evidence: evidence.slice(0, 20),
      count: evidence.length,
    });
  } catch (error) {
    console.error('Error fetching evidence:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get session state
app.get('/api/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const session = await redisStore.getSessionState(req.params.sessionId);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json(session);
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get insights (with OpenAI integration)
app.get('/api/insights', async (_req: Request, res: Response) => {
  const projectId = _req.query.projectId as string || 'default';

  try {
    const hotspots = await mongoStore.getHotspots(projectId, 10);
    const sentiment = await mongoStore.getSentimentTrend(projectId, Date.now() - 24 * 60 * 60 * 1000, Date.now());
    const evidence = await mongoStore.getEvidence(projectId, 5);

    // Generate insights from collected data
    const insights = generateInsights(hotspots, sentiment, evidence);

    res.json({
      insights,
      count: insights.length,
      hotspots,
      sentiment,
      evidence,
    });
  } catch (error) {
    console.error('Error fetching insights:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

// Generate AI insights endpoint (optional - calls OpenAI)
app.post('/api/insights/generate', async (req: Request, res: Response) => {
  const { projectId: bodyProjectId, hotspots, sentiment, evidence } = req.body;
  const projectId = bodyProjectId || (req.query.projectId as string) || 'default';

  try {
    // Ensure we have data context
    let h = hotspots as any[] | undefined;
    let s = sentiment as any[] | undefined;
    let e = evidence as any[] | undefined;

    if (!h || !s || !e) {
      try {
        h = await mongoStore.getHotspots(projectId, 10);
        s = await mongoStore.getSentimentTrend(projectId, Date.now() - 24 * 60 * 60 * 1000, Date.now());
        e = await mongoStore.getEvidence(projectId, 5);
      } catch (err) {
        console.warn('Failed to load data context for AI generation, falling back:', err);
      }
    }

    // Check if OpenAI API key is available
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.json({
        insights: generateInsights(h || [], s || [], e || []),
        source: 'local',
        message: 'OpenAI integration not configured. Set OPENAI_API_KEY env var for AI insights.',
      });
    }

    // Call OpenAI to generate insights
    const insights = await callOpenAI(projectId, h || [], s || [], e || [], apiKey);

    res.json({
      insights,
      source: 'openai',
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error generating insights:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

// SAM insights endpoint (queries Solace Agent Mesh)
app.get('/api/sam-insights', async (req: Request, res: Response) => {
  const projectId = (req.query.projectId as string) || 'default';

  try {
    // Check if SAM is running (port 8000)
    const samUrl = process.env.SAM_URL || 'http://localhost:8000';
    
    try {
      // Attempt to query SAM orchestrator API
      const response = await fetch(`${samUrl}/api/insights?projectId=${projectId}`);
      
      if (response.ok) {
        const data = await response.json();
        return res.json({
          insights: data.insights || [],
          source: 'sam',
          timestamp: Date.now(),
        });
      }
    } catch (samError) {
      // SAM not available, return empty
      console.log('SAM not available:', samError);
    }

    // Return empty insights if SAM is not running
    res.json({
      insights: [],
      source: 'sam-offline',
      message: 'SAM agent mesh is not running. Start SAM to see real-time agent insights.',
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error fetching SAM insights:', error);
    res.status(500).json({ error: 'Failed to fetch SAM insights' });
  }
});

/**
 * Generate insights from collected data
 */
function generateInsights(hotspots: any[], sentiment: any[], evidence: any[]) {
  const insights: any[] = [];

  // Find friction hotspots
  if (hotspots && hotspots.length > 0) {
    const topHotspot = hotspots[0];
    if (topHotspot.rageClicks > 0) {
      insights.push({
        id: 'insight_rage_clicks',
        title: 'High Rage-Click Activity Detected',
        description: `Users are clicking rapidly on "${topHotspot.page}" (${topHotspot.rageClicks} rage-clicks). This suggests frustration with UI elements or unclear CTAs.`,
        frictionType: 'rage-clicks',
        confidence: Math.min((topHotspot.rageClicks || 0) / 5, 1),
        affectedPages: [topHotspot.page],
      });
    }

    if (topHotspot.hesitations > 0) {
      insights.push({
        id: 'insight_hesitation',
        title: 'Users Hesitating on Key Areas',
        description: `Extended hover time detected on "${topHotspot.page}". Users may be confused or seeking more information before action.`,
        frictionType: 'hesitation',
        confidence: 0.75,
        affectedPages: [topHotspot.page],
      });
    }
  }

  // Sentiment analysis
  if (sentiment && sentiment.length > 0) {
    const totalSentiment = sentiment.reduce(
      (acc: any, day: any) => ({
        positive: (acc.positive || 0) + (day.thumbs_up || 0),
        negative: (acc.negative || 0) + (day.thumbs_down || 0),
        neutral: (acc.neutral || 0) + (day.neutral || 0),
      }),
      {}
    );

    if (totalSentiment.negative > totalSentiment.positive) {
      insights.push({
        id: 'insight_negative_sentiment',
        title: 'Negative User Sentiment Trend',
        description: `Recent feedback shows ${totalSentiment.negative} negative vs ${totalSentiment.positive} positive reactions. Consider investigating UX issues.`,
        frictionType: 'sentiment',
        confidence: 0.8,
        affectedPages: ['overall'],
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      id: 'insight_no_friction',
      title: 'User Experience Looks Good',
      description: 'No major friction patterns detected yet. Continue monitoring as users interact.',
      frictionType: 'positive',
      confidence: 1.0,
      affectedPages: ['overall'],
    });
  }

  return insights;
}

/**
 * Call OpenAI API to generate human-readable insights
 */
async function callOpenAI(
  projectId: string,
  hotspots: any[],
  sentiment: any[],
  evidence: any[],
  apiKey: string
) {
  const prompt = `
Analyze this user behavior data and generate 2-3 actionable, concise insights for a product team:

Hotspots:
${hotspots.slice(0, 3).map(h => `- ${h.page}: ${h.rageClicks} rage-clicks, ${h.hesitations} hesitations (friction ${(h.frictionScore * 100).toFixed(0)}%)`).join('\n')}

Evidence:
${evidence.slice(0, 3).map(e => `- ${e.action}: ${e.details}`).join('\n')}

Return ONLY valid JSON array with no markdown formatting: [{ "title": "...", "description": "...", "frictionType": "...", "confidence": 0.8, "affectedPages": ["..."] }]
`;

  try {
    console.log('[OpenAI] Sending request...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[OpenAI] API error ${response.status}: ${errorText}`);
      return generateInsights(hotspots, sentiment, evidence);
    }

    const data: any = await response.json();
    const content = data.choices[0]?.message?.content || '';
    console.log('[OpenAI] Response received:', content.substring(0, 200));

    // Parse JSON from response (handle markdown code blocks)
    let jsonText = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    }
    
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`[OpenAI] Parsed ${parsed.length} insights`);
      return parsed.map((insight: any, idx: number) => ({
        id: `insight_ai_${idx}`,
        ...insight,
      }));
    }

    console.warn('[OpenAI] Could not parse JSON from response');
    return generateInsights(hotspots, sentiment, evidence);
    }

    return generateInsights(hotspots, sentiment, evidence);
  } catch (error) {
    console.warn('OpenAI API unavailable, using local insights:', error);
    return generateInsights(hotspots, sentiment, evidence);
  }
}

// Start server
async function start() {
  try {
    console.log('[API] Starting...');
    
    // Connect to MongoDB first
    await mongoStore.connect();
    
    const PORT = parseInt(process.env.DASHBOARD_API_PORT || '3000');
    console.log(`[API] Attempting to listen on port ${PORT}`);
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n✓ Dashboard API listening on port ${PORT}`);
      console.log(`  GET http://localhost:${PORT}/api/hotspots?projectId=default`);
      console.log(`  GET http://localhost:${PORT}/api/sentiment?projectId=default`);
      console.log(`  GET http://localhost:${PORT}/api/evidence?projectId=default`);
    });
    
    console.log('[API] Server object created, listening...');
  } catch (error) {
    console.error('[API] Failed to start:', error);
    process.exit(1);
  }
}

// Catch any unhandled errors
process.on('uncaughtException', (error) => {
  console.error('[API FATAL] Uncaught Exception:', error.message, error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[API FATAL] Unhandled Rejection:', reason);
  process.exit(1);
});

// Graceful shutdown (disabled in development - tsx watch handles restarts)
// process.on('SIGINT', async () => {
//   console.log('\nShutting down...');
//   await mongoStore.disconnect();
//   await redisStore.disconnect();
//   process.exit(0);
// });

console.log('[API] Before calling start()');
start().catch((error) => {
  console.error('[API] Fatal error:', error);
  process.exit(1);
});
console.log('[API] After calling start() - SHOULD SEE THIS');
