# Use a base image with Node.js and Python
FROM mcr.microsoft.com/devcontainers/python:1-3.11-bullseye

# Install Node.js (current LTS)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean -y && rm -rf /var/lib/apt/lists/*

# Install global tools
RUN npm install -g npm@latest

# Set up the workspace
WORKDIR /workspaces/shared-parking

# Expose ports for React (3000) and FastAPI (8000)
EXPOSE 3000
EXPOSE 8000
