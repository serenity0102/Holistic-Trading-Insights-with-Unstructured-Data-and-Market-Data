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
                        "report_date": {"type": "keyword"},
                        "chunk_index": {"type": "integer"},
                        "total_chunks": {"type": "integer"},
                        "parent_id": {"type": "keyword"}
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

# Semantic chunking with Claude 3.7
def semantic_chunk_with_claude(text, max_chunk_size=2000):
    """
    Use Claude 3.7 to split text into semantic chunks that fit within Cohere's limits
    
    Args:
        text: The text to chunk
        max_chunk_size: Maximum size of each chunk (in characters, as a proxy for tokens)
        
    Returns:
        List of text chunks
    """
    # If text is small enough, return as is
    if len(text) <= max_chunk_size:
        return [text]
    
    # Truncate text if extremely long to fit in Claude's context window
    max_text_length = 150000  # characters, rough approximation
    if len(text) > max_text_length:
        text = text[:max_text_length]
    
    prompt = f"""
    You are an expert document analyzer. I need you to divide the following document into semantic chunks.
    
    Each chunk should:
    1. Be approximately {max_chunk_size} characters or less (to ensure it fits within embedding model limits)
    2. Preserve complete semantic units (don't cut in the middle of a topic)
    3. Include logical section breaks where possible
    4. Maintain context within each chunk
    
    Format your response as a JSON array of strings, where each string is a chunk of text.
    Only include the JSON array in your response, nothing else.
    
    Here's the document to chunk:
    
    {text}
    """
    
    try:
        response = bedrock.invoke_model(
            modelId="anthropic.claude-3-7-sonnet-20250219-v1:0",
            contentType="application/json",
            accept="application/json",
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 4096,
                "temperature": 0,
                "system": "You are an expert document analyzer that divides documents into semantic chunks. Output only valid JSON array of strings.",
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            })
        )
        
        response_body = json.loads(response["body"].read().decode())
        content = response_body["content"][0]["text"]
        
        # Extract JSON from the response
        # Find the first [ character and the last ] character
        start_idx = content.find('[')
        end_idx = content.rfind(']')
        
        if start_idx == -1 or end_idx == -1:
            raise ValueError("Could not find JSON array in Claude's response")
            
        json_str = content[start_idx:end_idx+1]
        chunks = json.loads(json_str)
        
        return chunks
    
    except Exception as e:
        logger.error(f"Error in semantic chunking with Claude 3.7: {str(e)}")
        # Fall back to simpler chunking method if Claude fails
        return simple_chunk_text(text, chunk_size=max_chunk_size)

def simple_chunk_text(text, chunk_size=2000, overlap=200):
    """Simple fallback chunking method that splits by paragraphs"""
    import re
    
    paragraphs = re.split(r'\n\s*\n', text)
    chunks = []
    current_chunk = ""
    
    for paragraph in paragraphs:
        if len(current_chunk) + len(paragraph) > chunk_size:
            chunks.append(current_chunk)
            current_chunk = paragraph
        else:
            current_chunk += "\n\n" + paragraph if current_chunk else paragraph
    
    if current_chunk:
        chunks.append(current_chunk)
    
    return chunks

# Get embedding from Cohere model
def get_embedding(text):
    if not text:
        return None
    
    # Cohere embed-english-v3 has a token limit, ensure we're within it
    max_chars = 2000  # Reduced from 8000 to stay under the 2048 limit
    if len(text) > max_chars:
        logger.warning(f"Text too long for embedding: {len(text)} chars. Truncating to {max_chars} chars.")
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
        
        response_body = json.loads(response["body"].read().decode())
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
        ticker, quarter = report_id.split("#", 1)
        year_str, quarter_str = quarter.split("-Q")
        year = int(year_str)
        quarter_num = int(quarter_str)
        
        # Get the report from DynamoDB
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
        
        # Use Claude 3.7 for semantic chunking
        logger.info(f"Performing semantic chunking for {report_id}")
        chunks = semantic_chunk_with_claude(extraction, max_chunk_size=2000)
        
        # Ensure OpenSearch index exists
        ensure_index_exists()
        
        # Process each chunk
        doc_ids = []
        for i, chunk_text in enumerate(chunks):
            # Get embedding for chunk using Cohere
            logger.info(f"Getting embedding for chunk {i+1}/{len(chunks)} of {report_id}")
            embedding = get_embedding(chunk_text)
            
            if not embedding:
                logger.error(f"Failed to generate embedding for chunk {i+1}")
                continue
            
            # Prepare document for OpenSearch
            document = {
                "pk": report.pk,
                "sk": report.sk,
                "extraction": chunk_text,
                "text_embedding": embedding,
                "company": ticker,
                "report_date": quarter,
                "chunk_index": i,
                "total_chunks": len(chunks),
                "parent_id": report_id
            }
            
            # Index the document
            logger.info(f"Indexing chunk {i+1}/{len(chunks)} for {report_id}")
            response = client.index(
                index=OPENSEARCH_INDEX,
                body=document
            )
            
            # Get the auto-generated ID from the response
            generated_id = response.get("_id")
            doc_ids.append(generated_id)
            logger.info(f"Chunk {i+1} indexed successfully with ID: {generated_id}")

        # Return the generated IDs
        return {
            "statusCode": 200,
            "reportId": report_id,
            "opensearch_doc_ids": doc_ids,
            "chunks_processed": len(chunks),
            "message": "Document chunked and indexed successfully"
        }

    except Exception as e:
        logger.exception(f"Error processing report: {str(e)}")
        return {
            "statusCode": 500,
            "error": str(e)
        }