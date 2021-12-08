function! prettier_nvim#Update() abort
    " For some reason, calling UpdateRemotePlugins directly doesn't work, so instead run a new
    " instance of nvim to update the remote plugin registry
    !npm update > /dev/null && npx tsc -b && nvim --headless +UpdateRemotePlugins +q
endfunction
