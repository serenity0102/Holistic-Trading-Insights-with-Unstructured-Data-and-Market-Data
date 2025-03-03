import json
import boto3
import os
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import APIGatewayRestResolver, Response
from aws_lambda_powertools.event_handler.exceptions import BadRequestError
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
        
        response_body = json.loads(response["body"].read())
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
    
    # First run a standard search to get the documents that match the filters
    filtered_query = {
        "query": {
            "bool": {
                "must": [
                    {
                        "term": {
                            "company": ticker.upper()
                        }
                    },
                    {
                        "range": {
                            "report_date": {
                                "gte": report_start,
                                "lte": report_end
                            }
                        }
                    }
                ]
            }
        },
        "size": 100  # Get more documents to have a better pool for KNN filtering
    }
    
    # Run the initial query to get documents that match filters
    filtered_results = client.search(
        body=filtered_query,
        index=OPENSEARCH_INDEX
    )
    
    # Extract document IDs that match the filters
    filtered_ids = [hit["_id"] for hit in filtered_results.get("hits", {}).get("hits", [])]
    
    if not filtered_ids:
        # No documents match the filters
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
    
    # Now run KNN search with relevance scoring
    knn_query = {
        "size": 5,
        "query": {
            "knn": {
                "text_embedding": {
                    "vector": query_embedding,
                    "k": 5
                }
            }
        },
        "_source": ["pk", "sk", "company", "report_date", "extraction"],
        "min_score": 0.4
    }
    
    # Execute the KNN search
    search_response = client.search(
        body=knn_query,
        index=OPENSEARCH_INDEX
    )
    
    # Process results with relevance filtering
    results = []
    for hit in search_response.get("hits", {}).get("hits", []):
        score = hit.get("_score", 0)
        
        if score > 0.4: 
            source = hit.get("_source", {})
            results.append({
                "ticker": source.get("company"),
                "reportDate": source.get("report_date"),
                "score": score, 
                "extraction": source.get("extraction")[:500] + "..." if len(source.get("extraction", "")) > 500 else source.get("extraction", ""),
                "documentId": hit.get("_id")
            })
    
    # Return formatted response
    return {
        "meta": {
            "count": len(results),
            "query": query,
            "ticker": ticker,
            "reportPeriod": {
                "start": report_start,
                "end": report_end
            },
            # "queryEmbedding": query_embedding 
        },
        "results": results
    }

@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    return app.resolve(event, context) 