# jwkim.log

Minimal Quarto blog → GitHub Pages.

- Site: https://mqjinwon.github.io/blogs
- Posts: `posts/**/*.qmd`
- Papers dashboard: `/papers.html` (built from post frontmatter)
- Output: `docs/`

```bash
quarto preview
quarto render
./deploy.sh                 # optional message: ./deploy.sh "deploy: …"
```

## Papers page

A post appears on **Papers** when frontmatter has either:

- `categories: [paper-review, …]`, or
- `arxiv: "2310.00166"`

Optional fields:

```yaml
venue: "NeurIPS"               # conference/journal name only (no year)
year: 2023                     # publication year (else derived from date / "Venue 2023")
one_liner: "…"
related: [other_post_folder]   # explicit graph edges (folder name = id)
```

**Papers page:** multi-select **AND** filters (tag / venue / year).  
**Every post bottom:** interactive Linked map (drag, click to open) — backlinks-style neighborhood.  
Edges: shared tags, same venue, or `related`. Re-render regenerates `data/posts.json`.
