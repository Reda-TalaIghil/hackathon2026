import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface Evidence {
  sessionId: string;
  action: string;
  details: any;
  timestamp: number;
}

export const Evidence: React.FC<{ apiUrl: string; projectId: string }> = ({
  apiUrl,
  projectId,
}) => {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvidence = async () => {
      try {
        const response = await axios.get(`${apiUrl}/api/evidence`, {
          params: { projectId },
        });
        setEvidence(response.data.evidence);
      } catch (error) {
        console.error('Error fetching evidence:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvidence();
  }, [apiUrl, projectId]);

  if (loading) {
    return <div className="p-4">Loading evidence...</div>;
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-lg font-bold mb-4">🔍 Evidence Drawer</h2>

      {evidence.length === 0 ? (
        <p className="text-gray-500">No evidence collected yet.</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto text-xs">
          {evidence.map((e, idx) => (
            <div
              key={idx}
              className="p-2 bg-gray-50 rounded border border-gray-200 font-mono"
            >
              <div className="text-gray-600">
                <span className="font-bold">{e.action}</span> •{' '}
                {new Date(e.timestamp).toLocaleTimeString()}
              </div>
              <div className="text-gray-500 mt-1">
                Session: {e.sessionId.slice(0, 16)}...
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
