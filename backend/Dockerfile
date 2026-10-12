# Enterprise Copilot Backend Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (build-essential for C-extensions, curl for health checks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY app/ ./app/
COPY run.py .

# Create data directories
RUN mkdir -p /app/data/chroma_db /app/data/uploads /app/data/sessions

# Expose port
EXPOSE 8000

ENV PYTHONUNBUFFERED=1
ENV HOST=0.0.0.0
ENV PORT=8000

CMD ["python", "run.py"]
