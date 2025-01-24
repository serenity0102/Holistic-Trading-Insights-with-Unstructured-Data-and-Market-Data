from flask import Flask, request, render_template, jsonify
import os
from dotenv import load_dotenv
from bedrock_utils import BedrockKnowledgeBase
from finspace_utils import FinSpaceClient
from s3_utils import S3Client

load_dotenv()

app = Flask(__name__)

# Initialize clients
kb = BedrockKnowledgeBase()
finspace = FinSpaceClient()
s3_client = S3Client()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    stock_code = request.form.get('stock_code')
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    if not stock_code:
        return jsonify({'error': 'Stock code is required'}), 400

    try:
        # Upload to S3 first
        s3_result = s3_client.upload_file(file, stock_code)
        
        # Trigger Bedrock knowledge base sync
        sync_result = kb.trigger_sync(s3_result['s3_uri'])
        
        return jsonify({
            'message': 'File uploaded successfully',
            'ingestion_job_id': sync_result['ingestion_job_id'],
            'sync_status': sync_result['status'],
            's3_uri': s3_result['s3_uri']
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/ingestion-status', methods=['GET'])
def get_ingestion_status():
    job_id = request.args.get('job_id')
    if not job_id:
        return jsonify({'error': 'Ingestion job ID is required'}), 400

    try:
        status = kb.get_ingestion_job_status(job_id)
        return jsonify(status)
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
