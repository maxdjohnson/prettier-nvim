/**
 * Adapted from fsouza/prettierd:
 * https://github.com/fsouza/prettierd/blob/1a51ab58f0193a6b0b53cf4b54fb586698dba220/src/service.ts
 *
 * Copyright 2020-2021 Francisco Souza
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
 * FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 * OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */

import LRU from "nanolru";
import path from "path";
import type Prettier from "prettier";
import { promisify } from "util";
import fs from "fs";

const stat = promisify(fs.stat);

const cacheParams = { max: 500, maxAge: 60000 };

const caches = {
  configCache: new LRU(cacheParams),
  importCache: new LRU(cacheParams),
  parentCache: new LRU(cacheParams),
};

async function isDir(path: string): Promise<boolean> {
  try {
    const fsStat = await stat(path);
    return fsStat.isDirectory();
  } catch (e) {
    return false;
  }
}

async function findParent(start: string, search: string): Promise<string | undefined> {
  const cacheKey = `${start}|${search}`;
  const cachedValue = caches.parentCache.get<string, string | false>(cacheKey);

  if (cachedValue === false) {
    return undefined;
  }

  if (cachedValue !== null) {
    return cachedValue;
  }

  const parent = path.join(start, "..");
  if (parent === start) {
    caches.parentCache.set(cacheKey, false);
    return undefined;
  }

  try {
    const candidate = path.join(parent, search);
    if (await isDir(candidate)) {
      caches.parentCache.set(cacheKey, candidate);
      return candidate;
    }
  } catch (e) {}

  return await findParent(parent, search);
}

async function pluginSearchDirs(cwd: string): Promise<string[]> {
  const result: string[] = [];

  const localNodeModules = await findParent(cwd, "node_modules");
  if (localNodeModules) {
    result.push(path.dirname(localNodeModules));
  }

  const parentNodeModules = await findParent(__dirname, "node_modules");
  if (parentNodeModules) {
    result.push(parentNodeModules);
  }

  return result;
}

async function resolveConfigNoCache(
  prettier: typeof Prettier,
  filepath: string
): Promise<Prettier.Options> {
  let config = await prettier.resolveConfig(filepath, {
    editorconfig: true,
    useCache: false,
  });
  return { ...config, filepath };
}

async function resolveConfig(
  prettier: typeof Prettier,
  filepath: string
): Promise<Prettier.Options> {
  const cachedValue = caches.configCache.get<string, Prettier.Options>(filepath);
  if (cachedValue) {
    return cachedValue;
  }

  const config = await resolveConfigNoCache(prettier, filepath);
  caches.configCache.set(filepath, config);
  return config;
}

async function resolvePrettier(dir: string): Promise<typeof Prettier | undefined> {
  const cached = caches.importCache.get<string, typeof Prettier | false>(dir);
  if (cached) {
    return cached;
  }

  if (cached === false) {
    return undefined;
  }

  return import(require.resolve("prettier", { paths: [dir] }))
    .catch(() => {
      return import("prettier");
    })
    .then((v) => {
      caches.importCache.set(dir, v ?? false);
      return v;
    });
}

function resolveFile(cwd: string, fileName: string): string {
  if (path.isAbsolute(fileName)) {
    return fileName;
  }

  return path.join(cwd, fileName);
}

export async function run(
  cwd: string,
  fileName: string,
  text: string,
  args: Prettier.FileInfoOptions,
  defaultOptions: Prettier.Options
): Promise<string> {
  const fullPath = resolveFile(cwd, fileName);
  const prettier = await resolvePrettier(path.dirname(fullPath));
  if (!prettier) {
    return text;
  }

  const { ignored } = await prettier.getFileInfo(fileName, args);
  if (ignored) {
    return text;
  }

  const options = await resolveConfig(prettier, fullPath);

  return prettier.format(text, {
    ...defaultOptions,
    ...options,
    pluginSearchDirs: await pluginSearchDirs(cwd),
  });
}

