#!/usr/bin/env python3
"""Dispatcher monitor. Given a substrate + run handle, emits a monitor command.

Usage:
    # Local substrate (the worker's stdout/log file)
    python3 monitor.py --substrate mps --stdout-file /path/to/run.log

    # SLURM substrate
    python3 monitor.py --substrate slurm --ssh-alias my-cluster --jobid 12345

Output: JSON plan on stdout. The `monitor_command` field is what the caller
pipes into Claude Code's Monitor tool (or runs in a shell). No side effects.

Design: mirrors route.py's emit-only contract. route.py picks the substrate;
monitor.py is how you watch the dispatched run once a handle exists. Handle
shape is substrate-specific (output file for local, jobid+alias for SLURM).
"""
import argparse
import json
import shlex
import sys

# Default progress patterns — one regex alternation that catches the common
# one-line-per-step shapes used by workshop workers (cache_s3_scores prints
# "[ 200/500] rate=..."), torch training loops, tqdm-ish bars, and Hydra
# logs. Override with --progress-regex to tune to your worker.
DEFAULT_PROGRESS_REGEX = r"\[ *[0-9]+/[0-9]+\]|step=|epoch[ =]|loss=|elapsed=|ETA="

# Failure signatures the filter MUST cover. Monitor docs: silence is not
# success — a tail+grep that only matches the happy path stays silent through
# crashes, hangs, and OOMs, which looks identical to "still running". Append
# patterns specific to your worker; never narrow this set.
FAILURE_REGEX = (
    r"Traceback|Error|ERROR|FAILED|FAIL[: ]|assert|"
    r"Killed|OOM|Out of memory|CUDA error|MPS backend|RuntimeError"
)

# Completion signatures the worker emits on success. Combined into the filter
# so the monitor reports "done" instead of going silent.
SUCCESS_REGEX = r"\[OK\]|\[DONE\]|wrote .*\.(npz|pt|json|csv)|completed"

# SLURM states that are NOT terminal — the poll loop keeps watching while
# state matches one of these. Anything else is treated as terminal, including
# UNKNOWN (ssh failure / sacct miss), so a broken connection ends the watch
# loudly rather than silently. Source: Slurm Workload Manager JOB STATE CODES.
SLURM_NON_TERMINAL = (
    "PENDING|CONFIGURING|RUNNING|REQUEUED|RESIZING|SUSPENDED|COMPLETING"
)


def build_local_command(stdout_file: str, progress_regex: str) -> str:
    """tail -f the worker's stdout; emit lines matching progress, failure, or success.

    `tail -F` (capital) follows across file rotation/replacement — safer than
    `-f` if the worker truncates its log on restart. `grep --line-buffered`
    is load-bearing: without it, pipe buffering delays events by minutes.
    """
    combined = f"{progress_regex}|{FAILURE_REGEX}|{SUCCESS_REGEX}"
    quoted_file = shlex.quote(stdout_file)
    return f"tail -F {quoted_file} | grep -E --line-buffered {shlex.quote(combined)}"


