import argparse
import io
import time
from contextlib import asynccontextmanager

import torch
import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from cnntest.data import dataset, transform
from cnntest.models import SimpleCNN
from cnntest.paths import DEFAULT_MODEL_PATH, SAMPLES_DIR

model = None
device = torch.device("cpu")
classes = dataset.classes


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model

    if not DEFAULT_MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model not found: {DEFAULT_MODEL_PATH}. Run `uv run train` first."
        )

    model = SimpleCNN(num_classes=len(classes)).to(device)
    model.load(DEFAULT_MODEL_PATH, device=device)
    model.eval()
    yield


app = FastAPI(title="cnnTest", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/classes")
async def list_classes():
    return {"classes": classes}


@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="file must be an image")

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {exc}") from exc

    tensor = transform(image).unsqueeze(0).to(device)

    with torch.no_grad():
        outputs = model(tensor)
        probabilities = torch.softmax(outputs, dim=1)
        confidence, predicted = torch.max(probabilities, 1)

    class_id = predicted.item()
    return {
        "class": classes[class_id],
        "class_id": class_id,
        "confidence": round(confidence.item(), 4),
    }


@app.post("/samples")
async def add_sample(
    file: UploadFile = File(...),
    class_name: str = Form(...),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="file must be an image")

    if class_name not in classes:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown class: {class_name}. Valid: {classes}",
        )

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {exc}") from exc

    class_dir = SAMPLES_DIR / class_name
    class_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{int(time.time() * 1000)}.png"
    save_path = class_dir / filename
    image.save(save_path)

    return {
        "ok": True,
        "class": class_name,
        "path": str(save_path.relative_to(SAMPLES_DIR.parent)),
    }


def parse_args():
    parser = argparse.ArgumentParser(description="Start detect HTTP server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8005)
    return parser.parse_args()


def main():
    args = parse_args()
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
