FROM node:20-alpine

WORKDIR /app

ENV API_PROXY_TARGET=http://backend:8000

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund --fetch-timeout=120000

COPY index.html vite.config.js tailwind.config.js postcss.config.js ./
COPY src ./src

RUN npm run build

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:80/ > /dev/null 2>&1 || exit 1

CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "80"]
