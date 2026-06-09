FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
COPY *.mp3 /usr/share/nginx/html/
EXPOSE 3000
CMD ["node", "server.js"]
