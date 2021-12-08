import { NvimPlugin } from "neovim";
import type Prettier from "prettier";
import { performance } from "perf_hooks";
import * as service from "./service";

export default (plugin: NvimPlugin): void => {
  plugin.setOptions({ dev: false });

  const runPrettier = async () => {
    const start = performance.now();
    const buf = await plugin.nvim.buffer;
    const [cwd, settings, shiftwidth, textwidth, lines, name] = await Promise.all([
      plugin.nvim.commandOutput("pwd"),
      plugin.nvim.eval("g:prettier#settings").catch((_) => undefined),
      buf.getOption("shiftwidth"),
      buf.getOption("textwidth"),
      buf.lines,
      buf.name,
    ]);
    if (name == "") {
      return;
    }
    const args: Prettier.FileInfoOptions = {
      ignorePath: (settings as any)?.ignorePath,
    };
    const defaultOptions: Prettier.Options = {};
    if (textwidth > 0) {
      defaultOptions.printWidth = textwidth as number;
    }
    if (shiftwidth > 0) {
      defaultOptions.tabWidth = shiftwidth as number;
    }
    if (settings != null) {
      Object.assign(defaultOptions, settings);
    }
    const text = lines.join("\n");
    const formatted = await service.run(cwd, name, text, args, defaultOptions);
    if (formatted == text) {
      await plugin.nvim.outWrite(
        `Prettier: Unchanged in ${Math.round(performance.now() - start)}ms.\n`
      );
      return;
    }
    await plugin.nvim.buffer.setLines(formatted.split("\n"), { start: 0, end: -1 });
    await plugin.nvim.outWrite(
      `Prettier: Formatted in ${Math.round(performance.now() - start)}ms.\n`
    );
  };
  plugin.registerFunction("Prettier", runPrettier, { sync: false });
  plugin.registerFunction("PrettierSync", runPrettier, { sync: true });
};

