from abc import ABC, abstractmethod
from typing import List, Optional

class VectorDBInterface(ABC):

    @abstractmethod
    async def connect(self):
        pass

    @abstractmethod
    async def disconnect(self):
        pass

    @abstractmethod
    async def is_collection_existed(self, collection_name: str) -> bool:
        pass

    @abstractmethod
    async def get_collection_info(self, collection_name: str) -> Optional[dict]:
        pass

    @abstractmethod
    async def delete_collection(self, collection_name: str):
        pass

    @abstractmethod
    async def create_collection(self, collection_name: str, embedding_size: int,
                                do_reset: bool = False):
        pass

    @abstractmethod
    async def insert_many(self, collection_name: str, texts: List[str],
                          vectors: List[list], metadata: List[dict],
                          record_ids: List[str]):
        pass

    @abstractmethod
    async def search_by_vector(self, collection_name: str, vector: list, limit: int):
        pass
