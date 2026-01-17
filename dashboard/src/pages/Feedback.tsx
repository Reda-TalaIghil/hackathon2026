import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface Insight {
  id: string;
  title: string;
  description: string;
  frictionType: string;
  confidence?: number;
  affectedPages: string[];
}

export const Feedback: React.FC<{ apiUrl: string; projectId: string }> = ({
  apiUrl,
  projectId,
}) => {
  const [samInsights, setSamInsights] = useState<Insight[]>([]);
  const [openaiInsights, setOpenaiInsights] = useState<Insight[]>([]);
  const [aiConnected, setAiConnected] = useState<boolean>(false);
  const [aiNote, setAiNote] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const dedupeInsights = (primary: Insight[], candidates: Insight[]) => {
    const seen = new Set<string>();

    return candidates.filter((candidate) => {
      const candidateKey = `${normalize(candidate.title)}|${normalize(candidate.description)}`;

      // Drop exact repeats in the AI list
      if (seen.has(candidateKey)) {
        return false;
      }

      // Drop anything that matches SAM insight title/description to avoid doubles
      const overlapsWithSam = primary.some((sam) => {
        const sameTitle = normalize(sam.title) === normalize(candidate.title);
        const sameBody = normalize(sam.description) === normalize(candidate.description);
        return sameTitle && sameBody;
      });

      if (overlapsWithSam) {
        return false;
      }

      seen.add(candidateKey);
      return true;
    });
  };

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const response = await axios.get(`${apiUrl}/api/insights`, {
          params: { projectId },
        });

        const baseInsights: Insight[] = response.data.insights || [];
        setSamInsights(baseInsights);
        setLastUpdated(new Date().toLocaleTimeString());

        // Try to fetch OpenAI-generated insights for comparison
        try {
          const aiResponse = await axios.post(`${apiUrl}/api/insights/generate`, {
            projectId,
            // Pass through any available context if backend includes it
            hotspots: response.data.hotspots || [],
            sentiment: response.data.sentiment || [],
            evidence: response.data.evidence || [],
          });

          if (aiResponse.data?.source === 'openai') {
            const ai = aiResponse.data.insights || [];
            const uniqueAi = dedupeInsights(baseInsights, ai);
            setOpenaiInsights(uniqueAi);
            setAiNote(uniqueAi.length < ai.length ? 'Filtered overlapping insights so AI stays distinct from SAM.' : '');
            setAiConnected(true);
          } else {
            setOpenaiInsights([]);
            setAiNote('');
            setAiConnected(false);
          }
        } catch {
          setOpenaiInsights([]);
          setAiNote('');
          setAiConnected(false);
        }
      } catch (error) {
        console.error('Error fetching feedback:', error);
      } finally {
        // No-op
      }
    };

    fetchInsights();
    const interval = setInterval(fetchInsights, 10000); // Refresh every 10s

    return () => clearInterval(interval);
  }, [apiUrl, projectId]);

  // Icon mapping for insight types

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'rage-clicks':
        return '🖱️';
      case 'hesitation':
        return '⏸️';
      case 'sentiment':
        return '📊';
      case 'positive':
        return '✅';
      default:
        return '💡';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-8">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <span className="text-4xl">🤖</span>
              Side-by-Side Insights
            </h2>
            <p className="text-slate-400">
              Compare AI-generated insights with SAM analytics to make decisions faster.
            </p>
          </div>
          <div className="text-right">
            <div className="flex gap-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-xs text-slate-300">{aiConnected ? '🔗 OpenAI Connected' : '⚠️ OpenAI Unavailable'}</span>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-xs text-slate-300">🧠 SAM Analytics</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Updated {lastUpdated}</p>
          </div>
        </div>
      </div>

      {/* Side-by-side Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* OpenAI Column */}
        <div className="space-y-4">
          <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <span>🔗</span> OpenAI Insights
            </h3>
            <p className="text-slate-400 text-sm">{aiConnected ? `Connected • ${openaiInsights.length} insights` : 'Not configured'}</p>
            {aiNote && <p className="text-xs text-amber-300 mt-1">{aiNote}</p>}
          </div>

          {openaiInsights.length === 0 ? (
            <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
              <p className="text-4xl mb-3">🤖</p>
              <p className="text-lg text-slate-300 font-semibold">No AI insights</p>
              <p className="text-slate-400 mt-2 text-sm">Configure OpenAI to see generated recommendations.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {openaiInsights.map((insight) => (
                <div
                  key={insight.id}
                  className="backdrop-blur-md bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl p-6 transition-all duration-300 group cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <span className="text-4xl group-hover:scale-110 transition-transform">{getTypeIcon(insight.frictionType)}</span>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white mb-2">{insight.title}</h3>
                      <p className="text-slate-300 text-sm leading-relaxed mb-4">{insight.description}</p>

                      {insight.confidence && (
                        <div className="mb-4">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-semibold text-slate-400">Confidence Score</span>
                            <span className="text-sm font-bold text-cyan-400">{Math.round(insight.confidence * 100)}%</span>
                          </div>
                          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                              style={{ width: `${Math.round(insight.confidence * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {insight.affectedPages && insight.affectedPages.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {insight.affectedPages.map((page) => (
                            <span
                              key={page}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-white/10 rounded-lg text-xs text-slate-300 font-medium"
                            >
                              📍 {page}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SAM Column */}
        <div className="space-y-4">
          <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <span>🧠</span> SAM Insights
            </h3>
            <p className="text-slate-400 text-sm">Live analytics • {samInsights.length} insights</p>
          </div>

          {samInsights.length === 0 ? (
            <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
              <p className="text-4xl mb-3">📊</p>
              <p className="text-lg text-slate-300 font-semibold">No insights yet</p>
              <p className="text-slate-400 mt-2 text-sm">Interactions will appear as users explore your product</p>
            </div>
          ) : (
            <div className="space-y-4">
              {samInsights.map((insight) => (
                <div
                  key={insight.id}
                  className="backdrop-blur-md bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl p-6 transition-all duration-300 group cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <span className="text-4xl group-hover:scale-110 transition-transform">{getTypeIcon(insight.frictionType)}</span>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white mb-2">{insight.title}</h3>
                      <p className="text-slate-300 text-sm leading-relaxed mb-4">{insight.description}</p>

                      {insight.confidence && (
                        <div className="mb-4">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-semibold text-slate-400">Confidence Score</span>
                            <span className="text-sm font-bold text-cyan-400">{Math.round(insight.confidence * 100)}%</span>
                          </div>
                          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                              style={{ width: `${Math.round(insight.confidence * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {insight.affectedPages && insight.affectedPages.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {insight.affectedPages.map((page) => (
                            <span
                              key={page}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-white/10 rounded-lg text-xs text-slate-300 font-medium"
                            >
                              📍 {page}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Tips */}
      <div className="backdrop-blur-md bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-400/20 rounded-2xl p-8">
        <h4 className="font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">💡</span>
          How to Act on These Insights
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <p className="font-semibold text-cyan-400 text-sm">1. Prioritize</p>
            <p className="text-slate-300 text-sm">Focus on high-confidence issues affecting many users</p>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-cyan-400 text-sm">2. Iterate</p>
            <p className="text-slate-300 text-sm">Make targeted fixes to the identified friction areas</p>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-cyan-400 text-sm">3. Validate</p>
            <p className="text-slate-300 text-sm">Monitor the dashboard to confirm improvements work</p>
          </div>
        </div>
      </div>
    </div>
  );
};
