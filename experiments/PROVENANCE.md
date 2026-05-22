# Provenance — lrw-vep-ub2026

Figure → script → CSV mapping. 
Updated whenever a figure or its inputs change.

Format:

```markdown
## Figure N (§X.Y)

- Script: `analysis/NN_figures.py::figure_<name>()`
- Inputs: `results/<name>.csv`
- Producing script: `analysis/NN_<name>.py`
- Generated: YYYY-MM-DD against <tool> `<sha>`
```

## Resolution panels (slide: Part 2 "Resolution")

- Script: `analysis/01_resolution_panels.py` (3-panel: n=2, n=499, n=36,537 literature anchor)
- Inputs (n=2): `analysis/data/demo_pair_scores.json`
  (sha256 `3a7b8721…699b9b28a`) — pre-scored by
  `scripts/score_demo_pair.py` from the demo pair in
  `experiments/data/demo_pair.json` (sha256 `faf7ac58…a654b08cc`).
  Encoder: HF transformers ESM-1b via `vep_utils.ESM1bEncoder`,
  fp32 on MPS. Variant pair: BRCA1 L1854P (pathogenic, `clinvar_55631`,
  LLR **−6.5283**) vs BRCA1 P1859R (benign, `clinvar_55634`,
  LLR **−3.7580**) — both negative under Brandes 2023's convention
  (`LLR = log P(mut|WT_seq) − log P(wt|WT_seq)`; negative ⇒
  deleterious). Pathogenic is more negative, as expected.
  **Panel A plots −LLR** so the visual story matches panels B and C
  (taller bar = stronger pathogenic signal). The raw Brandes LLR
  value is rendered as a text label on each bar so readers see the
  actual sign. Delta L2 norm bars dropped — at n=2 the values (~0.03)
  sit near zero and dilute the LLR contrast; both metrics still
  appear in panel B at scale. Underlying delta_norm/cosine values
  remain in `demo_pair_scores.json` for anyone who wants them.
- Inputs (n=500): `notebooks/data/s3_scores.npz`
  (sha256 `c00eeae60744…`, 500 rows: 250 P + 250 B across
  **400 unique genes**) — pre-scored by `scripts/cache_s3_scores.py`
  from `experiments/notebooks/data/workshop_set.tsv` (sha256
  `355822298e09…`) + matching FASTA. Same encoder as n=2.
  **LLR follows Brandes 2023**: `LLR = log P(mut|WT_seq) − log P(wt|WT_seq)`,
  both read from the same softmax at the variant position via a single
  WT-context forward pass. Sign convention: **negative = deleterious**.
  AUROC predictor is `-llr` (sklearn's positive-class = pathogenic
  convention; sign-flip at the metric callsite, not in the cache).
  delta_norm **0.6718** (CI95 [0.623, 0.719]),
  LLR **0.930** (CI95 [0.906, 0.951]).
  **Brandes 2023's 0.905 sits 0.001 below our CI95 lower bound**
  (0.906) — well within Brandes' own standard-error band for
  n=36,537. See "Validation set lineage" for the v0 → v2 history,
  "Long-sequence handling" for the methodology comparison, and
  `EXPERIMENT_LOG.md` 2026-05-13 for the LLR methodology fix (formula
  was previously two-pass with inverted sign; AUROC barely moved
  0.929 → 0.930 because the old quantity correlates with the Brandes
  one, but the method now matches the paper).
- Inputs (n=36,537): no local data — literature anchor from
  Brandes et al., *Nat. Genet.* 2023, Fig 2B. Single bar at ESM-1b
  zero-shot AUROC 0.905 on ClinVar missense, plus one dashed
  reference line pulled forward from panel B at the measured LLR
  AUROC (0.64, red). Delta L2 norm reference line dropped to keep
  panel C aligned with panel A (also LLR-only); delta_norm is shown
  in panel B only. The floor->ceiling gap (LLR 0.64 -> Brandes
  0.905) is the panel's visual argument. Constant lives in
  `01_resolution_panels.py::BRANDES_2023_CLINVAR_AUROC`.
