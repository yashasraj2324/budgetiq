"""Thread-safe in-process Prometheus-compatible metrics.

Never logs or exposes secrets, JWTs, passwords, or API key cleartext.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict
from typing import Dict, List, Tuple

_lock = threading.Lock()

# counter_name -> label_tuple -> int
_counters: Dict[str, Dict[Tuple, int]] = defaultdict(lambda: defaultdict(int))

# histogram_name -> label_tuple -> list[float]
_histograms: Dict[str, Dict[Tuple, List[float]]] = defaultdict(
    lambda: defaultdict(list)
)

# Histogram buckets (seconds)
_HTTP_BUCKETS = (0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)

_start_time = time.time()


def increment(metric: str, labels: dict | None = None) -> None:
    key = tuple(sorted((labels or {}).items()))
    with _lock:
        _counters[metric][key] += 1


def observe(metric: str, value: float, labels: dict | None = None) -> None:
    key = tuple(sorted((labels or {}).items()))
    with _lock:
        _histograms[metric][key].append(value)


def _label_str(key: tuple) -> str:
    if not key:
        return ""
    parts = ",".join(f'{k}="{v}"' for k, v in key)
    return "{" + parts + "}"


def metrics_text() -> str:
    lines: list[str] = []
    uptime = time.time() - _start_time

    lines.append("# HELP budgetiq_uptime_seconds Seconds since process start")
    lines.append("# TYPE budgetiq_uptime_seconds gauge")
    lines.append(f"budgetiq_uptime_seconds {uptime:.3f}")
    lines.append("budgetiq_health 1")

    with _lock:
        counters_snapshot = {m: dict(v) for m, v in _counters.items()}
        histograms_snapshot = {m: dict(v) for m, v in _histograms.items()}

    for metric, label_map in counters_snapshot.items():
        lines.append(f"# TYPE {metric} counter")
        for key, count in label_map.items():
            lines.append(f"{metric}{_label_str(key)} {count}")

    for metric, label_map in histograms_snapshot.items():
        lines.append(f"# TYPE {metric} histogram")
        for key, observations in label_map.items():
            ls = _label_str(key)
            count = len(observations)
            total = sum(observations)
            lines.append(f"{metric}_count{ls} {count}")
            lines.append(f"{metric}_sum{ls} {total:.6f}")
            buckets = _HTTP_BUCKETS if "duration" in metric else (0.1, 1.0, 10.0)
            cumulative = 0
            for bound in buckets:
                cumulative += sum(1 for v in observations if v <= bound)
                bl = _label_str(key[:-0] + (("le", str(bound)),) if key else (("le", str(bound)),))
                lines.append(f"{metric}_bucket{bl} {cumulative}")
            inf_ls = _label_str(key[:-0] + (("le", "+Inf"),) if key else (("le", "+Inf"),))
            lines.append(f"{metric}_bucket{inf_ls} {count}")

    return "\n".join(lines) + "\n"
