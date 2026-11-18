from string import Template

# Kept short and explicit: small local models (e.g. qwen2.5:3b) follow
# simple, numbered rules better than long instructions.
SYSTEM_PROMPT = Template("\n".join([
    "You are an assistant that answers questions using only the documents provided by the user.",
    "Rules:",
    "1. Use only the information in the documents. Do not use outside knowledge.",
    "2. If the documents do not contain the answer, say you could not find it in the documents.",
    "3. Answer in the same language as the question.",
    "4. Be concise and precise.",
]))

DOCUMENT_PROMPT = Template("\n".join([
    "## Document $doc_num",
    "$chunk_text",
]))

FOOTER_PROMPT = Template("\n".join([
    "Using only the documents above, answer the following question.",
    "## Question:",
    "$query",
    "",
    "## Answer:",
]))
