#!/usr/bin/env bash
# On the MANAGER VM: git pull, build the solver image, push it to the farm registry, deploy the stack.
# Running solvers stop gracefully (their jobs go straight back to the queue) and restart on the new code.
#
#   bash tools/swarm/build-and-deploy.sh
#   SOLVER_REPLICAS=16 bash tools/swarm/build-and-deploy.sh      # fewer solvers
#   NO_PULL=1 bash tools/swarm/build-and-deploy.sh               # skip git pull
source "$(dirname "${BASH_SOURCE[0]}")/farm-common.sh"

need_manager
git_pull
cd "$REPO_ROOT"
tag="$(git rev-parse --short=12 HEAD 2>/dev/null || date +%Y%m%d%H%M%S)"
if [ -n "$(git status --porcelain -- solves tools/scripts data/tiles tools/swarm/lib 2>/dev/null)" ]; then
  tag="$tag-local$(date +%H%M%S)"
  warn "solver files differ from git HEAD on this VM; tagging the image $tag"
fi
img="$REGISTRY/$IMAGE_NAME:$tag"

say "Building $img  ($(git log -1 --format='%h %s' 2>/dev/null | cut -c1-80))"
DOCKER_BUILDKIT=1 docker build -f "$SWARM_DIR/solver-worker.Dockerfile" \
  --build-arg FARM_GIT_COMMIT="$tag" -t "$img" -t "$REGISTRY/$IMAGE_NAME:latest" "$REPO_ROOT"

say "Pushing to the farm registry"
pushed=0
for i in $(seq 1 30); do
  if docker push -q "$img" >/dev/null && docker push -q "$REGISTRY/$IMAGE_NAME:latest" >/dev/null; then pushed=1; break; fi
  warn "registry not ready yet (try $i/30); waiting 3s"
  sleep 3
done
[ "$pushed" = 1 ] || die "could not push to $REGISTRY - check: docker service ps farm-registry"
echo "$tag" > "$STATE_DIR/image-tag"
ok "pushed $img"

say "Deploying stack '$STACK' with ${SOLVER_REPLICAS:-32} solvers (max 4 per VM)"
SOLVER_IMAGE="$img" docker stack deploy --detach=true -c "$SWARM_DIR/solver-stack.yml" "$STACK" >/dev/null 2>&1 \
  || SOLVER_IMAGE="$img" docker stack deploy -c "$SWARM_DIR/solver-stack.yml" "$STACK"
ok "deployed. Solvers (re)start within a minute."
echo
echo "    See where they run:  docker service ps ${STACK}_solver --filter desired-state=running"
echo "    Live progress:       bash tools/swarm/watch.sh"
