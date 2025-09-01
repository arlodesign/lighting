import fs from "fs";
import path from "path";
import cssnano from "cssnano";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import esbuild from "esbuild";

export default async function (eleventyConfig) {
  eleventyConfig.addWatchTarget("./src/assets/");

  eleventyConfig.on("eleventy.before", async () => {
    const tailwindInputPath = path.resolve("./src/assets/styles.css");
    const tailwindOutputPath = "./dist/assets/styles.css";
    const cssContent = fs.readFileSync(tailwindInputPath, "utf8");
    const outputDir = path.dirname(tailwindOutputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const result = await processor.process(cssContent, {
      from: tailwindInputPath,
      to: tailwindOutputPath,
    });
    fs.writeFileSync(tailwindOutputPath, result.css);

    await esbuild.build({
      entryPoints: ["./src/assets/scripts.js"],
      bundle: true,
      outdir: "./dist/assets",
      format: "esm",
      sourcemap: true,
    });
  });

  const processor = postcss([
    //compile tailwind
    tailwindcss(),

    //minify tailwind css
    cssnano({
      preset: "default",
    }),
  ]);

  return {
    dir: { input: "src", output: "dist" },
  };
}
