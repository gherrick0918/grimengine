import { promises as fs } from "fs";
import path from "path";

const root = process.cwd();
const samplesDir = path.join(root, "samples", "characters");
const vaultDir = path.join(root, ".data", "characters");
const names = ["Bruni", "Kara"];

async function main() {
  await fs.mkdir(vaultDir, { recursive: true });

  for (const name of names) {
    const src = path.join(samplesDir, `${name}.json`);
    const dest = path.join(vaultDir, `${name}.json`);
    const data = await fs.readFile(src, "utf-8");
    await fs.writeFile(dest, data, "utf-8");
    console.log(`Seeded ${name} -> ${path.relative(root, dest)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
