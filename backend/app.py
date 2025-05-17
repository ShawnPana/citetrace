from flask import Flask, jsonify, request, Response, stream_with_context
from dotenv import load_dotenv
import google.generativeai as genai
import os
import json

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# for similarity paragraph generation
from utils import generate_similarity_paragraph_stream

app = Flask(__name__)

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

if __name__ == '__main__':
    app.run(debug=True)
