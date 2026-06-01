# Multi-stage build for optimal image size and safety
# Stage 1: Build & Dependency Collection
FROM python:3.12-slim AS builder

WORKDIR /build

# Install system compilation packages if needed by any Python dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .

# Install dependencies into a localized wheel folder
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Runtime Image Creation
FROM python:3.12-slim AS runner

WORKDIR /app

# Create a non-privileged user to run the container safely
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /bin/bash appuser

# Copy installed libraries from the builder stage
COPY --from=builder /root/.local /home/appuser/.local
COPY backend/app /app/app

# Ensure correct path settings for custom binaries and local packages
ENV PATH=/home/appuser/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Set ownership of the application directory to the non-root user
RUN chown -R appuser:appgroup /app

# Switch to the non-privileged user
USER appuser

# Expose server port
EXPOSE 8000

# Health check probe to ensure container status is verified automatically by orchestrators
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/status')" || exit 1

# Launch production server with multi-worker configurations
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
