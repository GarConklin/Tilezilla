FROM python:3.12-alpine
WORKDIR /app
COPY . .
EXPOSE 8080
RUN apk add --no-cache nodejs npm && pip install --no-cache-dir pymysql
CMD ["python","scripts/server.py"]