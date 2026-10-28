from fastapi import APIRouter, Path, Request, status
from fastapi.responses import JSONResponse
from controllers import NLPController
from models import ResponseSignal, ProjectModel, ChunkModel
from .schemas.nlp import PushRequest, SearchRequest
import logging

logger = logging.getLogger("uvicorn.error")

nlp_router = APIRouter(
    prefix="/api/v1/nlp",
    tags=["api_v1", "nlp"],
    responses={404: {"description": "Not found"}},
)

ProjectIdPath = Path(..., pattern=r"^[a-zA-Z0-9]+$")

def get_nlp_controller(request: Request):
    return NLPController(
        vectordb_client=request.app.vectordb_client,
        embedding_client=request.app.embedding_client,
    )

@nlp_router.post("/index/push/{project_id}")
async def index_project(request: Request, push_request: PushRequest,
                        project_id: str = ProjectIdPath):

    project = await ProjectModel(db_client=request.app.db_client).get_project(project_id=project_id)
    if project is None:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"message": ResponseSignal.PROJECT_NOT_FOUND.value}
        )

    chunk_model = ChunkModel(db_client=request.app.db_client)
    nlp_controller = get_nlp_controller(request)

    await nlp_controller.create_vector_db_collection(project=project, do_reset=push_request.do_reset == 1)

    # Embed chunks page by page so we never load the whole project in memory
    page_no = 1
    inserted_items = 0
    while True:
        chunks = await chunk_model.get_project_chunks(project_id=project.id, page_no=page_no)
        if len(chunks) == 0:
            break

        try:
            is_inserted = await nlp_controller.index_into_vector_db(project=project, chunks=chunks)
        except Exception as e:
            logger.error(f"Error while indexing chunks: {str(e)}")
            is_inserted = False

        if not is_inserted:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"message": ResponseSignal.INSERT_INTO_VECTORDB_ERROR.value,
                         "inserted_items": inserted_items}
            )

        inserted_items += len(chunks)
        page_no += 1

    if inserted_items == 0:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"message": ResponseSignal.NO_CHUNKS_ERROR.value}
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"message": ResponseSignal.INSERT_INTO_VECTORDB_SUCCESS.value,
                 "inserted_items": inserted_items}
    )

@nlp_router.get("/index/info/{project_id}")
async def get_project_index_info(request: Request, project_id: str = ProjectIdPath):

    project = await ProjectModel(db_client=request.app.db_client).get_project(project_id=project_id)
    if project is None:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"message": ResponseSignal.PROJECT_NOT_FOUND.value}
        )

    collection_info = await get_nlp_controller(request).get_vector_db_collection_info(project=project)
    if collection_info is None:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"message": ResponseSignal.VECTORDB_COLLECTION_NOT_FOUND.value}
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"message": ResponseSignal.VECTORDB_COLLECTION_RETRIEVED.value,
                 "collection_info": collection_info}
    )

@nlp_router.post("/index/search/{project_id}")
async def search_index(request: Request, search_request: SearchRequest,
                       project_id: str = ProjectIdPath):

    project = await ProjectModel(db_client=request.app.db_client).get_project(project_id=project_id)
    if project is None:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"message": ResponseSignal.PROJECT_NOT_FOUND.value}
        )

    try:
        results = await get_nlp_controller(request).search_vector_db_collection(
            project=project, text=search_request.text, limit=search_request.limit
        )
    except Exception as e:
        logger.error(f"Error while searching: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"message": ResponseSignal.VECTORDB_SEARCH_ERROR.value}
        )

    if results is None:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"message": ResponseSignal.VECTORDB_COLLECTION_NOT_FOUND.value}
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"message": ResponseSignal.VECTORDB_SEARCH_SUCCESS.value,
                 "results": results}
    )
