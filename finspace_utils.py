import boto3
import pandas as pd
import os
from datetime import datetime, timedelta

class FinSpaceClient:
    def __init__(self):
        self.finspace = boto3.client('finspace-data')
        self.environment_id = os.getenv('FINSPACE_ENV_ID')
        self.database_name = os.getenv('FINSPACE_DB_NAME')
        self.kx_cluster_name = os.getenv('FINSPACE_KX_CLUSTER')

    def get_market_data(self, stock_code):
        try:
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
            
            # Execute query using FinSpace API
            response = self.finspace.execute_kx_query(
                environmentId=self.environment_id,
                databaseName=self.database_name,
                clusterName=self.kx_cluster_name,
                query=query
            )
            
            # Process the response
            if 'rows' in response:
                # Convert response to pandas DataFrame
                df = pd.DataFrame(response['rows'], columns=response['columnNames'])
                
                # Basic data processing
                result = {
                    'latest_price': float(df['price'].iloc[-1]) if not df.empty else None,
                    'daily_change': float(df['price'].iloc[-1] - df['price'].iloc[0]) if not df.empty else None,
                    'volume': int(df['volume'].sum()) if not df.empty else None,
                    'high': float(df['price'].max()) if not df.empty else None,
                    'low': float(df['price'].min()) if not df.empty else None,
                    'time_series': df[['timestamp', 'price']].to_dict('records') if not df.empty else []
                }
                
                return result
            else:
                return {
                    'error': 'No data available for the specified stock code'
                }
                
        except Exception as e:
            print(f"Error fetching market data: {str(e)}")
            raise

    def get_available_symbols(self):
        try:
            # Query to get unique symbols
            query = "select distinct sym from trade"
            
            response = self.finspace.execute_kx_query(
                environmentId=self.environment_id,
                databaseName=self.database_name,
                clusterName=self.kx_cluster_name,
                query=query
            )
            
            if 'rows' in response:
                return [row[0] for row in response['rows']]
            return []
            
        except Exception as e:
            print(f"Error fetching symbols: {str(e)}")
            raise
