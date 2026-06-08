FROM python:3.12-alpine
WORKDIR /app
COPY . .
EXPOSE 8080
RUN apk add --no-cache nodejs npm
CMD ["python","scripts/server.py"]