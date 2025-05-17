FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies (including huggingface-hub)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download BGE-M3 model files using huggingface-cli
# This creates a layer with the model. It will be cached if requirements.txt doesn't change.
ARG HF_TOKEN
RUN mkdir -p /app/local_model_files/bge-m3 && \
    HUGGING_FACE_HUB_TOKEN=${HF_TOKEN} huggingface-cli download BAAI/bge-m3 \
    --local-dir /app/local_model_files/bge-m3 \
    --local-dir-use-symlinks False \
    --quiet # Add --quiet to reduce log output during build

# Copy application code 
# This is done AFTER model download to leverage Docker layer caching better.
# If only app code changes, the model download layer won't be re-run.
COPY . .

# Configure environment variables
# Point MODEL_NAME to the local path within the container where the model was downloaded
ENV MODEL_NAME="/app/local_model_files/bge-m3"
# Keep or adjust MODEL_DEVICE as needed
ENV MODEL_DEVICE="cpu"
# Keep or adjust USE_FP16 as needed
ENV USE_FP16="false"
ENV PORT=8080

# Expose the port
EXPOSE 8080

# Use gunicorn as the production-ready WSGI server
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 app:app
