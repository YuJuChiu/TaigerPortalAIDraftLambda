import json
from db import get_keywords_collection
# from main import analyze_transcript


def lambda_hello_world(event, context):
    # This function is triggered by an event and returns a response.
    message = "Hello, world!"

    # Print statement logs to CloudWatch logs
    print(message)

    return {
        'statusCode': 200,
        'body': json.dumps({'message': message})
    }


def getKeywords(event, context):
    keywords = get_keywords_collection()
    print(keywords)

    return {
        'statusCode': 200,
        'body': json.dumps({'keywords': keywords})
    }


def postAnalyzeCourses(event, context):
    # Get the body from the event
    body = event.get('body')

    # If the body is JSON, parse it
    if body:
        try:
            body = json.loads(body)  # Parse the body as JSON
        except json.JSONDecodeError:
            return {
                'statusCode': 400,
                'body': json.dumps('Invalid JSON format')
            }

    # Now you can work with the request body
    print("Request body:", body)

    # analyze_transcript(body.courses, body.category, body.student_id,
    #                    body.student_name, body.language, body.courses_taiger_guided)

    return {
        'statusCode': 200,
        'body': json.dumps(f'Received body: {body}')
    }
