import numpy as np

class SemanticRouter():
    def __init__(self, embedding, routes):
        self.routes = routes
        self.embedding = embedding
        self.routesEmbedding = {}

        for route in self.routes:
            # Encode all samples for this route
            route_embeddings = self.embedding.encode(route.samples)
            # Ensure it's a numpy array
            self.routesEmbedding[route.name] = np.array(route_embeddings)

    def get_routes(self):
        return self.routes

    def guide(self, query):
        # Encode single query - should return a single embedding
        queryEmbedding = self.embedding.encode(query)  # Remove the list wrapper
        queryEmbedding = np.array(queryEmbedding)
        queryEmbedding = queryEmbedding / np.linalg.norm(queryEmbedding)
        scores = []

        # Calculate the cosine similarity of the query embedding with the sample embeddings of the router.

        for route in self.routes:
            routesEmbedding = np.array(self.routesEmbedding[route.name])
            # Normalize each route embedding
            routesEmbedding = routesEmbedding / np.linalg.norm(routesEmbedding, axis=1, keepdims=True)
            # Calculate similarity with all samples and take mean
            similarities = np.dot(routesEmbedding, queryEmbedding)
            score = np.mean(similarities)
            scores.append((score, route.name))

        scores.sort(reverse=True)
        return scores[0]
    
    def guide_with_all_scores(self, query):
        """Return all scores for debugging purposes"""
        # Encode single query - should return a single embedding
        queryEmbedding = self.embedding.encode(query)  # Remove the list wrapper
        queryEmbedding = np.array(queryEmbedding)
        queryEmbedding = queryEmbedding / np.linalg.norm(queryEmbedding)
        scores = []

        # Calculate the cosine similarity of the query embedding with the sample embeddings of the router.

        for route in self.routes:
            routesEmbedding = np.array(self.routesEmbedding[route.name])
            # Normalize each route embedding
            routesEmbedding = routesEmbedding / np.linalg.norm(routesEmbedding, axis=1, keepdims=True)
            # Calculate similarity with all samples and take mean
            similarities = np.dot(routesEmbedding, queryEmbedding)
            score = np.mean(similarities)
            scores.append((score, route.name))

        scores.sort(reverse=True)
        return scores  # Return all scores