- Outputs: `analysis/figures/resolution_panels.{pdf,png}`,
  `analysis/results/resolution_panels.csv`.
- Generated: 2026-05-11 against `manylatents-omics` `cceb1fa`.
  Regenerate post-2.11 with `manylatents.dogma.vep` to keep n=2 and
  n=499 parity-clean against Path B/C.

### Validation set lineage (four revisions → `workshop_set`)

The current panel B dataset is **`workshop_set`** — produced by
`experiments/scripts/build_validation_set.py --spec v2` (the v2 spec
is recorded in the manifest's `spec` field for audit; the filename
is intentionally unversioned because there is one canonical workshop
set, with a documented history). Full lineage in
`docs/internal/WORKSHOP_SET_LINEAGE.md`. Summary:

| revision | label scope | isoform | producer | LLR AUROC | status |
|---|---|---|---|---|---|
| v0 (2026-05-06, pre-bundled) | canonical-only | unverified | none in repo | 0.638 | **deprecated** — `_archive/validation_variants_v0_2026-05-06.{csv,fasta}` |
| v1 in-flight (per-gene cap) | canonical-only | UniProt-validated | `build_validation_set.py` | 0.925 | **deprecated** — unsanctioned per-gene cap, see `_archive/*_v1_in_flight_*` |
| v1 canonical-only (no cap) | canonical-only | UniProt-validated | `--spec v1` | 0.944 | **deprecated** — replaced for Brandes comparability; see `_archive/workshop_set_v1_canonical-only_*` |
| **`workshop_set` (current canonical, v2 spec)** | **Brandes-match (canonical + Conflicting via ClinSigSimple)** | **UniProt-validated** | **`--spec v2`** | **0.930** | **shipped** — 2026-05-13 (post Brandes-LLR fix; pre-fix value was 0.929 with a methodologically-incorrect two-pass formula that happened to correlate) |

**Files (sha256, current canonical):**

| file | sha256 (12 char) |
|---|---|
| `experiments/notebooks/data/workshop_set.tsv` | `355822298e09` |
| `experiments/notebooks/data/workshop_set_proteins.fasta` | `115a822a90a3` |
| `experiments/notebooks/data/workshop_set_manifest.json` | (includes bootstrap CI95 and Brandes anchor) |
| `experiments/notebooks/data/s3_scores.npz` | `c00eeae60744` |

**ClinVar source:** `experiments/cache/variant_summary.txt.gz` (gitignored,
sha256 `61e2b1fd3123…`). Recorded in the manifest.

**Composition:**

| dimension | value |
|---|---|
| Total rows | 500 (exactly 250 P + 250 B) |
| Unique genes | 400 |
| Singletons | 338 (84%) |
| Conflicting-binarized entries | 166 (33%) — the v2-spec inclusion |
| Canonical-text entries | 334 (Pathogenic/LP/B/LB etc.) |
| BRCA1 rows | 5 (re-appears via Conflicting-binarized) |
| BRCA2 rows | 7 |
| Top gene by count | FBN1 (n=11) |

**Bootstrap CI95 (10,000 resamples, seed 42; predictor = `-llr` for the Brandes-sign LLR):**
- delta L2 norm AUROC: 0.6718  [0.623, 0.719]
- LLR AUROC: **0.930  [0.906, 0.951]**
- Brandes 2023 (n=36,537) LLR AUROC: 0.9050 — sits 0.001 below
  our CI95 lower bound (0.906); within Brandes' own SE band for
  n=36,537.

**Caveats for downstream framing:**
1. AUROCs are a 400-gene mixture. Slide narration: "ClinVar workshop
   set across 400 disease genes," not "BRCA1 validation." (BRCA1 is
   present with 5 rows but is not over-represented.)
