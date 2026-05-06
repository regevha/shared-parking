# Use a base image with Node.js and Python
FROM mcr.microsoft.com/devcontainers/python:1-3.11-bullseye

# Install Node.js (current LTS)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean -y && rm -rf /var/lib/apt/lists/*

# Install global tools
# Pin npm to v10 — npm@latest (v11+) requires Node ^20.17.0 || >=22.9.0,
# which the nodesource setup_20.x script does not always provide.
RUN npm install -g npm@10

# Set up the workspace
WORKDIR /workspaces/shared-parking

# Expose ports for React (3000) and FastAPI (8000)
EXPOSE 3000
EXPOSE 8000
