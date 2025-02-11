"""Common utilities for API handlers"""

from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.data_classes import APIGatewayProxyEvent
from typing import Optional

logger = Logger()