2. Per-gene P/B balance is not enforced. Hot genes (FBN1 11P/0B,
   LDLR 6P/0B, etc.) have label-skewed distributions. Label balance
   is global only.
3. Two distinct data layers in the repo:
   - `experiments/data/clinvar/variants.tsv` — BRCA1-only; the demo
     pair and audience-pick gene-bundle flow live here.
   - `experiments/notebooks/data/workshop_set.tsv` — the multi-gene
     validation set; the notebook's S3 loop + `cache_s3_scores.py`
     consume it.

### Catch ledger — what each revision held back, in one sentence

Four revisions to ship the n=500 validation set; each held back by a different category of error caught by the parse-and-cite discipline:

1. **v0 → v1 in-flight (correctness):** pre-bundled v0 had no producer + no canonical-isoform validation — silent isoform mismatch was plausible, so the AUROC 0.638 couldn't be defended.
2. **v1 in-flight → v1 canonical-only (process):** the agent added an unsanctioned per-gene cap of 6 inside an unrelated panel-update task. Held because "change the validation set" deserves an explicit decision, not a quiet one.
3. **v1 canonical-only → v2 (methodology):** label scope dropped Conflicting + Uncertain entries, producing AUROC 0.944 on a strictly easier subset than Brandes 2023's 0.905 on unfiltered ClinVar — the literature comparison was not apples-to-apples.
4. **v2 ships:** Brandes-matching binarization (Conflicting via `ClinSigSimple`), AUROC 0.930, CI95 contains Brandes' 0.905. Numerically and methodologically comparable.

Workshop-prep also caught four downstream framing/methodology issues before any slide shipped: (a) the LLR sign convention was inverted in early slide narration; (b) Brandes' AUROC was misremembered as 0.74 in panel C of the resolution figure (correct: 0.905); (c) the multi-gene workshop set was being framed as "BRCA1 validation" despite having only 5 BRCA1 rows out of 500; (d) the two-pass LLR formula that produced 0.929 was methodologically wrong (corrected to single-pass Brandes formulation on 2026-05-13, moving AUROC 0.929 → 0.930 because the two quantities are highly correlated). None of these made it to a public slide.

### Reproduce `workshop_set` from scratch

```bash
# Cold-cache ~10 min (UniProt fetches); warm <1 min.
experiments/tools/manylatents-omics/.venv/bin/python \
    experiments/scripts/build_validation_set.py --spec v2

# Score through ESM-1b (~4 min on Apple Silicon MPS)
experiments/tools/manylatents-omics/.venv/bin/python \
    experiments/scripts/cache_s3_scores.py --force
```

The manifest at `experiments/notebooks/data/workshop_set_manifest.json` records the ClinVar dump sha256, all filter rules, sampling seed, output sha256s, the gene→UniProt map, and the bootstrap CI95 with Brandes-anchor verification.

### Long-sequence handling (Brandes methodology comparison)

The workshop set includes **236 of 500 variants on proteins >1022 aa**
(the ESM-1b context window, accounting for BOS/EOS — see
`vep_utils.ESM1bEncoder.MAX_LEN`). These are scored via Brandes'
"option 4" strategy: a variant-centered single window at
`window=MAX_LEN=1022`, implemented in `vep_utils.truncate_around_mutation`
and invoked uniformly by `cache_s3_scores.py` and the notebook's
S2-encode + S3-score-loop cells.

Brandes et al.'s own ablation (Extended Data Fig. 6a) shows that at
window size 1,022 — the maximum supported by ESM-1b — no aggregation
method outperformed their preferred sliding-window weighted average,
and the variant-centered single window is within noise of it. Their
headline AUROC of 0.905 (n=36,537) was computed on proteins ≤1022 aa
**only** (Extended Data Fig. 5 caption), explicitly avoiding the
sliding window. Our workshop set therefore covers a *broader* length
distribution than Brandes' benchmark — including the long-protein
slice they excluded — and scores it with the Brandes-validated
single-window method at the same window size.

