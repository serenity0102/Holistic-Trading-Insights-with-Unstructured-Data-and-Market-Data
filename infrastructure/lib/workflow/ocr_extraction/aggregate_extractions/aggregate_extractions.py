"""Lambda function to aggregate extracted text from all pages."""

import boto3
import os
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext
from aws_lambda_powertools.utilities.validation import validator
from ddb.report import Report, ExtractionStatus
from typing import List, Dict

logger = Logger()
tracer = Tracer()

# Input schema for the lambda function
INPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "reportId": {"type": "string"},
        "extractionResults": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "reportId": {"type": "string"},
                    "pageNumber": {"type": "number"},
                    "extractedS3Key": {"type": "string"},
                    "status": {"type": "string"}
                },
                "required": ["reportId", "pageNumber", "extractedS3Key", "status"]
            }
        }
    },
    "required": ["reportId", "extractionResults"]
}

@logger.inject_lambda_context
@tracer.capture_lambda_handler
@validator(inbound_schema=INPUT_SCHEMA)
def handler(event: dict, context: LambdaContext) -> dict:
    """Aggregate extracted text from all pages.
    
    Args:
        event: Lambda event containing extraction results
        context: Lambda context
        
    Returns:
        dict: Aggregation status
        
    Raises:
        Exception: If aggregation fails
    """
    report_id = event["reportId"]
    extraction_results = event["extractionResults"]
    
    # Initialize clients
    s3 = boto3.client('s3')
    bucket_name = os.environ['REPORT_EXTRACTIONS_BUCKET_NAME']
    
    try:
        # Sort results by page number
        sorted_results = sorted(extraction_results, key=lambda x: x["pageNumber"])
        
        # Aggregate text from all pages
        aggregated_text = []
        for result in sorted_results:
            s3_key = result["extractedS3Key"]
            response = s3.get_object(Bucket=bucket_name, Key=s3_key)
            page_text = response['Body'].read().decode('utf-8')
            aggregated_text.append(page_text)
        
        # Join all pages with newlines
        full_text = "\n\n".join(aggregated_text)
        
        # Get report instance and update extraction using the method
        ticker, year_quarter = report_id.split("#")
        year, quarter = year_quarter.split("-")
        year = int(year)
        quarter = int(quarter[1])
        report = Report.get_by_ticker_and_quarter(ticker=ticker, year=year, quarter=quarter)
        report.update_extraction(full_text)
        
        logger.info(f"Successfully aggregated text for report {report_id}")
        return {
            "reportId": report_id,
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Error aggregating text for report {report_id}: {str(e)}")
        raise 