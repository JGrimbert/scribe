import time

from app.core import jobs


def _wait(job_id: str, timeout: float = 5.0) -> jobs.Job:
    deadline = time.time() + timeout
    while time.time() < deadline:
        job = jobs.get(job_id)
        if job and job.status in ("done", "error"):
            return job
        time.sleep(0.02)
    raise AssertionError("job jamais terminé")


def test_job_done_avec_progression():
    def work(set_progress):
        set_progress(50, "à mi-chemin")
        return {"ok": True}

    job = _wait(jobs.submit("test", work))
    assert job.status == "done"
    assert job.result == {"ok": True}
    assert job.pct == 100.0


def test_job_erreur_capturee():
    def boom(set_progress):
        raise ValueError("corpus vide")

    job = _wait(jobs.submit("test", boom))
    assert job.status == "error"
    assert "ValueError" in job.error
    assert "corpus vide" in job.error


def test_job_inconnu():
    assert jobs.get("inexistant") is None
