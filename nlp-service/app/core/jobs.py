"""Registre de jobs asynchrones en mémoire.

Un seul worker : les jobs lourds (BERTopic sur un manuscrit) monopolisent le
CPU de toute façon, les sérialiser évite de dégrader les endpoints synchrones.
Même compromis assumé que la Map de preview d'import côté Nest : un
redémarrage du service perd les jobs en cours — le client (Nest) reçoit un
404 au polling suivant et présente l'erreur à l'utilisateur.
"""

import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Any, Callable

_executor = ThreadPoolExecutor(max_workers=1)
_lock = threading.Lock()
_jobs: dict[str, "Job"] = {}

MAX_FINISHED_JOBS = 20

SetProgress = Callable[[float, str], None]


@dataclass
class Job:
    id: str
    kind: str
    status: str = "queued"  # queued | running | done | error
    pct: float = 0.0
    step: str = "en attente"
    result: Any = None
    error: str | None = None
    created_at: float = field(default_factory=time.time)


def submit(kind: str, fn: Callable[[SetProgress], Any]) -> str:
    job = Job(id=uuid.uuid4().hex, kind=kind)
    with _lock:
        _prune()
        _jobs[job.id] = job

    def set_progress(pct: float, step: str) -> None:
        job.pct = min(100.0, max(0.0, pct))
        job.step = step

    def run() -> None:
        job.status = "running"
        try:
            job.result = fn(set_progress)
            job.pct = 100.0
            job.status = "done"
        except Exception as e:  # noqa: BLE001 — l'erreur part au client via le statut
            job.error = f"{type(e).__name__}: {e}"
            job.status = "error"

    _executor.submit(run)
    return job.id


def get(job_id: str) -> Job | None:
    with _lock:
        return _jobs.get(job_id)


def _prune() -> None:
    finished = sorted(
        (j for j in _jobs.values() if j.status in ("done", "error")),
        key=lambda j: j.created_at,
    )
    for job in finished[: max(0, len(finished) - MAX_FINISHED_JOBS)]:
        del _jobs[job.id]
