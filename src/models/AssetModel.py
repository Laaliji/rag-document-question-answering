from .BaseDataModel import BaseDataModel
from .db_schemas import Asset
from .enums.DatabaseEnum import DatabaseEnum
from bson.objectid import ObjectId

class AssetModel(BaseDataModel):

    def __init__(self, db_client: object):
        super().__init__(db_client=db_client)
        self.collection = self.db_client[DatabaseEnum.COLLECTION_ASSET_NAME.value]

    async def init_collection(self):
        """
        Create the indexes of the assets collection (no-op if they already exist).
        """
        await self.collection.create_index("asset_project_id")
        await self.collection.create_index(
            [("asset_project_id", 1), ("asset_name", 1)], unique=True
        )

    async def create_asset(self, asset: Asset):
        """
        Create a new asset (uploaded file record) in the database.
        """
        asset_dict = asset.model_dump(by_alias=True, exclude_none=True)
        result = await self.collection.insert_one(asset_dict)
        asset.id = result.inserted_id
        return asset

    async def get_all_project_assets(self, asset_project_id: ObjectId, asset_type: str):
        """
        Return all assets of a project with the given type.
        """
        records = await self.collection.find({
            "asset_project_id": asset_project_id,
            "asset_type": asset_type,
        }).to_list(length=None)

        return [Asset(**record) for record in records]

    async def get_asset_record(self, asset_project_id: ObjectId, asset_name: str):
        """
        Return one asset of a project by its name, or None if it does not exist.
        """
        record = await self.collection.find_one({
            "asset_project_id": asset_project_id,
            "asset_name": asset_name,
        })

        return Asset(**record) if record else None
