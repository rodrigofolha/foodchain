# Systematic mapping: classification of the 53 primary studies

Data behind the systematic mapping of the paper on this system (its summary table and Appendix A).

The mapping followed Petersen et al. (2015). It searched IEEE Xplore, Scopus, Springer, AISEL and Engineering Village for studies from 2016 to early 2026 that use blockchain or smart contracts in the delivery of time-sensitive products. The selection went 6,507 → 6,114 after removing duplicates → 260 after screening titles and abstracts → 86 after full-text reading → 99 after backward snowballing → 54 after the quality assessment. One study appeared twice under different file names, which leaves 53 distinct studies.

Each study was read in full and classified, with a verbatim quote and page for every value other than "none". Each record was then checked a second time against the paper. That second pass made 22 corrections over the 54 records, 21 of them in the 53 distinct studies; the values given here are the corrected ones.

## Files

- `classification-53.json`: one record per study, with every field and its `evidence`. For a value that records an absence (none, no, unspecified, n/a, no-payment-on-chain), the evidence is usually the list of terms searched; for any other value, it is a quote and a page.
- `classification-53.csv`: the same records without the evidence column.

## Fields

| Field | Values |
|---|---|
| `domain` | food-delivery, parcel-last-mile, pharma-vaccine, supply-chain-with-delivery, other-delivery |
| `chainDesign` | public-permissionless, permissioned-consortium-private, unspecified |
| `evaluation` | mainnet, public-testnet, local-emulator, private-network, simulation-only, none |
| `L1_identity` | none, pseudonymous-addresses, fresh-or-one-time-addresses, stealth-addresses, other |
| `L2_payment` | none, no-payment-on-chain, escrow-only, mixer-or-shielded-pool, zk-confidential-amounts, other |
| `L3_content` | none, off-chain-storage-only, encrypted-partial, encrypted-full (`L3_who`: who encrypts) |
| `L4_staged` | none, partial, yes (staged disclosure of delivery details to the courier) |
| `L5_reputation` | none, public-reputation |
| `infraPrivacy` | permissioned access, TLS/HTTPS, role-based access control, … |
| `zkp` | whether the system itself uses zero-knowledge proofs |
| `title`, `authors`, `year`, `venue`, `doi` | bibliographic data of the study |
| `actors`, `platform`, `notes` | free text |

Some values add a short explanation after the category (for example `yes: ...` or `other (...)`); `L3_who` and `infraPrivacy` are free text.

`bibKey` matches the paper's bibliography.
