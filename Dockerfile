FROM node:20-alpine

WORKDIR /app

# Copia só os manifests primeiro: se o código mudar mas as dependências não,
# o Docker reaproveita esta camada e não reinstala tudo
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY config ./config

ENV NODE_ENV=production
EXPOSE 3000

# Roda como usuário sem privilégios (já existe na imagem oficial do Node)
USER node
CMD ["node", "src/server.js"]
