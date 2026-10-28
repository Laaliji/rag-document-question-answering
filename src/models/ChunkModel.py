from .BaseDataModel import BaseDataModel
from .db_schemas import DataChunk
from .enums.DatabaseEnum import DatabaseEnum
from bson.objectid import ObjectId

class ChunkModel(BaseDataModel):

    def __init__(self, db_client: object):
        super().__init__(db_client=db_client)
        self.collection = self.db_client[DatabaseEnum.COLLECTION_CHUNK_NAME.value]

    async def init_collection(self):
        """
        Create the indexes of the chunks collection (no-op if they already exist).
        """
        await self.collection.create_index("chunk_project_id")
        await self.collection.create_index("chunk_asset_id")

    async def insert_many_chunks(self, chunks: list[DataChunk], batch_size: int = 100):
        """
        Insert chunks in batches to avoid sending one huge request to MongoDB.
        """
        for i in range(0, len(chunks), batch_size):
            batch = [
                chunk.model_dump(by_alias=True, exclude_none=True)
                for chunk in chunks[i:i + batch_size]
            ]
            await self.collection.insert_many(batch)

        return len(chunks)

    async def delete_chunks_by_project_id(self, project_id: ObjectId):
        """
        Delete all chunks of a project, returns the number of deleted chunks.
        """
        result = await self.collection.delete_many({"chunk_project_id": project_id})
        return result.deleted_count

    async def delete_chunks_by_asset_id(self, asset_id: ObjectId):
        """
        Delete all chunks of one file (asset), returns the number of deleted chunks.
        """
        result = await self.collection.delete_many({"chunk_asset_id": asset_id})
        return result.deleted_count

    async def get_project_chunks(self, project_id: ObjectId, page_no: int = 1, page_size: int = 50):
        """
        Return one page of a project's chunks, ordered so pages are stable.
        """
        records = await self.collection.find({"chunk_project_id": project_id})             .sort("_id", 1)             .skip((page_no - 1) * page_size)             .limit(page_size)             .to_list(length=None)

        return [DataChunk(**record) for record in records]
