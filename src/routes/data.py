from fastapi import FastAPI, APIRouter, Depends, UploadFile, File, status
from fastapi.responses import JSONResponse
import os
from helpers.config import get_settings, Settings
from controllers import DataController, ProjectController, ProcessController
import aiofiles
from models import ResponseSignal
import logging
from .schemas.data import ProcessRequest

# Use standard logging instead of uvicorn.logging
logger = logging.getLogger("uvicorn.error")

data_router = APIRouter(
    prefix="/api/v1/data",
    tags=["api_v1", "data"],
    responses={404: {"description": "Not found"}},
)

@data_router.post("/upload/{project_id}")
async def upload_data(project_id: str, 
                      file: UploadFile = File(...), 
                      app_settings: Settings = Depends(get_settings)):
    
    # Validate the file properties
    is_valid, message = DataController().validate_uploaded_file(file=file)
    
    if not is_valid:
        return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, 
                            content={"message": message})
    
    # Generate unique filename
    data_controller = DataController()
    file_path, file_id = data_controller.generate_unique_filepath(
        original_filename=file.filename,
        project_id=project_id
    )
    
    # Write file asynchronously
    try:
        async with aiofiles.open(file_path, "wb") as f:
            while chunk := await file.read(app_settings.FILE_DEFAULT_CHUNK_SIZE):
                await f.write(chunk)
    except Exception as e:
        logger.error(f"Error while uploading file: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,  # Fixed status code
            content={"message": f"File upload failed: {str(e)}"}
        )
    
    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "message": ResponseSignal.FILE_UPLOAD_SUCCESS.value,
            "file_id": file_id,
        }
    )

@data_router.post("/process/{project_id}")
async def process_endpoint(project_id: str, process_request: ProcessRequest):
    file_id = process_request.file_id
    chunk_size = process_request.chunk_size
    overlap_size = process_request.overlap_size

    process_controller = ProcessController(project_id=project_id)

    try:
        file_content = process_controller.get_file_content(file_id=file_id)
        chunks = process_controller.process_file_content(
            file_content=file_content,
            file_id=file_id,
            chunk_size=chunk_size,
            overlap_size=overlap_size
        )
        
        # Here you would typically save the chunks to a database or vector store
        
        if chunks is None or len(chunks) == 0:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "message": ResponseSignal.FILE_PROCESSING_FAILURE.value,
                }
            )
        
        return chunks
    
    except Exception as e:
        logger.error(f"Error while processing file: {str(e)}")
        return JSONResponse(
            status_code=ResponseSignal.FILE_PROCESSING_FAILURE.value,
            content={"message": f"File processing failed: {str(e)}"}
        )