from flask import Flask, jsonify, send_from_directory
import json
import networkx as nx
from itertools import combinations
import os

app = Flask(__name__, static_url_path='', static_folder='static')

@app.route('/data')
def get_data():
    try:
        # Load the JSON file
        file_path = os.path.join('data', 'binaryCleanUserNumberCollections1Test024.json')
        with open(file_path, 'r') as f:
            data = json.load(f)
        print("JSON file loaded successfully")
    except Exception as e:
        print(f"Error loading JSON file: {e}")
        return jsonify({"error": str(e)}), 500

    # Create user collections from data
    user_collections = {}
    for row in data:
        for user, value in row.items():
            if user != 'Unnamed: 0':
                if user not in user_collections:
                    user_collections[user] = set()
                if value == 1:
                    user_collections[user].add(row['Unnamed: 0'])

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

    group_to_node = {}
    for group_id, (indices, users) in enumerate(common_groups.items(), 1):
        group_name = f"Group {group_id}"
        num_elements = len(indices)
        node_size = min_size + scale_factor * (num_elements - 2)
        G.add_node(group_name, numbers=indices, size=node_size)
        group_to_node[group_name] = group_id

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

    # Debug statement to print the data
    print("Graph data prepared:", data)

    return jsonify(data)

@app.route('/')
def serve_index():
    return send_from_directory('', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    print(f"Serving static file: {path}")
    return send_from_directory(app.static_folder, path)

if __name__ == '__main__':
    app.run(debug=True)
