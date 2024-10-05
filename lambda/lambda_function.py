import json

def lambda_handler(event, context):
    # This function is triggered by an event and returns a response.
    message = "Hello, world!"
    
    # Print statement logs to CloudWatch logs
    print(message)
    
    return {
        'statusCode': 200,
        'body': json.dumps({'message': message})
    }