import json
import boto3
import os
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import APIGatewayRestResolver, Response
from aws_lambda_powertools.event_handler.exceptions import BadRequestError, InternalServerError
from aws_lambda_powertools.utilities.typing import LambdaContext
from opensearchpy import OpenSearch, RequestsHttpConnection, AWSV4SignerAuth
from botocore.exceptions import ClientError
from datetime import datetime

logger = Logger()
tracer = Tracer()
app = APIGatewayRestResolver()

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

# Get embedding from Cohere model for search query
def get_embedding(query_text):
    if not query_text:
        return None
    
    try:
        response = bedrock.invoke_model(
            modelId="cohere.embed-english-v3",
            contentType="application/json",
            body=json.dumps({
                "texts": [query_text],
                "input_type": "search_query"  # Use search_query for queries
            })
        )
        
        response_body = json.loads(response["body"].read().decode())
        return response_body["embeddings"][0]
    except ClientError as e:
        logger.error(f"Error getting embedding: {str(e)}")
        return None

# Validate date format (YYYY-QN)
def validate_report_date(date_str):
    try:
        year_str, quarter_str = date_str.split("-Q")
        year = int(year_str)
        quarter = int(quarter_str)
        
        if not (1900 <= year <= 2100 and 1 <= quarter <= 4):
            return False
            
        return True
    except (ValueError, AttributeError):
        return False

@app.get("/search")
@tracer.capture_method
def search():
    """
    Semantic search for financial reports with vector embeddings
    
    Query parameters:
    - ticker: Company ticker symbol (mandatory)
    - reportStart: Start date for report range (format: YYYY-QN)
    - reportEnd: End date for report range (format: YYYY-QN)
    - query: Search text to find semantically similar content
    """
    try:
        # Check if the OPENSEARCH_ENDPOINT is correctly set
        logger.info(f"Using OpenSearch endpoint: {OPENSEARCH_ENDPOINT}")
        
        # Get and validate parameters
        ticker = app.current_event.get_query_string_value(name="ticker", default_value=None)
        report_start = app.current_event.get_query_string_value(name="reportStart", default_value=None)
        report_end = app.current_event.get_query_string_value(name="reportEnd", default_value=None)
        query = app.current_event.get_query_string_value(name="query", default_value=None)
        
        # Validate required parameters
        if not ticker:
            raise BadRequestError("Missing required query parameter: ticker")
        
        if not report_start or not validate_report_date(report_start):
            raise BadRequestError("Missing or invalid query parameter: reportStart (format: YYYY-QN)")
            
        if not report_end or not validate_report_date(report_end):
            raise BadRequestError("Missing or invalid query parameter: reportEnd (format: YYYY-QN)")
        
        if not query:
            raise BadRequestError("Missing required query parameter: query")
        
        # Log the search request
        logger.info(f"Searching for ticker: {ticker}, report period: {report_start} to {report_end}, query: {query}")
        
        # Get embedding for the search query
        query_embedding = get_embedding(query)
        if not query_embedding:
            raise BadRequestError("Failed to generate embedding for search query")
        
        # For simplicity, we'll just use the start date if start and end are different
        report_date = report_start
        
        # First, get all documents for the company and report date
        filter_query = {
            "size": 100,  # Get more documents to have a better pool for ranking
            "query": {
                "bool": {
                    "must": [
                        {
                            "term": {
                                "company": ticker.upper()
                            }
                        },
                        {
                            "term": {
                                "report_date": report_date
                            }
                        }
                    ]
                }
            },
            "_source": [
                "company",
                "report_date",
                "chunk_index",
                "total_chunks",
                "parent_id",
                "extraction"
            ]
        }
        
        logger.info(f"Filter query: {json.dumps(filter_query)}")
        
        # Execute the filter query
        filter_response = client.search(
            body=filter_query,
            index=OPENSEARCH_INDEX
        )
        
        logger.info(f"Filter response: {json.dumps(filter_response)}")
        
        # Get document IDs from the filter query
        doc_ids = [hit["_id"] for hit in filter_response.get("hits", {}).get("hits", [])]
        
        if not doc_ids:
            logger.info(f"No documents found for ticker: {ticker}, report date: {report_date}")
            return {
                "meta": {
                    "count": 0,
                    "query": query,
                    "ticker": ticker,
                    "reportPeriod": {
                        "start": report_start,
                        "end": report_end
                    }
                },
                "results": []
            }
        
        # Now run KNN search with the filtered document IDs
        knn_query = {
            "size": 10,
            "query": {
                "knn": {
                    "text_embedding": {
                        "vector": query_embedding,
                        "k": 5
                    }
                }
            },
            "_source": [
                "company",
                "report_date",
                "chunk_index",
                "total_chunks",
                "parent_id",
                "extraction"
            ]
        }
        
        logger.info(f"KNN query: {json.dumps(knn_query)}")
        
        # Execute the KNN search
        knn_response = client.search(
            body=knn_query,
            index=OPENSEARCH_INDEX
        )
        
        logger.info(f"KNN response: {json.dumps(knn_response)}")
        
        # Filter KNN results to only include documents from our filtered set
        # and with a score above 0.45
        filtered_hits = []
        for hit in knn_response.get("hits", {}).get("hits", []):
            if hit["_id"] in doc_ids and hit.get("_score", 0) > 0.4:
                filtered_hits.append(hit)
        
        # Process results
        results = []
        for hit in filtered_hits:
            score = hit.get("_score", 0)
            source = hit.get("_source", {})
            
            extraction_text = source.get("extraction", "")
            truncated_text = extraction_text[:500] + "..." if len(extraction_text) > 500 else extraction_text
            
            results.append({
                "ticker": source.get("company"),
                "reportDate": source.get("report_date"),
                "score": score,
                "extraction": truncated_text,
                "documentId": hit.get("_id"),
                "chunkIndex": source.get("chunk_index"),
                "totalChunks": source.get("total_chunks"),
                "parentId": source.get("parent_id")
            })
        
        # Return the results
        return {
            "meta": {
                "count": len(results),
                "query": query,
                "ticker": ticker,
                "reportPeriod": {
                    "start": report_start,
                    "end": report_end
                }
            },
            "results": results
        }
    
    except Exception as e:
        logger.exception(f"Error in search: {str(e)}")
        raise InternalServerError(f"Search failed: {str(e)}")

@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    return app.resolve(event, context)