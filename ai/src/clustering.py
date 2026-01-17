#!/usr/bin/env python3
"""
Clustering Job
Batch clustering of feedback + friction signals using LLM

Usage:
  python clustering.py --batch-size 100 --output ./clusters.json
"""

import os
import json
import argparse
from typing import List, Dict, Any
import sys

# Try to import openai, but make it optional
try:
    import openai
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

def cluster_feedback(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Cluster feedback events using LLM (or fallback rule-based clustering)
    """
    if not HAS_OPENAI or not os.getenv('OPENAI_API_KEY'):
        # Fallback: rule-based clustering
        return fallback_clustering(events)
    
    # LLM-based clustering
    try:
        openai.api_key = os.getenv('OPENAI_API_KEY')
        
        # Prepare events for LLM
        feedback_text = "\n".join([
            f"- {e.get('payload', {}).get('action', '?')}: {e.get('payload', {}).get('details', '')}"
            for e in events[:20]  # Limit to 20 for token budget
        ])
        
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You cluster UX friction issues. Group similar signals. Output JSON."
                },
                {
                    "role": "user",
                    "content": f"Cluster these friction signals:\n{feedback_text}\n\nOutput valid JSON array of clusters with 'name', 'count', 'signals'."
                }
            ],
            temperature=0.5,
        )
        
        result = json.loads(response['choices'][0]['message']['content'])
        return result if isinstance(result, list) else [result]
    
    except Exception as e:
        print(f"Error calling LLM: {e}", file=sys.stderr)
        return fallback_clustering(events)

def fallback_clustering(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Simple rule-based clustering (no LLM)
    """
    clusters = {}
    
    for event in events:
        action = event.get('payload', {}).get('action', 'unknown')
        
        if action not in clusters:
            clusters[action] = {
                'name': f'{action.replace("_", " ").title()} Issue',
                'count': 0,
                'signals': []
            }
        
        clusters[action]['count'] += 1
        clusters[action]['signals'].append(event.get('sessionId', '?')[:16])
    
    return list(clusters.values())

def main():
    parser = argparse.ArgumentParser(description='Cluster feedback signals')
    parser.add_argument('--batch-size', type=int, default=100)
    parser.add_argument('--output', default='./clusters.json')
    args = parser.parse_args()
    
    print("🤖 Clustering feedback signals...")
    
    # In production, fetch from message bus or analytics store
    sample_events = [
        {'sessionId': 'sess_1', 'payload': {'action': 'rage_click', 'details': 'Payment button'}},
        {'sessionId': 'sess_2', 'payload': {'action': 'rage_click', 'details': 'Submit button'}},
        {'sessionId': 'sess_3', 'payload': {'action': 'hesitation', 'details': 'Checkout form'}},
        {'sessionId': 'sess_4', 'payload': {'action': 'hesitation', 'details': 'Shipping address'}},
    ]
    
    clusters = cluster_feedback(sample_events)
    
    with open(args.output, 'w') as f:
        json.dump(clusters, f, indent=2)
    
    print(f"✓ Generated {len(clusters)} clusters")
    print(f"  Saved to {args.output}")
    
    for cluster in clusters:
        print(f"  - {cluster['name']}: {cluster['count']} signals")

if __name__ == '__main__':
    main()
