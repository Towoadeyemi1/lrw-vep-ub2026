# Workshop activity — your turn

Slides: <https://docs.google.com/presentation/d/14CGms9ehy0xH1d8UCTNtZiv9J1ZFs6GzahuD4fWy3pg/edit?usp=sharing>

About 30 minutes. Pick one or two tasks; you don't need to finish anything. The goal is to drive the notebook (or an agent) on something you find interesting and see what shakes loose. I'll be walking the room — flag me if something breaks or you want feedback.

## Before you start

If you're working on a gene other than BRCA1, confirm the LLR signal isn't inverted before you build on it:

```bash
uv run python experiments/notebooks/validate_genes.py --n 5
```

This runs the four bundled non-BRCA1 genes and prints PASS/FAIL per gene with the mean LLR gap. Look for your gene's row; PASS means pathogenic mean LLR < benign mean LLR on n=5 variants of each class.

The five bundled gene snapshots:

- `experiments/data/clinvar/` — BRCA1 (default; sits at the clinvar root, no subdirectory)
- `experiments/data/clinvar/tp53/`
- `experiments/data/clinvar/brca2/`
- `experiments/data/clinvar/pten/`
- `experiments/data/clinvar/mlh1/`

Each carries the same schema: `variants.tsv` + `protein.fasta` + `dna.fasta` + `rna.fasta`.

## Branch A — drive the notebook

Edit cells in `experiments/notebooks/01_workshop_followalong.ipynb` directly. Tasks reference cell IDs; click a cell and check the metadata pane (or just match the section comment at the top of each cell).

### A1. Swap the gene in the prototype

Replace `s2-pick-pair` with the block below — it loads the per-gene variants, reconstructs WT from any one mutant FASTA entry by reverse-applying the substitution, and produces a `demo_pair` + `wt_seqs` in the shape `s2-encode` expects (column names + 0-indexed `protein_pos`). Then rerun `s2-encode` and `s2-visualize` unchanged.

```python
import pandas as pd

GENE = "tp53"   # or brca2 / pten / mlh1

# Load per-gene variants; clinvar/<gene>/variants.tsv uses different columns
# than the BRCA1 demo_pair.tsv, so we rename to match s2-encode's expectations.
df = pd.read_csv(f"../data/clinvar/{GENE}/variants.tsv", sep="\t")
df = df[df.label.isin([0, 1])]
path_row   = df[df.label == 1].iloc[0]
benign_row = df[df.label == 0].iloc[0]

# Per-gene protein.fasta holds MUT sequences keyed by `clinvar_<variation_id>`.
# Reverse-apply the pathogenic mutation to recover WT (BRCA2/TP53/etc. all
# derive from a single UniProt canonical isoform).
fasta = {}
with open(f"../data/clinvar/{GENE}/protein.fasta") as f:
    cur_id, cur_seq = None, []
    for line in f:
        line = line.rstrip()
        if line.startswith(">"):
            if cur_id is not None:
                fasta[cur_id] = "".join(cur_seq)
            cur_id, cur_seq = line[1:], []
        else:
            cur_seq.append(line)
    fasta[cur_id] = "".join(cur_seq)

mut_seq = fasta[f"clinvar_{path_row.variation_id}"]
p0 = path_row.position - 1
assert mut_seq[p0] == path_row.alt_aa, "FASTA/position mismatch — flag this"
wt_seq = mut_seq[:p0] + path_row.wt_aa + mut_seq[p0 + 1:]

# s2-encode reads variant_id / aa_ref / aa_alt / protein_pos (0-indexed) /
# label, and indexes wt_seqs by variant_id.
def _row(r, label):
    return {"variant_id": f"clinvar_{r.variation_id}", "gene": GENE.upper(),
            "aa_ref": r.wt_aa, "protein_pos": int(r.position) - 1,
            "aa_alt": r.alt_aa, "label": label}

demo_pair = pd.DataFrame([_row(path_row, 1), _row(benign_row, 0)])
wt_seqs   = {row.variant_id: wt_seq for _, row in demo_pair.iterrows()}
```

Question: does the LLR ordering match the Brandes sign convention (pathogenic more negative than benign) on your pair? If it inverts, that's an interesting case to flag.

### A2. Rescale on a single gene

Adapt `s3-score-loop` to read from `experiments/data/clinvar/<gene>/variants.tsv` instead of the canonical 500-variant workshop set. The encode + `compute_llr` + `compute_delta_norm` body is unchanged; you're just feeding it a different table and reconstructing WT from the gene's `protein.fasta`.

Compute the AUROC on your gene-specific dataset and compare to the canonical n=500 workshop set's LLR AUROC of **0.930** (95% CI [0.906, 0.951]). Cleaner gene? Worse? What about your gene (variant counts, sequence length, fraction of variants at conserved residues) could explain the gap?

### A3. Add cosine distance as a third scorer

`compute_cosine_distance(wt_emb, mut_emb)` is already in `experiments/notebooks/vep_utils.py`. Three edits:

