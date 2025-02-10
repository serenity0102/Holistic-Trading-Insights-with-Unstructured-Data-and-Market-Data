from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import APIGatewayRestResolver, Response
from aws_lambda_powertools.event_handler.exceptions import BadRequestError, NotFoundError
from aws_lambda_powertools.utilities.typing import LambdaContext
from datetime import datetime
from ddb.hello_world import HelloWorld

logger = Logger()
tracer = Tracer()
app = APIGatewayRestResolver()

@app.get("/hello/hello-world")
@tracer.capture_method
def get_hello_world():
    """
    Note: Lambda for API
    Returns hello world record for the given ID
    """
    # Get and validate id parameter
    id = app.current_event.get_query_string_value(name="id", default_value=None)
    if not id:
        raise BadRequestError("Missing required query parameter: id")

    try:
        # Query DynamoDB using the model
        record = HelloWorld.get(HelloWorld.pk_format(id))
        
        current_time = datetime.utcnow().isoformat()
        
        return {
            "meta": {
                "fetchedAt": current_time
            },
            "item": {
                "id": id,
                "value": record.value
            }
        }
    except HelloWorld.DoesNotExist:
        raise NotFoundError(f"No record found for ID: {id}")
    except Exception as e:
        logger.error(f"Error retrieving record: {str(e)}")
        raise

@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    return app.resolve(event, context) 