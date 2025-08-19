#!/usr/bin/env python3
"""
Sample LLM integration script for Adobe Hackathon
Supports multiple providers: Gemini, OpenAI, Ollama
"""

import os
import json
from typing import Optional, Dict, Any

def chat_with_llm(
    prompt: str,
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 1000
) -> str:
    """
    Chat with LLM using environment variables for configuration
    
    Args:
        prompt: The input prompt
        model: Model name (optional, uses env default)
        temperature: Sampling temperature
        max_tokens: Maximum response tokens
        
    Returns:
        LLM response as string
    """
    provider = os.getenv('LLM_PROVIDER', 'gemini').lower()
    
    try:
        if provider == 'gemini':
            return _chat_with_gemini(prompt, model, temperature, max_tokens)
        elif provider == 'openai':
            return _chat_with_openai(prompt, model, temperature, max_tokens)
        elif provider == 'ollama':
            return _chat_with_ollama(prompt, model, temperature, max_tokens)
        else:
            raise ValueError(f"Unsupported LLM provider: {provider}")
    except Exception as e:
        print(f"LLM chat error: {e}")
        return "I apologize, but I could not process your request at this time."

def _chat_with_gemini(prompt: str, model: Optional[str], temperature: float, max_tokens: int) -> str:
    """Chat with Google Gemini"""
    try:
        import google.generativeai as genai
        
        # Configure API
        credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
        if credentials_path:
            os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = credentials_path
        
        api_key = os.getenv('GOOGLE_API_KEY')
        if api_key:
            genai.configure(api_key=api_key)
        
        # Get model
        model_name = model or os.getenv('GEMINI_MODEL', 'gemini-2.5-flash')
        model_obj = genai.GenerativeModel(model_name)
        
        # Generate response
        response = model_obj.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
            )
        )
        
        return response.text
        
    except ImportError:
        raise Exception("google-generativeai package not installed")
    except Exception as e:
        raise Exception(f"Gemini API error: {e}")

def _chat_with_openai(prompt: str, model: Optional[str], temperature: float, max_tokens: int) -> str:
    """Chat with OpenAI"""
    try:
        import openai
        
        client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        model_name = model or os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
        
        response = client.chat.completions.create(
            model=model_name,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        return response.choices[0].message.content or ""
        
    except ImportError:
        raise Exception("openai package not installed")
    except Exception as e:
        raise Exception(f"OpenAI API error: {e}")

def _chat_with_ollama(prompt: str, model: Optional[str], temperature: float, max_tokens: int) -> str:
    """Chat with Ollama (local)"""
    try:
        import requests
        
        ollama_url = os.getenv('OLLAMA_URL', 'http://localhost:11434')
        model_name = model or os.getenv('OLLAMA_MODEL', 'llama3')
        
        response = requests.post(
            f"{ollama_url}/api/generate",
            json={
                "model": model_name,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "num_predict": max_tokens
                }
            },
            timeout=60
        )
        
        response.raise_for_status()
        return response.json().get('response', '')
        
    except ImportError:
        raise Exception("requests package not installed")
    except Exception as e:
        raise Exception(f"Ollama API error: {e}")

if __name__ == "__main__":
    import sys
    import json
    
    try:
        # Read JSON input from stdin
        input_data = json.loads(sys.stdin.read())
        prompt = input_data.get('prompt', '')
        temperature = input_data.get('temperature', 0.7)
        max_tokens = input_data.get('max_tokens', 1000)
        
        if not prompt:
            print("Error: No prompt provided", file=sys.stderr)
            sys.exit(1)
        
        response = chat_with_llm(prompt, temperature=temperature, max_tokens=max_tokens)
        print(response)
        
    except json.JSONDecodeError:
        print("Error: Invalid JSON input", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
