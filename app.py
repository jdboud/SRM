from flask import Flask, jsonify, send_from_directory
import pandas as pd
import networkx as nx
from itertools import combinations

app = Flask(__name__, static_url_path='', static_folder='static')

@app.route('/data')
def get_data():
    # Load the Excel file
    file_path = 'https://github.com/jdboud/SRM/blob/8995826ed4130af6638b7941c84bef75e552cb52/data/binaryCleanUserNumberCollections1Test024.xlsx'
    df = pd.read_excel(file_path, index_col=0)

    # Create user collections from data
    user_collections = {user: set(df.index[df[user] == 1]) for user in df.columns}

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
    print(data)

    return jsonify(data)

@app.route('/')
def serve_index():
    return send_from_directory('static', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

if __name__ == '__main__':
    app.run(debug=True)


