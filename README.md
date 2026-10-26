# rag-document-question-answering

This is a minimal implementation of the RAG model for question answering.

Current features:

- Upload `.txt` and `.pdf` files to a project, with content-type and size validation
- Load uploaded files with LangChain (`TextLoader` / `PyMuPDFLoader`) and split them into chunks
- MongoDB connection managed through the FastAPI lifespan (async `motor` client)
- Pydantic data models for `Project` and `DataChunk` documents

## Project Structure

```
.
├── docker/
│   └── docker-compose.yml     # MongoDB service
└── src/
    ├── main.py                # FastAPI app + lifespan (MongoDB connect/close)
    ├── .env.example
    ├── requirements.txt
    ├── assets/files/          # Uploaded files, one folder per project_id
    ├── controllers/           # Base, Data, Project, Process controllers
    ├── helpers/config.py      # Settings loaded from .env
    ├── models/
    │   ├── db_schemas/        # Project, DataChunk (Pydantic)
    │   └── enums/             # ResponseSignal, ProcessingEnum
    └── routes/
        ├── base.py            # GET  /api/v1/
        ├── data.py            # POST /api/v1/data/upload, /api/v1/data/process
        └── schemas/data.py    # ProcessRequest
```

## Requirements

- Python 3.10 or later (LangChain 1.x requires 3.10+)
- Docker and Docker Compose (for MongoDB)

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
| `OPENAI_API_KEY`          | OpenAI API key                                 | `sk-...`                             |
| `FILE_ALLOWED_TYPES`      | Allowed upload MIME types (JSON list)          | `["text/plain", "application/pdf"]`  |
| `FILE_MAX_SIZE_MB`        | Maximum upload size in MB                      | `10`                                 |
| `FILE_DEFAULT_CHUNK_SIZE` | Read/write buffer size in bytes for uploads    | `512000`                             |
| `MONGODB_URL`             | MongoDB connection string                      | `mongodb://localhost:27107`          |
| `MONGODB_DATABASE`        | MongoDB database name                          | `mini-rag`                           |

## Run MongoDB with Docker Compose

```bash
$ cd docker
$ docker compose up -d
```

This starts a `mongo:9` container named `mongodb`, exposed on host port `27107` (container port `27017`), with data persisted in `docker/mongodb/`. Make sure `MONGODB_URL` in `src/.env` uses the same port.

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

Uploads a file (multipart form field `file`) into `src/assets/files/{project_id}/`.

```bash
$ curl -X POST "http://localhost:5000/api/v1/data/upload/1" -F "file=@./sample.pdf"
```

Response (`201`):

```json
{ "message": "file_upload_success", "file_id": "aB3dE5fG7hJ9_sample.pdf" }
```

Returns `400` with `file_type_not_allowed` or `file_size_exceeded` when validation fails.

### `POST /api/v1/data/process/{project_id}`

Loads an uploaded file and splits it into chunks.

```bash
$ curl -X POST "http://localhost:5000/api/v1/data/process/1" \
       -H "Content-Type: application/json" \
       -d '{"file_id": "aB3dE5fG7hJ9_sample.pdf", "chunk_size": 100, "overlap_size": 20}'
```

| Field          | Type | Default | Description                     |
| -------------- | ---- | ------- | ------------------------------- |
| `file_id`      | str  | —       | `file_id` returned by upload    |
| `chunk_size`   | int  | `100`   | Characters per chunk            |
| `overlap_size` | int  | `20`    | Overlap between chunks          |
| `do_reset`     | int  | `0`     | Reserved, not used yet          |

Returns the list of chunks (`page_content` + `metadata`). Chunks are not yet persisted to MongoDB.

## Data Models

Defined in `src/models/db_schemas/`:

- **`Project`**: `_id` (ObjectId), `project_id` (non-empty, alphanumeric)
- **`DataChunk`**: `_id` (ObjectId), `chunk_project_id` (ObjectId of the project), `chunk_text` (non-empty), `chunk_metadata` (dict), `chunk_order` (int > 0)

Both use `arbitrary_types_allowed = True` because Pydantic does not natively support `ObjectId`.
