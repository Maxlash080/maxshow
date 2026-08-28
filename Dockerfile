# ==========================================
# MAXSHOW Production Multi-Stage Dockerfile
# Optimized for AWS App Runner, ECS, Lightsail & EC2
# ==========================================

# Step 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/Frontend

COPY Frontend/package*.json ./
RUN npm ci

COPY Frontend/ ./
RUN npm run build

# Step 2: Python Backend Runtime
FROM python:3.11-slim AS production

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY Backend/requirements.txt ./Backend/
RUN pip install --no-cache-dir -r Backend/requirements.txt

# Copy Backend code
COPY Backend/ ./Backend/

# Copy built Frontend dist from builder stage
COPY --from=frontend-builder /app/Frontend/dist ./Frontend/dist
COPY Frontend/package.json ./Frontend/

# Create uploads directory
RUN mkdir -p /app/Backend/uploads

EXPOSE 8000

# Start production server
CMD ["python", "-m", "uvicorn", "Backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
