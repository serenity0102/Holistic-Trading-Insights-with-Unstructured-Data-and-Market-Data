from enum import Enum
from pynamodb.models import Model
from pynamodb.attributes import UnicodeAttribute
from typing import Optional
import os

class ExtractionStatus(str, Enum):
    """Enum for report extraction status"""
    NEW = "New"
    COMPLETED = "Completed"
    ERROR = "Error"

class Report(Model):
    """
    Report DynamoDB model for storing financial report data and extraction status
    
    Attributes:
        pk: Ticker symbol (e.g., "AAPL", "MSFT")
        sk: Quarter identifier (e.g., "2018-Q1", "2019-Q3")
        extraction_status: Current status of OCR extraction
        extraction: Extracted text content
        pdf_url: URL to the PDF file
    """
    class Meta:
        table_name = os.environ.get('REPORT_TABLE_NAME')
        region = os.environ.get('AWS_REGION')

    pk = UnicodeAttribute(hash_key=True)
    sk = UnicodeAttribute(range_key=True)
    extraction_status = UnicodeAttribute(default=ExtractionStatus.NEW)
    extraction = UnicodeAttribute(null=True)
    pdf_url = UnicodeAttribute()

    @staticmethod
    def pk_format(ticker: str) -> str:
        """Format the partition key"""
        return ticker.upper()

    @staticmethod
    def sk_format(year: int, quarter: int) -> str:
        """Format the sort key"""
        if not 1 <= quarter <= 4:
            raise ValueError("Quarter must be between 1 and 4")
        return f"{year}-Q{quarter}"

    @classmethod
    def get_by_ticker_and_quarter(cls, ticker: str, year: int, quarter: int) -> Optional['Report']:
        """Get report by ticker and quarter"""
        try:
            return cls.get(
                cls.pk_format(ticker),
                cls.sk_format(year, quarter)
            )
        except cls.DoesNotExist:
            return None

    def update_extraction_status(self, status: ExtractionStatus) -> None:
        """Update the extraction status"""
        if not isinstance(status, ExtractionStatus):
            raise ValueError("Status must be an ExtractionStatus enum value")
        self.extraction_status = status
        self.save()

    def update_extraction(self, extraction_text: str) -> None:
        """Update the extracted text"""
        self.extraction = extraction_text
        self.extraction_status = ExtractionStatus.COMPLETED
        self.save() 