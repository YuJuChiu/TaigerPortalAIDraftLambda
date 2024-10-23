import json
import pytest
# Adjust the import according to your module structure
from lambda_function import lambda_hello_world


def test_lambda_hello_world():
    event = {}
    context = {}
    response = lambda_hello_world(event, context)

    assert response['statusCode'] == 200
    body = json.loads(response['body'])
    assert body['message'] == "Hello, world!"
