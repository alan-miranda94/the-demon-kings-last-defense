#!/usr/bin/env bash
set -e

echo "==> Preparando pastas..."
mkdir -p /data/models/checkpoints
mkdir -p /data/models/vae
mkdir -p /data/models/loras
mkdir -p /data/input
mkdir -p /data/output

echo "==> Criando extra_model_paths.yaml..."
cat > /opt/ComfyUI/extra_model_paths.yaml <<EOF
local_models:
  base_path: /data/models
  checkpoints: checkpoints
  vae: vae
  loras: loras
EOF

echo "==> Iniciando ComfyUI..."
cd /opt/ComfyUI

python3 main.py \
  --extra-model-paths-config /opt/ComfyUI/extra_model_paths.yaml \
  ${COMFY_ARGS} &

COMFY_PID=$!

echo "==> Iniciando API wrapper..."
cd /app

uvicorn api_server:app \
  --host 0.0.0.0 \
  --port "${API_PORT:-8000}"

wait $COMFY_PID