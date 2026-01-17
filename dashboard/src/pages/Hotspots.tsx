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
    return (
      <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
        <p className="text-lg text-slate-300 font-semibold">Loading hotspots...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-8">
        <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <span className="text-4xl">🔥</span>
          Friction Hotspots
        </h2>
        <p className="text-slate-400">
          Pages where users struggle most with rage clicks, hesitations, and backtracks
        </p>
      </div>

      {hotspots.length === 0 ? (
        <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">🔥</p>
          <p className="text-lg text-slate-300 font-semibold">No friction detected yet</p>
          <p className="text-slate-400 mt-2 text-sm">Interactions will appear as users explore your product</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {hotspots.map((spot, idx) => (
            <div
              key={idx}
              className="backdrop-blur-md bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-400/50 rounded-2xl p-6 transition-all duration-300 group cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-3 group-hover:text-red-400 transition-colors">
                    {spot.page}
                  </h3>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="text-xs text-slate-400 mb-1">Rage Clicks</p>
                      <p className="text-2xl font-bold text-red-400">🖱️ {spot.rageClicks}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="text-xs text-slate-400 mb-1">Hesitations</p>
                      <p className="text-2xl font-bold text-yellow-400">⏸️ {spot.hesitations}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="text-xs text-slate-400 mb-1">Backtracks</p>
                      <p className="text-2xl font-bold text-orange-400">👈 {spot.backtracks}</p>
                    </div>
                  </div>
                </div>
                <div className="ml-6">
                  <div className="bg-gradient-to-br from-red-500 to-orange-500 text-white rounded-2xl px-6 py-4 shadow-lg shadow-red-500/50">
                    <p className="text-xs font-semibold opacity-90">Friction Score</p>
                    <p className="text-3xl font-bold">{(spot.frictionScore * 100).toFixed(0)}%</p>
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