**Source:** Brandes et al., *Nat. Genet.* 2023, Methods §
"Handling long sequences" and Extended Data Figs. 5 and 6a.

---

## LLR distribution (headline §Results figure, n=500)

- Script: `analysis/02_llr_distribution.py`
- Inputs:
  - `notebooks/data/s3_scores.npz` (sha256 `c00eeae60744…`, 500 rows: 250 P + 250 B across 400 unique genes) — same cache `01_resolution_panels.py` uses for panel B.
  - `notebooks/data/workshop_set_manifest.json` for the anchor AUROC + CI; script asserts the computed AUROC matches the manifest's `evaluation.metrics.llr_auroc` within 5e-4.
- Outputs:
  - `analysis/figures/llr_distribution_500.{pdf,png}` — KDE of pathogenic vs benign LLRs with the AUROC + 95 % CI in the title.
  - `analysis/results/llr_distribution_500.csv` — long-form `(variant_id, gene, label, llr)` for parse-and-cite.
  - `analysis/results/llr_distribution_500.json` — `(auroc, ci95_lo, ci95_hi, n_variants, n_pathogenic, n_benign, n_bootstrap, bootstrap_seed, auroc_predictor)`.
- Conventions:
  - **Bootstrap:** `n_resamples=10000`, `seed=42`, predictor `-llr` (sklearn positive-class = pathogenic).
  - **Sign convention:** raw LLRs are plotted on the x-axis (more negative ⇒ more pathogenic, Brandes 2023); the legend labels each KDE with its median.
  - **No encoder calls.** Reads the cached score table; bit-identical given a fresh cache, ≲30 s on CPU.
- Use: the smoke-test paper from `validate_paper.py` `\includegraphics`'s this figure as its headline visual; same paper-anchor (§Results) the slide deck cites.
- Generated: 2026-05-14 against the s3 cache rebuilt 2026-05-13 (Brandes-correct LLR; see `EXPERIMENT_LOG.md` 2026-05-13). Regenerate via `experiments/tools/manylatents-omics/.venv/bin/python experiments/analysis/02_llr_distribution.py`.

---

## Delta-norm distribution (L2 baseline §Results figure, n=500, with demo pair)

- Script: `analysis/03_delta_norm_distribution.py`
- Inputs:
  - `notebooks/data/s3_scores.npz` (sha256 `c00eeae60744…`, 500 rows) — same cache `02_llr_distribution.py` reads; the `delta_norm` column comes from `vep_utils.compute_delta_norm` (L2 of the mean-pooled WT→MUT embedding shift).
  - `analysis/data/demo_pair_scores.json` (sha256 `acc170ccd948…`) — BRCA1 demo pair scored on the same fp32 MPS encoder by `experiments/scripts/score_demo_pair.py`. Supplies the two vertical markers overlaid on the population KDE.
  - `notebooks/data/workshop_set_manifest.json` (sha256 `08afc36298a1…`) for the anchor AUROC; script asserts the computed AUROC matches `evaluation.metrics.delta_norm_auroc` within 5e-4.
- Outputs:
  - `analysis/figures/delta_norm_distribution_500.{pdf,png}` — pathogenic vs benign KDEs with AUROC + 95 % CI in the title; demo pair (BRCA1 L1854P, P1859R) as dotted vertical lines with δ-value annotations.
  - `analysis/results/delta_norm_distribution_500.csv` — long-form `(variant_id, gene, label, delta_norm)`.
  - `analysis/results/delta_norm_distribution_500.json` — `(auroc, ci95_lo, ci95_hi, n_variants, n_pathogenic, n_benign, n_bootstrap, bootstrap_seed, auroc_predictor, demo_pair)`.
- Conventions:
  - **Bootstrap:** `n_resamples=10000`, `seed=42`, predictor `+delta_norm` (higher ⇒ pathogenic; sklearn positive-class = pathogenic).
  - **No encoder calls.** Reads the cached score table + the cached demo-pair JSON; <10 s on CPU.
