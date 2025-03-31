import clickhouse_driver
import pandas as pd
from datetime import datetime

# Connect to ClickHouse
client = clickhouse_driver.Client(
    host='44.222.122.134',
    port=9000,
    user='default',
    password='clickhouse@aws',
    database='tick_data_db'
)

# Query 1: Get monthly average closing prices
print("Monthly average closing prices:")
monthly_avg = client.execute('''
    SELECT
        toYear(timestamp) AS year,
        toMonth(timestamp) AS month,
        avg(close) AS avg_close
    FROM tick_data
    WHERE symbol = 'AAPL'
    GROUP BY year, month
    ORDER BY year, month
    LIMIT 10
''')

for row in monthly_avg:
    print(f"{row[0]}-{row[1]:02d}: ${row[2]:.2f}")

# Query 2: Get highest and lowest prices by year
print("\nYearly high and low prices:")
yearly_high_low = client.execute('''
    SELECT
        toYear(timestamp) AS year,
        max(high) AS yearly_high,
        min(low) AS yearly_low,
        (max(high) - min(low)) / min(low) * 100 AS price_range_percent
    FROM tick_data
    WHERE symbol = 'AAPL'
    GROUP BY year
    ORDER BY year
''')

for row in yearly_high_low:
    print(f"{row[0]}: High ${row[1]:.2f}, Low ${row[2]:.2f}, Range {row[3]:.2f}%")

# Query 3: Get days with highest trading volume
print("\nTop 5 days with highest trading volume:")
high_volume_days = client.execute('''
    SELECT
        timestamp,
        volume,
        close
    FROM tick_data
    WHERE symbol = 'AAPL'
    ORDER BY volume DESC
    LIMIT 5
''')

for row in high_volume_days:
    print(f"{row[0].strftime('%Y-%m-%d')}: {row[1]:,} shares, Closing price: ${row[2]:.2f}")

# Query 4: Calculate moving average using a window function
print("\n30-day moving average (last 10 entries):")
moving_avg = client.execute('''
    WITH 
    moving_avg AS (
        SELECT
            timestamp,
            close,
            avg(close) OVER (
                ORDER BY timestamp
                ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
            ) AS moving_avg_30
        FROM tick_data
        WHERE symbol = 'AAPL'
    )
    SELECT * FROM moving_avg
    ORDER BY timestamp DESC
    LIMIT 10
''')

for row in reversed(moving_avg):
    print(f"{row[0].strftime('%Y-%m-%d')}: Close ${row[1]:.2f}, 30-day MA ${row[2]:.2f}")
