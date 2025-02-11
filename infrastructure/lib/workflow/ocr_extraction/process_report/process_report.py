"""Lambda function to process PDF report and prepare pages for extraction."""

import boto3
import fitz  # PyMuPDF
import io
import os
import base64
import requests
from PIL import Image
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext
from aws_lambda_powertools.utilities.validation import validator
from ddb.report import Report, ExtractionStatus
from typing import List, Dict

logger = Logger()
tracer = Tracer()

# Input schema for the lambda function
INPUT_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "reportId": {"type": "string"},
            "pdfUrl": {"type": "string", "format": "uri"}
        },
        "required": ["reportId", "pdfUrl"]
    },
    "minItems": 1,
    "maxItems": 1
}

def process_page(page, zoom=2.0, max_width=2000) -> str:
    """Process a single page and return base64 jpg."""
    # Convert page to image with optimal DPI
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    
    # Convert pixmap to PIL Image
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    
    # Optimize image size while maintaining readability
    if img.width > max_width:
        ratio = max_width / img.width
        new_size = (max_width, int(img.height * ratio))
        img = img.resize(new_size, Image.Resampling.LANCZOS)
    
    # Convert image to JPG with optimized settings
    buffered = io.BytesIO()
    img.save(buffered, format="JPEG", quality=85, optimize=True)
    return base64.b64encode(buffered.getvalue()).decode('utf-8')

def download_pdf(url: str) -> bytes:
    """Download PDF from URL."""
    response = requests.get(url)
    response.raise_for_status()
    return response.content

def process_and_upload_pages(pdf_document, report_id: str, s3_client, bucket_name: str) -> List[Dict]:
    """Process all pages and upload to S3."""
    total_pages = len(pdf_document)
    processed_pages = []
    
    for page_num in range(total_pages):
        try:
            # Process the page
            page = pdf_document[page_num]
            base64_content = process_page(page)
            
            # Store base64 content in S3 with unique prefix
            s3_key = f"{report_id}/page_{page_num + 1}.txt"
            s3_client.put_object(
                Bucket=bucket_name,
                Key=s3_key,
                Body=base64_content,
                ContentType='text/plain'
            )
            
            processed_pages.append({
                "pageNumber": page_num + 1,
                "s3Key": s3_key,
                "totalPages": total_pages
            })
            
            logger.info(f"Successfully processed page {page_num + 1} for report {report_id}")
            
        except Exception as e:
            logger.error(f"Error processing page {page_num + 1} for report {report_id}: {str(e)}")
            raise
            
    return processed_pages

@logger.inject_lambda_context
@tracer.capture_lambda_handler
@validator(inbound_schema=INPUT_SCHEMA)
def handler(event: dict, context: LambdaContext) -> dict:
    """Process PDF report and prepare pages for extraction.
    
    Args:
        event: Lambda event containing report details (as single-item array)
        context: Lambda context
        
    Returns:
        dict: List of processed pages with their S3 keys
        
    Raises:
        Exception: If processing fails
    """
    # Extract the first (and only) item from the array
    item = event[0]
    report_id = item["reportId"]
    pdf_url = item["pdfUrl"]
    
    # Initialize S3 client
    s3 = boto3.client('s3')
    bucket_name = os.environ['REPORT_EXTRACTIONS_BUCKET_NAME']
    
    try:
        # Download PDF from URL
        pdf_content = download_pdf(pdf_url)
        
        # Load PDF and process all pages
        pdf_document = fitz.open(stream=pdf_content, filetype="pdf")
        processed_pages = process_and_upload_pages(pdf_document, report_id, s3, bucket_name)
        
        logger.info(f"Successfully processed all pages for report {report_id}")
        return {
            "reportId": report_id,
            "pages": processed_pages,
            "totalPages": len(processed_pages)
        }
        
    except Exception as e:
        logger.error(f"Error processing report {report_id}: {str(e)}")
        raise 