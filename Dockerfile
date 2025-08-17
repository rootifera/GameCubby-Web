FROM node:20-bookworm-slim

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_APP_URL=https://gamecubby.rootifera.xyz
ENV NEXT_PUBLIC_API_BASE_URL=http://gamecubby-api:8000
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]
