#!/usr/bin/env bash
# One-time setup on the MANAGER VM (safe to re-run):
#   creates the swarm, the queue password secret and the image registry, builds the solver image
#   from this git checkout, deploys the stack, and prints the join command for the other VMs.
#
#   bash tools/swarm/bootstrap.sh                 # auto-detects this VM's address
#   bash tools/swarm/bootstrap.sh 10.10.0.11      # or give the address on the VM-to-VM switch
source "$(dirname "${BASH_SOURCE[0]}")/farm-common.sh"

need_docker
IP="${1:-${FARM_ADVERTISE_IP:-}}"

say "Step 1/4: Swarm"
state="$(docker info --format '{{.Swarm.LocalNodeState}}')"
if [ "$state" = "active" ]; then
  is_manager || die "this VM already joined a swarm as a WORKER. Run 'docker swarm leave' here or run bootstrap on the manager."
  ok "this VM is already the swarm manager"
else
  if [ -z "$IP" ]; then
    mapfile -t ips < <(ip -4 -o addr show scope global | awk '{print $4}' | cut -d/ -f1 | grep -v '^172\.1[7-9]\.\|^172\.2[0-9]\.\|^172\.3[01]\.' || true)
    if [ "${#ips[@]}" -eq 1 ]; then IP="${ips[0]}"
    else
      echo "This VM has several addresses: ${ips[*]:-none}"
      die "run again with the address the other VMs use to reach this one, e.g.: bash tools/swarm/bootstrap.sh ${ips[0]:-10.10.0.11}"
    fi
  fi
  docker swarm init --advertise-addr "$IP" >/dev/null
  ok "swarm created; manager address $IP"
  grep -q '^FARM_ADVERTISE_IP=' "$ENV_FILE" 2>/dev/null || echo "FARM_ADVERTISE_IP=$IP" >> "$ENV_FILE"
fi

say "Step 2/4: Queue password (swarm secret farm_redis_password)"
if docker secret inspect farm_redis_password >/dev/null 2>&1; then
  ok "already exists"
else
  if [ ! -s "$PW_FILE" ]; then
    (umask 077; head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n' > "$PW_FILE")
    ok "generated a random password (kept in $PW_FILE, never committed)"
  fi
  docker secret create farm_redis_password "$PW_FILE" >/dev/null
  ok "secret created"
fi

say "Step 3/4: Image registry (service farm-registry, used as $REGISTRY by every VM)"
if docker service inspect farm-registry >/dev/null 2>&1; then
  ok "already running"
else
  docker service create --name farm-registry --detach \
    --publish published=5000,target=5000 \
    --constraint node.role==manager \
    --mount type=volume,source=farm_registry_data,target=/var/lib/registry \
    --restart-condition any \
    registry:2 >/dev/null
  ok "registry service created"
fi

say "Step 4/4: Build the solver image and deploy the farm"
bash "$FARM_SCRIPT_DIR/build-and-deploy.sh"

say "Swarm ready. On EACH of the other 7 VMs run this once (vSphere console):"
docker swarm join-token worker | sed -n 's/^ *\(docker swarm join .*\)$/    sudo \1/p'
echo
echo "    Then come back here and check:  docker node ls     (8 nodes, all Ready)"
echo "    The solvers spread out automatically (max 4 per VM). Next: bash tools/swarm/load-queue.sh pair-swap-drafts"
