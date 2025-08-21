from pydantic.v1 import BaseModel, Field, validator
from embeddings import BaseEmbedding, EmbeddingConfig
from sentence_transformers import SentenceTransformer
from typing import List, Union
import numpy as np

class SentenceTransformerEmbedding(BaseEmbedding):
    def __init__(self, name: str = 'BAAI/bge-m3'):
        super().__init__(name)
        self.embedding_model = SentenceTransformer(name)

    def encode(self, texts: Union[str, List[str]]) -> Union[List[float], List[List[float]]]:
        """
        Encode text(s) to embeddings
        
        Args:
            texts: Single string or list of strings to encode
            
        Returns:
            If single string: List[float] - single embedding
            If list of strings: List[List[float]] - list of embeddings
        """
        if isinstance(texts, str):
            # Single string input
            embedding = self.embedding_model.encode(texts)
            return embedding.tolist()
        else:
            # List of strings input
            embeddings = self.embedding_model.encode(texts)
            return [emb.tolist() for emb in embeddings]
