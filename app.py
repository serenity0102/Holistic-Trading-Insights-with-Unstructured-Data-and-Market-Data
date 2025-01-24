from flask import Flask, request, render_template, jsonify
import os
from dotenv import load_dotenv
from bedrock_utils import BedrockKnowledgeBase
from finspace_utils import FinSpaceClient

load_dotenv()

app = Flask(__name__)

# Initialize clients
kb = BedrockKnowledgeBase()
finspace = FinSpaceClient()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    try:
        # Read file content
        file_content = file.read().decode('utf-8')
        
        # Upload to Bedrock knowledge base
        data_source_id = kb.upload_document(file_content, file.filename)
        return jsonify({
            'message': 'File uploaded successfully',
            'data_source_id': data_source_id
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/market-data', methods=['GET'])
def get_market_data():
    stock_code = request.args.get('stock_code')
    if not stock_code:
        return jsonify({'error': 'Stock code is required'}), 400

    try:
        # Get market data from FinSpace
        market_data = finspace.get_market_data(stock_code)
        return jsonify(market_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/search-news', methods=['GET'])
def search_news():
    stock_code = request.args.get('stock_code')
    if not stock_code:
        return jsonify({'error': 'Stock code is required'}), 400

    try:
        # Perform semantic search in knowledge base
        query = f"Find recent news and updates about {stock_code}"
        results = kb.semantic_search(query, stock_code)
        return jsonify({'news': results})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/symbols', methods=['GET'])
def get_symbols():
    try:
        symbols = finspace.get_available_symbols()
        return jsonify({'symbols': symbols})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
