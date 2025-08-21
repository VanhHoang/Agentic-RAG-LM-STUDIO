import pymongo
from IPython.display import Markdown
import textwrap
from embeddings import SentenceTransformerEmbedding
from typing import List, Dict, Any
from format_api import LmStudioClient

class RAG():
    def __init__(self, 
            mongodbUri: str,
            dbName: str,
            dbCollection: str,
            llm: LmStudioClient,
            embeddingName: str ='BAAI/bge-m3',
        ):
        self.client = pymongo.MongoClient(mongodbUri)
        self.db = self.client[dbName] 
        self.collection = self.db[dbCollection]
        self.embedding_model = SentenceTransformerEmbedding(
            name=embeddingName
        )
        self.llm = llm

    def get_embedding(self, text):
        if not text.strip():
            return []

        print(f"🧮 Generating embedding for text: '{text[:50]}{'...' if len(text) > 50 else ''}'")
        
        # SentenceTransformerEmbedding.encode can handle both single string and list of strings
        # For single string, it returns a single embedding as List[float]
        embedding = self.embedding_model.encode(text)
        
        print(f"✅ Embedding generated successfully (dimension: {len(embedding)})")
        return embedding

    def vector_search(
            self, 
            user_query: str, 
            limit=4):
        """
        Perform a vector search in the MongoDB collection based on the user query.

        Args:
        user_query (str): The user's query string.

        Returns:
        list: A list of matching documents.
        """
        print(f"\n🔍 Starting vector search for: '{user_query}'")
        print(f"📊 Search limit: {limit}")

        # Generate embedding for the user query
        query_embedding = self.get_embedding(user_query)
        print(f"🧮 Generated embedding with dimension: {len(query_embedding)}")

        if query_embedding is None:
            print("❌ Invalid query or embedding generation failed.")
            return "Invalid query or embedding generation failed."

        # Define the vector search pipeline
        vector_search_stage = {
            "$vectorSearch": {
                "index": "vector_index",
                "queryVector": query_embedding,
                "path": "embedding",
                "numCandidates": 400,
                "limit": limit,
            }
        }

        unset_stage = {
            "$unset": "embedding" 
        }

        project_stage = {
            "$project": {
                "_id": 0,  
                "title": 1, 
                "product_specs": 1,
                "color_options": 1,
                "current_price": 1,
                "product_promotion": 1,
                "score": {
                    "$meta": "vectorSearchScore"
                }
            }
        }

        print(f"\n📋 VECTOR SEARCH PIPELINE DETAILS:")
        print(f"  - Index name: vector_index")
        print(f"  - Search path: embedding") 
        print(f"  - Embedding dimension: {len(query_embedding)}")
        print(f"  - Similarity: cosine")
        print(f"  - Num candidates: 400")
        print(f"  - Result limit: {limit}")

        pipeline = [vector_search_stage, unset_stage, project_stage]
        print(f"🔍 Executing MongoDB aggregation pipeline...")

        # Execute the search
        results = self.collection.aggregate(pipeline)
        results_list = list(results)
        
        print(f"✅ Vector search completed. Found {len(results_list)} results")
        return results_list

    def enhance_prompt(self, query: str) -> str:
        """Enhanced prompt with vector search results - only the best match"""
        print(f"\n🔍 VECTOR SEARCH RESULTS for query: '{query}'")
        print("=" * 60)
        
        get_knowledge = self.vector_search(query, 5)
        print(f"📊 Total results found: {len(get_knowledge)}")
        
        # Filter and find the best product
        valid_products = []
        
        for idx, result in enumerate(get_knowledge):
            print(f"\n📱 Result #{idx + 1}:")
            print(f"  - Title: {result.get('title', 'N/A')}")
            print(f"  - Price: {result.get('current_price', 'N/A')}")
            print(f"  - Colors: {result.get('color_options', 'N/A')}")
            specs_preview = str(result.get('product_specs', 'N/A')).replace('<br>', ' | ').replace('\n', ' | ')
            print(f"  - Specs: {specs_preview[:100]}{'...' if len(specs_preview) > 100 else ''}")
            print(f"  - Promotion: {result.get('product_promotion', 'N/A')}")
            print(f"  - Search Score: {result.get('score', 'N/A'):.4f}")
            
            # Only consider products with valid price and decent score
            if result.get('current_price') and result.get('score', 0) > 0.1:
                valid_products.append(result)
                if idx == 0:  # Mark the highest scoring one
                    print(f"  ⭐ BEST MATCH - Will be used for LLM")
            else:
                print(f"  ⚠️  Skipped (no price or low score)")
        
        # Use only the best product (highest score with valid price)
        enhanced_prompt = ""
        if valid_products:
            best_product = valid_products[0]  # Already sorted by score from MongoDB
            enhanced_prompt = f"Tên: {best_product.get('title')}"
            
            if best_product.get('current_price'):
                enhanced_prompt += f", Giá: {best_product.get('current_price')}"
            
            if best_product.get('color_options'):
                enhanced_prompt += f", Màu sắc: {best_product.get('color_options')}"
            
            if best_product.get('product_specs'):
                # Preserve original formatting with <br> and \n
                specs = best_product.get('product_specs')
                enhanced_prompt += f", Thông số kỹ thuật:\n{specs}"
            
            if best_product.get('product_promotion'):
                enhanced_prompt += f", Ưu đãi: {best_product.get('product_promotion')}"
            
            print(f"\n✅ Selected BEST product for LLM:")
            print(f"  - Title: {best_product.get('title')}")
            print(f"  - Price: {best_product.get('current_price')}")
            print(f"  - Colors: {best_product.get('color_options')}")
            if best_product.get('product_specs'):
                specs_display = best_product.get('product_specs').replace('<br>', ' | ').replace('\n', ' | ')
                print(f"  - Specs: {specs_display[:150]}{'...' if len(specs_display) > 150 else ''}")
            print(f"  - Full prompt length: {len(enhanced_prompt)} characters")
        else:
            print(f"\n❌ No valid products found!")
        
        print("=" * 60)
        
        return enhanced_prompt

    def generate_content_stream(self, messages: List[Dict[str, str]]):
        """Generate content with streaming using LM Studio for RAG responses"""
        try:
            yield from self.llm.chat_stream(messages)
        except Exception as e:
            raise Exception(f"RAG stream generation error: {str(e)}")

    def generate_content(self, messages: List[Dict[str, str]]):
        """Generate content using LM Studio for RAG responses"""
        try:
            return self.llm.generate_content(messages)
        except Exception as e:
            raise Exception(f"RAG generation error: {str(e)}")
    
    def _to_markdown(text):
        text = text.replace('•', '  *')
        return Markdown(textwrap.indent(text, '> ', predicate=lambda _: True))
