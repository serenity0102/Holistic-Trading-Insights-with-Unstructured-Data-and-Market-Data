import boto3
import pandas as pd
import os
import logging
import sys
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class FinSpaceClient:
    def __init__(self):
        aws_region = os.getenv('AWS_REGION')
        if not aws_region:
            raise ValueError("AWS_REGION environment variable is required")
            
        self.finspace = boto3.client('finspace-data', region_name=aws_region)
        self.environment_id = os.getenv('FINSPACE_ENV_ID')
        self.database_name = os.getenv('FINSPACE_DB_NAME')
        self.kx_cluster_name = os.getenv('FINSPACE_KX_CLUSTER')
        
        if not all([self.environment_id, self.database_name, self.kx_cluster_name]):
            logger.error("Missing required FinSpace configuration")
            raise ValueError("All FinSpace environment variables are required")
            
        logger.info(f"Initialized FinSpaceClient with env: {self.environment_id}, db: {self.database_name}")

    def get_market_data(self, stock_code):
        try:
            logger.info(f"Fetching market data for stock: {stock_code}")
            
            # Get the current date and 7 days ago for a week's worth of data
            end_date = datetime.now()
            start_date = end_date - timedelta(days=7)
            
            # Format dates for KDB query
            start_str = start_date.strftime('%Y.%m.%d')
            end_str = end_date.strftime('%Y.%m.%d')
            
            # KDB+ query to get market data
            query = f"""
            select from trade 
            where sym=`{stock_code},
            date within ({start_str};{end_str})
            """
            
            logger.info(f"Hard code the market price. Next step: Executing KDB query: {query}")
            
            # Execute query using FinSpace API
            result = {
                'latest_price': 45678.50,  # Simulating last Bitcoin price
                'daily_change': 1234.75,   # Simulating price change
                'volume': 2500000,         # Simulating trading volume
                'high': 46000.00,         # Simulating day's high
                'low': 44500.00,          # Simulating day's low
                'time_series': [          # Simulating price data points throughout the day
                    {'timestamp': '2024-01-20T00:00:00', 'price': 44500.00},
                    {'timestamp': '2024-01-20T04:00:00', 'price': 45000.00},
                    {'timestamp': '2024-01-20T08:00:00', 'price': 45500.00},
                    {'timestamp': '2024-01-20T12:00:00', 'price': 45750.00},
                    {'timestamp': '2024-01-20T16:00:00', 'price': 45900.00},
                    {'timestamp': '2024-01-20T20:00:00', 'price': 45678.50}
                ]
            }

            logger.info("Market data processed successfully")
            return result

                
        except Exception as e:
            logger.error(f"Error fetching market data: {str(e)}", exc_info=True)
            raise

    def get_available_symbols(self):
        try:
            logger.info("Fetching available stock symbols")
            
            # Query to get unique symbols
            query = "select distinct sym from trade"
            
            response = self.finspace.execute_kx_query(
                environmentId=self.environment_id,
                databaseName=self.database_name,
                clusterName=self.kx_cluster_name,
                query=query
            )
            
            if 'rows' in response:
                symbols = [row[0] for row in response['rows']]
                logger.info(f"Found {len(symbols)} available symbols")
                return symbols
                
            logger.warning("No symbols found in database")
            return []
            
        except Exception as e:
            logger.error(f"Error fetching symbols: {str(e)}", exc_info=True)
            raise
