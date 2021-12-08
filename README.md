# prettier-nvim

Runs prettier as a remote provider for neovim. This yields excellent performance, typically under 30ms to format a file.

## Prerequisites

Requires the neovim nodejs provider to be healthy; see `:help provider-nodejs`

* Nodejs version 16 or higher
* The `neovim` npm package, installed globally

Example using [asdf](https://github.com/asdf-vm/asdf):

```
asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git
echo "neovim" >> .default-npm-packages
asdf install nodejs latest
asdf global nodejs latest
```

To check that the nodejs provider is healthy, run `:checkhealth` and check the "Node.js provider" section.

## Installation with vim-plug

```
Plug 'maxdjohnson/prettier-nvim', {'do': ':call prettier_nvim#Update()'}
```

## Configuration

This plugin will resolve the prettier version and configuration to use based on the path of the file being formatted.

A default configuration can also be specified by setting the `g:prettier#settings` variable, for example:

```
let g:prettier#settings = {
    \ 'singleQuote': true,
\}
```

If not otherwise specified, prettier will use the current buffer's `shiftwidth` and `textwidth` as `tabWidth` and `printWidth` respectively.

To format on save, in your `init.vim` add an autocmd BufWritePre for each file type, for example:

```
autocmd BufWritePre *.js execute ': call PrettierSync()'
autocmd BufWritePre *.ts execute ': call PrettierSync()'
```
