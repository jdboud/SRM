from flask import Flask, jsonify, send_from_directory
import requests

app = Flask(__name__, static_url_path='', static_folder='static')

@app.route('/data')
def get_data():
    # Load the JSON data from the GitHub URL
    file_url = 'https://jdboud.github.io/SRM/data/binaryCleanUserNumberCollections1Test024.xlsx'
    response = requests.get(file_url, verify=False)  # Disable SSL verification for development purposes
    if response.status_code != 200:
        return jsonify({"error": "Failed to load data"}), 500

    data = response.json()

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


