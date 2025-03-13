import json
import boto3
import os
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import APIGatewayRestResolver, Response, CORSConfig
from aws_lambda_powertools.event_handler.exceptions import BadRequestError, InternalServerError
from aws_lambda_powertools.utilities.typing import LambdaContext
from botocore.exceptions import ClientError

logger = Logger()
tracer = Tracer()
cors_config = CORSConfig(allow_origin="*", allow_headers=["Content-Type", "X-Amz-Date", "Authorization", "X-Api-Key", "X-Amz-Security-Token"], max_age=300)
app = APIGatewayRestResolver(cors=cors_config)

# Environment variables
REGION = os.environ.get("REGION", "us-east-1")
REPORT_TABLE_NAME = os.environ.get("REPORT_TABLE_NAME")

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb', region_name=REGION)
report_table = dynamodb.Table(REPORT_TABLE_NAME)

@app.get("/reports")
@tracer.capture_method
def list_reports():
    """
    List all reports from DynamoDB
    
    Query parameters:
    - ticker: Optional filter by company ticker symbol
    - reportDate: Optional filter by report date (format: YYYY-QN)
    """
    try:
        # Get query parameters
        ticker = app.current_event.get_query_string_value(name="ticker", default_value=None)
        report_date = app.current_event.get_query_string_value(name="reportDate", default_value=None)
        
        logger.info(f"Listing reports with filters - ticker: {ticker}, reportDate: {report_date}")
        
        # Build query parameters based on filters
        if ticker:
            # If ticker is provided, use query operation with ticker as partition key
            query_params = {
                'KeyConditionExpression': 'pk = :pk',
                'ExpressionAttributeValues': {
                    ':pk': f"COMPANY#{ticker.upper()}"
                }
            }
            
            # Add report date filter if provided
            if report_date:
                query_params['KeyConditionExpression'] += ' AND begins_with(sk, :sk)'
                query_params['ExpressionAttributeValues'][':sk'] = f"REPORT#{report_date}"
                
            # Execute the query
            response = report_table.query(**query_params)
            items = response.get('Items', [])
            
            # Handle pagination if needed
            while 'LastEvaluatedKey' in response:
                query_params['ExclusiveStartKey'] = response['LastEvaluatedKey']
                response = report_table.query(**query_params)
                items.extend(response.get('Items', []))
        else:
            # If no ticker is provided, use scan operation
            scan_params = {}
            
            # Add report date filter if provided
            if report_date:
                scan_params['FilterExpression'] = 'begins_with(sk, :sk)'
                scan_params['ExpressionAttributeValues'] = {
                    ':sk': f"REPORT#{report_date}"
                }
                
            # Execute the scan
            response = report_table.scan(**scan_params)
            items = response.get('Items', [])
            
            # Handle pagination if needed
            while 'LastEvaluatedKey' in response:
                scan_params['ExclusiveStartKey'] = response['LastEvaluatedKey']
                response = report_table.scan(**scan_params)
                items.extend(response.get('Items', []))
        
        # Process and format the results
        reports = []
        for item in items:
            # Extract ticker from partition key (COMPANY#TICKER)
            item_ticker = item.get('pk', '').replace('COMPANY#', '')
            
            # Extract report date from sort key (REPORT#YYYY-QN)
            item_report_date = item.get('sk', '').replace('REPORT#', '')
            
            # Add formatted report to results
            reports.append({
                'ticker': item_ticker,
                'reportDate': item_report_date,
                'title': item.get('title', ''),
                'url': item.get('url', ''),
                'processingStatus': item.get('processingStatus', 'UNKNOWN'),
                'createdAt': item.get('createdAt', ''),
                'updatedAt': item.get('updatedAt', '')
            })
        
        # Return the results
        return {
            "meta": {
                "count": len(reports),
                "ticker": ticker,
                "reportDate": report_date
            },
            "reports": reports
        }
    
    except ClientError as e:
        logger.error(f"DynamoDB error: {str(e)}")
        raise InternalServerError(f"Failed to list reports: {str(e)}")
    except Exception as e:
        logger.exception(f"Error listing reports: {str(e)}")
        raise InternalServerError(f"Failed to list reports: {str(e)}")

@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    return app.resolve(event, context)