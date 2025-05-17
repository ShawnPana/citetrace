# Testing Your BGE-M3 API

This document explains how to test your deployed BGE-M3 API using the provided test script.

## Prerequisites

- Python 3.6+
- `requests` library (install with `pip install requests`)
- Your API key

## Basic Testing

Run the test script with your API key:

```bash
python test_api.py --api-key YOUR_API_KEY
```

This will:
1. Test the health endpoint to check if your service is running
2. Test the encode endpoint by sending sample texts and showing the returned embeddings

## Getting Your API Key

The API key is defined when you deploy the service to Google Cloud. There are two ways to get your API key:

1. **From your deployment configuration:**
   - Check the `ALLOWED_API_KEYS` environment variable in your `gcp_deploy.sh` script
   - These are the comma-separated keys you defined during deployment 
   - Example: If you set `--set-env-vars="ALLOWED_API_KEYS=key1,key2,key3"`, then "key1", "key2", or "key3" are your valid API keys

2. **Create a new API key:**
   - Go to Google Cloud Console → Cloud Run → Select your service (bge-m3-api)
   - Click "Edit and Deploy New Revision"
   - Under "Variables & Secrets", find the `ALLOWED_API_KEYS` variable
   - Add your new key to the comma-separated list
   - Click "Deploy" to update the service with the new API key

If you're testing locally with Docker, the key is whatever you set with the `-e "ALLOWED_API_KEYS=test_key"` parameter when running the container.

## Additional Options

### Custom API URL

If your API is deployed at a different URL, you can specify it:

```bash
python test_api.py --api-key YOUR_API_KEY --api-url https://your-custom-url.run.app
```

### Wait for Model Loading

If the model is still loading (common after deployment), use this flag to wait:

```bash
python test_api.py --api-key YOUR_API_KEY --wait-for-model
```

This will check the health endpoint periodically (every 10 seconds) for up to 5 minutes until the model is loaded.

## Expected Output

For a successful test, you should see output similar to:

