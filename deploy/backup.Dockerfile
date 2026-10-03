FROM postgres:18-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends awscli python3 \
    && rm -rf /var/lib/apt/lists/*

COPY deploy/monthly_backup.py /usr/local/bin/monthly_backup.py
USER postgres
ENTRYPOINT ["python3", "/usr/local/bin/monthly_backup.py"]
