import argparse
import io
import time
from contextlib import asynccontextmanager

import torch
import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from cnntest.data import dataset, detect_transform
from cnntest.models import SimpleCNN
from cnntest.paths import DEFAULT_MODEL_PATH, SAMPLES_DIR

model = None
device = torch.device("cpu")
classes = []


def _load_model_classes(state_dict, saved_classes):
    if saved_classes:
        return list(saved_classes)

    num_classes = state_dict["fc2.weight"].shape[0]
    if len(dataset.classes) == num_classes:
        return list(dataset.classes)

    if len(dataset.classes) > num_classes:
        return list(dataset.classes[:num_classes])

    raise RuntimeError(
        f"Checkpoint has {num_classes} classes but samples/ only has "
        f"{len(dataset.classes)}. Run `uv run train` to retrain."
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, classes

    if not DEFAULT_MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model not found: {DEFAULT_MODEL_PATH}. Run `uv run train` first."
        )

    state_dict, saved_classes, num_classes = SimpleCNN.read_checkpoint(
        DEFAULT_MODEL_PATH, device=device
    )
    classes = _load_model_classes(state_dict, saved_classes)
    model = SimpleCNN(num_classes=num_classes).to(device)
    model.load_state_dict(state_dict)
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
    return {"classes": list(dataset.classes)}


@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="file must be an image")

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("L")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {exc}") from exc
    # 这里把图片转换成张量，并添加一个维度，以便于模型输入
    tensor = detect_transform(image).unsqueeze(0).to(device)
    # no_grad: 梯度计算不参与计算图，减少内存占用和计算量
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

    if not class_name or "/" in class_name or "\\" in class_name or ".." in class_name:
        raise HTTPException(status_code=400, detail=f"Invalid class name: {class_name}")

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("L")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {exc}") from exc

    class_dir = SAMPLES_DIR / class_name
    class_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{int(time.time() * 1000)}.png"
    save_path = class_dir / filename
    image.save(save_path)

    count = sum(
        1
        for path in class_dir.iterdir()
        if path.is_file() and path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
    )

    return {
        "ok": True,
        "class": class_name,
        "path": str(save_path.relative_to(SAMPLES_DIR.parent)),
        "count": count,
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
