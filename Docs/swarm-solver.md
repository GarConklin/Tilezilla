# Solver farm on 8 Ubuntu VMs (Docker Swarm)

All 8 VMs share **one** queue of puzzles. Each VM runs 4 solvers (32 in total). Every solver takes
the next puzzle from the queue, solves it, and saves the result **straight away**, so closing a
window or rebooting a VM never loses finished work. If a VM dies mid-puzzle, that puzzle goes
back in the queue after 2 minutes and another solver picks it up.

Everything runs inside the VMs. **Git (GitHub) is the only link to the Windows PC:**

- The VMs get the solver code and the puzzle lists (queue + specs) with `git pull`.
- The manager VM pushes finished results to a branch named `solver-results/<set>`.
- On Windows you run one script that fetches that branch and copies the results into your tree.

```
 Windows PC --git push (code, queues)--> GitHub --git pull--> manager VM --> queue (Redis)
                                                                   |            ^  |
 Windows PC <--fetch-results.ps1-- GitHub <--export-publish.sh-----+     8 VMs x 4 solvers
```

## What runs where

| Piece | Where |
|---|---|
| Queue + results (Redis, saved to disk) | manager VM only |
| Image registry (the VMs download the solver image from it) | manager VM only |
| Solvers (no network ports opened) | all 8 VMs, max 4 each |
| Commands (bootstrap, load, watch, publish) | manager VM, in the repo folder |

Files: `docker/swarm/` (image + stack) and `tools/swarm/` (scripts).

---

## First-time setup (once)

Pick **one VM to be the manager** (the one with the most disk/RAM, if they differ). The other 7 are
workers. All commands are typed in the vSphere console.

### 1. Network between the VMs

Put all 8 VMs on the same virtual switch/port group so they can reach each other, and keep internet
access (they need it for `git` and to download the base images). Note the manager's address on that
switch (`ip -4 addr` on the manager), e.g. `10.10.0.11`.

The VMs must reach each other on these ports (open by default on a fresh Ubuntu; if `ufw` is on, run
these on every VM):

```bash
sudo ufw allow 2377/tcp && sudo ufw allow 7946/tcp && sudo ufw allow 7946/udp && sudo ufw allow 4789/udp
```

### 2. Docker without sudo (every VM)

```bash
sudo usermod -aG docker $USER
```

Log out and back in, then check that `docker info` works without `sudo`.

### 3. Give the manager VM access to GitHub (manager only)

The manager needs to **read** the repo and **push** the results branches. Use a deploy key, which
only works for this one repo:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/tilezilla_deploy -N "" -C "tilezilla-farm"
cat ~/.ssh/tilezilla_deploy.pub
printf 'Host github.com\n  IdentityFile ~/.ssh/tilezilla_deploy\n  IdentitiesOnly yes\n' >> ~/.ssh/config
```

On GitHub: repo **GarConklin/Tilezilla** > Settings > Deploy keys > **Add deploy key**. Paste the
line printed by `cat` and tick **Allow write access**. Then check it on the manager:

```bash
ssh -T git@github.com      # answer "yes" once; it should greet you with the repo name
```

(Alternative: a fine-grained personal access token with "Contents: read and write" for this repo
only. Clone with `https://` and let `git config --global credential.helper store` remember it.
Never put keys or tokens in the repo.)

### 4. Get the code (manager only)

```bash
git clone git@github.com:GarConklin/Tilezilla.git ~/tilezilla
cd ~/tilezilla
git checkout release/v0.99.312        # the current release branch
```

### 5. Bootstrap the farm (manager only)

```bash
cd ~/tilezilla
bash tools/swarm/bootstrap.sh 10.10.0.11      # use the manager's address on the VM switch
```

This creates the swarm, a random queue password (kept in `~/.tilezilla-farm/`, never committed), the
image registry, builds the solver image from the checkout, starts the queue and the solvers, and
finally prints a line like:

```
sudo docker swarm join --token SWMTKN-1-xxxx 10.10.0.11:2377
```

