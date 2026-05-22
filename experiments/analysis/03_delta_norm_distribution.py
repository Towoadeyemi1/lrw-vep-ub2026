#!/usr/bin/env python
"""03_delta_norm_distribution.py — ESM-1b embedding L2 (delta_norm) vs ClinVar label, n=500.

The L2-sibling of 02_llr_distribution.py. Same shape, weaker signal:
delta_norm is the L2 norm of the mean-pooled embedding shift between WT and
MUT (vep_utils.compute_delta_norm). The two BRCA1 demo-pair variants
(L1854P pathogenic, P1859R benign) are overlaid as vertical markers so the
slide audience can see where the hand-picked pair lands in the population.

Paper anchor: §Results (L2 baseline / delta_norm row).
Inputs:  experiments/notebooks/data/s3_scores.npz (cached S3 score table)
         experiments/analysis/data/demo_pair_scores.json (BRCA1 demo pair)
         experiments/notebooks/data/workshop_set_manifest.json (anchor)
Outputs: results/delta_norm_distribution_500.csv,
         results/delta_norm_distribution_500.json,
         figures/delta_norm_distribution_500.{pdf,png}
Runtime: CPU, <30s
"""

from __future__ import annotations

import json

import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
from sklearn.metrics import roc_auc_score

import _config as cfg

CACHE_PATH = cfg.EXPERIMENTS_DIR / "notebooks" / "data" / "s3_scores.npz"
DEMO_PAIR_PATH = cfg.ANALYSIS_DIR / "data" / "demo_pair_scores.json"
MANIFEST_PATH = cfg.EXPERIMENTS_DIR / "notebooks" / "data" / "workshop_set_manifest.json"

PATHOGENIC_COLOR = "#c44e52"
BENIGN_COLOR = "#4a8fb8"


def bootstrap_auroc(y: np.ndarray, s: np.ndarray, n_boot: int = 10000, seed: int = 42):
    rng = np.random.default_rng(seed)
    aurocs = []
    for _ in range(n_boot):
        idx = rng.integers(0, len(y), len(y))
        if len(np.unique(y[idx])) < 2:
            continue
        aurocs.append(roc_auc_score(y[idx], s[idx]))
    a = np.array(aurocs)
    return float(a.mean()), float(np.percentile(a, 2.5)), float(np.percentile(a, 97.5))


