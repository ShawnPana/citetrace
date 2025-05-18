from flask import Flask, request, jsonify
from flask_cors import CORS
from FlagEmbedding import BGEM3FlagModel
import numpy as np
import os
import logging
import time
from functools import wraps
import threading

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing

# Global variables
MODEL = None
MODEL_LOADED = threading.Event()
COLBERT_VEC_CACHE = {} # Cache for Colbert vectors {text_string: colbert_vector}

# Initialize API_KEYS
_raw_api_keys_env = os.environ.get('ALLOWED_API_KEYS')
if _raw_api_keys_env:
    # Filter out empty strings that can result from splitting an empty string
    # or strings with just commas, and strip whitespace from keys.
    API_KEYS = set(key.strip() for key in _raw_api_keys_env.split(',') if key.strip())
else:
    # If ALLOWED_API_KEYS is not set or is an empty string,
    # API_KEYS will be an empty set.
    # The decorator `require_api_key` will treat an empty API_KEYS set as "no auth required".
    API_KEYS = set()

logger.info(f"API Keys loaded: {API_KEYS if API_KEYS else 'No API keys configured (open access)'}")

def initialize_bge_m3_model(model_name='BAAI/bge-m3', use_fp16=None, device=None):
    """
    Initialize the BGE-M3 model and signal when it's ready to use.
    
    Args:
        model_name (str): The model identifier to load
        use_fp16 (bool): Whether to use FP16 precision (defaults to True if on GPU, False if on CPU)
        device (str): Device to use ('cpu', 'cuda:0', etc.)
        
    Returns:
        BGEM3FlagModel: The initialized model
    """
    global MODEL
    
    # Determine device if not specified
    if device is None:
        import torch
        device = 'cuda:0' if torch.cuda.is_available() else 'cpu'
    
    # Set default use_fp16 based on device if not specified
    if use_fp16 is None:
        use_fp16 = device.startswith('cuda')
    
    logger.info(f"Initializing BGE-M3 model on device: {device} with FP16: {use_fp16}")
    start_time = time.time()
    
    try:
        MODEL = BGEM3FlagModel(model_name, use_fp16=use_fp16, device=device)
        load_time = time.time() - start_time
        logger.info(f"Model initialization complete in {load_time:.2f} seconds")
        MODEL_LOADED.set()  # Signal that the model is ready
        return MODEL
    except Exception as e:
        logger.error(f"Model initialization failed: {str(e)}")
        raise

def require_api_key(f):
    """Decorator to require a valid API key for endpoint access"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # If API_KEYS is empty (meaning no keys were configured) or contains '*', allow access.
        if not API_KEYS or '*' in API_KEYS:
            return f(*args, **kwargs)
            
        api_key = request.headers.get('X-API-Key')
        if api_key not in API_KEYS:
            logger.warning(f"Access denied: Invalid or missing API key. Provided API key: '{api_key}'. Allowed keys: {API_KEYS}")
            return jsonify({"error": "Invalid or missing API key"}), 401
        return f(*args, **kwargs)
    return decorated_function

def wait_for_model(f):
    """Decorator to ensure model is loaded before processing requests"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not MODEL_LOADED.is_set():
            return jsonify({"error": "Model is still loading. Please try again later."}), 503
        return f(*args, **kwargs)
    return decorated_function

@app.route('/health', methods=['GET'])
def health_check():
    """Endpoint to check if the service is healthy and model is loaded"""
    return jsonify({
        "status": "healthy", 
        "model_loaded": MODEL_LOADED.is_set()
    }), 200 if MODEL_LOADED.is_set() else 503

