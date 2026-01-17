import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface SentimentData {
  [date: string]: {
    thumbs_up?: number;
    thumbs_down?: number;
    neutral?: number;
  };
}

export const Sentiment: React.FC<{ apiUrl: string; projectId: string }> = ({
  apiUrl,
  projectId,
}) => {
  const [data, setData] = useState<SentimentData>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSentiment = async () => {
      try {
        const from = Date.now() - 7 * 24 * 60 * 60 * 1000; // Last 7 days
        const response = await axios.get(`${apiUrl}/api/sentiment`, {
          params: { projectId, from, to: Date.now() },
        });
        setData(response.data.trend);
      } catch (error) {
        console.error('Error fetching sentiment:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSentiment();
    const interval = setInterval(fetchSentiment, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, [apiUrl, projectId]);

  const dates = Object.keys(data).sort();
  const totalEvents = dates.reduce(
    (sum, date) =>
      sum +
      (data[date].thumbs_up || 0) +
      (data[date].thumbs_down || 0) +
      (data[date].neutral || 0),
    0
  );

  if (loading) {
    return <div className="p-4">Loading sentiment...</div>;
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-lg font-bold mb-4">📊 Sentiment Trend (7 days)</h2>

      {totalEvents === 0 ? (
        <p className="text-gray-500">No sentiment data yet.</p>
      ) : (
        <div>
          <div className="mb-4 grid grid-cols-3 gap-4">
            <div className="bg-green-50 p-3 rounded border border-green-200">
              <p className="text-sm text-gray-600">👍 Positive</p>
              <p className="text-2xl font-bold text-green-600">
                {dates.reduce((sum, date) => sum + (data[date].thumbs_up || 0), 0)}
              </p>
            </div>
            <div className="bg-red-50 p-3 rounded border border-red-200">
              <p className="text-sm text-gray-600">👎 Negative</p>
              <p className="text-2xl font-bold text-red-600">
                {dates.reduce((sum, date) => sum + (data[date].thumbs_down || 0), 0)}
              </p>
            </div>
            <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
              <p className="text-sm text-gray-600">😕 Neutral</p>
              <p className="text-2xl font-bold text-yellow-600">
                {dates.reduce((sum, date) => sum + (data[date].neutral || 0), 0)}
              </p>
            </div>
          </div>

          <div className="text-sm">
            <p className="font-semibold mb-2">Daily Breakdown:</p>
            {dates.slice(-7).map((date) => (
              <div key={date} className="flex items-center gap-2 text-xs mb-1">
                <span className="w-20 text-gray-600">{date}</span>
                <div className="flex gap-1">
                  <span className="inline-block w-16 px-2 py-1 bg-green-100 text-green-700 rounded">
                    👍 {data[date].thumbs_up || 0}
                  </span>
                  <span className="inline-block w-16 px-2 py-1 bg-red-100 text-red-700 rounded">
                    👎 {data[date].thumbs_down || 0}
                  </span>
                  <span className="inline-block w-16 px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                    😕 {data[date].neutral || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
