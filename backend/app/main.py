from fastapi import FastAPI

app = FastAPI(title="HK2026 Backend")


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "HK2026 backend is running"}
