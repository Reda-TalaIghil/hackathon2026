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
    return <div className="p-4">Loading insights...</div>;
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-lg font-bold mb-4">💡 AI Insights (Optional)</h2>

      {insights.length === 0 ? (
        <p className="text-gray-500">No insights generated yet. Collect more data.</p>
      ) : (
        <div className="space-y-3">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className="p-3 border border-blue-200 bg-blue-50 rounded hover:shadow-md transition"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-gray-800">{insight.title}</h3>
                {insight.confidence && (
                  <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">
                    {(insight.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-700 mb-2">{insight.description}</p>
              <div className="text-xs text-gray-600">
                <span className="inline-block mr-3">
                  🏷️ {insight.frictionType}
                </span>
                <span>📍 {insight.affectedPages.join(', ')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
