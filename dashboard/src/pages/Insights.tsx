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

export const Insights: React.FC<{ apiUrl: string; projectId: string }> = ({
  apiUrl,
  projectId,
}) => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const response = await axios.get(`${apiUrl}/api/insights`, {
          params: { projectId },
        });
        setInsights(response.data.insights);
      } catch (error) {
        console.error('Error fetching insights:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
    const interval = setInterval(fetchInsights, 120000); // Refresh every 2 min

    return () => clearInterval(interval);
  }, [apiUrl, projectId]);

  if (loading) {
    return (
      <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
        <p className="text-lg text-slate-300 font-semibold">Loading insights...</p>
      </div>
    );
  }

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
        <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <span className="text-4xl">💡</span>
          SAM Insights
        </h2>
        <p className="text-slate-400">
          AI-powered recommendations based on user behavior patterns
        </p>
      </div>

      {insights.length === 0 ? (
        <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">💡</p>
          <p className="text-lg text-slate-300 font-semibold">No insights generated yet</p>
          <p className="text-slate-400 mt-2 text-sm">Collect more data to see AI-powered recommendations</p>
        </div>
      ) : (
        <div className="space-y-4">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className="backdrop-blur-md bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-400/50 rounded-2xl p-6 transition-all duration-300 group cursor-pointer"
            >
              <div className="flex items-start gap-4">
                <span className="text-4xl group-hover:scale-110 transition-transform">{getTypeIcon(insight.frictionType)}</span>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">{insight.title}</h3>
                    {insight.confidence && (
                      <span className="text-xs bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-3 py-1 rounded-full font-bold">
                        {(insight.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed mb-4">{insight.description}</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/10 rounded-lg text-xs text-slate-300 font-medium">
                      🏷️ {insight.frictionType}
                    </span>
                    {insight.affectedPages.map((page) => (
                      <span
                        key={page}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-white/10 rounded-lg text-xs text-slate-300 font-medium"
                      >
                        📍 {page}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
