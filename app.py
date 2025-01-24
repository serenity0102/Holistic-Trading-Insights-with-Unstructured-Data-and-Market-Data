from flask import Flask, request, render_template, jsonify
import os
import logging
import sys
from dotenv import load_dotenv
from bedrock_utils import BedrockKnowledgeBase
from finspace_utils import FinSpaceClient
from s3_utils import S3Client

# Configure logging to output to console
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

load_dotenv()

app = Flask(__name__)
app.logger.setLevel(logging.DEBUG)

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
        logger.info(f"Starting file upload for stock code: {stock_code}")
        
        # Upload to S3 first
        s3_result = s3_client.upload_file(file, stock_code)
        if not s3_result or 's3_uri' not in s3_result:
            logger.error("Failed to upload file to S3")
            return jsonify({'error': 'Failed to upload file to S3'}), 500
        
        logger.info(f"File uploaded to S3: {s3_result['s3_uri']}")
        
        # Trigger Bedrock knowledge base sync
        sync_result = kb.trigger_sync()
        if not sync_result:
            logger.error("Failed to trigger knowledge base sync")
            return jsonify({'error': 'Failed to trigger knowledge base sync'}), 500
        
        logger.info(f"Sync triggered successfully: {sync_result}")
        logger.info(f"Ingestion job ID: {sync_result['ingestion_job_id']}")
        logger.info(f"Initial status: {sync_result['status']}")

        return jsonify({
            'message': 'File uploaded successfully',
            'ingestion_job_id': sync_result['ingestion_job_id'],
            'sync_status': sync_result['status'],
            's3_uri': s3_result['s3_uri']
        })
    except Exception as e:
        logger.error(f"Error in upload process: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/ingestion-status', methods=['GET'])
def get_ingestion_status():
    job_id = request.args.get('job_id')
    if not job_id:
        return jsonify({'error': 'Ingestion job ID is required'}), 400

    try:
        logger.info(f"Checking status for job: {job_id}")
        status = kb.get_ingestion_job_status(job_id)
        logger.info(f"Status result: {status}")
        return jsonify(status)
    except Exception as e:
        logger.error(f"Error checking ingestion status: {str(e)}", exc_info=True)
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
        logger.error(f"Error fetching market data: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/search-news', methods=['GET'])
def search_news():
    stock_code = request.args.get('stock_code')
    if not stock_code:
        return jsonify({'error': 'Stock code is required'}), 400

    query = request.args.get('query')
    if not query:
        query = f"Find recent news and updates about {stock_code}"
    
    try:
        # Perform semantic search in knowledge base with custom query
        logger.info(f"Performing semantic search for stock {stock_code} with query: {query}")
        results = kb.semantic_search(query, stock_code)
        return jsonify({'news': results})
    except Exception as e:
        logger.error(f"Error searching news: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/symbols', methods=['GET'])
def get_symbols():
    try:
        symbols = finspace.get_available_symbols()
        return jsonify({'symbols': symbols})
    except Exception as e:
        logger.error(f"Error fetching symbols: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    logger.info("Starting Market Data Viewer application")
    app.run(debug=True)
