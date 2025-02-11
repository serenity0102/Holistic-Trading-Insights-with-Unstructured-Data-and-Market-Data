from pynamodb.models import Model
from pynamodb.attributes import UnicodeAttribute
from typing import Optional
import os

class HelloWorld(Model):
    """
    Hello World DynamoDB model
    """
    class Meta:
        table_name = os.environ.get('HELLO_WORLD_TABLE_NAME')
        region = os.environ.get('AWS_REGION')

    pk = UnicodeAttribute(hash_key=True)
    value = UnicodeAttribute()

    @staticmethod
    def pk_format(id: str) -> str:
        """Format the partition key"""
        return f"HELLO#{id}" 