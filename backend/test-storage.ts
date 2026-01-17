import { analyticsStore } from './src/storage/analytics-store.js';

console.log('Testing analytics store...');

// Add some test data
analyticsStore.recordHotspot('demo-project', '/demo', {
  clickCount: 5,
  rageClicks: 2,
  hesitations: 1,
  avgDuration: 250,
}, 0.8);

analyticsStore.recordSentiment('demo-project', 'session_123', 'explicit', {
  rating: 4,
  comment: 'Test feedback',
});

// Read it back
const hotspots = analyticsStore.getHotspots('demo-project');
const sentiment = analyticsStore.getSentimentTrend('demo-project');

console.log('Hotspots:', JSON.stringify(hotspots, null, 2));
console.log('Sentiment:', JSON.stringify(sentiment, null, 2));

console.log('✓ Analytics store working!');
