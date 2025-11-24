# Build Frontend
FROM node:18-alpine as frontend-builder
WORKDIR /app/frontEnd
COPY frontEnd/package.json frontEnd/package-lock.json ./
RUN npm install
COPY frontEnd/ .
RUN npm run build

# Setup Backend
FROM python:3.9-slim
WORKDIR /app

RUN apt-get update && apt-get install -y build-essential && rm -rf /var/lib/apt/lists/*

COPY phrase-net-backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN python -c "import stanza; stanza.download('en')"

COPY phrase-net-backend/ .

# Copiar frontend buildado
COPY --from=frontend-builder /app/frontEnd/dist ./static

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
