# MiniRAG — Web UI

React + TypeScript (Vite) interface for the RAG backend in `../src`.

- Projects sidebar, drag-and-drop upload (PDF / TXT) with progress
- One-click **Process & index** (chunking → local embeddings → Qdrant), with chunk size / overlap settings
- Pipeline status (uploaded → chunked → indexed) and index stats
- Chat with answers streamed as they are generated (with a Stop button), grounded in your documents: source passages with relevance scores, the full prompt for debugging, copy / regenerate
- Light and dark themes, responsive down to phone width

## Run

Requires Node 18+ and the backend running on port 5000 (`uvicorn main:app --port 5000` from `src/`).

```bash
npm install
npm run dev        # http://localhost:5173
```

The dev server proxies `/api` to `http://localhost:5000`, so no CORS setup is needed.

```bash
npm run build      # type-check + production build into dist/
```