### 6. Join the other 7 VMs (each worker VM, once)

Type the `sudo docker swarm join ...` line from step 5 on each worker VM. That's all the workers
ever need: no git, no files. (Lost the line? On the manager: `bash tools/swarm/farm-ctl.sh join-command`.)

Back on the manager:

```bash
docker node ls                              # 8 VMs, all "Ready"
bash tools/swarm/farm-ctl.sh status         # should show 4 solvers on each VM
```

Solvers move to new VMs on their own as they join.

---

## Run the pair-swap drafts queue

1. The set must be committed and pushed, because the VMs only see what is on GitHub. The pair-swap
   drafts already are: `tools/data/swap-candidates/pair-swap-drafts/` (`queue.txt`, `specs/`,
   `draft-status.json`; 4,237 puzzles, no 6x6) is on `release/v0.99.312`. After you change or add
   specs on Windows, commit and push them first.
2. **On the manager:**

```bash
cd ~/tilezilla
bash tools/swarm/load-queue.sh pair-swap-drafts --dry-run   # optional: shows the counts per size
bash tools/swarm/load-queue.sh pair-swap-drafts
bash tools/swarm/watch.sh
```

`load-queue.sh` does a `git pull` first, puts the puzzles in the queue smallest boards first (then 0A,
0C, 0B), and skips anything already solved, waiting, or running, so you can run it again safely
after the list grows. 6x6 boards are skipped (add `--exclude-sizes none` to include them).
Other options: `--sizes 3x5,4x4`, `--tiers 0A`, `--limit 100`, `--priority 20` (a higher number runs
after the lower-numbered loads; default 10).

`watch.sh` shows solved / waiting / in progress / failed per set, the rate (per minute and hour), the
ETA, how many solvers and results each VM has, and the longest-running puzzles. It refreshes every 5
seconds. Ctrl+C closes the view only; the farm keeps working.

### The big list later (swap-named, ~270,000 puzzles)

Commit its `queue.txt` + `specs/` under `tools/data/swap-candidates/swap-named/` (only the pending ids;
no 6x6), push, then on the manager:

```bash
bash tools/swarm/load-queue.sh swap-named --priority 20
```

---

## Getting results to Windows

**On the manager**, export and push the results. Run it once, or leave it running so results are saved
off the VM every 15 minutes:

```bash
bash tools/swarm/export-publish.sh pair-swap-drafts               # once
bash tools/swarm/export-publish.sh pair-swap-drafts --every 15    # keeps going until Ctrl+C
```

To keep the 15-minute loop running after you close the console, use cron instead:

```bash
crontab -e
# add this line:
*/15 * * * * cd $HOME/tilezilla && bash tools/swarm/export-publish.sh pair-swap-drafts >> $HOME/.tilezilla-farm/publish.log 2>&1
```

The script writes into branch `solver-results/pair-swap-drafts` (kept separate from the code):

- `tools/data/swap-candidates/pair-swap-drafts/results/<id>.json` is the same file
  `run-candidate-queue.ps1` writes. Puzzles with zero solutions get no file, like before.
- `results-progress.ndjson` has one line per puzzle (`id`, `totalUniqueSolutions`, `hitMaxSolCap`,
  `exit`, `ts`), like before.
- `farm-results.ndjson` is the full record: VM, attempt, run time, and which solver version
  (`solverHash`, `imageCommit`) produced it.
- `farm-status.txt` / `.json` is a progress snapshot from the moment of the push.

**On Windows:**

```powershell
.\tools\swarm\fetch-results.ps1 -Set pair-swap-drafts               # copy results into your tree
.\tools\swarm\fetch-results.ps1 -Set pair-swap-drafts -StatusOnly   # just show farm progress
```

This does not switch branches, stage, or commit anything. It merges `results-progress.ndjson` by
puzzle id and prints the farm status.

