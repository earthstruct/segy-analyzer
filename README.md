# SEG-Y Analyzer (Observable Framework)

Requires Node 18 or newer.

    npm install
    npm run dev      # preview at http://localhost:3000
    npm run build    # static site written to dist/

Files chosen in the page are read locally in the browser and never uploaded.

The page opens with the included example file (`src/data/stk00819t_first5.sgy`).
Choose your own file with the file picker to replace it.

## Deploying to GitHub Pages

1. Create an empty repository on GitHub and push this folder to its `main` branch.
2. In the repository, open Settings, then Pages, and set Source to "GitHub Actions".
3. The workflow in `.github/workflows/deploy.yml` builds the site with `npm run build`
   and publishes `dist/` on every push to `main`. You can also run it by hand from
   the Actions tab.

## Observable notebook

`notebook/segy-analyzer.notebook.html` is the same app as a single Observable
Notebooks 2.0 file (open it in Observable Desktop, or build it with Notebook Kit).

