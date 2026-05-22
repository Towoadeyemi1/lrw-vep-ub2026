# Section anchors — paper/main.tex

Every section below names the manifest keys and PROVENANCE entries it must
cite. Agents filling these sections must read the named keys before writing.
If a key is missing, stop and ask — do not invent.

The manifest is at `experiments/notebooks/data/workshop_set_manifest.json`.
PROVENANCE is at `experiments/PROVENANCE.md`. EXPERIMENT_LOG is at
`experiments/EXPERIMENT_LOG.md`. The bibliography is at
`shared/bib/references.bib`.

Key paths below are written as `manifest.<path>` where `<path>` is the
literal nested-key path inside `workshop_set_manifest.json`.

## §Methods

Required manifest keys:
- `manifest.composition.total_variants` (= 500)
- `manifest.sampling.n_pathogenic` + `manifest.sampling.n_benign` (= 250 + 250)
- `manifest.composition.unique_genes` (= 400 disease genes)
- `manifest.evaluation.metrics.bootstrap_n_resamples` (= 10000)
- `manifest.evaluation.metrics.bootstrap_seed` (= 42)

Required PROVENANCE entries:
- `PROVENANCE.md` :: "LLR distribution (headline §Results figure, n=500)"
- `PROVENANCE.md` :: "Validation set lineage" (build-history context for the
  workshop set; the four revisions + catch ledger sit under this heading)

Required citations (must exist in `shared/bib/references.bib`):
- `brandes2023`, `rives2021esm`, `landrum2018clinvar`

## §Results

Required manifest keys:
- `manifest.evaluation.metrics.llr_auroc` (= 0.930032)
- `manifest.evaluation.metrics.llr_auroc_ci95_bootstrap` (= [0.9062, 0.9512])
- `manifest.evaluation.literature_anchor.llr_auroc` (= 0.905)
- `manifest.evaluation.literature_anchor.n` (= 36537)
- `manifest.evaluation.literature_anchor.reference`
  (= "Brandes et al., Nat. Genet. 2023, Fig 2B")

Required PROVENANCE entries:
- `PROVENANCE.md` :: "Resolution panels (slide: Part 2 'Resolution')"

Required citations:
- `brandes2023`

## §Discussion

The manifest does not have a `limitations` field. The fields below are what
the limitations paragraphs anchor against — each field captures one of the
honest-limitations bullets the §Discussion TODO names.

Required manifest keys:
- `manifest.composition.singleton_genes` (= 338 of 400 — the gene-singleton
  structure limitation)
- `manifest.universe_filters.variant_type` (= "single nucleotide variant" —
  SNPs only, no indels)
- `manifest.evaluation.literature_anchor.inside_workshop_ci95` (= False) and
  `manifest.evaluation.literature_anchor.note` (anchor-vs-CI caveat)
- `manifest.evaluation.metrics.llr_auroc` (must match §Results)

Required EXPERIMENT_LOG entries:
- 2026-05-13 "Brandes-correct LLR + S3 cache regeneration" (the sign-fix scar)
- 2026-05-12 "MAX_LEN off-by-2 fix + S3 cache regeneration" (the context-cap
  scar; crashed on BRCA1 L1854P — the demo pair)

Required citations:
- `brandes2023`

## Validator contract

`validate_paper.py --real-paper` enforces, before the PDF compile:

1. Every `\cite`-key in `paper/main.tex` resolves to a bib entry that
   carries a `doi` field.
2. Every `\includegraphics{...}` path resolves on the parsed
   `\graphicspath`.
3. The manifest's `llr_auroc` (3- or 4-decimal precision) is present
   somewhere in the `.tex` source.

If any check fails: stop, do not commit, report the failure with the
structured FAIL line the validator emitted.

## How to use

Before writing any section:

1. Read this file.
2. Read every named manifest key.
3. Read every named PROVENANCE / EXPERIMENT_LOG entry.
4. Write the section using only the values you just read.
5. Run `validate_paper.py --real-paper` before claiming done.
