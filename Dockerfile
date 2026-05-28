# --- Estágio 1: Compilação ---
FROM node:20-alpine AS build

WORKDIR /app

# Copia os manifestos de dependência
COPY package*.json ./

# Instala as dependências de forma limpa e rápida
RUN npm ci

# Copia todo o código fonte do projeto
COPY . .

# Compila a aplicação gerando os arquivos estáticos na pasta dist/
RUN npm run build

# --- Estágio 2: Servidor de Produção ---
FROM nginx:alpine

# Copia os arquivos compilados do estágio anterior para a pasta pública do Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copia a configuração personalizada do Nginx (para rotas do React funcionarem)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
