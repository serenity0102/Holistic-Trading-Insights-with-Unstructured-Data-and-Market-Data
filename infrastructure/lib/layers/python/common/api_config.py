"""Common configurations for API handlers"""

from aws_lambda_powertools.event_handler import CORSConfig
import os

# Get frontend URL from environment variable
FRONTEND_URL = os.environ.get('FRONTEND_URL')

# if not FRONTEND_URL:
#     raise ValueError("FRONTEND_URL environment variable is required for CORS configuration")

# Common CORS configuration for all APIs
cors_config = CORSConfig(
    allow_origin=FRONTEND_URL,
    max_age=300,
    allow_headers=[
        "Authorization",
        "Content-Type",
        "X-Amz-Date",
        "X-Api-Key",
        "X-Amz-Security-Token",
        "X-Request-Id",
    ],
) 