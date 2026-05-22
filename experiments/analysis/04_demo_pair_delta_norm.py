#!/usr/bin/env python
"""04_demo_pair_delta_norm.py — BRCA1 demo pair ESM-1b L2 (n=2 bar chart).

Two bars, one per variant in the workshop's canonical demo pair (BRCA1
L1854P pathogenic, P1859R benign). Bar height = delta_norm
(`vep_utils.compute_delta_norm`, L2 of mean-pooled WT→MUT embedding shift).
This is the slide-deck plot for the "compute L2 on the demo pair" moment;
the population-context twin (n=500 KDE with the pair overlaid) lives in
`03_delta_norm_distribution.py`.

Paper anchor: §Method (worked example of the L2 scorer).
Inputs:  experiments/analysis/data/demo_pair_scores.json (cached pair scores)
Outputs: results/demo_pair_delta_norm.csv,
         figures/demo_pair_delta_norm.{pdf,png}
Runtime: CPU, <5s
"""

from __future__ import annotations

import json

import matplotlib.pyplot as plt
import pandas as pd

import _config as cfg

DEMO_PAIR_PATH = cfg.ANALYSIS_DIR / "data" / "demo_pair_scores.json"

PATHOGENIC_COLOR = "#c44e52"
BENIGN_COLOR = "#4a8fb8"


def main(smoke: bool = False) -> None:
    pair = json.loads(DEMO_PAIR_PATH.read_text())
    rows = [
        {"hgvs": pair["pathogenic"]["hgvs"],
         "class": "Pathogenic",
         "delta_norm": float(pair["pathogenic"]["delta_norm"]),
         "color": PATHOGENIC_COLOR},
        {"hgvs": pair["benign"]["hgvs"],
         "class": "Benign",
         "delta_norm": float(pair["benign"]["delta_norm"]),
         "color": BENIGN_COLOR},
    ]
    df = pd.DataFrame(rows)

    fig, ax = plt.subplots(figsize=(5.0, 4.0))
    xs = list(range(len(df)))
    bars = ax.bar(xs, df["delta_norm"], color=df["color"], width=0.55,
                  edgecolor="white", linewidth=1.2)
    for bar, val in zip(bars, df["delta_norm"]):
        ax.text(bar.get_x() + bar.get_width() / 2, val, f"{val:.4f}",
                ha="center", va="bottom", fontsize=10, fontweight="bold")

    ax.set_xticks(xs)
    ax.set_xticklabels([f"{r['hgvs']}\n({r['class']})" for r in rows], fontsize=10)
    ax.set_ylabel(r"$\Vert \mathrm{emb}_{\mathrm{mut}} - \mathrm{emb}_{\mathrm{wt}} \Vert_2$")
    ax.set_title("BRCA1 demo pair — ESM-1b embedding L2 (n=2)")
    ax.set_ylim(0, max(df["delta_norm"]) * 1.25)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", alpha=0.25)
    ax.set_axisbelow(True)
    fig.tight_layout()

    fig_paths = cfg.save_figure("demo_pair_delta_norm", fig)
    plt.close(fig)
    csv_path = cfg.save_csv("demo_pair_delta_norm",
                            df.drop(columns=["color"]))

    p, b = df.loc[0, "delta_norm"], df.loc[1, "delta_norm"]
    print(f"Pathogenic ({df.loc[0, 'hgvs']}): delta_norm = {p:.4f}")
    print(f"Benign     ({df.loc[1, 'hgvs']}): delta_norm = {b:.4f}")
    print(f"Pathogenic / Benign ratio: {p / b:.3f}")
    print(f"Figure: {fig_paths}")
    print(f"CSV:    {csv_path}")


if __name__ == "__main__":
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument("--smoke", action="store_true",
                   help="no-op for this script (already <5s); kept for contract parity")
    args = p.parse_args()
    main(smoke=args.smoke)
