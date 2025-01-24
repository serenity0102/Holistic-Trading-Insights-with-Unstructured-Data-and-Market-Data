# Market Data Viewer

A Python Flask application that combines market data from Amazon FinSpace KDB+ with news analysis using Amazon Bedrock's knowledge base and semantic search capabilities.

## Features

- View real-time market data for stocks from FinSpace KDB+
- Upload news articles and documents to Bedrock knowledge base
- Semantic search for relevant news based on stock symbols
- Interactive web interface with market statistics and news display

## Prerequisites

- Python 3.11
- AWS Account with access to:
  - Amazon Bedrock
  - Amazon FinSpace with KDB+
  - Amazon S3
- AWS credentials configured with appropriate permissions

## Installation

1. Clone the repository and navigate to the project directory:
```bash
cd market-data-viewer
```

2. Install required Python packages:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file from the example:
```bash
cp .env.example .env
```

4. Configure your `.env` file with the following:

- AWS credentials and region
- S3 bucket name for storing uploaded files
- Bedrock knowledge base ID and role ARN
- FinSpace environment ID, database name, and KX cluster name

Example:
```
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=your_region

BEDROCK_KB_ID=your_knowledge_base_id
BEDROCK_ROLE_ARN=your_role_arn

FINSPACE_ENV_ID=your_environment_id
FINSPACE_DB_NAME=your_database_name
FINSPACE_KX_CLUSTER=your_kx_cluster_name
```

## Running the Application

1. Start the Flask server:
```bash
python app.py
```

2. Open your web browser and navigate to:
```
http://localhost:5000
```

## Usage

1. **View Market Data**:
   - Select a stock symbol from the dropdown (automatically populated from FinSpace)
   - Click "Get Data" to view market statistics and time series data

2. **Upload News**:
   - Select a stock symbol from the dropdown
   - Click "Choose File" to select a news article or document
   - Click "Upload" to save to S3 and add to the Bedrock knowledge base
   - The file will be stored in S3 using the pattern: `stock_code/YYYY/MM/DD/HHMMSS_filename`

3. **Search News**:
   - When viewing market data, related news articles will automatically be retrieved
   - News results are ranked by relevance using Bedrock's semantic search

## Project Structure

- `app.py`: Main Flask application
- `bedrock_utils.py`: Amazon Bedrock integration for knowledge base operations
- `finspace_utils.py`: Amazon FinSpace KDB+ integration for market data
- `s3_utils.py`: Amazon S3 integration for file storage
- `templates/`: HTML templates
  - `index.html`: Main web interface

## Error Handling

The application includes error handling for:
- Invalid stock symbols
- File upload failures
- API connection issues
- Missing environment variables

Check the application logs for detailed error messages if you encounter issues.

## Security Considerations

- Never commit your `.env` file or expose sensitive credentials
- Ensure AWS credentials have minimum required permissions
- Consider implementing user authentication for production use
- Review and update dependencies regularly for security patches