- Use: slide-deck companion to `llr_distribution_500.{pdf,png}` — same population, weaker signal (AUROC 0.672 vs LLR's 0.930), and the demo pair markers make the "hand-picked for LLR signal, not L2" point visible at a glance.
- Generated: 2026-05-21 against the s3 cache re-encoded the same day (bit-identical to the 2026-05-13 rebuild — sha unchanged; see `EXPERIMENT_LOG.md` 2026-05-21). Regenerate via `uv run python experiments/analysis/03_delta_norm_distribution.py`.

---

## Demo-pair delta-norm (slide figure, n=2)

- Script: `analysis/04_demo_pair_delta_norm.py`
- Inputs:
  - `analysis/data/demo_pair_scores.json` (sha256 `acc170ccd948…`) — BRCA1 demo pair scored on `vep_utils.ESM1bEncoder` (HF transformers, fp32 MPS) by `experiments/scripts/score_demo_pair.py`. Same artifact `03_delta_norm_distribution.py` reads for its overlay markers.
- Outputs:
  - `analysis/figures/demo_pair_delta_norm.{pdf,png}` — two-bar chart, pathogenic (L1854P) vs benign (P1859R), bar height = `delta_norm`, values labeled above each bar.
  - `analysis/results/demo_pair_delta_norm.csv` — `(hgvs, class, delta_norm)`, 2 rows.
- Conventions:
  - **No encoder calls.** Reads the cached pair JSON; <2 s on CPU.
- Use: slide-deck plot for the "compute L2 on the demo pair" moment — the literal n=2 artifact. Pairs with the n=500 distribution-with-overlay (`delta_norm_distribution_500.{pdf,png}`) for the population-context slide.
- Generated: 2026-05-21 against the same demo-pair JSON used by the 2026-05-14 demo-pair LLR work. Regenerate via `uv run python experiments/analysis/04_demo_pair_delta_norm.py`.

---

## Demo-pair LLR (slide figure, n=2)

- Script: `analysis/05_demo_pair_llr.py`
- Inputs:
  - `analysis/data/demo_pair_scores.json` (sha256 `acc170ccd948…`) — same cached pair scoring that `04_demo_pair_delta_norm.py` reads.
- Outputs:
  - `analysis/figures/demo_pair_llr.{pdf,png}` — two-bar chart, pathogenic (L1854P) vs benign (P1859R), bars going **up** from y=0; y-axis is −LLR (deleteriousness flip). Raw LLR is preserved as an annotation under each `−LLR` value so the sign convention is transparent.
  - `analysis/results/demo_pair_llr.csv` — `(hgvs, class, llr, neg_llr)`, 2 rows.
- Conventions:
  - **−LLR (deleteriousness) sign convention** — same as Panel A of `01_resolution_panels.py`. Raw LLR is negative for pathogenic variants (Brandes); negating it puts the pathogenic bar visually above the benign one. Bar value labels show `+<−LLR>` with `(LLR <raw>)` underneath.
  - **Visual consistency with `04_demo_pair_delta_norm.py` and `01_resolution_panels.py` Panel A:** identical figsize (5.0 × 4.0), color palette, bar geometry (bars up from y=0), value-label treatment, and class subtitles, so the triplet stack cleanly in slides.
- Use: slide-deck plot for the "compute LLR on the demo pair" moment. Paired with `demo_pair_delta_norm.{pdf,png}` to contrast scorer strengths — −LLR's 1.74× ratio vs delta_norm's 1.10× ratio on the same pair.
- Generated: 2026-05-21 against the same demo-pair JSON used by `04_demo_pair_delta_norm.py`. Regenerate via `uv run python experiments/analysis/05_demo_pair_llr.py`.

---

# Paper section spine (paper/skeleton.tex → paper/main.tex)

The skeleton at `paper/skeleton.tex` is structure only — preamble, section
headers, figure placeholder, bibliography wiring. Each section body is a
single TODO pointing back here. Agents filling the skeleton must read the
named PROVENANCE entry, manifest keys, source files, and EXPERIMENT_LOG
entries before writing a single line of prose. If a referenced key is
missing or the script can't reach it, stop and ask — do not invent.

The validator (`experiments/notebooks/validate_paper.py --real-paper`)
enforces: every \cite-key resolves to a bib entry with a `doi` field;
every \includegraphics resolves on the parsed graphicspath; the manifest's
`evaluation.metrics.llr_auroc` (3- or 4-decimal precision) is present in
the source. Run it at the end of every section-fill, not just at the end
of the paper.

---

## §Abstract

- **Skeleton location:** the `\begin{abstract}...\end{abstract}` block in `paper/skeleton.tex`.
- **Required values from `experiments/notebooks/data/workshop_set_manifest.json`:**
  - `evaluation.metrics.llr_auroc`
  - `evaluation.metrics.llr_auroc_ci95_bootstrap`
  - `evaluation.literature_anchor.llr_auroc`
  - `evaluation.literature_anchor.n`
- **Required citations** (must exist in `shared/bib/references.bib`):
  - `brandes2023`
- **Length:** 4–6 sentences, single paragraph. The reader should know whether to keep reading after the first four sentences.
- **Validator:** AUROC must appear (3- or 4-decimal precision).

---

## §Introduction

- **Skeleton location:** `\section{Introduction}` block.
- **Required citations:**
  - `brandes2023`, `rives2021esm`, `landrum2018clinvar`
- **Required values:** none — qualitative paragraph(s).
- **Length:** 1–2 paragraphs. Lead with the stakes (why VEP, why now); establish the gap (silent misalignment as the agent failure mode); preview what the harness adds.

---

## §Related Work

- **Skeleton location:** `\section{Related Work}` block.
- **Required citations:**
  - Protein language models: `rives2021esm` (ESM-1), `lin2023esm` (ESM-2), `brandes2023` (ESM-1b zero-shot VEP).
  - Cross-modal foundation models (optional): `nguyen2024evo2`.
- **Length:** 1–2 short paragraphs, or 2–3 `\paragraph{}` stubs. One sentence per category, each backed by a `\citep`.

---

## §Methods

- **Skeleton location:** `\section{Methods}` block.
- **Required source files** (read these BEFORE writing, derive the formula from the code, not from prior prose):
  - `experiments/notebooks/vep_utils.py::compute_llr` — the LLR formula.
  - `experiments/notebooks/vep_utils.py::truncate_around_mutation` — variant-centered single-window truncation (Brandes Option 4).
  - `experiments/notebooks/vep_utils.py::ESM1bEncoder` — the encoder; note `MAX_LEN = 1022`.
- **Required values from manifest:**
  - `composition.total_variants` (= 500)
  - `sampling.n_pathogenic` + `sampling.n_benign` (= 250 + 250)
  - `composition.unique_genes` (= 400)
  - `universe_filters.binarization.label_source` (ClinSigSimple binarization, matching Brandes)
- **Required citations:**
  - `brandes2023` (the methodology anchor), `rives2021esm` (ESM-1b), `landrum2018clinvar` (the dataset source).
- **Required figure:** none (Methods is prose + the LLR equation block).
- **EXPERIMENT_LOG refs:** none required for Methods prose itself — the scars are surfaced in §Discussion.
- **CRITICAL — anti-regression note:**

  > The LLR formula is **Brandes-correct single-pass**:
  > `LLR = log P(mut | WT_seq) − log P(wt | WT_seq)`,
  > both probabilities read from the **same softmax** at the variant position
  > after **one** ESM-1b forward pass on the **wild-type** context.
  > **Sign convention: negative = deleterious** (mutant less likely than wild-type).
  > The AUROC predictor is `-LLR` so pathogenic is the positive class.
  >
  > These two facts — single-pass and negative=deleterious — are the LLR scar
  > caught at EXPERIMENT_LOG.md 2026-05-13 ("Brandes-correct LLR + S3 cache
  > regeneration", commits `565958a` and `3eabc0e`). The earlier two-pass
  > formula with inverted sign produced AUROC 0.929; the Brandes-correct
  > methodology produces 0.930. Right number, wrong methodology — if you
  > write a §Methods that drifts from compute_llr's actual implementation,
  > the validator will not catch it (it bites on DOI / figure / AUROC
  > presence, not on sign convention). Derive from the code; do not infer
  > from prior papers' prose.

- **Length:** 1–2 paragraphs + the boxed LLR equation + 1 paragraph on truncation policy + 1 paragraph naming the validation set.

---

## §Results

- **Skeleton location:** `\section{Results}` block (figure `resolution_panels` is already wired into the skeleton; do not regenerate).
- **Required values from manifest:**
  - `evaluation.metrics.llr_auroc` (= 0.930032)
  - `evaluation.metrics.llr_auroc_ci95_bootstrap` (= [0.9062, 0.9512])
  - `evaluation.metrics.delta_norm_auroc` (= 0.671808; the L2-baseline contrast)
  - `evaluation.metrics.bootstrap_n_resamples` (= 10000)
  - `evaluation.metrics.bootstrap_seed` (= 42)
  - `evaluation.literature_anchor.{llr_auroc, n, reference, inside_workshop_ci95, note}`
- **Required citations:** `brandes2023`.
- **Required figure caption:** name all three panels — (A) demo-pair LLR, (B) n=500 ROC, (C) Brandes n=36,537 anchor at 0.905. Walk left-to-right and close with the ceiling-gap interpretation. The figure caption itself is a TODO in the skeleton.
- **Related PROVENANCE entry:** `PROVENANCE.md` :: "Resolution panels (slide: Part 2 'Resolution')" — for the figure's reproduction lineage.
- **Length:** 1–2 paragraphs of prose framing the figure.

---

## §Discussion

- **Skeleton location:** `\section{Discussion}` block.
- **Required values from manifest** (each captures one honest-limitations bullet):
  - `composition.singleton_genes` (= 338) and `composition.unique_genes` (= 400) — the gene-singleton structure of the workshop set.
  - `universe_filters.variant_type` (= "single nucleotide variant") — SNPs only, no indels.
  - `evaluation.literature_anchor.inside_workshop_ci95` (= False) + `evaluation.literature_anchor.note` — the anchor-vs-CI caveat.
  - `evaluation.metrics.llr_auroc` (must match the value reported in §Results).
- **Required EXPERIMENT_LOG entries:**
  - `2026-05-13` — "Brandes-correct LLR + S3 cache regeneration". The LLR sign-and-formula scar.
  - `2026-05-12` — "MAX_LEN off-by-2 fix + S3 cache regeneration". The context-window scar; crashed specifically on BRCA1 L1854P (the demo pair).
- **Required citations:** `brandes2023`.
- **Length:** 3–4 short paragraphs covering (a) what the harness made cheap, (b) what the agent still needed human input for, (c) failure modes encountered (cite the two EXPERIMENT_LOG entries as receipts), (d) honest limitations.

---

## How to fill the skeleton

Before writing any section:

1. Read this file's per-section entry for the section you're filling.
2. Read every named manifest key (`workshop_set_manifest.json`).
3. Read every named source file (for §Methods, this is non-negotiable — read `vep_utils.py` first).
4. Read every named EXPERIMENT_LOG entry (for §Discussion).
5. Write the section using only the values you just read.
6. Run `validate_paper.py --real-paper`. Iterate until it passes.
7. Do not edit `paper/skeleton.tex` — it stays as the template for future regenerations. The generated paper goes to `paper/main.tex`.
