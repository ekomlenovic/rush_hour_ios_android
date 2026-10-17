# Built from the root of the repository (the server shares the game logic of the app):
#   docker build -f server/Dockerfile -t rush-hours-server .
FROM node:24-alpine AS build
WORKDIR /src/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY store/ /src/store/
COPY utils/ /src/utils/
COPY theme/ /src/theme/
COPY data/ /src/data/
COPY server/ ./
RUN npm run typecheck && npm run build

FROM node:24-alpine
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
WORKDIR /app
COPY --from=build /src/server/dist ./dist
RUN mkdir -p /data && chown node:node /data
# Never as root; the only writable place is the /data volume
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO /dev/null "http://127.0.0.1:${PORT}/api/v1/info" || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "--enable-source-maps", "dist/server.cjs"]
