#!/usr/bin/env python3
"""
Summarization Job
Generate human-readable insights from clustered feedback

Usage:
  python summarization.py --clusters ./clusters.json
"""

import json
import argparse
import os
import sys
from typing import Dict, List, Any

try:
    import openai
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

def summarize_cluster(cluster: Dict[str, Any]) -> Dict[str, Any]:
    """
    Summarize a cluster into an insight
    """
    if not HAS_OPENAI or not os.getenv('OPENAI_API_KEY'):
        return fallback_summarize(cluster)
    
    try:
        openai.api_key = os.getenv('OPENAI_API_KEY')
        
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You explain UX friction issues in 2 sentences. Suggest 1 hypothesis. Be concise."
                },
                {
                    "role": "user",
                    "content": f"Explain this friction cluster:\n{json.dumps(cluster, indent=2)}"
                }
            ],
            temperature=0.7,
        )
        
        description = response['choices'][0]['message']['content']
        return {
            'title': cluster.get('name', 'Unknown'),
            'description': description,
            'evidence_count': cluster.get('count', 0),
            'hypothesis': 'See description above.'
        }
    
    except Exception as e:
        print(f"Error calling LLM: {e}", file=sys.stderr)
        return fallback_summarize(cluster)

def fallback_summarize(cluster: Dict[str, Any]) -> Dict[str, Any]:
    """
    Simple text summarization (no LLM)
    """
    name = cluster.get('name', 'Unknown Friction')
    count = cluster.get('count', 0)
    
    return {
        'title': name,
        'description': f'{count} users experienced {name.lower()}. This may indicate a UX issue.',
        'evidence_count': count,
        'hypothesis': 'Consider reviewing this flow in user testing.',
    }

def main():
    parser = argparse.ArgumentParser(description='Summarize feedback clusters')
    parser.add_argument('--clusters', default='./clusters.json')
    parser.add_argument('--output', default='./insights.json')
    args = parser.parse_args()
    
    print("📝 Summarizing feedback clusters...")
    
    # Load clusters
    if not os.path.exists(args.clusters):
        print(f"Clusters file not found: {args.clusters}")
        print("Running sample summarization...")
        clusters = [
            {'name': 'Payment Button Friction', 'count': 5, 'signals': ['s1', 's2', 's3']},
            {'name': 'Checkout Form Hesitation', 'count': 3, 'signals': ['s4', 's5']},
        ]
    else:
        with open(args.clusters, 'r') as f:
            clusters = json.load(f)
    
    insights = []
    for cluster in clusters:
        insight = summarize_cluster(cluster)
        insights.append(insight)
    
    with open(args.output, 'w') as f:
        json.dump(insights, f, indent=2)
    
    print(f"✓ Generated {len(insights)} insights")
    print(f"  Saved to {args.output}")
    
    for insight in insights:
        print(f"\n📌 {insight['title']}")
        print(f"   {insight['description'][:100]}...")

if __name__ == '__main__':
    main()
