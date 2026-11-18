from .BaseController import BaseController
from models.db_schemas import Project, DataChunk
from stores.llm import DocumentTypeEnum, OpenAIRoleEnums
from stores.llm.templates import rag_prompts
from typing import List

class NLPController(BaseController):

    def __init__(self, vectordb_client, embedding_client, generation_client=None):
        super().__init__()

        self.vectordb_client = vectordb_client
        self.embedding_client = embedding_client
        self.generation_client = generation_client

    def create_collection_name(self, project_id: str):
        return f"collection_{project_id}".strip()

    async def reset_vector_db_collection(self, project: Project):
        collection_name = self.create_collection_name(project_id=project.project_id)
        return await self.vectordb_client.delete_collection(collection_name=collection_name)

    async def get_vector_db_collection_info(self, project: Project):
        collection_name = self.create_collection_name(project_id=project.project_id)
        return await self.vectordb_client.get_collection_info(collection_name=collection_name)

    async def create_vector_db_collection(self, project: Project, do_reset: bool = False):
        collection_name = self.create_collection_name(project_id=project.project_id)
        return await self.vectordb_client.create_collection(
            collection_name=collection_name,
            embedding_size=self.embedding_client.embedding_size,
            do_reset=do_reset,
        )

    async def index_into_vector_db(self, project: Project, chunks: List[DataChunk]):
        """Embed a batch of chunks and store them in the project's collection"""
        collection_name = self.create_collection_name(project_id=project.project_id)

        texts = [chunk.chunk_text for chunk in chunks]
        metadata = [chunk.chunk_metadata for chunk in chunks]
        record_ids = [str(chunk.id) for chunk in chunks]

        vectors = await self.embedding_client.embed_text(
            texts=texts, document_type=DocumentTypeEnum.DOCUMENT.value
        )
        if vectors is None:
            return False

        return await self.vectordb_client.insert_many(
            collection_name=collection_name,
            texts=texts,
            vectors=vectors,
            metadata=metadata,
            record_ids=record_ids,
        )

    async def search_vector_db_collection(self, project: Project, text: str, limit: int = 5):
        collection_name = self.create_collection_name(project_id=project.project_id)

        if not await self.vectordb_client.is_collection_existed(collection_name):
            return None

        vectors = await self.embedding_client.embed_text(
            texts=[text], document_type=DocumentTypeEnum.QUERY.value
        )
        if not vectors:
            return None

        return await self.vectordb_client.search_by_vector(
            collection_name=collection_name, vector=vectors[0], limit=limit
        )

    async def answer_rag_question(self, project: Project, query: str, limit: int = 5):
        """Retrieve the top chunks for the query and ask the generation model to answer from them.

        Returns (answer, full_prompt, retrieved_documents); answer is None on failure,
        retrieved_documents is None when the project has no vector collection.
        """
        retrieved_documents = await self.search_vector_db_collection(
            project=project, text=query, limit=limit
        )
        if retrieved_documents is None:
            return None, None, None
        if len(retrieved_documents) == 0:
            return None, None, []

        system_prompt = rag_prompts.SYSTEM_PROMPT.substitute()

        documents_prompt = "\n\n".join(
            rag_prompts.DOCUMENT_PROMPT.substitute(doc_num=idx + 1, chunk_text=doc["text"])
            for idx, doc in enumerate(retrieved_documents)
        )
        footer_prompt = rag_prompts.FOOTER_PROMPT.substitute(query=query)
        full_prompt = "\n\n".join([documents_prompt, footer_prompt])

        chat_history = [
            self.generation_client.construct_prompt(
                prompt=system_prompt, role=OpenAIRoleEnums.SYSTEM.value
            )
        ]

        answer = await self.generation_client.generate_text(
            prompt=full_prompt, chat_history=chat_history
        )

        return answer, full_prompt, retrieved_documents
