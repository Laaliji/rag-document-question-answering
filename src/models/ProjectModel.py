from .BaseDataModel import BaseDataModel
from .db_schemas import Project
from .enums.DatabaseEnum import DatabaseEnum

class ProjectModel(BaseDataModel):

    def __init__(self, db_client: object):
        super().__init__(db_client=db_client)
        self.collection = self.db_client[DatabaseEnum.COLLECTION_PROJECT_NAME.value]

    async def init_collection(self):
        """
        Create the indexes of the projects collection (no-op if they already exist).
        """
        await self.collection.create_index("project_id", unique=True)

    async def create_project(self, project: Project):
        """
        Create a new project in the database.
        """
        project_dict = project.model_dump(by_alias=True, exclude_none=True)
        result = await self.collection.insert_one(project_dict)
        project.id = result.inserted_id
        return project

    async def get_project_or_create_one(self, project_id: str):
        """
        Return the project with the given project_id, creating it if it does not exist.
        """
        record = await self.collection.find_one({"project_id": project_id})

        if record is None:
            return await self.create_project(Project(project_id=project_id))

        return Project(**record)
