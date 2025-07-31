# Use slim Python for small footprint
FROM python:3.11-slim

# create app directory
WORKDIR /usr/src/app

# install build deps & copy requirements
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# copy code
COPY src ./src
COPY templates ./templates
COPY static ./static

# expose & run
EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]