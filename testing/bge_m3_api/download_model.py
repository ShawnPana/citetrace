from huggingface_hub import snapshot_download
import os

def download_bge_m3_model():
    model_id = "BAAI/bge-m3"
    
    # Determine the script's directory to make the download path relative to it
    # Assumes this script is in testing/bge_m3_api/
    script_dir = os.path.dirname(os.path.abspath(__file__))
    download_root_dir = os.path.join(script_dir, "local_model_files")
    model_specific_download_path = os.path.join(download_root_dir, model_id.split('/')[-1]) # e.g., "bge-m3"

    os.makedirs(model_specific_download_path, exist_ok=True)

    print(f"Downloading model {model_id} to {model_specific_download_path}...")
    try:
        snapshot_download(
            repo_id=model_id,
            local_dir=model_specific_download_path,
            local_dir_use_symlinks=False,  # Important for Docker: copies actual files
            # Consider adding ignore_patterns if there are very large, unneeded files
            # Or allow_patterns to be very specific
            # For BGE-M3, default usually works fine.
            # example: ignore_patterns=["*.safetensors.index.json", "*.h5", "*.ot"] 
        )
        print(f"Model {model_id} download complete to {model_specific_download_path}")
    except Exception as e:
        print(f"Error downloading model {model_id}: {e}")
        print("Please check your internet connection and Hugging Face Hub access.")
        print("You might need to log in using 'huggingface-cli login' or set HF_TOKEN environment variable if the model is private or gated.")

if __name__ == "__main__":
    download_bge_m3_model() 