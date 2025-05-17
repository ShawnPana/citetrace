import requests
import argparse
import json
import time

def test_health(api_url):
    """Test the health endpoint of the API"""
    print(f"Testing health endpoint at: {api_url}/health")
    try:
        response = requests.get(f"{api_url}/health")
        print(f"Status code: {response.status_code}")
        print("Response:")
        print(json.dumps(response.json(), indent=2))
        return response.json().get("model_loaded", False)
    except Exception as e:
        print(f"Error testing health endpoint: {e}")
        return False

def test_encode(api_url, api_key):
    """Test the encode endpoint with sample texts"""
    print(f"\nTesting encode endpoint at: {api_url}/encode")
    
    # Sample texts to encode
    sample_texts = [
        "This is the first test sentence, acting as the query.",
        "The BGE-M3 model generates embeddings for natural language.",
        "Another sentence to compare against the first one."
    ]
    
    # Prepare headers and payload
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": api_key
    }
    
    payload = {
        "texts": sample_texts,
        "return_dense": True,
        "return_sparse": False,
        "return_colbert_vecs": True, # Ensure Colbert vecs are returned
        "compute_colbert_pairwise_scores": True # Request similarity scores (relative to first)
    }
    
    try:
        # Send the request
        print("Sending request...")
        response = requests.post(
            f"{api_url}/encode",
            headers=headers,
            json=payload
        )
        
        # Check response status
        print(f"Status code: {response.status_code}")
        
        # If successful, try to parse the JSON response
        if response.status_code == 200:
            try:
                result = response.json()
                print("\nRequest successful!")
                
                # Check for dense vectors
                if "dense_vecs" in result:
                    vectors = result["dense_vecs"]
                    print(f"Received {len(vectors)} embedding vectors")
                    print(f"Vector dimension: {len(vectors[0])}")
                    print(f"First vector preview (first 5 values): {vectors[0][:5]}")
                else:
                    print("No dense vectors returned")
                    
                # Check for Colbert scores relative to the first text
                if "colbert_scores_relative_to_first" in result:
                    colbert_scores = result["colbert_scores_relative_to_first"]
                    print(f"Received {len(colbert_scores)} Colbert similarity scores (relative to first text):")
                    for score_info in colbert_scores:
                        print(f"  Query text (index {score_info['query_text_index']}) vs Candidate text (index {score_info['candidate_text_index']}): {score_info['score']:.4f}")
                elif payload["compute_colbert_pairwise_scores"]:
                    print("Colbert scores relative to first were requested but not found in response.")

                # Check for other return types if present (excluding already processed keys)
                processed_keys = {"dense_vecs", "colbert_scores_relative_to_first", "colbert_vecs"}
                if payload.get("return_colbert_vecs"):
                    if "colbert_vecs" in result:
                        print(f"Received {len(result['colbert_vecs'])} Colbert vectors.")
                    else:
                        print("Colbert vectors were requested but not found.")
                
                other_keys = [k for k in result if k not in processed_keys and k != "colbert_vecs"]
                if other_keys:
                    print("Also received other keys:")
                    for key in other_keys:
                        print(f"  {key}: {str(result[key])[:100]}...") # Print a preview

            except json.JSONDecodeError as e:
                print(f"Error parsing JSON response: {e}")
                print("Raw response content:")
                print(response.text[:500])  # Print first 500 chars of response
                print("..." if len(response.text) > 500 else "")  # Indicate if content was truncated
        else:
            # Print error information
            print("Request failed!")
            print("Response:")
            try:
                print(json.dumps(response.json(), indent=2))
            except:
                print(response.text)
            
    except Exception as e:
        print(f"Error testing encode endpoint: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test BGE-M3 API")
    parser.add_argument("--api-url", type=str, 
                        default="https://bge-m3-api-1055631535125.us-central1.run.app",
                        help="API URL")
    parser.add_argument("--api-key", type=str, required=True, 
                        help="API key for authentication")
    parser.add_argument("--wait-for-model", action="store_true",
                        help="Wait for model to be loaded before testing encode endpoint")
    
    args = parser.parse_args()
    
    # Remove trailing slash if present in the URL
    api_url = args.api_url.rstrip('/')
    
    # Always test health endpoint first
    model_loaded = test_health(api_url)
    
    # If waiting for model and model not loaded, wait and retry
    if args.wait_for_model and not model_loaded:
        max_wait = 300  # 5 minutes maximum wait time
        interval = 10   # Check every 10 seconds
        elapsed = 0
        
        print("\nModel is not yet loaded. Waiting...")
        
        while elapsed < max_wait:
            print(f"Waiting {interval} seconds before checking again...")
            time.sleep(interval)
            elapsed += interval
            
            model_loaded = test_health(api_url)
            if model_loaded:
                print("Model is now loaded!")
                break
                
        if not model_loaded:
            print(f"Model did not load after waiting {max_wait} seconds.")
            print("Continuing with encode test anyway...")
    
    # Test the encode endpoint
    test_encode(api_url, args.api_key)