**Sizes.** Typical results are 2-5 KB (the drafts queue should be well under 50 MB in total). A puzzle
that hits the 500,000 solution cap can produce a file of 100 MB or more. Files over 20 MB are stored
as `<id>.json.gz` on the branch (`fetch-results.ps1` unpacks them). Anything still over 95 MB
(GitHub refuses files over 100 MB) stays on the manager in `~/.tilezilla-farm/too-big/<set>/` and is
listed in `too-big.txt`.

---

## After you change the solver

1. On Windows: commit + push the solver change to the release branch, as usual.
2. On the manager:

```bash
cd ~/tilezilla && bash tools/swarm/build-and-deploy.sh
```

It pulls, builds a new image tagged with the commit, and rolls all 32 solvers over to it (8 at a
time). Puzzles that were running go straight back to the queue and restart on the new code. Results
already in the queue/results stay as they are; each result records the solver version that produced
it. If the change means old results are wrong, reload the set with
`bash tools/swarm/farm-ctl.sh farm load --set <set> --queue ... --specs ... --force`.

---

## Everyday controls (manager)

| What | Command |
|---|---|
| Live progress | `bash tools/swarm/watch.sh` |
| VMs + solvers per VM | `bash tools/swarm/farm-ctl.sh status` |
| Pause (finish current puzzles, take no new ones) | `bash tools/swarm/farm-ctl.sh pause` / `resume` |
| Stop all solvers now (their puzzles go back in the queue) | `bash tools/swarm/farm-ctl.sh stop` |
| Start them again | `bash tools/swarm/farm-ctl.sh start` |
| Fewer/more solvers | `bash tools/swarm/farm-ctl.sh scale 16` |
| What failed and why | `bash tools/swarm/requeue-failed.sh --list` |
| Retry failed puzzles | `bash tools/swarm/requeue-failed.sh pair-swap-drafts` |
| Solver logs | `bash tools/swarm/farm-ctl.sh logs` |
| Remove the farm (queue data is kept) | `bash tools/swarm/farm-ctl.sh down` (bring back: `build-and-deploy.sh`) |

A puzzle "fails" when the solver crashes or runs out of memory. It is retried up to 3 times, then
moved to the failed list. Shutting down a VM is safe: its puzzles return to the queue.

Settings can be changed when deploying, e.g.
`SOLVER_REPLICAS=24 MAX_SOL=1000000 SOLVER_MEMORY=4G bash tools/swarm/build-and-deploy.sh`.
(The defaults are 32 solvers, `--max-sol 500000`, 3 GB of memory and 1 CPU per solver, 3 attempts, and
a 2 minute lease.) To make a setting stick, put it in `~/.tilezilla-farm/farm.env`, e.g.
`SOLVER_MEMORY=4G`.

## Testing on the Windows PC (no VMs)

```powershell
.\tools\swarm\test-local.ps1
```

This runs Redis + 2 solvers in Docker Desktop as a separate compose project (`tz-farm-test`; your
normal containers are not touched). It solves 5 small puzzles, checks them against the known counts,
exports them to `data/solver-runs/swarm-test/`, and checks that stopping or killing a solver puts its
puzzle back in the queue.

## How it works (short)

- **Image** `docker/swarm/solver-worker.Dockerfile`: Node 22 plus only the solver files
  (`solves/solve-level.js`, `is-viable-seed.js`, `validate-complete-layout.js`,
  `layout-equivalence-key.js`, `data/tiles/tiles-live-edges.json`) and the farm code in
  `tools/swarm/lib/`. It publishes no ports.
- **Queue** Redis with append-only persistence on a volume on the manager. Each change (take a job,
  heartbeat, save a result, retry, return expired jobs) is one atomic Lua script. A solver holds a
  2-minute lease on its puzzle and renews it every 20 s. Leases that are not renewed are returned to
  the queue by the other solvers. The full solves JSON is stored gzipped next to the result.
- **Stack** `docker/swarm/solver-stack.yml`: Redis is pinned to the manager. 32 solvers run with at
  most 4 per VM, restart on failure, and have memory/CPU limits.
- The admin tool `tools/swarm/farm.js` runs inside the same image on the manager, so the VMs need no
  Node install.