@app.route('/encode', methods=['POST'])
@require_api_key
@wait_for_model
def encode_texts():
    """Endpoint to encode texts with the BGE-M3 model"""
    try:
        data = request.get_json()
        if not data or 'texts' not in data:
            return jsonify({"error": "Missing 'texts' in request body"}), 400
        
        texts = data['texts']
        if not texts:
            return jsonify({}), 200 # Return empty if texts is empty
        
        # Get parameters with defaults
        params = {
            'return_dense': data.get('return_dense', True),
            'return_sparse': data.get('return_sparse', False),
            'return_colbert_vecs': data.get('return_colbert_vecs', False),
            'batch_size': data.get('batch_size', 32),
            'max_length': data.get('max_length', 8192)
        }
        
        final_embeddings_dict = {} # Will hold all results, from cache or fresh

        # --- Colbert Vector Caching Logic for /encode --- 
        if params['return_colbert_vecs']:
            cached_colberts_for_batch = []
            all_colberts_in_cache_for_batch = True
            for text_input in texts:
                if text_input in COLBERT_VEC_CACHE:
                    cached_colberts_for_batch.append(COLBERT_VEC_CACHE[text_input])
                else:
                    all_colberts_in_cache_for_batch = False
                    break
            
            if all_colberts_in_cache_for_batch:
                logger.info(f"All {len(texts)} Colbert vectors for batch found in cache.")
                final_embeddings_dict['colbert_vecs'] = cached_colberts_for_batch
                # If only Colbert was needed, and we got it from cache, skip primary encode call
                if not params['return_dense'] and not params['return_sparse']:
                    pass # No further MODEL.encode call needed
                else:
                    # Other vectors are needed, call MODEL.encode but without asking for Colbert again
                    params_for_other_vecs = params.copy()
                    params_for_other_vecs['return_colbert_vecs'] = False
                    logger.info(f"Calling MODEL.encode for other vectors (Colbert was cached). Params: {params_for_other_vecs}")
                    other_model_output = MODEL.encode(texts, **params_for_other_vecs)
                    final_embeddings_dict.update(other_model_output)
            else:
                # Not all Colbert vectors are cached for this batch, so call MODEL.encode with original params
                logger.info(f"Not all Colbert vectors in cache for this batch. Calling MODEL.encode. Params: {params}")
                model_output = MODEL.encode(texts, **params)
                final_embeddings_dict.update(model_output)
                # Populate cache with freshly computed Colbert vectors if they were returned
                if 'colbert_vecs' in final_embeddings_dict and final_embeddings_dict['colbert_vecs'] is not None:
                    logger.info("Populating Colbert cache from /encode fresh call.")
                    for i, text_input in enumerate(texts):
                        if i < len(final_embeddings_dict['colbert_vecs']):
                            COLBERT_VEC_CACHE[text_input] = final_embeddings_dict['colbert_vecs'][i]
        else:
            # Colbert vectors not requested for this call.
            # Call MODEL.encode only if dense or sparse vectors are requested.
            if params['return_dense'] or params['return_sparse']:
                logger.info(f"Colbert not requested. Calling MODEL.encode for dense/sparse. Params: {params}")
                model_output = MODEL.encode(texts, **params)
                final_embeddings_dict.update(model_output)
            else:
                logger.info("No embedding types requested in /encode call.")
        # --- End Colbert Vector Caching Logic --- 

        # Convert numpy arrays to Python lists for JSON serialization
        result = {}
        if 'dense_vecs' in final_embeddings_dict and final_embeddings_dict['dense_vecs'] is not None:
            result['dense_vecs'] = final_embeddings_dict['dense_vecs'].tolist()
        
        if 'lexical_weights' in final_embeddings_dict and final_embeddings_dict['lexical_weights'] is not None:
            result['lexical_weights'] = final_embeddings_dict['lexical_weights'] # Typically dicts of lists/floats
            
        # Ensure Colbert vectors in result are lists, not numpy arrays
        if 'colbert_vecs' in final_embeddings_dict and final_embeddings_dict['colbert_vecs'] is not None:
            # Vectors from cache are already in desired format (raw from model, usually np.ndarray)
            # Vectors from MODEL.encode output colbert_vecs: List[np.ndarray]
            result['colbert_vecs'] = [vec.tolist() if hasattr(vec, 'tolist') else vec 
                                    for vec in final_embeddings_dict['colbert_vecs']]
        
        # When compute_colbert_pairwise_scores is true, calculate similarity of each text to the first text.
        if data.get('compute_colbert_pairwise_scores', False) and \
           params['return_colbert_vecs'] and \
           'colbert_vecs' in final_embeddings_dict and final_embeddings_dict['colbert_vecs'] is not None and \
           len(texts) > 1:
            
            # Use the raw Colbert vectors (before tolist()) for scoring from final_embeddings_dict
            colbert_vectors_for_scoring = final_embeddings_dict['colbert_vecs'] 
            first_text_colbert_vec = colbert_vectors_for_scoring[0]
            
            scores_relative_to_first = []
            for i in range(1, len(colbert_vectors_for_scoring)):
                candidate_colbert_vec = colbert_vectors_for_scoring[i]
                score = MODEL.colbert_score(first_text_colbert_vec, candidate_colbert_vec)
                
                if hasattr(score, 'item'): # Check if it's a PyTorch tensor and get float
                    score = score.item()
                
                scores_relative_to_first.append({
                    "query_text_index": 0, # Index of the first text (query)
                    "candidate_text_index": i, # Index of the current text being compared to the first
                    "score": score
                })
            result['colbert_scores_relative_to_first'] = scores_relative_to_first
            
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/colbert-similarity', methods=['POST'])
@require_api_key
@wait_for_model
def colbert_similarity_to_query():
    """
    Computes ColBERT-style similarity scores between a query text and multiple candidate texts.
    Expects JSON: {"query_text": "...", "candidate_texts": ["...", "..."]}
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON payload"}), 400
        
        query_text = data.get('query_text')
        candidate_texts = data.get('candidate_texts')

        if not query_text or not isinstance(query_text, str):
            return jsonify({"error": "Missing or invalid 'query_text'"}), 400
        if not candidate_texts or not isinstance(candidate_texts, list) or not all(isinstance(t, str) for t in candidate_texts):
            return jsonify({"error": "Missing or invalid 'candidate_texts'"}), 400
        if not candidate_texts:
            return jsonify({"scores": []}), 200

        all_texts_for_scoring = [query_text] + candidate_texts
        final_colbert_vectors_for_scoring = [None] * len(all_texts_for_scoring)
        texts_to_encode_freshly_map = {} # Stores {original_idx: text_val}
        
        for original_idx, text_val in enumerate(all_texts_for_scoring):
            if text_val in COLBERT_VEC_CACHE:
                logger.debug(f"Cache hit for text '{text_val[:30]}...' in /colbert-similarity")
                final_colbert_vectors_for_scoring[original_idx] = COLBERT_VEC_CACHE[text_val]
            else:
                logger.debug(f"Cache miss for text '{text_val[:30]}...' in /colbert-similarity")
                texts_to_encode_freshly_map[original_idx] = text_val
        
        if texts_to_encode_freshly_map:
            texts_to_encode_values = list(texts_to_encode_freshly_map.values())
            original_indices_of_fresh_texts = list(texts_to_encode_freshly_map.keys())
            
            logger.info(f"Encoding {len(texts_to_encode_values)} texts freshly for /colbert-similarity.")
            fresh_output = MODEL.encode(
                texts_to_encode_values, 
                return_dense=False, return_sparse=False, return_colbert_vecs=True
            )
            fresh_vecs = fresh_output.get('colbert_vecs')
            
            if fresh_vecs and len(fresh_vecs) == len(texts_to_encode_values):
                for i, vec in enumerate(fresh_vecs):
                    original_idx = original_indices_of_fresh_texts[i]
                    text_val = texts_to_encode_values[i]
                    final_colbert_vectors_for_scoring[original_idx] = vec
                    COLBERT_VEC_CACHE[text_val] = vec # Populate cache
                    logger.debug(f"Cached fresh Colbert vector for '{text_val[:30]}...'")
            else:
                logger.error("Failed to get valid Colbert vectors for subset in /colbert-similarity.")
                return jsonify({"error": "Failed to compute some Colbert vectors"}), 500
        else:
            logger.info("All Colbert vectors for /colbert-similarity found in cache.")

        if any(v is None for v in final_colbert_vectors_for_scoring):
            logger.error("Internal error: Some Colbert vectors are None after processing in /colbert-similarity.")
            return jsonify({"error": "Internal error preparing Colbert vectors for scoring"}), 500
            
        query_colbert_vec = final_colbert_vectors_for_scoring[0]
        candidate_colbert_vecs_for_scoring = final_colbert_vectors_for_scoring[1:]
        
        scores = []
        for cand_vec in candidate_colbert_vecs_for_scoring:
            score = MODEL.colbert_score(query_colbert_vec, cand_vec)
            if hasattr(score, 'item'): # Handle PyTorch tensor
                score = score.item()
            scores.append(score)
            
        return jsonify({"scores": scores}), 200

    except Exception as e:
        logger.error(f"Error in /colbert-similarity: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({"error": "An internal error occurred"}), 500

# Start model initialization in a separate thread
def start_model_initialization():
    """Start model initialization in a background thread"""
    def initialize_model_thread():
        try:
            # Default to the BAAI/bge-m3 Hugging Face ID if MODEL_NAME is not set
            # However, Dockerfile now sets MODEL_NAME to the local path
            model_name_to_load = os.environ.get('MODEL_NAME', 'BAAI/bge-m3')
            logger.info(f"Attempting to load model using identifier: {model_name_to_load}")

            # Check if the model_name_to_load is a local path and if it exists
            if os.path.isdir(model_name_to_load):
                logger.info(f"Treating model identifier as a local path: {model_name_to_load}")
                if not os.path.exists(os.path.join(model_name_to_load, 'config.json')):
                    logger.warning(f"Local model path {model_name_to_load} exists, but config.json is missing. Initialization might fail or fall back.")
            else:
                logger.info(f"Treating model identifier '{model_name_to_load}' as a Hugging Face Hub ID.")

            use_fp16_str = os.environ.get('USE_FP16', '').lower()
            use_fp16 = None
            if use_fp16_str in ('true', 'false'):
                use_fp16 = use_fp16_str == 'true'
            device = os.environ.get('MODEL_DEVICE', None)
            
            initialize_bge_m3_model(model_name=model_name_to_load, use_fp16=use_fp16, device=device)
        except Exception as e:
            logger.error(f"Background model initialization failed: {str(e)}")
            
    thread = threading.Thread(target=initialize_model_thread)
    thread.daemon = True
    thread.start()

start_model_initialization() # Ensure model initialization starts when module is loaded

if __name__ == '__main__':
    # Start model initialization in background
    # start_model_initialization() # No longer needed here as it's called at module level
    
    # Get port from environment variable or default to 8080
    port = int(os.environ.get('PORT', 8080))
    
    # Run the Flask app
    app.run(host='0.0.0.0', port=port, debug=False)
