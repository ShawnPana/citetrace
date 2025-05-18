# import io
# from PyPDF2 import PdfReader
# import google.generativeai as genai
# from dotenv import load_dotenv
# import os
# import json
# import tempfile
# from supabase import create_client

# load_dotenv()

# genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# # Initialize Supabase client
# supabase_url = os.getenv("SUPABASE_URL")
# supabase_key = os.getenv("SUPABASE_KEY")
# supabase = create_client(supabase_url, supabase_key)

# # Name of your bucket containing PDFs
# BUCKET_NAME = "pdfs"  # Change this to match your actual bucket name

# # Supabase functions
# def list_all_pdfs():
#     """List all PDFs in the bucket"""
#     response = supabase.storage.from_(BUCKET_NAME).list()
#     return [file['name'] for file in response if file['name'].endswith('.pdf')]

# def download_pdf(file_name):
#     """Download a PDF file from the bucket and return it as bytes"""
#     response = supabase.storage.from_(BUCKET_NAME).download(file_name)
#     return response

# def get_pdf_as_file(file_name):
#     """Download a PDF file and save it to a temporary file"""
#     pdf_bytes = download_pdf(file_name)
    
#     # Create a temporary file
#     temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
#     temp_file.write(pdf_bytes)
#     temp_file.close()
    
#     return temp_file.name

# def process_pdf_from_supabase(file_name):
#     """Process a single PDF from Supabase and extract its text"""
#     # Download the PDF bytes
#     pdf_bytes = download_pdf(file_name)
    
#     # Extract text from the PDF
#     text = extract_text_from_pdf(pdf_bytes)
#     return text

# def get_all_pdf_texts():
#     """Get text from all PDFs in the bucket"""
#     all_pdfs = list_all_pdfs()
#     result = {}
    
#     for pdf_name in all_pdfs:
#         result[pdf_name] = process_pdf_from_supabase(pdf_name)
        
#     return result

# # Existing PDF processing functions
# def extract_text_from_pdf(pdf_bytes):
#     """Extract text from PDF bytes"""
#     try:
#         pdf_reader = PdfReader(io.BytesIO(pdf_bytes))
#         text = ""
#         for page in pdf_reader.pages:
#             text += page.extract_text() + "\n"
#         return text
#     except Exception as e:
#         raise Exception(f"Error extracting text from PDF: {str(e)}")

# def generate_similarity_paragraph_stream(pdf_bytes1, pdf_bytes2):
#     """Generate a similarity analysis paragraph between two PDFs with streaming response"""
#     text1 = extract_text_from_pdf(pdf_bytes1)
#     text2 = extract_text_from_pdf(pdf_bytes2)
    
#     max_chars = 10000
#     if len(text1) > max_chars:
#         text1 = text1[:max_chars] + "... [truncated]"
#     if len(text2) > max_chars:
#         text2 = text2[:max_chars] + "... [truncated]"
    
#     prompt = f"""
#     I have two research papers. Here are extracts from both:
    
#     PAPER 1:
#     {text1}
    
#     PAPER 2:
#     {text2}
    
#     Compare these two research papers and analyze their similarities and differences in terms of:
#     1. Research topics and focus areas
#     2. Methodologies used
#     3. Key findings and conclusions
#     4. Potential areas of complementarity or contradiction
    
#     Write a comprehensive paragraph that explains how these papers are related to each other.
#     """
    
#     model = genai.GenerativeModel('models/gemini-2.0-flash')
#     response = model.generate_content(prompt, stream=True)
    
#     for chunk in response:
#         if chunk.text:
#             yield chunk.text

# def compare_supabase_papers(paper1_name, paper2_name):
#     """Compare two papers from Supabase storage and generate similarity analysis"""
#     # Download both papers
#     pdf_bytes1 = download_pdf(paper1_name)
#     pdf_bytes2 = download_pdf(paper2_name)
    
#     # Use existing function to generate similarity paragraph
#     return generate_similarity_paragraph_stream(pdf_bytes1, pdf_bytes2)