1. **Force `s3-score-loop` to actually re-encode.** The cell short-circuits to the committed `data/s3_scores.npz` cache when present, so editing the per-variant loop body is a no-op until you delete the cache:
   ```bash
   # Run from the repo root, or adjust the path if you're inside experiments/notebooks/.
   rm experiments/notebooks/data/s3_scores.npz   # ~4 min re-encode on MPS will follow
   ```

2. **In `s3-score-loop`**, alongside the LLR and delta_norm calls inside the per-variant body, compute cosine and append it to a parallel list (next to `llr_vals` / `dn`), then include it in the `scores_df` built at the bottom of the cell:
   ```python
   cos = compute_cosine_distance(wt_emb, mut_emb)   # per variant, inside the loop
   # ...add cos_vals.append(cos) alongside llr_vals.append(llr), etc.
   # ...add cosine_dist=cos_vals when building scores_df at the end of the cell.
   ```

3. **In `s3-auroc`**, extend the scorers tuple-dict (`s3-distributions` and `s3-roc` reuse it, so they update automatically):
   ```python
   scorers = {
       'LLR':           (scores_df['llr'].values,         -scores_df['llr'].values),
       'Delta L2 norm': (scores_df['delta_norm'].values,   scores_df['delta_norm'].values),
       'Cosine dist':   (scores_df['cosine_dist'].values,  scores_df['cosine_dist'].values),
   }
   ```

Question: does cosine sit between delta_norm and LLR on AUROC, or elsewhere? Why?

### A4. Per-gene asymmetry

The workshop set's "pathogenic distribution is wider than benign" asymmetry is across 400 genes pooled. Filter `s3-distributions` to a single gene and see if the asymmetry holds. Only a handful of genes have enough variants for a KDE to be honest; in the n=500 cache the highest counts are roughly FBN1 ≈ 11, BRCA2 ≈ 7, LDLR ≈ 6, BRCA1 ≈ 5. Confirm with `scores_df.gene.value_counts().head(10)`.

```python
gene = "FBN1"   # top-count gene with both classes; FBN1 is also entirely pathogenic in cache
sub   = scores_df[scores_df.gene == gene]
y_sub = sub['label'].values
# Replot s3-distributions using `sub` and `y_sub` in place of `scores_df` and `y`.
# Many top-count genes are label-skewed (FBN1 all P; BRCA1 all B). If your pick
# has only one class, the KDE will be a single distribution — that's its own
# finding worth flagging.
```

Question: does the asymmetry survive on a single gene, or is it an artifact of pooling many genes with different baseline distributions?

### A5. Sequence-length confounding

In `s3-seqlen`, color by a low-cardinality categorical to see whether any apparent length effect is actually concentrated in one regime. The workshop set has 400 unique genes, so `hue="gene"` directly produces 400 colors and an unreadable plot — bucket first.

```python
import seaborn as sns
# Option A: bucket by long-protein truncation regime (the most interesting cut).
scores_df["regime"] = scores_df["seq_len"].apply(
    lambda L: "short ≤1022" if L <= 1022 else "long >1022"
)
sns.scatterplot(data=scores_df, x="seq_len", y="llr", hue="regime", alpha=0.6)

# Option B: highlight top-N genes by variant count, lump the rest into "other".
top = scores_df["gene"].value_counts().head(5).index
scores_df["gene_hue"] = scores_df["gene"].where(scores_df["gene"].isin(top), "other")
sns.scatterplot(data=scores_df, x="seq_len", y="llr", hue="gene_hue", alpha=0.6)
```

Question: are specific genes or length regimes systematically scored higher or lower? Is the long-protein cluster (where Brandes truncation kicks in past 1022 aa) visible as its own band?

## Branch B — drive an agent

These tasks assume you have a Claude Code session running against the repo. Each task ends with a prompt to paste verbatim — adapt the bracketed values to your gene / results.

### B1. Layer × scorer sweep

Open the notebook to `s4-sweep-prompt` and copy the markdown cell's text into your Claude Code session. While the runs fire (3–10 min depending on substrate), make a prediction: which ESM-1b layer (out of 33) will peak for LLR? Early layers carry local sequence statistics; late layers carry global structural context. Bet a coffee with your neighbor before the runs land.

### B2. Disagreement diagnostic

Find variants where the two scorers disagree on direction — LLR ranks pathogenic but delta_norm ranks benign, or vice versa:

```python
import scipy.stats as ss
scores_df["llr_z"] = ss.zscore(-scores_df.llr)        # higher = more pathogenic
scores_df["dn_z"]  = ss.zscore(scores_df.delta_norm)  # higher = more pathogenic
gap = scores_df.llr_z - scores_df.dn_z

# LLR ranks pathogenic but delta_norm ranks benign (LLR > delta_norm in z-space):
llr_calls_p = scores_df.loc[gap.nlargest(5).index,
                            ['variant_id', 'gene', 'label', 'llr', 'delta_norm']]
# Reverse — delta_norm ranks pathogenic but LLR ranks benign:
dn_calls_p  = scores_df.loc[gap.nsmallest(5).index,
                            ['variant_id', 'gene', 'label', 'llr', 'delta_norm']]
print("LLR-pathogenic / dn-benign:\n", llr_calls_p, "\n")
print("dn-pathogenic / LLR-benign:\n", dn_calls_p)
```

