# rag-document-question-answering

This is a minimal implementation of the RAG model for question answering.

Current features:

- Upload `.txt` and `.pdf` files to a project, with content-type and size validation
- Load uploaded files with LangChain (`TextLoader` / `PyMuPDFLoader`) and split them into chunks
- MongoDB connection managed through the FastAPI lifespan (async `motor` client)
- Pydantic data models for `Project`, `Asset` and `DataChunk` documents
- Uploaded files are tracked in MongoDB; processing works on one file or all files of a project
- Chunks are embedded with a free local model (Ollama `nomic-embed-text`) and indexed in Qdrant for semantic search
- LLM and vector DB are behind interfaces + factories, so the backend is swappable from `.env`

## Project Structure

```
.
├── docker/
│   └── docker-compose.yml     # MongoDB + Qdrant services
└── src/
    ├── main.py                # FastAPI app + lifespan (MongoDB connect/close)
    ├── .env.example
    ├── requirements.txt
    ├── assets/files/          # Uploaded files, one folder per project_id
    ├── controllers/           # Base, Data, Project, Process controllers
    ├── helpers/config.py      # Settings loaded from .env
    ├── stores/
    │   ├── llm/               # LLMInterface, OpenAI-compatible provider, factory
    │   └── vectordb/          # VectorDBInterface, Qdrant provider, factory
    ├── models/
    │   ├── db_schemas/        # Project, DataChunk (Pydantic)
    │   └── enums/             # ResponseSignal, ProcessingEnum
    └── routes/
        ├── base.py            # GET  /api/v1/
        ├── data.py            # POST /api/v1/data/upload, /api/v1/data/process
        ├── nlp.py             # /api/v1/nlp/index/push, /info, /search
        └── schemas/data.py    # ProcessRequest
```

## Requirements

