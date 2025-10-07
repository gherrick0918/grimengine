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
