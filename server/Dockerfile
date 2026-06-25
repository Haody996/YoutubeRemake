FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 5000
CMD ["node", "index.js"]