def build_slurm_command(ssh_alias: str, jobid: str, poll_seconds: int) -> str:
    """SSH poll loop over sacct. Emits one line per state change; exits on terminal state.

    Why sacct, not squeue: squeue drops the job from its view ~5 min after
    completion, after which the monitor would emit nothing. sacct queries the
    accounting db, which retains terminal states for the cluster's accounting
    window (usually days). Trade-off: sacct is slightly slower per query,
    which is why poll_seconds defaults to 60s — well under any sensible cluster
    rate limit.

    `|| echo UNKNOWN` keeps a transient ssh failure from killing the loop;
    UNKNOWN is treated as terminal so a permanently broken connection ends
    the watch loudly rather than silently retrying forever.
    """
    safe_alias = shlex.quote(ssh_alias)
    safe_jobid = shlex.quote(str(jobid))
    return (
        f"prev=''; "
        f"while true; do "
        f"state=$(ssh {safe_alias} sacct -j {safe_jobid} -X -n -o State --parsable2 2>/dev/null | head -1 || echo UNKNOWN); "
        f"state=${{state:-UNKNOWN}}; "
        f"if [ \"$state\" != \"$prev\" ]; then "
        f"echo \"job {safe_jobid} state: $state\"; "
        f"prev=$state; "
        f"fi; "
        f"case \"$state\" in "
        f"{SLURM_NON_TERMINAL}) ;; "
        f"*) exit 0 ;; "
        f"esac; "
        f"sleep {int(poll_seconds)}; "
        f"done"
    )


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--substrate", required=True,
                    choices=["local_cpu", "local_gpu", "mps", "slurm"],
                    help="Substrate the workload was dispatched to (from route.py's plan)")

    # Local handle
    ap.add_argument("--stdout-file",
                    help="Path the worker writes stdout/logs to. For Claude Code "
                         "background tasks, this is the output-file path from the "
                         "task-launch notification.")

    # SLURM handle
    ap.add_argument("--jobid", help="SLURM job id (captured from sbatch output)")
    ap.add_argument("--ssh-alias",
                    help="SSH alias for the SLURM login node (matches backend manifest)")
    ap.add_argument("--poll-seconds", type=int, default=60,
                    help="SLURM poll cadence in seconds (default 60)")

    # Local override
    ap.add_argument("--progress-regex", default=DEFAULT_PROGRESS_REGEX,
                    help="Regex matching one progress line per step. Failure and "
                         "success patterns are appended automatically.")

    args = ap.parse_args()

    if args.substrate in ("local_cpu", "local_gpu", "mps"):
        if not args.stdout_file:
            print(json.dumps({
                "error": "--stdout-file required for local substrates",
                "fix": "pass the path the worker writes its stdout to (for Claude "
                       "Code background tasks, this is the output-file path printed "
                       "when the task was launched)",
            }, indent=2))
            sys.exit(2)
        command = build_local_command(args.stdout_file, args.progress_regex)
        plan = {
            "substrate": args.substrate,
            "monitor_command": command,
            "handle": {"stdout_file": args.stdout_file},
            "patterns": {
                "progress_regex": args.progress_regex,
                "failure_regex": FAILURE_REGEX,
                "success_regex": SUCCESS_REGEX,
            },
            "use_with": (
                "pipe `monitor_command` into Claude Code's Monitor tool, or run in "
                "a shell. Each matching stdout line is one event. The filter covers "
                "progress, failure, and success patterns — silence means the worker "
                "is alive but quiet, not that it succeeded."
            ),
        }
        print(json.dumps(plan, indent=2))
        return

    # SLURM
    if not (args.jobid and args.ssh_alias):
        print(json.dumps({
            "error": "--jobid and --ssh-alias both required for SLURM",
            "fix": "capture the job id from sbatch output; ssh-alias must match "
                   "the backend manifest's ssh_alias (or the first SSH step of "
                   "its access_chain)",
        }, indent=2))
        sys.exit(2)

    command = build_slurm_command(args.ssh_alias, args.jobid, args.poll_seconds)
    plan = {
        "substrate": "slurm",
        "monitor_command": command,
        "handle": {"jobid": args.jobid, "ssh_alias": args.ssh_alias},
        "poll_seconds": args.poll_seconds,
        "non_terminal_states": SLURM_NON_TERMINAL.split("|"),
        "use_with": (
            "pipe `monitor_command` into Claude Code's Monitor tool. Each state "
            "transition is one event; the loop exits on any terminal state "
            "(COMPLETED, FAILED, CANCELLED, TIMEOUT, OUT_OF_MEMORY, NODE_FAIL, "
            "BOOT_FAIL, DEADLINE, PREEMPTED) including UNKNOWN if ssh breaks. "
            "For chained-access backends, walk the access_chain from the route "
            "plan first; --ssh-alias here is the final hop."
        ),
        "note_on_logs": (
            "sacct reports job state, not log content. To also tail the SLURM "
            "log file, run a second monitor with --substrate local_* and "
            "--stdout-file pointing at the cluster-mounted log path (or wrap "
            "in an `ssh <alias> tail -F <path>` command)."
        ),
    }
    print(json.dumps(plan, indent=2))


if __name__ == "__main__":
    main()
