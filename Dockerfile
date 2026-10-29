FROM python:3.13-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY vora ./vora
COPY scripts ./scripts
# The running service requires PostgreSQL migrations, APP_ENV, DATABASE_URL,
# PUBLIC_BASE_URL and SESSION_SECRET from the hosting environment.
EXPOSE 8080
CMD ["uvicorn", "vora.main:app", "--host", "0.0.0.0", "--port", "8080", "--proxy-headers"]
