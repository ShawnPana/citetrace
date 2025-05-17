from flask import Flask, jsonify, request
import os
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables
load_dotenv()

# Configure the Gemini API
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

app = Flask(__name__)

@app.route('/')
def home():
    return jsonify({"message": "Welcome to the Inciteful API"})

@app.route('/api/hello')
def hello():
    return jsonify({"message": "Hello from the backend!"})

@app.route('/test')
def test_gemini():
    query = request.args.get('query', 'Tell me a fun fact about technology')
    
    try:
        # Create a generative model
        model = genai.GenerativeModel('gemini-pro')
        
        # Generate a response
        response = model.generate_content(query)
        
        return jsonify({
            "status": "success",
            "query": query,
            "response": response.text
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/gemini/test')
# test if gmeini is working
def gemini_test():
    # Generate a response from Gemini
    model = genai.GenerativeModel('models/gemini-2.0-flash')
    response = model.generate_content('Write a short poem about coding.')
    
    return jsonify({
        "status": "success",
        "response": response.text
    })

if __name__ == '__main__':
    app.run(debug=True)
