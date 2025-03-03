import os
import json
import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext
from opensearchpy import OpenSearch, RequestsHttpConnection, AWSV4SignerAuth
from ddb.report import Report, ExtractionStatus
from botocore.exceptions import ClientError

logger = Logger()
tracer = Tracer()

# Environment variables
REGION = os.environ.get("REGION", "us-east-1")
OPENSEARCH_ENDPOINT = os.environ.get("OPENSEARCH_ENDPOINT")
OPENSEARCH_INDEX = os.environ.get("OPENSEARCH_INDEX", "reports")

# Initialize clients
bedrock = boto3.client(service_name="bedrock-runtime", region_name=REGION)
credentials = boto3.Session().get_credentials()
auth = AWSV4SignerAuth(credentials, REGION, "aoss")

# Initialize OpenSearch client
def get_opensearch_client():
    endpoint = OPENSEARCH_ENDPOINT
    
    # Clean the endpoint URL - remove any protocol prefix
    if endpoint.startswith("https://"):
        endpoint = endpoint.replace("https://", "")
    
    logger.info(f"Connecting to OpenSearch endpoint: {endpoint}")
    
    client = OpenSearch(
        hosts=[{"host": endpoint, "port": 443}],
        http_auth=auth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection,
        timeout=30
    )
    return client

# Create a client instance
client = get_opensearch_client()

# Create index if not exists
def ensure_index_exists():
    """Ensure index exists with the proper mapping for KNN search"""
    
    logger.info(f"Checking if index {OPENSEARCH_INDEX} exists")
    
    try:
        # First check if index exists
        if not client.indices.exists(OPENSEARCH_INDEX):
            logger.info(f"Creating index {OPENSEARCH_INDEX} with KNN mapping")
            
            # Define index with KNN settings
            index_body = {
                "settings": {
                    "index.knn": True,
                },
                "mappings": {
                    "properties": {
                        "pk": {"type": "keyword"},
                        "sk": {"type": "keyword"},
                        "text_embedding": {
                            "type": "knn_vector",
                            "dimension": 1024,
                            "method": {
                                "name": "hnsw",
                                "space_type": "l2",
                                "engine": "nmslib",
                                "parameters": {
                                    "ef_construction": 128,
                                    "m": 16
                                }
                            }
                        },
                        "extraction": {"type": "text"},
                        "company": {"type": "keyword"},
                        # Use keyword type instead of date to avoid parsing issues
                        "report_date": {"type": "keyword"},
                        "metadata": {"type": "object"}
                    }
                }
            }
            
            # Create the index with mapping
            client.indices.create(OPENSEARCH_INDEX, body=index_body)
            logger.info(f"Successfully created index {OPENSEARCH_INDEX}")
        else:
            # Verify if the mapping is correct for KNN
            try:
                mapping = client.indices.get_mapping(index=OPENSEARCH_INDEX)
                
                # Check if text_embedding exists and is a knn_vector
                properties = mapping.get(OPENSEARCH_INDEX, {}).get('mappings', {}).get('properties', {})
                embedding_field = properties.get('text_embedding', {})
                
                if embedding_field.get('type') != 'knn_vector':
                    logger.warning(f"Index {OPENSEARCH_INDEX} exists but text_embedding is not a knn_vector. " +
                                   "Deleting and recreating the index.")
                    
                    # Delete the index
                    client.indices.delete(index=OPENSEARCH_INDEX)
                    
                    # Recursively call to create the index fresh
                    ensure_index_exists()
            except Exception as mapping_error:
                logger.error(f"Error checking index mapping: {str(mapping_error)}")
                raise mapping_error
            
    except Exception as e:
        logger.error(f"Error ensuring index exists: {str(e)}")
        raise e

# Get embedding from Cohere model
def get_embedding(text):
    if not text:
        return None
    
    # Truncate text if too long (Cohere limit is around 8K tokens)
    max_chars = 32000
    if len(text) > max_chars:
        text = text[:max_chars]
    
    try:
        response = bedrock.invoke_model(
            modelId="cohere.embed-english-v3",
            contentType="application/json",
            body=json.dumps({
                "texts": [text],
                "input_type": "search_document"
            })
        )
        
        response_body = json.loads(response["body"].read())
        return response_body["embeddings"][0]
    except ClientError as e:
        logger.error(f"Error getting embedding: {str(e)}")
        return None

@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event, context: LambdaContext):
    logger.info(f"Processing report for OpenSearch indexing")
    
    try:
        # Extract reportId from the event - only parameter we need
        report_id = event.get("reportId")
        if not report_id:
            logger.error("Missing required parameter: reportId")
            return {
                "statusCode": 400,
                "error": "Missing required parameter: reportId"
            }
        
        logger.info(f"Processing report: {report_id}")
        
        # Parse reportId to get ticker and quarter
        # Expected format: "TICKER#YYYY-QN" (e.g., "AAPL#2023-Q1")
        ticker, quarter = report_id.split("#", 1)
        
        # Parse quarter string to get year and quarter number
        year_str, quarter_str = quarter.split("-Q")
        year = int(year_str)
        quarter_num = int(quarter_str)
        
        # Get the report from DynamoDB - similar to update_report_status.py
        report = Report.get_by_ticker_and_quarter(
            ticker=ticker,
            year=year,
            quarter=quarter_num
        )
        
        if not report:
            logger.error(f"Report not found: {report_id}")
            return {
                "statusCode": 404,
                "error": f"Report not found: {report_id}"
            }
        
        # Get the extraction text from the report
        extraction = report.extraction
        if not extraction:
            logger.error(f"No extraction available for report: {report_id}")
            return {
                "statusCode": 400,
                "error": "No extraction available for report"
            }
        
        # Get embedding for the extraction text
        logger.info(f"Getting embedding for {report_id}")
        embedding = get_embedding(extraction)
        
        if not embedding:
            logger.error("Failed to generate embedding")
            return {
                "statusCode": 500,
                "error": "Failed to generate embedding"
            }
        
        # Ensure OpenSearch index exists
        ensure_index_exists()
        
        # Build metadata object
        metadata = {
            "report_year": year,
            "report_quarter": quarter_num
        }
        
        # Prepare document for OpenSearch
        document = {
            "pk": report.pk,
            "sk": report.sk,
            "extraction": extraction,
            "text_embedding": embedding,
            "company": ticker,
            "report_date": quarter,
            "metadata": metadata
        }
        
        # Let OpenSearch generate an ID - without refresh policy
        logger.info(f"Indexing document for {report_id} without specifying ID")
        response = client.index(
            index=OPENSEARCH_INDEX,
            body=document
        )

        # Get the auto-generated ID from the response
        generated_id = response.get("_id")
        logger.info(f"Document indexed successfully with generated ID: {generated_id}")

        # Return the generated ID
        return {
            "statusCode": 200,
            "reportId": report_id,
            "opensearch_doc_id": generated_id,
            "message": "Document indexed successfully"
        }

    except Exception as e:
        logger.exception(f"Error processing report: {str(e)}")
        return {
            "statusCode": 500,
            "error": str(e)
        } 