import io
from PyPDF2 import PdfReader
import google.generativeai as genai
from dotenv import load_dotenv
import os
import json
import tempfile
from supabase import create_client

# RAG pipeline imports
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain.schema import Document

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
supabase = create_client(supabase_url, supabase_key)

# Name of your bucket containing PDFs
BUCKET_NAME = "pdfs"  # Change this to match your actual bucket name

# Supabase functions
def list_all_pdfs():
    """List all PDFs in the bucket"""
    response = supabase.storage.from_(BUCKET_NAME).list()
    return [file['name'] for file in response if file['name'].endswith('.pdf')]

def download_pdf(file_name):
    """Download a PDF file from the bucket and return it as bytes"""
    response = supabase.storage.from_(BUCKET_NAME).download(file_name)
    return response

def get_pdf_as_file(file_name):
    """Download a PDF file and save it to a temporary file"""
    pdf_bytes = download_pdf(file_name)
    
    # Create a temporary file
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
    temp_file.write(pdf_bytes)
    temp_file.close()
    
    return temp_file.name

def process_pdf_from_supabase(file_name):
    """Process a single PDF from Supabase and extract its text"""
    # Download the PDF bytes
    pdf_bytes = download_pdf(file_name)
    
    # Extract text from the PDF
    text = extract_text_from_pdf(pdf_bytes)
    return text

def get_all_pdf_texts():
    """Get text from all PDFs in the bucket"""
    all_pdfs = list_all_pdfs()
    result = {}
    
    for pdf_name in all_pdfs:
        result[pdf_name] = process_pdf_from_supabase(pdf_name)
        
    return result

# PDF processing functions
def extract_text_from_pdf(pdf_bytes):
    """Extract text from PDF bytes"""
    try:
        pdf_reader = PdfReader(io.BytesIO(pdf_bytes))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        raise Exception(f"Error extracting text from PDF: {str(e)}")

def generate_similarity_paragraph_stream(pdf_bytes1, pdf_bytes2):
    """Generate a similarity analysis paragraph between two PDFs with streaming response"""
    text1 = extract_text_from_pdf(pdf_bytes1)
    text2 = extract_text_from_pdf(pdf_bytes2)
    
    max_chars = 10000
    if len(text1) > max_chars:
        text1 = text1[:max_chars] + "... [truncated]"
    if len(text2) > max_chars:
        text2 = text2[:max_chars] + "... [truncated]"
    
    prompt = f"""
    I have two research papers. Here are extracts from both:
    
    PAPER 1:
    {text1}
    
    PAPER 2:
    {text2}
    
    Compare these two research papers and analyze their similarities and differences in terms of:
    1. Research topics and focus areas
    2. Methodologies used
    3. Key findings and conclusions
    4. Potential areas of complementarity or contradiction
    
    Write a comprehensive paragraph that explains how these papers are related to each other.
    """
    
    model = genai.GenerativeModel('models/gemini-2.0-flash')
    response = model.generate_content(prompt, stream=True)
    
    for chunk in response:
        if chunk.text:
            yield chunk.text

def compare_supabase_papers(paper1_name, paper2_name):
    """Compare two papers from Supabase storage and generate similarity analysis"""
    # Download both papers
    pdf_bytes1 = download_pdf(paper1_name)
    pdf_bytes2 = download_pdf(paper2_name)
    
    # Use existing function to generate similarity paragraph
    return generate_similarity_paragraph_stream(pdf_bytes1, pdf_bytes2)

