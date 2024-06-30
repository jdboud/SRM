from flask import Flask, jsonify, send_from_directory
import json
import networkx as nx
from itertools import combinations
import os

app = Flask(__name__, static_url_path='', static_folder='static')

@app.route('/data')
def get_data():
    # Load the JSON file
    file_path = os.path.join(app.root_path, 'data', 'data.json')
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    # Create user collections from data
    user_collections = {}
    for i, row in enumerate(data):
        for j, val in enumerate(row):
            if val == 1:
                if j + 1 not in user_collections:
                    user_collections[j + 1] = set()
                user_collections[j + 1].add(i + 1)

    # Create common groups
    common_groups = {}
    for user1, indices1 in user_collections.items():
        for user2, indices2 in user_collections.items():
            if user1 != user2:
                common_indices = indices1.intersection(indices2)
                if len(common_indices) >= 2:
                    sorted_common = tuple(sorted(common_indices))
                    if sorted_common not in common_groups:
                        common_groups[sorted_common] = set()
                    common_groups[sorted_common].update([user1, user2])

    # Create the graph
    G = nx.Graph()
    min_size = 10  # Base node size
    scale_factor = 1  # Scale factor for node size

    for group_id, (indices, users) in enumerate(common_groups.items(), 1):
        group_name = f"Group {group_id}"
        num_elements = len(indices)
        node_size = min_size + scale_factor * (num_elements - 2)
        G.add_node(group_name, numbers=indices, size=node_size)

    # Add edges based on shared numbers with weights
    for (group1, data1), (group2, data2) in combinations(G.nodes(data=True), 2):
        shared_numbers = set(data1['numbers']).intersection(data2['numbers'])
        if shared_numbers:
            weight = len(shared_numbers)
            G.add_edge(group1, group2, weight=weight)

    # Prepare nodes and links for D3.js
    nodes = [{"id": group, "size": data["size"], "numbers": list(data["numbers"])} for group, data in G.nodes(data=True)]
    links = [{"source": group1, "target": group2, "weight": G.edges[group1, group2]["weight"]} for group1, group2 in G.edges()]

    data = {"nodes": nodes, "links": links}

    return jsonify(data)

@app.route('/')
def serve_index():
    return send_from_directory('static', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

if __name__ == '__main__':
    app.run(debug=True)
