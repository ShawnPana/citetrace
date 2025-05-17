import io
from PyPDF2 import PdfReader
import google.generativeai as genai
from dotenv import load_dotenv
import os

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# for similarity paragraph generation
def extract_text_from_pdf(pdf_bytes):
    pdf_file = io.BytesIO(pdf_bytes)
    pdf_reader = PdfReader(pdf_file)
    text = ""
    for page_num in range(len(pdf_reader.pages)):
        page = pdf_reader.pages[page_num]
        text += page.extract_text()
    return text

def generate_similarity_paragraph(pdf_bytes1, pdf_bytes2):
    """
    Analyze two research paper PDFs and generate a paragraph describing how their content is related.
    
    Args:
        pdf_bytes1: Bytes of the first PDF research paper
        pdf_bytes2: Bytes of the second PDF research paper
        
    Returns:
        A paragraph describing the relationship between the research papers
    """
    try:    
        # Get text from both PDFs
        text1 = extract_text_from_pdf(pdf_bytes1)
        text2 = extract_text_from_pdf(pdf_bytes2)
        
        # Truncate texts if too long (Gemini has context limits)
        max_chars = 10000  # Adjust based on model limits
        if len(text1) > max_chars:
            text1 = text1[:max_chars] + "..."
        if len(text2) > max_chars:
            text2 = text2[:max_chars] + "..."
        
        # Prepare prompt for Gemini
        prompt = f"""
        I have two research papers. Please analyze them and write a paragraph that explains 
        how their content is related. Focus on:
        1. Shared topics, methods, or conclusions
        2. How they complement or contradict each other
        3. The potential value of considering them together
        
        PAPER 1:
        {text1}
        
        PAPER 2:
        {text2}
        """
        
        # Generate comparison with Gemini
        model = genai.GenerativeModel('models/gemini-2.0-flash')
        response = model.generate_content(prompt)
        
        return response.text
    except Exception as e:
        return f"Error analyzing PDFs: {str(e)}"