import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load your secret key
load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=API_KEY)

print("🔍 Scanning your Google API Key for available models...\n")

# Ask Google what models you have access to
try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"✅ FOUND MODEL: {m.name}")
except Exception as e:
    print(f"❌ API Error: {e}")