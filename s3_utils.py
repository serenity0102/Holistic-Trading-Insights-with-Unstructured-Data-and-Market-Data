import boto3
import os
import logging
import sys
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class S3Client:
    def __init__(self):
        aws_region = os.getenv('AWS_REGION')
        if not aws_region:
            raise ValueError("AWS_REGION environment variable is required")
            
        self.s3 = boto3.client('s3', region_name=aws_region)
        self.bucket_name = os.getenv('S3_BUCKET_NAME')
        
        if not self.bucket_name:
            raise ValueError("S3_BUCKET_NAME environment variable is required")
            
        logger.info(f"Initialized S3Client with bucket: {self.bucket_name}")

    def upload_file(self, file_obj, stock_code):
        """
        Upload a file to S3 bucket in a structured folder format
        Returns the S3 URI of the uploaded file
        """
        try:
            logger.info(f"Starting file upload for stock code: {stock_code}")
            logger.info(f"File name: {file_obj.filename}")
            
            # Create a structured key with date for organization
            current_date = datetime.now().strftime('%Y/%m/%d')
            timestamp = datetime.now().strftime('%H%M%S')
            file_name = file_obj.filename
            
            # Create key in format: stock_code/YYYY/MM/DD/HHMMSS_filename
            s3_key = f"{stock_code}/{current_date}/{timestamp}_{file_name}"
            logger.info(f"Generated S3 key: {s3_key}")
            
            # Upload file
            logger.info("Uploading file to S3...")
            self.s3.upload_fileobj(file_obj, self.bucket_name, s3_key)
            logger.info("File uploaded successfully")
            
            s3_uri = f"s3://{self.bucket_name}/{s3_key}"
            logger.info(f"File uploaded to: {s3_uri}")
            
            return {
                's3_uri': s3_uri
            }
            
        except Exception as e:
            logger.error(f"Error uploading to S3: {str(e)}", exc_info=True)
            raise

    def get_file_content(self, s3_uri):
        """
        Get file content from S3 by URI
        """
        try:
            logger.info(f"Getting file content from: {s3_uri}")
            
            # Parse bucket and key from s3 URI
            uri_parts = s3_uri.replace("s3://", "").split("/")
            bucket = uri_parts[0]
            key = "/".join(uri_parts[1:])
            
            logger.info(f"Parsed bucket: {bucket}, key: {key}")
            
            # Get object from S3
            response = self.s3.get_object(Bucket=bucket, Key=key)
            content = response['Body'].read().decode('utf-8')
            
            logger.info("File content retrieved successfully")
            return content
            
        except Exception as e:
            logger.error(f"Error reading from S3: {str(e)}", exc_info=True)
            raise