(`gap.abs().nlargest(5)` would find variants "extreme on both scorers in agreement" — not what you want. The signed `nlargest` / `nsmallest` split above isolates the directional disagreements.)

Pick one disagreement case and paste into Claude Code:

> Variant `<variant_id>` in gene `<GENE>` has LLR `<llr>` (pathogenic-ranking) but delta_norm `<delta_norm>` (benign-ranking). Both come from ESM-1b on the same mutation. Walk me through what each scorer is actually measuring at the model level, and propose one biological reason they could disagree on this specific case. Cite anything from Brandes 2023 you can verify against the repo's references.

### B3. Methods paragraph for your gene

`s4-paper-prompt` scaffolds the *whole* paper project via expaper — a different scope from what you want here. For B3, ignore the s4 prompt and write directly against `paper/main.tex` (which already has a §Methods). Paste:

> I want to extend `paper/main.tex` §Methods with a gene-specific paragraph for `<YOUR_GENE>` (n=`<variant count>`, LLR AUROC=`<your A2 number>`). Match the existing §Methods voice — present tense, direct, no hedge words. Cite Brandes 2023 by DOI for the LLR formulation. Call out any methodological deviation from the canonical n=500 workshop set, e.g. truncation policy if your gene exceeds 1022 aa, or label-scope differences if your gene's ClinVar distribution looks unusual.

When the agent comes back, diff its paragraph against the existing `paper/main.tex` §Methods. Would the paragraph actually land in the paper?

### B4. Distribution hypothesis

The n=500 workshop cache happens to contain **no pathogenic BRCA1 rows** (all 5 BRCA1 entries are benign), so a BRCA1-specific pathogenic-median anchor isn't available from the cache. Use the **overall pathogenic median** across the 500-variant set as your baseline instead. Compute both:

```python
overall_path_median = scores_df.loc[scores_df.label == 1, 'llr'].median()
my_gene_path_median = scores_df.loc[
    (scores_df.gene == "<YOUR_GENE>") & (scores_df.label == 1), 'llr'
].median()
print(overall_path_median, my_gene_path_median)
```

(Heads-up: in the n=500 cache, **BRCA1 and TP53 happen to have zero pathogenic rows** — `my_gene_path_median` will come out `NaN` for those. If your gene is in that boat, run A2 first to score the gene's own ClinVar pull, then take the median from that.)

Paste:

> My gene `<YOUR_GENE>` has pathogenic median LLR `<my_gene_path_median>`, vs the n=500 workshop set's overall pathogenic median of `<overall_path_median>`. ESM-1b is the same checkpoint, same scoring rule, same truncation policy in both cases. Walk through why a gene's pathogenic-distribution median might differ from the cross-gene baseline — protein length, conservation pressure at the variant sites, fraction of variants at deeply conserved residues, ClinVar curation density, Mendelian-disease-gene tilt. Rank these explanations by which likely dominates for `<YOUR_GENE>` specifically.

## Branch C — inspect the harness

For engineers more interested in the harness than the biology.

### C1. PROVENANCE.md tracing

Open `PROVENANCE.md`. Pick one number — an AUROC, a CI bound, a sha256, anything specific. Trace it backward: figure → analysis script → input artifact (`s3_scores.npz` or `demo_pair_scores.json`) → producer script → ClinVar snapshot. How many hops to get to a raw input? At which hop does the audit trail get fuzzier than you'd want?

### C2. Skill stub

Open `.claude/skills/dispatcher/SKILL.md` and skim it (it's short). Then write a one-line description of a skill for something you actually do at least weekly — a repo-specific routine, a deploy-status check, a meeting-summary pattern, a figure-refresh pipeline. Keep it in your notes; if the trigger phrasing is compact enough, it's worth turning into an actual skill later.

### C3. CI failure thought experiment

Open `.github/workflows/validate.yml`. Without running anything: identify three things you could change in this repo that would break CI. Rank them by likelihood of happening by accident.

## Stretch / extra credit

If you finish faster than expected:

### S1. AlphaMissense cross-reference

Pull AlphaMissense scores for your gene's variants and compare to the ESM-1b LLR you computed. Where do the two methods agree? Where does one think pathogenic and the other benign? AlphaMissense is available via EBI's REST API or as a downloadable table from the AlphaFold DB.

### S2. Reproduce a Brandes panel

Pick one panel from Brandes et al. 2023, *Nat. Genet.* Figure 2, and reproduce it on your gene's variants. The supplementary methods describe the exact computation.

### S3. Make a figure that doesn't exist yet

Look at `experiments/analysis/figures/` and decide what's missing — a panel, a breakdown axis, a comparison the resolution-panels figure doesn't surface. Generate one figure that would belong there. Bonus if it's defensible enough to commit.
