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

    def upload_document(self, file_content, file_name):
        try:
            # Create data source if not exists
            data_source_id = self._get_or_create_data_source()
            
            # Upload document to knowledge base
            response = self.bedrock_agent.create_data_source(
                knowledgeBaseId=self.kb_id,
                name=file_name,
                description=f'News document: {file_name}',
                dataSourceConfiguration={
                    'type': 'VECTOR_TEXT',
                    'vectorTextConfiguration': {
                        'text': file_content
                    }
                }
            )
            return response['dataSource']['dataSourceId']
        except Exception as e:
            print(f"Error uploading document: {str(e)}")
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

    def _get_or_create_data_source(self):
        try:
            # List existing data sources
            response = self.bedrock_agent.list_data_sources(
                knowledgeBaseId=self.kb_id
            )
            
            if response['dataSourceSummaries']:
                return response['dataSourceSummaries'][0]['dataSourceId']
            
            # Create new data source if none exists
            response = self.bedrock_agent.create_data_source(
                knowledgeBaseId=self.kb_id,
                name='StockNewsDataSource',
                description='Data source for stock market news'
            )
            
            return response['dataSource']['dataSourceId']
        except Exception as e:
            print(f"Error with data source: {str(e)}")
            raise