- Python 3.10 or later (LangChain 1.x requires 3.10+)
- Docker and Docker Compose (for MongoDB and Qdrant)
- [Ollama](https://ollama.com/download) for free local models:

```bash
$ ollama pull nomic-embed-text   # embeddings (768 dims)
$ ollama pull qwen2.5:3b         # generation (used by the upcoming answer endpoint)
```

### Create a virtual environment

Using `venv`:

```bash
# Linux / macOS
$ python -m venv minirag-env
$ source minirag-env/bin/activate
```

```powershell
# Windows (PowerShell)
PS> python -m venv minirag-env
PS> Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
PS> .\minirag-env\Scripts\Activate.ps1
```

Or using MiniConda ([download](https://docs.anaconda.com/free/miniconda/#quick-command-line-install)):

```bash
$ conda create -n mini-rag python=3.12
$ conda activate mini-rag
```

### (Optional) Setup you command line interface for better readability

```bash
export PS1="\[\033[01;32m\]\u@\h:\w\n\[\033[00m\]\$ "
```

## Installation

### Install the required packages

```bash
$ cd src
$ pip install -r requirements.txt
```

### Setup the environment variables

```bash
$ cp .env.example .env
```

Set your environment variables in the `src/.env` file. The application reads these keys (see `src/helpers/config.py`):

| Variable                  | Description                                    | Example                              |
| ------------------------- | ---------------------------------------------- | ------------------------------------ |
| `APP_NAME`                | Application name returned by `GET /api/v1/`    | `RAG-document-question-answering`    |
| `APP_VERSION`             | Application version                            | `0.1`                                |
| `OPENAI_API_KEY`          | Optional, unused unless you point the LLM to OpenAI | `sk-...`                        |
| `FILE_ALLOWED_TYPES`      | Allowed upload MIME types (JSON list)          | `["text/plain", "application/pdf"]`  |
| `FILE_MAX_SIZE_MB`        | Maximum upload size in MB                      | `10`                                 |
| `FILE_DEFAULT_CHUNK_SIZE` | Read/write buffer size in bytes for uploads    | `512000`                             |
| `MONGODB_URL`             | MongoDB connection string                      | `mongodb://localhost:27107`          |
| `MONGODB_DATABASE`        | MongoDB database name                          | `mini-rag`                           |
| `LLM_BACKEND`             | LLM provider                                   | `OPENAI_COMPATIBLE`                  |
| `LLM_BASE_URL`            | Any OpenAI-compatible server                   | `http://localhost:11434/v1` (Ollama) |
| `LLM_API_KEY`             | API key (any non-empty value for Ollama)       | `ollama`                             |
| `EMBEDDING_MODEL_ID`      | Embedding model                                | `nomic-embed-text`                   |
| `EMBEDDING_MODEL_SIZE`    | Embedding vector size                          | `768`                                |
| `EMBEDDING_DOCUMENT_PREFIX` / `EMBEDDING_QUERY_PREFIX` | Task prefixes required by nomic-embed-text | `search_document: ` / `search_query: ` |
| `GENERATION_MODEL_ID`     | Generation model                               | `qwen2.5:3b`                         |
| `GENERATION_DEFAULT_MAX_TOKENS` / `GENERATION_DEFAULT_TEMPERATURE` | Generation defaults | `1000` / `0.1`         |
| `VECTOR_DB_BACKEND`       | Vector DB provider                             | `QDRANT`                             |
| `VECTOR_DB_URL`           | Qdrant URL                                     | `http://localhost:6333`              |
| `VECTOR_DB_DISTANCE_METHOD` | `cosine` or `dot`                            | `cosine`                             |

To use a hosted model instead (e.g. Groq free tier or OpenAI), change `LLM_BASE_URL`, `LLM_API_KEY` and the model ids. If you change the embedding model, update `EMBEDDING_MODEL_SIZE` and re-push with `do_reset: 1`.

## Run MongoDB with Docker Compose

```bash
$ cd docker
$ docker compose up -d
```

This starts a `mongo:9` container named `mongodb`, exposed on host port `27107` (container port `27017`), with data persisted in `docker/mongodb/`, and a `qdrant/qdrant:v1.20.0` container on port `6333` (dashboard at `http://localhost:6333/dashboard`), with data in `docker/qdrant/`. Make sure `MONGODB_URL` in `src/.env` uses the same port.

## Run the FastAPI server

From the `src` directory:

```bash
$ uvicorn main:app --reload --host 0.0.0.0 --port 5000
```

On startup the app opens a MongoDB connection (`app.mongodb_client` / `app.db_client`) and closes it on shutdown. Interactive API docs are available at `http://localhost:5000/docs`.

## API Endpoints

### `GET /api/v1/`

Returns the app name and version.

### `POST /api/v1/data/upload/{project_id}`

Uploads a file (multipart form field `file`) into `src/assets/files/{project_id}/` and records it in the `assets` collection.

```bash
$ curl -X POST "http://localhost:5000/api/v1/data/upload/1" -F "file=@./sample.pdf"
```

Response (`201`):

```json
{ "message": "file_upload_success", "file_id": "aB3dE5fG7hJ9_sample.pdf", "asset_id": "6ae1f2fac7aa01b3aa4c49d5" }
```

Returns `400` with `file_type_not_allowed` or `file_size_exceeded` when validation fails.

### `POST /api/v1/data/process/{project_id}`

Loads an uploaded file (or all files of the project when `file_id` is omitted), splits it into chunks and saves them to MongoDB. Re-processing a file replaces its previous chunks.

```bash
$ curl -X POST "http://localhost:5000/api/v1/data/process/1" \
       -H "Content-Type: application/json" \
       -d '{"file_id": "aB3dE5fG7hJ9_sample.pdf", "chunk_size": 100, "overlap_size": 20}'
```

| Field          | Type | Default | Description                     |
| -------------- | ---- | ------- | ------------------------------- |
| `file_id`      | str  | `null`  | `file_id` returned by upload; omit to process all project files |
| `chunk_size`   | int  | `100`   | Characters per chunk            |
| `overlap_size` | int  | `20`    | Overlap between chunks          |
| `do_reset`     | int  | `0`     | `1` deletes the project's existing chunks first |

Response (`200`):

```json
{ "message": "file_processing_success", "inserted_chunks": 12, "deleted_chunks": 0, "processed_files": 2, "failed_files": [] }
```

Returns `404` `file_not_found` if the `file_id` does not exist in the project, `404` `no_files_found` if the project has no files, and `422` if `project_id` is not alphanumeric.

### `POST /api/v1/nlp/index/push/{project_id}`

Embeds all chunks of the project (50 per batch) and stores them in the Qdrant collection `collection_{project_id}`. Body: `{"do_reset": 1}` recreates the collection first. Pushing twice does not duplicate points (ids are derived from chunk ids).

```json
{ "message": "insert_into_vectordb_success", "inserted_items": 6 }
```

### `GET /api/v1/nlp/index/info/{project_id}`

Returns the collection status, `points_count`, `vector_size` and `distance`.

### `POST /api/v1/nlp/index/search/{project_id}`

Semantic search over the project's chunks.

```bash
$ curl -X POST "http://localhost:5000/api/v1/nlp/index/search/1"        -H "Content-Type: application/json"        -d '{"text": "Which planet is the biggest?", "limit": 3}'
```

Returns `results`: a list of `{score, text, metadata}`, best match first. `404` if the project or its collection does not exist.

## Data Models

Defined in `src/models/db_schemas/`:

- **`Project`** (collection `projects`, unique index on `project_id`): `_id` (ObjectId), `project_id` (non-empty, alphanumeric)
- **`Asset`** (collection `assets`, unique on `asset_project_id` + `asset_name`): `_id`, `asset_project_id`, `asset_type` (`file`), `asset_name` (the `file_id`), `asset_size` (bytes), `asset_config`, `asset_pushed_at`
- **`DataChunk`** (collection `chunks`, indexes on `chunk_project_id` and `chunk_asset_id`): `_id` (ObjectId), `chunk_project_id` (ObjectId of the project), `chunk_asset_id` (ObjectId of the asset), `chunk_text` (non-empty), `chunk_metadata` (dict), `chunk_order` (int > 0)

Both use `arbitrary_types_allowed = True` because Pydantic does not natively support `ObjectId`.
