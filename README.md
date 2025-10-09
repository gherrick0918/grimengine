# Grimengine

## Character Vault & Samples
- The CLI command `character load-name "<Name>"` reads from `.data/characters/<Name>.json`.
- Seed the vault with bundled sample characters (Bruni and Kara):

  ```sh
  pnpm run seed:characters
  ```

- Verify they are available:

  ```sh
  pnpm dev -- character list
  ```

## Thread Kickoff (paste-once)
Use this any time you open a fresh thread so names/tags exist and demos won’t drift.

**bash/zsh**

```sh
pnpm -w build; \
 pnpm test; \
 pnpm run seed:characters; \
 pnpm dev -- encounter start; \
 pnpm dev -- character load-name "Bruni"; \
 pnpm dev -- encounter add pc "Bruni"; \
 pnpm dev -- character load-name "Kara"; \
 pnpm dev -- encounter add pc "Kara"; \
 pnpm dev -- encounter add goblin --n 2; \
 pnpm dev -- encounter bless "Bruni" "Bruni,Kara"; \
 pnpm dev -- encounter mark "Kara" "Goblin #1"; \
 pnpm dev -- encounter list
```

**PowerShell**

```powershell
pnpm -w build; `
pnpm test; `
pnpm run seed:characters; `
pnpm dev -- encounter start; `
pnpm dev -- character load-name "Bruni"; `
pnpm dev -- encounter add pc "Bruni"; `
pnpm dev -- character load-name "Kara"; `
pnpm dev -- encounter add pc "Kara"; `
pnpm dev -- encounter add goblin --n 2; `
pnpm dev -- encounter bless "Bruni" "Bruni,Kara"; `
pnpm dev -- encounter mark "Kara" "Goblin #1"; `
pnpm dev -- encounter list
```

> Tip: After running once, save it as a snapshot so you can restore with one command next time:
>
> ```sh
> pnpm dev -- encounter save "hm-demo"  # later: pnpm dev -- encounter load "hm-demo"
> ```
