from ..VectorDBInterface import VectorDBInterface
from ..VectorDBEnums import DistanceMethodEnums
from qdrant_client import AsyncQdrantClient, models
from typing import List, Optional
import logging
import uuid

class QdrantDBProvider(VectorDBInterface):

    def __init__(self, url: str, distance_method: str):
        self.url = url
        self.client = None

        if distance_method == DistanceMethodEnums.DOT.value:
            self.distance_method = models.Distance.DOT
        else:
            self.distance_method = models.Distance.COSINE

        self.logger = logging.getLogger("uvicorn.error")

    async def connect(self):
        self.client = AsyncQdrantClient(url=self.url)

    async def disconnect(self):
        if self.client is not None:
            await self.client.close()
        self.client = None

    async def is_collection_existed(self, collection_name: str) -> bool:
        return await self.client.collection_exists(collection_name=collection_name)

    async def get_collection_info(self, collection_name: str) -> Optional[dict]:
        if not await self.is_collection_existed(collection_name):
            return None

        info = await self.client.get_collection(collection_name=collection_name)
        return {
            "status": str(info.status.value),
            "points_count": info.points_count,
            "vector_size": info.config.params.vectors.size,
            "distance": str(info.config.params.vectors.distance.value),
        }

    async def delete_collection(self, collection_name: str):
        if await self.is_collection_existed(collection_name):
            return await self.client.delete_collection(collection_name=collection_name)

    async def create_collection(self, collection_name: str, embedding_size: int,
                                do_reset: bool = False):
        if do_reset:
            await self.delete_collection(collection_name=collection_name)

        if not await self.is_collection_existed(collection_name):
            await self.client.create_collection(
                collection_name=collection_name,
                vectors_config=models.VectorParams(size=embedding_size, distance=self.distance_method),
            )
            return True

        return False

    async def insert_many(self, collection_name: str, texts: List[str],
                          vectors: List[list], metadata: List[dict],
                          record_ids: List[str]):
        points = [
            models.PointStruct(
                # Qdrant ids must be int or UUID: derive a stable UUID from the chunk id,
                # so pushing the same chunk twice overwrites it instead of duplicating it
                id=str(uuid.uuid5(uuid.NAMESPACE_OID, record_ids[i])),
                vector=vectors[i],
                payload={"text": texts[i], "metadata": metadata[i], "chunk_id": record_ids[i]},
            )
            for i in range(len(texts))
        ]

        await self.client.upsert(collection_name=collection_name, points=points)
        return True

    async def search_by_vector(self, collection_name: str, vector: list, limit: int):
        result = await self.client.query_points(
            collection_name=collection_name,
            query=vector,
            limit=limit,
            with_payload=True,
        )

        return [
            {
                "score": point.score,
                "text": point.payload.get("text"),
                "metadata": point.payload.get("metadata"),
            }
            for point in result.points
        ]
