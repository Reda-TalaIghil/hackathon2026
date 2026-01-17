import React, { useState } from 'react';
import { Hotspots } from './pages/Hotspots';
import { Sentiment } from './pages/Sentiment';
import { Evidence } from './pages/Evidence';
import { Insights } from './pages/Insights';
import { Feedback } from './pages/Feedback';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'feedback' | 'hotspots' | 'sentiment' | 'evidence' | 'insights'>(
    'feedback'
  );

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const projectId = new URLSearchParams(window.location.search).get('projectId') || 'default';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="backdrop-blur-md bg-black/30 border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent flex items-center gap-3">
                <span className="text-4xl">🚀</span>
                Flowback Analytics
              </h1>
              <p className="text-slate-400 text-sm mt-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Real-time user insights • Project: <span className="font-mono text-cyan-400">{projectId}</span>
              </p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <p>Last sync: <span className="text-cyan-400">{new Date().toLocaleTimeString()}</span></p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Tabs - Modern Glassmorphism */}
        <div className="mb-8">
          <div className="flex gap-3 p-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl w-fit">
            {(
              [
                { key: 'feedback', label: '🤖 AI Feedback', icon: 'feedback' },
                { key: 'hotspots', label: '🔥 Hotspots', icon: 'hotspots' },
                { key: 'sentiment', label: '📊 Sentiment', icon: 'sentiment' },
                { key: 'evidence', label: '🔍 Evidence', icon: 'evidence' },
                { key: 'insights', label: '💡 Insights', icon: 'insights' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-6 py-2.5 rounded-xl font-semibold transition-all duration-300 whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/50'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="space-y-6 pb-12">
          {activeTab === 'feedback' && (
            <Feedback apiUrl={apiUrl} projectId={projectId} />
          )}

          {activeTab === 'hotspots' && (
            <>
              <Hotspots apiUrl={apiUrl} projectId={projectId} />
              <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                <h3 className="font-bold text-lg mb-3 text-white flex items-center gap-2">
                  <span>ℹ️</span> Understanding Friction Hotspots
                </h3>
                <p className="text-slate-300 leading-relaxed mb-4">
                  Hotspots reveal where users struggle most. These friction points indicate areas that frustrate your users and likely drive them away.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-sm font-semibold text-cyan-400">🖱️ Rage Clicks</p>
                    <p className="text-xs text-slate-400 mt-1">3+ rapid clicks on same element</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-sm font-semibold text-cyan-400">⏸️ Hesitations</p>
                    <p className="text-xs text-slate-400 mt-1">Extended hover or idle time</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-sm font-semibold text-cyan-400">👈 Backtracks</p>
                    <p className="text-xs text-slate-400 mt-1">Browser back button usage</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'sentiment' && (
            <>
              <Sentiment apiUrl={apiUrl} projectId={projectId} />
              <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                <h3 className="font-bold text-lg mb-3 text-white flex items-center gap-2">
                  <span>📊</span> Sentiment Analysis
                </h3>
                <p className="text-slate-300 leading-relaxed">
                  User sentiment reflects satisfaction levels. One-tap reactions (👍 👎 😕) reveal emotional responses to your product without being intrusive.
                </p>
              </div>
            </>
          )}

          {activeTab === 'evidence' && (
            <>
              <Evidence apiUrl={apiUrl} projectId={projectId} />
              <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                <h3 className="font-bold text-lg mb-3 text-white flex items-center gap-2">
                  <span>🔍</span> Raw Event Data
                </h3>
                <p className="text-slate-300 leading-relaxed">
                  Anonymous event logs connected to friction clusters. Drill down to understand exact user behavior patterns.
                </p>
              </div>
            </>
          )}

          {activeTab === 'insights' && (
            <>
              <Insights apiUrl={apiUrl} projectId={projectId} />
              <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                <h3 className="font-bold text-lg mb-3 text-white flex items-center gap-2">
                  <span>💡</span> Smart Insights
                </h3>
                <p className="text-slate-300 leading-relaxed">
                  AI-powered pattern clustering identifies root causes of friction. Confidence scores show how certain each insight is.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <footer className="border-t border-white/10 pt-8 mt-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center md:text-left mb-6">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Status</p>
              <p className="text-sm text-cyan-400 mt-1 flex items-center gap-2 justify-center md:justify-start">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                All systems operational
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">API</p>
              <p className="text-sm text-slate-300 mt-1 font-mono">{apiUrl}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Features</p>
              <p className="text-sm text-slate-300 mt-1">Consent-First • Real-Time • Privacy-Focused</p>
            </div>
          </div>
          <div className="text-center pt-6 border-t border-white/10">
            <p className="text-xs text-slate-500">© 2026 Flowback Analytics. Real-time user feedback intelligence.</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
