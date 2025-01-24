import boto3
import os
from datetime import datetime

class S3Client:
    def __init__(self):
        self.s3 = boto3.client('s3') 
        self.bucket_name = os.getenv('S3_BUCKET_NAME')
        
        if not self.bucket_name:
            raise ValueError("S3_BUCKET_NAME environment variable is required")

    def upload_file(self, file_obj, stock_code):
        """
        Upload a file to S3 bucket in a structured folder format
        Returns the S3 URI of the uploaded file
        """
        try:
            # Create a structured key with date for organization
            current_date = datetime.now().strftime('%Y/%m/%d')
            timestamp = datetime.now().strftime('%H%M%S')
            file_name = file_obj.filename
            
            # Create key in format: stock_code/YYYY/MM/DD/HHMMSS_filename
            s3_key = f"{stock_code}/{current_date}/{timestamp}_{file_name}"
            
            # Upload file
            self.s3.upload_fileobj(file_obj, self.bucket_name, s3_key)
            
            # Get the file content for knowledge base
            file_obj.seek(0)  # Reset file pointer to beginning
            file_content = file_obj.read().decode('utf-8')
            
            return {
                's3_uri': f"s3://{self.bucket_name}/{s3_key}",
                'content': file_content
            }
            
        except Exception as e:
            print(f"Error uploading to S3: {str(e)}")
            raise

    def get_file_content(self, s3_uri):
        """
        Get file content from S3 by URI
        """
        try:
            # Parse bucket and key from s3 URI
            uri_parts = s3_uri.replace("s3://", "").split("/")
            bucket = uri_parts[0]
            key = "/".join(uri_parts[1:])
            
            # Get object from S3
            response = self.s3.get_object(Bucket=bucket, Key=key)
            content = response['Body'].read().decode('utf-8')
            
            return content
            
        except Exception as e:
            print(f"Error reading from S3: {str(e)}")
            raise
