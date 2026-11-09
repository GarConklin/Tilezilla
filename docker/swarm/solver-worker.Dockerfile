# TileZilla solver farm worker: Node only, no ports, one solver per container.
# Build context = repo root (a git clone is enough; solver-worker.Dockerfile.dockerignore keeps the
# context to the files below). tools/swarm/build-and-deploy.sh builds it on the Swarm manager VM.
#
#   docker build -f docker/swarm/solver-worker.Dockerfile -t tilezilla-solver:latest .
#
# The same image also carries the admin CLI:  docker run --rm -it <image> node /farm/farm.js status
FROM node:22-alpine

ARG FARM_GIT_COMMIT=unknown
ENV NODE_ENV=production \
    FARM_GIT_COMMIT=${FARM_GIT_COMMIT} \
    SOLVER_PATH=/app/solves/solve-level.js

WORKDIR /app
COPY data/tiles/tiles-live-edges.json data/tiles/
COPY solves/solve-level.js solves/is-viable-seed.js solves/
COPY tools/scripts/validate-complete-layout.js tools/scripts/
COPY tools/scripts/lib/layout-equivalence-key.js tools/scripts/lib/
COPY tools/swarm/lib/ /farm/lib/
COPY tools/swarm/farm.js /farm/farm.js

LABEL org.opencontainers.image.title="tilezilla-solver" \
      org.opencontainers.image.revision="${FARM_GIT_COMMIT}"

USER node
CMD ["node", "/farm/lib/worker.js"]
