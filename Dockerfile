FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./
COPY public ./public

# le dossier data est monté en volume (voir docker-compose.yml) pour que
# les scores survivent aux redémarrages/mises à jour du conteneur
RUN mkdir -p /app/data

EXPOSE 8083
ENV PORT=8083

CMD ["node", "server.js"]