# RAG Pipeline implementation
class RAGPipeline:
    # def __init__(self):
    #     self.text_splitter = RecursiveCharacterTextSplitter(
    #         chunk_size=1000,
    #         chunk_overlap=100
    #     )
    #     self.embeddings = GoogleGenerativeAIEmbeddings(
    #         model="models/embedding-001"
    #     )
    #     self.vector_store = None
    # Find the RAGPipeline.__init__ method and replace it with this:

    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=100
        )
        
        # Use HuggingFace embeddings instead of Google's embeddings
        from langchain_community.embeddings import HuggingFaceEmbeddings
        self.embeddings = HuggingFaceEmbeddings(
            model_name="all-MiniLM-L6-v2"
        )
        self.vector_store = None
        
    def process_all_pdfs(self):
        """Process all PDFs from Supabase and create a vector store"""
        all_pdfs = list_all_pdfs()
        
        all_documents = []
        for pdf_name in all_pdfs:
            # Download PDF bytes
            pdf_bytes = download_pdf(pdf_name)
            
            # Extract text
            text = extract_text_from_pdf(pdf_bytes)
            
            # Split into chunks
            chunks = self.text_splitter.split_text(text)
            
            # Convert to LangChain Document objects with metadata
            documents = [Document(page_content=chunk, metadata={"source": pdf_name}) for chunk in chunks]
            all_documents.extend(documents)
        
        # Create vector store
        self.vector_store = Chroma.from_documents(
            documents=all_documents,
            embedding=self.embeddings,
            persist_directory="./chroma_db"
        )
        
        return len(all_documents)
    
    def process_single_pdf(self, pdf_name):
        """Process a single PDF and add it to the vector store"""
        # Download PDF bytes
        pdf_bytes = download_pdf(pdf_name)
        
        # Extract text
        text = extract_text_from_pdf(pdf_bytes)
        
        # Split into chunks
        chunks = self.text_splitter.split_text(text)
        
        # Convert to LangChain Document objects with metadata
        documents = [Document(page_content=chunk, metadata={"source": pdf_name}) for chunk in chunks]
        
        # Create or update vector store
        if self.vector_store is None:
            self.vector_store = Chroma.from_documents(
                documents=documents,
                embedding=self.embeddings,
                persist_directory="./chroma_db"
            )
        else:
            self.vector_store.add_documents(documents)
            
        return len(chunks)
    
    def query(self, question, top_k=5):
        """Query the vector store for relevant documents"""
        if self.vector_store is None:
            raise ValueError("Vector store not initialized. Process PDFs first.")
        
        relevant_docs = self.vector_store.similarity_search(question, k=top_k)
        return relevant_docs
    
    def generate_answer(self, question, context_docs):
        """Generate an answer using Gemini with retrieved context"""
        # Format the context from retrieved documents
        context = "\n\n".join([f"Document {i+1} (from {doc.metadata.get('source', 'Unknown')}):\n{doc.page_content}" 
                              for i, doc in enumerate(context_docs)])
        
        # Prepare the prompt
        prompt = f"""
        I need you to answer the following question based on the provided context from research papers.
        
        Question: {question}
        
        Context from research papers:
        {context}
        
        Please provide a comprehensive answer based solely on the information in the context. 
        If the context doesn't contain enough information to answer the question, please state that clearly.
        """
        
        # Generate the answer using Gemini
        model = genai.GenerativeModel('models/gemini-1.5-pro')
        response = model.generate_content(prompt)
        
        return response.text
    
    # Add this method to your RAGPipeline class
    def generate_answer_stream(self, question, context_docs):
        """Generate a streaming answer using Gemini with retrieved context"""
        # Format the context from retrieved documents
        context = "\n\n".join([f"Document {i+1} (from {doc.metadata.get('source', 'Unknown')}):\n{doc.page_content}" 
                            for i, doc in enumerate(context_docs)])
        
        # Prepare the prompt
        prompt = f"""
        I need you to answer the following question based on the provided context from research papers.
        
        Question: {question}
        
        Context from research papers:
        {context}
        
        Please provide a comprehensive answer based solely on the information in the context. 
        If the context doesn't contain enough information to answer the question, please state that clearly.
        """
        
        # Generate the answer using Gemini with streaming enabled
        model = genai.GenerativeModel('models/gemini-1.5-pro')
        response = model.generate_content(prompt, stream=True)
        
        for chunk in response:
            if chunk.text:
                yield chunk.text