FROM node:20-alpine

WORKDIR /app

# Cài đặt OpenSSL cho Prisma engine trên Alpine
RUN apk add --no-cache openssl

# Cài đặt dependencies
COPY package*.json ./
RUN npm ci

# Copy Prisma schema và tạo Prisma Client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy mã nguồn
COPY tsconfig.json ./
COPY src ./src/

EXPOSE 8080

CMD ["/bin/sh", "-c", "npx prisma migrate deploy && (npm run seed || true) && npm start"]
