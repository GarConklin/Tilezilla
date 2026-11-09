#!/usr/bin/env bash
# On the MANAGER VM: day-to-day farm controls.
#
#   bash tools/swarm/farm-ctl.sh status        nodes, services and solvers per VM
#   bash tools/swarm/farm-ctl.sh pause         solvers finish their current puzzle, then wait
#   bash tools/swarm/farm-ctl.sh resume
#   bash tools/swarm/farm-ctl.sh stop          stop all solvers now (running puzzles go back to the queue)
#   bash tools/swarm/farm-ctl.sh start         start the solvers again (SOLVER_REPLICAS, default 32)
#   bash tools/swarm/farm-ctl.sh scale 16      run 16 solvers
#   bash tools/swarm/farm-ctl.sh logs          follow solver logs (Ctrl+C to quit)
#   bash tools/swarm/farm-ctl.sh join-command  print the command for joining another VM
#   bash tools/swarm/farm-ctl.sh down          remove the whole farm (queue + results stay in the
#                                              Redis volume; build-and-deploy.sh brings it back)
#   bash tools/swarm/farm-ctl.sh clear-queue <set>   drop the waiting jobs of a set
#   bash tools/swarm/farm-ctl.sh farm <args>   any farm.js command, e.g. farm status --json
source "$(dirname "${BASH_SOURCE[0]}")/farm-common.sh"

case "${1:-help}" in
  status)
    need_manager
    say "VMs in the swarm"; docker node ls
    say "Services"; docker stack services "$STACK" 2>/dev/null || warn "farm stack not deployed"
    say "Solvers running per VM"
    docker service ps "${STACK}_solver" --filter desired-state=running --format '{{.Node}} {{.CurrentState}}' 2>/dev/null \
      | awk '{n[$1]++; if ($2!="Running") p[$1]++} END {for (k in n) printf "    %-30s %d solver(s)%s\n", k, n[k], (p[k] ? "  (" p[k] " starting/pending)" : "")}' | sort
    ;;
  pause)   admin_run pause ;;
  resume)  admin_run resume ;;
  stop)    need_manager; docker service scale "${STACK}_solver=0" ;;
  start)   need_manager; docker service scale "${STACK}_solver=${SOLVER_REPLICAS:-32}" ;;
  scale)   need_manager; [ -n "${2:-}" ] || die "usage: farm-ctl.sh scale N"; docker service scale "${STACK}_solver=$2" ;;
  logs)    need_manager; docker service logs -f --tail 30 "${STACK}_solver" ;;
  join-command)
    need_manager
    docker swarm join-token worker | sed -n 's/^ *\(docker swarm join .*\)$/sudo \1/p'
    ;;
  down)    need_manager; docker stack rm "$STACK"; ok "farm removed; queue data kept in volume ${STACK}_farm_redis_data" ;;
  clear-queue) check_set_name "${2:-}"; admin_run clear-queue --set "$2" ;;
  farm)    shift; admin_run "$@" ;;
  *)       sed -n '2,17p' "$0" ;;
esac
