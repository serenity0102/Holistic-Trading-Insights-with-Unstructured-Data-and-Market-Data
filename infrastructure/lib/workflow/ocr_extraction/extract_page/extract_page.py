"""Lambda function to extract text from a page using OCR."""

import boto3
import json
import os
import re
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext
from aws_lambda_powertools.utilities.validation import validator
from ddb.report import Report, ExtractionStatus

logger = Logger()
tracer = Tracer()

# Input schema for the lambda function
INPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "reportId": {"type": "string"},
        "pageNumber": {"type": "number", "minimum": 1},
        "s3Key": {"type": "string"},
        "totalPages": {"type": "number", "minimum": 1}
    },
    "required": ["reportId", "pageNumber", "s3Key", "totalPages"]
}

CLAUDE_PROMPT = """
<task>
Convert the given document to Markdown format.
</task>

<instructions>
1. Read the provided document carefully.
2. Identify any text formatting such as headings, lists, bold/italic text, links, etc.
3. Convert the formatting to the appropriate Markdown syntax.
4. Maintain the original structure and content of the document.
</instructions>

<output_format>
Provide the converted Markdown document immediately without any preamble, enclosed in <response></response> tags.
</output_format>
"""

def extract_response_content(text: str) -> str:
    """Extract content between <response> tags."""
    pattern = r"<response>(.*?)</response>"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return ""

@logger.inject_lambda_context
@tracer.capture_lambda_handler
@validator(inbound_schema=INPUT_SCHEMA)
def handler(event: dict, context: LambdaContext) -> dict:
    """Extract text from a page using OCR.
    
    Args:
        event: Lambda event containing page details
        context: Lambda context
        
    Returns:
        dict: Extracted text and status
        
    Raises:
        Exception: If extraction fails
    """
    report_id = event["reportId"]
    page_number = event["pageNumber"]
    s3_key = event["s3Key"]
    
    # Initialize clients
    s3 = boto3.client('s3')
    bedrock = boto3.client('bedrock-runtime')
    bucket_name = os.environ['REPORT_EXTRACTIONS_BUCKET_NAME']
    
    try:
        # Get base64 content from S3
        response = s3.get_object(Bucket=bucket_name, Key=s3_key)
        base64_content = response['Body'].read().decode('utf-8')
        
        # Prepare request body for Claude
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 4096,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": base64_content
                            }
                        },
                        {
                            "type": "text",
                            "text": CLAUDE_PROMPT
                        }
                    ]
                }
            ]
        }
        
        # Invoke Bedrock
        bedrock_response = bedrock.invoke_model(
            modelId="anthropic.claude-3-sonnet-20240229-v1:0",
            body=json.dumps(body)
        )
        
        # Parse response
        response_body = json.loads(bedrock_response['body'].read())
        extracted_text = extract_response_content(response_body['content'][0]['text'])
        
        # Save extracted text to S3
        extracted_s3_key = s3_key.replace('.txt', '_extracted.txt')
        s3.put_object(
            Bucket=bucket_name,
            Key=extracted_s3_key,
            Body=extracted_text,
            ContentType='text/plain'
        )
        
        logger.info(f"Successfully extracted text from page {page_number} for report {report_id}")
        return {
            "reportId": report_id,
            "pageNumber": page_number,
            "extractedS3Key": extracted_s3_key,
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Error extracting text from page {page_number} for report {report_id}: {str(e)}")
        raise 