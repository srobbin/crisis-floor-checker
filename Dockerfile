FROM node:16-slim

# Create destination directory
RUN mkdir /app
WORKDIR /app

# Update and install dependencies
RUN apt-get -y update && apt-get -y upgrade
RUN apt-get -y install make g++ python3 git

# Install the dependencies
COPY package*.json ./
RUN npm install

# Copy files
COPY . .

# Generate the credentials file
ENTRYPOINT [ "sh", "google-credentials.sh" ]
