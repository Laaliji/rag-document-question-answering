from fastapi import FastAPI, APIRouter, Depends, UploadFile, File, Path, Request, status
from fastapi.responses import JSONResponse
import os
from helpers.config import get_settings, Settings
from controllers import DataController, ProjectController, ProcessController
import aiofiles
from models import ResponseSignal, ProjectModel, ChunkModel, AssetModel, AssetTypeEnum
from models.db_schemas import DataChunk, Asset
import logging
from .schemas.data import ProcessRequest

# Use standard logging instead of uvicorn.logging
logger = logging.getLogger("uvicorn.error")

data_router = APIRouter(
    prefix="/api/v1/data",
    tags=["api_v1", "data"],
    responses={404: {"description": "Not found"}},
)

# project_id is used as a folder name, so only allow alphanumeric values (FastAPI returns 422 otherwise)
ProjectIdPath = Path(..., pattern=r"^[a-zA-Z0-9]+$")

@data_router.post("/upload/{project_id}")
async def upload_data(request: Request,
                      project_id: str = ProjectIdPath,
                      file: UploadFile = File(...),
                      app_settings: Settings = Depends(get_settings)):

    data_controller = DataController()

    # Validate the file properties
    is_valid, message = data_controller.validate_uploaded_file(file=file)

    if not is_valid:
        return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST,
                            content={"message": message})

    # Generate unique filename
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

    # Record the uploaded file in the assets collection
    project_model = ProjectModel(db_client=request.app.db_client)
    project = await project_model.get_project_or_create_one(project_id=project_id)

    asset_model = AssetModel(db_client=request.app.db_client)
    asset = await asset_model.create_asset(Asset(
        asset_project_id=project.id,
        asset_type=AssetTypeEnum.FILE.value,
        asset_name=file_id,
        asset_size=os.path.getsize(file_path),
    ))

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "message": ResponseSignal.FILE_UPLOAD_SUCCESS.value,
            "file_id": file_id,
            "asset_id": str(asset.id),
        }
    )

@data_router.post("/process/{project_id}")
async def process_endpoint(request: Request, process_request: ProcessRequest,
                           project_id: str = ProjectIdPath):
    file_id = process_request.file_id
    chunk_size = process_request.chunk_size
    overlap_size = process_request.overlap_size
    do_reset = process_request.do_reset

    project_model = ProjectModel(db_client=request.app.db_client)
    project = await project_model.get_project_or_create_one(project_id=project_id)

    asset_model = AssetModel(db_client=request.app.db_client)

    # Process one file if file_id is given, otherwise every file of the project
    if file_id:
        asset = await asset_model.get_asset_record(asset_project_id=project.id, asset_name=file_id)
        if asset is None:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"message": ResponseSignal.FILE_NOT_FOUND.value}
            )
        assets = [asset]
    else:
        assets = await asset_model.get_all_project_assets(
            asset_project_id=project.id, asset_type=AssetTypeEnum.FILE.value
        )
        if len(assets) == 0:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"message": ResponseSignal.NO_FILES_ERROR.value}
            )

    process_controller = ProcessController(project_id=project_id)
    chunk_model = ChunkModel(db_client=request.app.db_client)

    deleted_chunks = 0
    if do_reset == 1:
        deleted_chunks = await chunk_model.delete_chunks_by_project_id(project_id=project.id)

    inserted_chunks = 0
    processed_files = 0
    failed_files = []

    for asset in assets:
        # Skip records whose file is missing on disk
        if process_controller.get_file_path(file_id=asset.asset_name) is None:
            logger.error(f"File not found on disk: {asset.asset_name}")
            failed_files.append(asset.asset_name)
            continue

        try:
            file_content = process_controller.get_file_content(file_id=asset.asset_name)
            if file_content is None:
                failed_files.append(asset.asset_name)
                continue

            chunks = process_controller.process_file_content(
                file_content=file_content,
                file_id=asset.asset_name,
                chunk_size=chunk_size,
                overlap_size=overlap_size
            )
        except Exception as e:
            logger.error(f"Error while processing file {asset.asset_name}: {str(e)}")
            failed_files.append(asset.asset_name)
            continue

        if chunks is None or len(chunks) == 0:
            failed_files.append(asset.asset_name)
            continue

        file_chunks_records = [
            DataChunk(
                chunk_project_id=project.id,
                chunk_asset_id=asset.id,
                chunk_text=chunk.page_content,
                chunk_metadata=chunk.metadata,
                chunk_order=i + 1,
            )
            for i, chunk in enumerate(chunks)
        ]

        # Re-processing a file replaces its old chunks instead of duplicating them
        if do_reset != 1:
            deleted_chunks += await chunk_model.delete_chunks_by_asset_id(asset_id=asset.id)

        inserted_chunks += await chunk_model.insert_many_chunks(chunks=file_chunks_records)
        processed_files += 1

    if processed_files == 0:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "message": ResponseSignal.FILE_PROCESSING_FAILURE.value,
                "failed_files": failed_files,
            }
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "message": ResponseSignal.FILE_PROCESSING_SUCCESS.value,
            "inserted_chunks": inserted_chunks,
            "deleted_chunks": deleted_chunks,
            "processed_files": processed_files,
            "failed_files": failed_files,
        }
    )
