import os
import uuid
import torch

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from diffusers import StableDiffusionPipeline


MODEL_ID = os.getenv(
    "MODEL_ID",
    "/app/models/SD_PixelArt_SpriteSheet_Generator"
)

OUTPUT_DIR = "/app/output"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pipe = None


class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: str | None = None
    width: int = 384
    height: int = 384
    steps: int = 30
    guidance_scale: float = 8.0


@app.on_event("startup")
def load_model():
    global pipe

    pipe = StableDiffusionPipeline.from_pretrained(
        MODEL_ID,
        torch_dtype=torch.float32,
        safety_checker=None,
        requires_safety_checker=False,
        local_files_only=True,
        use_safetensors=False
    )

    if torch.cuda.is_available():
        pipe = pipe.to("cuda")
    else:
        pipe = pipe.to("cpu")

    pipe.enable_attention_slicing()


@app.get("/")
def home():
    return {
        "status": "ok",
        "model": MODEL_ID,
        "cuda": torch.cuda.is_available()
    }


@app.post("/generate")
def generate(req: GenerateRequest):
    filename = f"{uuid.uuid4()}.png"
    path = os.path.join(OUTPUT_DIR, filename)

    image = pipe(
        prompt=req.prompt,
        negative_prompt=req.negative_prompt,
        width=req.width,
        height=req.height,
        num_inference_steps=req.steps,
        guidance_scale=req.guidance_scale
    ).images[0]

    image.save(path)

    return {
        "image": f"/image/{filename}",
        "url": f"http://localhost:8091/image/{filename}",
        "file": filename
    }


@app.get("/image/{filename}")
def get_image(filename: str):
    path = os.path.join(OUTPUT_DIR, filename)
    return FileResponse(path, media_type="image/png")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8091
    )