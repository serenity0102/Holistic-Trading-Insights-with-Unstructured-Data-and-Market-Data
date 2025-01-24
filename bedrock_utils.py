import boto3
import json
import os

class BedrockKnowledgeBase:
    def __init__(self):
        self.bedrock = boto3.client('bedrock')
#        self.bedrock_agent = boto3.client('bedrock-agent')
        self.kb_id = os.getenv('BEDROCK_KB_ID')
        
        if not self.kb_id:
            # Create a new knowledge base if ID not provided
            # self.create_knowledge_base()
            print("create KB")

    def create_knowledge_base(self):
        try:
            response = self.bedrock.create_knowledge_base(
                knowledgeBaseName='StockNewsKB',
                description='Knowledge base for stock market news',
                roleArn=os.getenv('BEDROCK_ROLE_ARN')
            )
            self.kb_id = response['knowledgeBase']['knowledgeBaseId']
        except Exception as e:
            print(f"Error creating knowledge base: {str(e)}")
            raise

    def trigger_sync(self, s3_uri):
        """
        Trigger a sync operation for the knowledge base to process new files in S3
        """
        try:
            response = self.bedrock_agent.start_ingestion_job(
                knowledgeBaseId=self.kb_id,
                dataSource={
                    's3Configuration': {
                        's3Uri': s3_uri
                    }
                }
            )
            return {
                'ingestion_job_id': response['ingestionJob']['ingestionJobId'],
                'status': response['ingestionJob']['status']
            }
        except Exception as e:
            print(f"Error triggering knowledge base sync: {str(e)}")
            raise

    def semantic_search(self, query, stock_code):
        try:
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
            
            return results
        except Exception as e:
            print(f"Error performing semantic search: {str(e)}")
            raise

    def get_ingestion_job_status(self, ingestion_job_id):
        """
        Get the status of a specific ingestion job
        """
        try:
            response = self.bedrock_agent.get_ingestion_job(
                knowledgeBaseId=self.kb_id,
                ingestionJobId=ingestion_job_id
            )
            return {
                'status': response['ingestionJob']['status'],
                'statistics': response['ingestionJob'].get('statistics', {}),
                'error_message': response['ingestionJob'].get('errorMessage', '')
            }
        except Exception as e:
            print(f"Error getting ingestion job status: {str(e)}")
            raise
