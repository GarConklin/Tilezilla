# Production game image — runtime only (no Node.js; no solver/ingest tooling).
FROM python:3.12-alpine
WORKDIR /app
COPY . .
EXPOSE 8080
RUN pip install --no-cache-dir pymysql
CMD ["python", "scripts/server.py"]
