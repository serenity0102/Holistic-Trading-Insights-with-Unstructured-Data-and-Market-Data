# Stock Data Pipeline with ClickHouse and AWS Secrets Manager

This project demonstrates how to build a data pipeline that:
1. Downloads historical stock data from Yahoo Finance
2. Securely connects to a ClickHouse database using credentials stored in AWS Secrets Manager
3. Inserts the data into ClickHouse for analysis
4. Performs analytical queries on the time-series stock data

## Prerequisites

- Python 3.x
- AWS account with Secrets Manager access
- ClickHouse server

## Required Python Packages

```bash
pip install yfinance clickhouse_driver pandas boto3
```

## AWS Configuration

### Setting up AWS Profile

```bash
aws configure --profile clickhouse
```

### Creating Secret in AWS Secrets Manager

```bash
aws secretsmanager create-secret \
    --name clickhouse/password \
    --description "ClickHouse database credentials" \
    --secret-string '{"username":"default","password":"your_password"}' \
    --profile clickhouse \
    --region us-east-1
```

## Usage

### Download and Insert Stock Data

```bash
python direct_insert_tick_to_clickhouse_with_profile.py
```

### Query and Analyze Data

```bash
python query_ba_data.py
```

## Security Best Practices

- Use AWS Secrets Manager to store database credentials
- Use AWS named profiles to manage multiple AWS accounts
- Never hardcode credentials in your scripts
- Rotate credentials regularly

## Sample Queries

The project includes several analytical queries:
- Monthly average closing prices
- Yearly high and low prices with price range percentages
- Top trading volume days
- Moving averages
- Performance comparisons between stocks

## Data Schema

```sql
CREATE TABLE tick_data
(
    symbol String,
    timestamp DateTime,
    open Float64,
    high Float64,
    low Float64,
    close Float64,
    volume UInt64,
    adjusted_close Float64
)
ENGINE = MergeTree()
ORDER BY (symbol, timestamp)
```