def main(smoke: bool = False) -> None:
    d = np.load(CACHE_PATH, allow_pickle=True)
    delta = d["delta_norm"].astype(float)
    label = d["label"].astype(int)
    mask = ~np.isnan(delta)
    delta, label = delta[mask], label[mask]

    # Higher delta_norm => more pathogenic (manifest convention).
    score = delta
    point_auroc = roc_auc_score(label, score)
    n_boot = 200 if smoke else 10000
    _, ci_lo, ci_hi = bootstrap_auroc(label, score, n_boot=n_boot)
    n_p = int((label == 1).sum())
    n_b = int((label == 0).sum())

    pair = json.loads(DEMO_PAIR_PATH.read_text())
    pair_p_delta = float(pair["pathogenic"]["delta_norm"])
    pair_b_delta = float(pair["benign"]["delta_norm"])
    pair_p_label = pair["pathogenic"]["hgvs"]
    pair_b_label = pair["benign"]["hgvs"]

    fig, ax = plt.subplots(figsize=(7.5, 4.5))
    for lbl_val, color, lbl_name, n in [
        (0, BENIGN_COLOR, "Benign", n_b),
        (1, PATHOGENIC_COLOR, "Pathogenic", n_p),
    ]:
        sub = delta[label == lbl_val]
        sns.kdeplot(sub, ax=ax, color=color, fill=True, alpha=0.35, linewidth=1.8,
                    label=f"{lbl_name} (n={n}, median={np.median(sub):.3f})")
        ax.axvline(np.median(sub), color=color, linestyle="--", alpha=0.6, linewidth=1.0)

    # Demo pair markers. Place at top of axes (annotate after autoscale).
    ax.axvline(pair_p_delta, color=PATHOGENIC_COLOR, linestyle=":", linewidth=2.0, alpha=0.95)
    ax.axvline(pair_b_delta, color=BENIGN_COLOR, linestyle=":", linewidth=2.0, alpha=0.95)
    ymax = ax.get_ylim()[1]
    ax.annotate(f"demo: {pair_p_label}\nδ={pair_p_delta:.3f}",
                xy=(pair_p_delta, ymax * 0.92), xytext=(8, 0),
                textcoords="offset points", color=PATHOGENIC_COLOR,
                fontsize=8, ha="left", va="top")
    ax.annotate(f"demo: {pair_b_label}\nδ={pair_b_delta:.3f}",
                xy=(pair_b_delta, ymax * 0.72), xytext=(8, 0),
                textcoords="offset points", color=BENIGN_COLOR,
                fontsize=8, ha="left", va="top")

    ax.set_title(
        f"ESM-1b embedding L2 weakly separates ClinVar pathogenic from benign "
        f"(AUROC = {point_auroc:.3f}, 95% CI [{ci_lo:.3f}, {ci_hi:.3f}])"
    )
    ax.set_xlabel(r"$\Vert \mathrm{emb}_{\mathrm{mut}} - \mathrm{emb}_{\mathrm{wt}} \Vert_2$   (higher $\Rightarrow$ pathogenic-leaning)")
    ax.set_ylabel("Density")
    ax.legend(loc="upper right", frameon=False)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    fig.tight_layout()

    fig_paths = cfg.save_figure("delta_norm_distribution_500", fig)
    plt.close(fig)

    import pandas as pd
    out_df = pd.DataFrame({"variant_id": d["variant_id"][mask], "gene": d["gene"][mask],
                           "label": label, "delta_norm": delta})
    csv_path = cfg.save_csv("delta_norm_distribution_500", out_df)
    summary = {
        "scorer": "delta_norm",
        "auroc": point_auroc,
        "ci95_lo": ci_lo,
        "ci95_hi": ci_hi,
        "n_variants": int(mask.sum()),
        "n_pathogenic": n_p,
        "n_benign": n_b,
        "n_bootstrap": n_boot,
        "bootstrap_seed": 42,
        "auroc_predictor": "+delta_norm",
        "demo_pair": {
            "pathogenic": {"hgvs": pair_p_label, "delta_norm": pair_p_delta},
            "benign":     {"hgvs": pair_b_label, "delta_norm": pair_b_delta},
        },
    }
    json_path = cfg.RESULTS_DIR / "delta_norm_distribution_500.json"
    json_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(summary, indent=2) + "\n")

    print(f"AUROC = {point_auroc:.4f}  CI95 = [{ci_lo:.4f}, {ci_hi:.4f}]  n = {mask.sum()}")
    print(f"Demo pair (BRCA1): {pair_p_label} δ={pair_p_delta:.4f}  "
          f"{pair_b_label} δ={pair_b_delta:.4f}")
    print(f"Figure: {fig_paths}")
    print(f"CSV:    {csv_path}")
    print(f"JSON:   {json_path}")

    if MANIFEST_PATH.exists() and not smoke:
        m = json.loads(MANIFEST_PATH.read_text())["evaluation"]["metrics"]
        anchor = float(m["delta_norm_auroc"])
        if abs(point_auroc - anchor) > 5e-4:
            raise SystemExit(
                f"AUROC drift: got {point_auroc:.6f}, manifest expects {anchor:.6f}"
            )
        print(f"Anchor check: matches manifest ({anchor:.6f}) within 5e-4.")


if __name__ == "__main__":
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument("--smoke", action="store_true", help="200-resample bootstrap, no anchor assert")
    args = p.parse_args()
    main(smoke=args.smoke)
