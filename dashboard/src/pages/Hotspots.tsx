import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface Hotspot {
  page: string;
  rageClicks: number;
  hesitations: number;
  backtracks: number;
  frictionScore: number;
}

export const Hotspots: React.FC<{ apiUrl: string; projectId: string }> = ({
  apiUrl,
  projectId,
}) => {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHotspots = async () => {
      try {
        const response = await axios.get(`${apiUrl}/api/hotspots`, {
          params: { projectId },
        });
        setHotspots(response.data.hotspots);
      } catch (error) {
        console.error('Error fetching hotspots:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHotspots();
    const interval = setInterval(fetchHotspots, 10000); // Refresh every 10s

    return () => clearInterval(interval);
  }, [apiUrl, projectId]);

  if (loading) {
    return <div className="p-4">Loading hotspots...</div>;
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-lg font-bold mb-4">🔥 Friction Hotspots</h2>

      {hotspots.length === 0 ? (
        <p className="text-gray-500">No friction detected yet.</p>
      ) : (
        <div className="space-y-3">
          {hotspots.map((spot, idx) => (
            <div
              key={idx}
              className="p-3 border border-red-200 bg-red-50 rounded cursor-pointer hover:shadow-md transition"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-gray-800">{spot.page}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    🖱️ Rage clicks: {spot.rageClicks} | ⏸️ Hesitations:{' '}
                    {spot.hesitations} | 👈 Backtracks: {spot.backtracks}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-red-500 text-white rounded-full text-sm font-bold">
                    {(spot.frictionScore * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
