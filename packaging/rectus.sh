#!/usr/bin/bash
# Launcher for Rectus. Runs the app on the system Electron.
# Extra Electron/Chromium flags: one per line in ~/.config/rectus-flags.conf
# (lines that start with # are ignored).

_electron=/usr/bin/electron44
_app=/usr/share/rectus/app

flags_file="${XDG_CONFIG_HOME:-$HOME/.config}/rectus-flags.conf"
flags=()
if [[ -f $flags_file ]]; then
  while IFS= read -r line || [[ -n $line ]]; do
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -z $line || $line == \#* ]] && continue
    flags+=("$line")
  done <"$flags_file"
fi

export CHROME_DESKTOP=io.github.juthrbog.Rectus.desktop
exec "$_electron" "$_app" "${flags[@]}" "$@"
