import requests
import json
from typing import List, Dict, Any, Optional, Iterator

class LmStudioClient:
    def __init__(self, base_url: str = "http://localhost:1234", model: str = "gpt-oss-20b"):
        self.base_url = base_url.rstrip('/')  # Remove trailing slash if any
        self.model = model
        self.chat_endpoint = f"{self.base_url}/v1/chat/completions"
        self.completions_endpoint = f"{self.base_url}/v1/completions"
        self.models_endpoint = f"{self.base_url}/v1/models"
        
        print(f"🔧 LmStudioClient initialized:")
        print(f"  - Base URL: {self.base_url}")
        print(f"  - Model: {self.model}")
        print(f"  - Chat endpoint: {self.chat_endpoint}")
        print(f"  - Completions endpoint: {self.completions_endpoint}")
    
    def generate_content_stream(self, messages: List[Dict[str, str]]) -> Iterator[str]:
        """Generate content with streaming support"""
        print(f"\n🤖 Generating streaming content with LM Studio...")
        print(f"  - Messages count: {len(messages)}")
        
        # Using OpenAI-compatible API endpoint with GPT-OSS-20B optimized settings
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": True,
            "temperature": 0.7,
            "max_tokens": 2048,
            "top_p": 0.9,
            "frequency_penalty": 0.1,
            "presence_penalty": 0.1,
            "stop": ["<|endoftext|>", "</s>"]
        }
        
        try:
            print(f"  - Sending streaming request to LM Studio... (timeout: 180s)")
            response = requests.post(self.chat_endpoint, json=payload, stream=True, timeout=180)
            response.raise_for_status()
            
            for line in response.iter_lines():
                if line:
                    line = line.decode('utf-8')
                    if line.startswith('data: '):
                        line = line[6:]  # Remove 'data: ' prefix
                        if line.strip() == '[DONE]':
                            break
                        try:
                            chunk_data = json.loads(line)
                            choices = chunk_data.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            continue
            
            print(f"✅ LM Studio streaming successful")
            print("--------------------------------------")

        except requests.exceptions.Timeout as e:
            print(f"  ⏰ LM Studio timeout error: {str(e)}")
            raise Exception(f"LM Studio API timeout: {str(e)}")
        except requests.exceptions.ConnectionError as e:
            print(f"  🔌 Connection error: {str(e)}")
            raise Exception(f"Cannot connect to LM Studio server at {self.base_url}. Is LM Studio running?")
        except requests.exceptions.RequestException as e:
            print(f"  ❌ Request error: {str(e)}")
            raise Exception(f"LM Studio API error: {str(e)}")
        except Exception as e:
            print(f"  💥 Unexpected error: {str(e)}")
            raise Exception(f"LM Studio streaming error: {str(e)}")

    def generate_content(self, messages: List[Dict[str, str]]) -> 'LmStudioResponse':
        print(f"\n🤖 Generating with LM Studio...")
        print(f"  - Messages count: {len(messages)}")
        
        # Using OpenAI-compatible API endpoint with GPT-OSS-20B optimized settings
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "temperature": 0.7,
            "max_tokens": 2048,
            "top_p": 0.9,
            "frequency_penalty": 0.1,
            "presence_penalty": 0.1,
            "stop": ["<|endoftext|>", "</s>"]
        }
        
        try:
            print(f"  - Sending request to LM Studio... (timeout: 180s)")
            response = requests.post(self.chat_endpoint, json=payload, timeout=180)
            response.raise_for_status()
            result = response.json()
            
            choices = result.get("choices", [])
            if choices:
                content = choices[0].get("message", {}).get("content", "")
                print(f"  ✅ LM Studio successful, response length: {len(content)}")
                return LmStudioResponse(content)
            else:
                raise Exception("No response choices from LM Studio")

        except requests.exceptions.Timeout as e:
            print(f"  ⏰ LM Studio timeout error: {str(e)}")
            raise Exception(f"LM Studio API timeout: {str(e)}")
        except requests.exceptions.ConnectionError as e:
            print(f"  🔌 Connection error: {str(e)}")
            raise Exception(f"Cannot connect to LM Studio server at {self.base_url}. Is LM Studio running?")
        except requests.exceptions.RequestException as e:
            print(f"  ❌ Request error: {str(e)}")
            raise Exception(f"LM Studio API error: {str(e)}")
        except Exception as e:
            print(f"  💥 Unexpected error: {str(e)}")
            raise Exception(f"LM Studio error: {str(e)}")
    
    def chat_stream(self, messages: List[Dict[str, str]]) -> Iterator[str]:
        """Stream chat responses"""
        try:
            yield from self.generate_content_stream(messages)
        except Exception as e:
            raise Exception(f"Chat stream error: {str(e)}")
    
    def chat(self, messages: List[Dict[str, str]]) -> str:
        try:
            response = self.generate_content(messages)
            return response.text
        except Exception as e:
            raise Exception(f"Chat error: {str(e)}")
    
    def health_check(self) -> bool:
        """Check if the LM Studio server is healthy"""
        try:
            print(f"🔍 Checking LM Studio server health...")
            # Try multiple endpoints
            endpoints_to_check = [
                f"{self.base_url}/v1/models",
                f"{self.base_url}/health",
                f"{self.base_url}"
            ]
            
            for endpoint in endpoints_to_check:
                try:
                    print(f"  - Trying {endpoint}...")
                    response = requests.get(endpoint, timeout=10)
                    if response.status_code == 200:
                        print(f"  ✅ LM Studio server is healthy (responded from {endpoint})")
                        return True
                except:
                    continue
            
            print(f"  ❌ LM Studio server health check failed")
            return False
        except Exception as e:
            print(f"  💥 Health check error: {str(e)}")
            return False

    def get_available_models(self) -> List[str]:
        """Get list of available models from LM Studio"""
        try:
            print(f"🔍 Getting available models from LM Studio...")
            response = requests.get(self.models_endpoint, timeout=10)
            response.raise_for_status()
            result = response.json()
            
            models = []
            if "data" in result:
                for model in result["data"]:
                    models.append(model.get("id", ""))
            
            print(f"  ✅ Found {len(models)} models: {models}")
            return models
        except Exception as e:
            print(f"  ❌ Error getting models: {str(e)}")
            return []

class LmStudioResponse:
    def __init__(self, text: str):
        self.text = text.strip()
        self.content = self.text  # For compatibility with other clients
