from flask import Flask, jsonify, request, Response, stream_with_context
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai
import os
import json
from utils import RAGPipeline

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

from utils import generate_similarity_paragraph_stream

app = Flask(__name__)
CORS(app)

@app.route('/')
def home():
    return jsonify({"message": "Welcome to the Inciteful API"})

@app.route('/api/hello')
def hello():
    return jsonify({"message": "Hello from the backend!"})

@app.route('/gemini/test')
def gemini_test():
    model = genai.GenerativeModel('models/gemini-2.0-flash')
    response = model.generate_content('Who came first, the chicken or the egg?')
    
    return jsonify({
        "status": "success",
        "response": response.text
    })

@app.route('/api/compare-papers', methods=['POST'])
def compare_papers():
    """API endpoint to compare two research papers and generate similarity analysis with streaming response"""
    if 'file1' not in request.files or 'file2' not in request.files:
        return jsonify({
            "status": "error", 
            "message": "Two PDF files required"
        }), 400
        
    file1 = request.files['file1']
    file2 = request.files['file2']
    
    if file1.filename == '' or file2.filename == '':
        return jsonify({
            "status": "error", 
            "message": "No file selected"
        }), 400
        
    if not (file1.filename.endswith('.pdf') and file2.filename.endswith('.pdf')):
        return jsonify({
            "status": "error", 
            "message": "Both files must be PDFs"
        }), 400
    
    try:
        pdf_bytes1 = file1.read()
        pdf_bytes2 = file2.read()
        
        def generate():
            yield json.dumps({
                "status": "processing",
                "message": "Starting comparison..."
            }) + '\n'
            
            for chunk in generate_similarity_paragraph_stream(pdf_bytes1, pdf_bytes2):
                yield json.dumps({
                    "status": "generating",
                    "chunk": chunk
                }) + '\n'
            
            yield json.dumps({
                "status": "complete",
                "paper1_name": file1.filename,
                "paper2_name": file2.filename
            }) + '\n'
        
        return Response(stream_with_context(generate()), 
                       mimetype='text/event-stream')
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


rag = RAGPipeline()

@app.route('/api/initialize-rag', methods=['POST'])
def initialize_rag():
    try:
        num_chunks = rag.process_all_pdfs()
        return jsonify({
            "status": "success",
            "message": f"RAG pipeline initialized with {num_chunks} chunks"
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/api/process-pdf', methods=['POST'])
def process_pdf():
    data = request.json
    if not data or 'pdf_name' not in data:
        return jsonify({
            "status": "error",
            "message": "PDF name is required"
        }), 400
        
    try:
        pdf_name = data['pdf_name']
        num_chunks = rag.process_single_pdf(pdf_name)
        return jsonify({
            "status": "success",
            "message": f"Processed {pdf_name} into {num_chunks} chunks"
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/api/query-rag', methods=['POST'])
def query_rag():
    data = request.json
    if not data or 'question' not in data:
        return jsonify({
            "status": "error",
            "message": "Question is required"
        }), 400
        
    try:
        question = data['question']
        top_k = data.get('top_k', 5)
        
        relevant_docs = rag.query(question, top_k=top_k)
        
        sources = []
        for doc in relevant_docs:
            sources.append({
                "content": doc.page_content,
                "source": doc.metadata.get("source", "Unknown")
            })
        
        def generate():
            yield json.dumps({
                "status": "processing",
                "message": "Retrieving relevant information..."
            }) + '\n'
            
            for chunk in rag.generate_answer_stream(question, relevant_docs):
                yield json.dumps({
                    "status": "generating",
                    "chunk": chunk
                }) + '\n'
            
            yield json.dumps({
                "status": "complete",
                "sources": sources
            }) + '\n'
        
        return Response(stream_with_context(generate()), 
                        mimetype='text/event-stream')
                        
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500    

if __name__ == '__main__':
    app.run(debug=True)
