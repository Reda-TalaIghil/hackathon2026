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
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'local' | 'openai'>('local');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const response = await axios.get(`${apiUrl}/api/insights`, {
          params: { projectId },
        });
        setInsights(response.data.insights || []);
        setLastUpdated(new Date().toLocaleTimeString());
        
        // Try to fetch from OpenAI if available
        try {
          const aiResponse = await axios.post(`${apiUrl}/api/insights/generate`, {
            projectId,
            hotspots: response.data.hotspots || [],
            sentiment: response.data.sentiment || [],
            evidence: response.data.evidence || [],
          });
          setInsights(aiResponse.data.insights || response.data.insights || []);
          setSource(aiResponse.data.source === 'openai' ? 'openai' : 'local');
        } catch {
          setSource('local');
        }
      } catch (error) {
        console.error('Error fetching feedback:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
    const interval = setInterval(fetchInsights, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, [apiUrl, projectId]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'rage-clicks':
        return 'bg-red-50 border-red-200';
      case 'hesitation':
        return 'bg-yellow-50 border-yellow-200';
      case 'sentiment':
        return 'bg-orange-50 border-orange-200';
      case 'positive':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

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
              AI-Powered User Feedback
            </h2>
            <p className="text-slate-400">
              Intelligent insights from {insights.length} detected patterns • Powered by {source === 'openai' ? 'OpenAI GPT-3.5' : 'Local Analytics'}
            </p>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-xs text-slate-300">{source === 'openai' ? '🔗 AI Connected' : '⚙️ Local Mode'}</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">Updated {lastUpdated}</p>
          </div>
        </div>
      </div>

      {/* Insights Grid */}
      {insights.length === 0 ? (
        <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-lg text-slate-300 font-semibold">No insights yet</p>
          <p className="text-slate-400 mt-2 text-sm">Interactions will appear as users explore your product</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className="backdrop-blur-md bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl p-6 transition-all duration-300 group cursor-pointer"
            >
              <div className="flex items-start gap-4">
                <span className="text-4xl group-hover:scale-110 transition-transform">{getTypeIcon(insight.frictionType)}</span>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-2">{insight.title}</h3>
                  <p className="text-slate-300 text-sm leading-relaxed mb-4">{insight.description}</p>
                  
                  {/* Confidence Meter */}
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
                  
                  {/* Affected Pages */}
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
