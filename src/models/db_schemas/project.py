from pydantic import BaseModel, Field, field_validator
from typing import Optional
from bson.objectid import ObjectId

class Project(BaseModel):
    # Pydantic treats "_id" as a private attribute, so we expose it as "id" with alias "_id"
    id: Optional[ObjectId] = Field(None, alias="_id")
    project_id: str = Field(..., min_length=1)

    @field_validator("project_id")
    @classmethod
    def validate_project_id(cls, value):
        if not value.isalnum():
            raise ValueError("Project ID must be alphanumeric.")
        return value

    class Config:  # Allow arbitrary types like ObjectId
        arbitrary_types_allowed = True ## This because Pydantic does not natively support ObjectId, so we need to allow arbitrary types. So, It will just ignore the type checking for ObjectId and allow it to be used as a field in the model.
        populate_by_name = True  # allow both Project(id=...) and Project(_id=...) (Mongo records)
