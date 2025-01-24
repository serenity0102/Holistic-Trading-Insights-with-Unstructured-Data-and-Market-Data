import boto3
import json
import os
import logging
import sys

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class BedrockKnowledgeBase:
    def __init__(self):
        aws_region = os.getenv('AWS_REGION')
        if not aws_region:
            raise ValueError("AWS_REGION environment variable is required")
            
        self.bedrock = boto3.client('bedrock', region_name=aws_region)
        boto3_session = boto3.session.Session()
        self.bedrock_agent = boto3_session.client('bedrock-agent', region_name=aws_region)
        self.kb_id = os.getenv('BEDROCK_KB_ID')
        self.ds_id = os.getenv('BEDROCK_KB_DS_ID')
        
        if not self.kb_id:
            logger.error("BEDROCK_KB_ID environment variable is required")
            raise ValueError("BEDROCK_KB_ID environment variable is required")
        
        if not self.ds_id:
            logger.error("BEDROCK_KB_DS_ID environment variable is required")
            raise ValueError("BEDROCK_KB_DS_ID environment variable is required")
            
        logger.info(f"Initialized BedrockKnowledgeBase with KB ID: {self.kb_id}, DS ID: {self.ds_id}")

    def trigger_sync(self):
        """
        Trigger a sync operation for the knowledge base to process new files in S3
        """
        try:
            logger.info("Starting ingestion job...")
            response = self.bedrock_agent.start_ingestion_job(
                knowledgeBaseId=self.kb_id,
                dataSourceId=self.ds_id
            )
            
            if 'ingestionJob' not in response:
                logger.error("Error: No ingestionJob in response")
                logger.error(f"Full response: {response}")
                raise ValueError("Invalid response from start_ingestion_job")
                
            job = response['ingestionJob']
            if 'ingestionJobId' not in job:
                logger.error("Error: No ingestionJobId in ingestionJob")
                logger.error(f"Full job: {job}")
                raise ValueError("No ingestion job ID in response")
            
            logger.info(f"Ingestion job ID: {job['ingestionJobId']}")
            result = {
                'ingestion_job_id': job['ingestionJobId'],
                'status': job.get('status', 'UNKNOWN')
            }
            logger.info(f"Sync triggered successfully: {result}")
            return result
            
        except Exception as e:
            logger.error(f"Error triggering knowledge base sync: {str(e)}", exc_info=True)
            raise

    def semantic_search(self, query, stock_code):
        try:
            logger.info(f"Performing semantic search for stock: {stock_code}")
            logger.info(f"Query: {query}")
            
            response = self.bedrock_agent.retrieve(
                knowledgeBaseId=self.kb_id,
                retrievalQuery={
                    'text': f"{query} {stock_code}"
                },
                retrievalConfiguration={
                    'vectorSearchConfiguration': {
                        'numberOfResults': 5
                    }
                }
            )
            
            results = []
            for result in response['retrievalResults']:
                results.append({
                    'content': result['content'],
                    'score': result['score']
                })
            
            logger.info(f"Found {len(results)} results")
            return results
        except Exception as e:
            logger.error(f"Error performing semantic search: {str(e)}", exc_info=True)
            raise

    def get_ingestion_job_status(self, ingestion_job_id):
        """
        Get the status of a specific ingestion job
        """
        try:
            logger.info(f"Checking status for job {ingestion_job_id}")
            logger.info(f"Using KB ID: {self.kb_id}")
            logger.info(f"Using DS ID: {self.ds_id}")
            
            if not ingestion_job_id:
                raise ValueError("Ingestion job ID is required")
                
            response = self.bedrock_agent.get_ingestion_job(
                knowledgeBaseId=self.kb_id,
                dataSourceId=self.ds_id,
                ingestionJobId=ingestion_job_id
            )
            
            if 'ingestionJob' not in response:
                logger.error("Error: No ingestionJob in response")
                logger.error(f"Full response: {response}")
                raise ValueError("Invalid response from get_ingestion_job")
                
            job = response['ingestionJob']
            result = {
                'status': job.get('status', 'UNKNOWN'),
                'statistics': job.get('statistics', {}),
                'error_message': job.get('errorMessage', '')
            }
            logger.info(f"Status check result: {result}")
            return result
            
        except Exception as e:
            logger.error(f"Error getting ingestion job status: {str(e)}", exc_info=True)
            raise
