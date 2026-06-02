FROM node:20-alpine

# Instala Python 3, pip e a biblioteca pydicom necessária para gerar os arquivos .wl da Worklist
RUN apk add --no-cache python3 py3-pip && \
    pip3 install --no-cache-dir --break-system-packages pydicom

WORKDIR /app

# Copia manifestos de dependências
COPY package*.json ./

# Instala dependências do projeto
RUN npm ci

# Copia o restante do código fonte
COPY . .

# Expõe a porta padrão do Vite (5173)
EXPOSE 5173

# Sinaliza ao servidor Vite/plugin que está rodando em ambiente conteinerizado
ENV RUNNING_IN_DOCKER=true

# Inicializa o servidor de desenvolvimento do Vite (com suporte ao middleware de PACS e Python)
CMD ["npm", "run", "dev"]
