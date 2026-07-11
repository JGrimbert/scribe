from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes import router
from app.core import models


@asynccontextmanager
async def lifespan(app: FastAPI):
    models.load()
    yield


app = FastAPI(title="Scribe NLP", version="0.1.0", lifespan=lifespan)
app.include_router(router)
