from .VectorDBEnums import VectorDBEnums
from .providers import QdrantDBProvider
from helpers.config import Settings

class VectorDBProviderFactory:

    def __init__(self, config: Settings):
        self.config = config

    def create(self, provider: str):
        if provider == VectorDBEnums.QDRANT.value:
            return QdrantDBProvider(
                url=self.config.VECTOR_DB_URL,
                distance_method=self.config.VECTOR_DB_DISTANCE_METHOD,
            )

        return None
