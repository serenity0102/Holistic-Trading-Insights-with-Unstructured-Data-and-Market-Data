"""Lambda function to update report status after extraction."""

from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext
from aws_lambda_powertools.utilities.validation import validator
from ddb.report import Report, ExtractionStatus
from datetime import datetime

logger = Logger()
tracer = Tracer()

# Input schema for the lambda function
INPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "reportId": {"type": "string"},
        "status": {"type": "string", "enum": ["COMPLETED", "ERROR"]},
        "totalPages": {"type": "number", "minimum": 1},
        "error": {
            "type": "object",
            "properties": {
                "Error": {"type": "string"},
                "Cause": {"type": "string"}
            }
        }
    },
    "required": ["reportId", "status"]
}

@logger.inject_lambda_context
@tracer.capture_lambda_handler
@validator(inbound_schema=INPUT_SCHEMA)
def handler(event: dict, context: LambdaContext) -> dict:
    """Update report status after extraction completion or failure.
    
    Args:
        event: Lambda event containing report details
        context: Lambda context
        
    Returns:
        dict: Updated report details
        
    Raises:
        Exception: If report not found or update fails
    """
    report_id = event["reportId"]
    status = event["status"]
    total_pages = event.get("totalPages", 0)
    error = event.get("error", {})
    
    # Parse reportId to get ticker and quarter
    ticker, quarter = report_id.split("#")
    
    # Get the report from DynamoDB
    report = Report.get_by_ticker_and_quarter(
        ticker=ticker,
        year=int(quarter.split("-")[0]),
        quarter=int(quarter.split("-Q")[1])
    )
    
    if not report:
        raise Exception(f"Report not found: {report_id}")
    
    # Update status based on the outcome
    if status == "COMPLETED":
        report.update_extraction_status(ExtractionStatus.COMPLETED)
        logger.info(f"Report {report_id} completed successfully")
    else:
        report.update_extraction_status(ExtractionStatus.ERROR)
        error_message = error.get("Cause", "Unknown error")
        logger.error(f"Report {report_id} failed: {error_message}")
    
    # Return updated report details
    response = {
        "reportId": report_id,
        "status": status,
        "completedAt": datetime.utcnow().isoformat()
    }
    
    if status == "COMPLETED":
        response["totalPages"] = total_pages
    elif error:
        response["error"] = error
        
    return response 