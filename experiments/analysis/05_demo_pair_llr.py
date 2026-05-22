#!/usr/bin/env python
"""05_demo_pair_llr.py — BRCA1 demo pair ESM-1b -LLR (n=2 bar chart).

Visual sibling of 04_demo_pair_delta_norm.py and panel A of
01_resolution_panels.py — same figsize, colors, layout, and "bars up, higher
⇒ more pathogenic" treatment. The y-axis is **−LLR** (deleteriousness flip,
following the Brandes convention used in panel A): raw LLR is negative for
pathogenic variants, so negating it puts the pathogenic bar visually
*above* the benign one. Raw LLR is preserved as an annotation under each
bar so the sign convention stays transparent.

Paper anchor: §Method (worked example of the LLR scorer).
Inputs:  experiments/analysis/data/demo_pair_scores.json (cached pair scores)
Outputs: results/demo_pair_llr.csv,
         figures/demo_pair_llr.{pdf,png}
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
         "llr": float(pair["pathogenic"]["llr"]),
         "color": PATHOGENIC_COLOR},
        {"hgvs": pair["benign"]["hgvs"],
         "class": "Benign",
         "llr": float(pair["benign"]["llr"]),
         "color": BENIGN_COLOR},
    ]
    df = pd.DataFrame(rows)
    df["neg_llr"] = -df["llr"]

    fig, ax = plt.subplots(figsize=(5.0, 4.0))
    xs = list(range(len(df)))
    bars = ax.bar(xs, df["neg_llr"], color=df["color"], width=0.55,
                  edgecolor="white", linewidth=1.2)
    for bar, neg_val, raw_val in zip(bars, df["neg_llr"], df["llr"]):
        ax.text(bar.get_x() + bar.get_width() / 2, neg_val,
                f"{neg_val:+.3f}\n(LLR {raw_val:+.3f})",
                ha="center", va="bottom", fontsize=9, fontweight="bold")

    ax.set_xticks(xs)
    ax.set_xticklabels([f"{r['hgvs']}\n({r['class']})" for r in rows], fontsize=10)
    ax.set_ylabel(r"Deleteriousness ($-\mathrm{LLR}$)"
                  "\n(higher $\\Rightarrow$ pathogenic-leaning)")
    ax.set_title("BRCA1 demo pair — ESM-1b masked-LM $-$LLR (n=2)")
    ax.set_ylim(0, max(df["neg_llr"]) * 1.25)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", alpha=0.25)
    ax.set_axisbelow(True)
    fig.tight_layout()

    fig_paths = cfg.save_figure("demo_pair_llr", fig)
    plt.close(fig)
    csv_path = cfg.save_csv("demo_pair_llr", df.drop(columns=["color"]))

    p, b = df.loc[0, "llr"], df.loc[1, "llr"]
    print(f"Pathogenic ({df.loc[0, 'hgvs']}): LLR = {p:+.4f}  (-LLR = {-p:+.4f})")
    print(f"Benign     ({df.loc[1, 'hgvs']}): LLR = {b:+.4f}  (-LLR = {-b:+.4f})")
    print(f"Pathogenic / Benign -LLR ratio: {(-p) / (-b):.3f}")
    print(f"Figure: {fig_paths}")
    print(f"CSV:    {csv_path}")


if __name__ == "__main__":
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument("--smoke", action="store_true",
                   help="no-op for this script (already <5s); kept for contract parity")
    args = p.parse_args()
    main(smoke=args.smoke)
