# Rectus

Rectus is an unofficial Arch Linux port of the Linear desktop app. Linear has official desktop apps only for macOS and Windows. Rectus opens the Linear web app ([linear.app](https://linear.app)) in its own window and adds Linux desktop features.

## The name

"Rectus" is Latin for "straight". "Straight" is a synonym for "linear". The name does not use the Linear name or the Arch Linux name, because both are trademarks of their owners.

## Not official

Rectus is not made by Linear and is not affiliated with Linear Orbit, Inc. It does not contain any code from the official Linear desktop app.

Rectus is not made by the Arch Linux project and is not endorsed by it. It is a community package for Arch Linux. It runs on the system Electron (`electron44`) from the Arch `extra` repository.

## Features

- A window that keeps your Linear login between restarts.
- Native notifications through your notification daemon (mako, dunst, swaync, or similar).
- A tray icon that shows a dot when you have unread items.
- Support for `linear://` links and for `https://linear.app/...` links on the command line.
- Native Wayland, with spellcheck and a right-click menu.
- Links to other websites open in your default browser.
- Issue attachments download with your Linear login.

## Install

After the first release, install the `rectus` package from the AUR with an AUR helper, for example:

```sh
yay -S rectus
```

Each release on GitHub also has the package file `rectus-VERSION-1-any.pkg.tar.zst`. To install it, run `sudo pacman -U` with the file.

To build the package from the local files, you need Node.js to make the source tarball and to run the tests:

```sh
npm run pack          # writes packaging/rectus-VERSION.tar.gz
cd packaging
makepkg -si
```

The package installs these files:

| Path | Content |
|---|---|
| `/usr/bin/rectus` | The launcher |
| `/usr/share/rectus/app` | The app |
| `/usr/share/applications/io.github.juthrbog.Rectus.desktop` | The desktop entry |

## Run

Start Rectus from your app launcher, or run `rectus` in a terminal.

To open a Linear page, give the URL as an argument:

```sh
rectus https://linear.app/acme/issue/ENG-123
rectus linear://acme/issue/ENG-123
```

If Rectus is already open, the existing window shows the page.

## Log in

Rectus supports these login methods:

- Email code. Linear sends an email with a code and a link. Type the code in Rectus. If you click the link, it logs you in to your browser and not to Rectus.
- Google. The Google login page opens in the Rectus window.
- SAML and other single sign-on (SSO) providers. The provider pages open in the Rectus window during login.

During login, Rectus lets any https page load in its window, because single sign-on providers use many hosts. This login mode stops when you arrive on a Linear page, or after 10 minutes.

Some integrations (GitHub, GitLab, Slack, Figma, Microsoft) open a login popup window from Linear settings. Rectus opens these popups only for the login pages of those services. Other integrations open in your browser and can fail to connect. If an integration does not connect, connect it in your browser.

Passkeys do not work.

## Make Rectus open linear:// links

The desktop entry tells the system that Rectus can open `linear://` links. Rectus does not make itself the default handler, because another app can own that link type. To make Rectus the default, run this command:

```sh
xdg-mime default io.github.juthrbog.Rectus.desktop x-scheme-handler/linear
```

The "Open in desktop app" button on linear.app does not find Rectus. That button looks for the official app. Use File > Open Linear link from clipboard instead. Press Alt to show the menu bar.

## Tray icon and closing the window

The tray icon needs a StatusNotifierItem host. On Hyprland, the `tray` module of Waybar is one such host. If no host runs, Rectus shows no tray icon and works without it.

When you close the window, Rectus quits. To keep Rectus running in the tray, turn on "Close to tray" in the File menu or in the tray menu. When you close the window, Rectus asks D-Bus if a tray host runs. If no tray host runs, Rectus quits and does not hide the window. To show a hidden window again, click the tray icon or run `rectus` again.

On Hyprland, a running app cannot move focus to its window by default. If the window does not come to the front when you click the tray icon, set the Hyprland option `misc:focus_on_activate` to true.

## Electron flags

Rectus reads extra Electron and Chromium flags from `~/.config/rectus-flags.conf`. Put one flag on each line. Lines that start with `#` are ignored.

Electron 44 uses Wayland by default. These flags can help on some systems:

```sh
# Run through XWayland instead of native Wayland
--ozone-platform=x11
# Input methods (fcitx5, ibus) on Wayland
--enable-wayland-ime
--wayland-text-input-version=3
```

## Hyprland window rules

The Wayland app ID of Rectus is `io.github.juthrbog.Rectus`. Use it in window rules. This example is for a Hyprland configuration in Lua:

```lua
hl.window_rule({
    name  = "rectus-workspace",
    match = { class = "^(io\\.github\\.juthrbog\\.Rectus)$" },
    workspace = "3",
})
```

## Files

| Path | Content |
|---|---|
| `~/.config/Rectus/` | Login session, cache, and app data |
| `~/.config/Rectus/settings.json` | The "Close to tray" setting and the spellcheck languages |
| `~/.config/Rectus/window-state.json` | The window size |
| `~/.config/rectus-flags.conf` | Extra Electron flags |

To log out of all accounts and reset Rectus, quit Rectus and remove `~/.config/Rectus`.

## Development

You need Node.js and npm. The npm install gets a matching Electron 44 for development only. The Arch package does not use it.

```sh
npm install
npm start             # run the app
npm test              # run the unit tests
npm run selftest      # load the Linear login page in a temporary profile and print a report
npm run icons         # render the PNG icons from the SVG files (needs rsvg-convert)
```

The code is plain JavaScript modules with no build step:

| File | Purpose |
|---|---|
| `src/main.js` | Start-up, single instance, deep links, and wiring |
| `src/policy.js` | URL rules. It has no Electron import, so the unit tests can load it |
| `src/navigation.js` | Applies the URL rules to each window |
| `src/session.js` | User agent, permissions, and spellcheck |
| `src/window.js` | Main window, window size, and the right-click menu |
| `src/tray.js` | Tray icon |
| `src/menu.js` | App menu |
| `src/selftest.js` | The `--self-test` mode |

## Release

A release starts when you push a tag such as `v0.2.0`. The release workflow (`.github/workflows/release.yml`) does these steps:

1. It makes sure that the tag matches the version in `package.json` and in `packaging/PKGBUILD`, and it runs the tests.
2. It builds the package on Arch Linux from the tag, checks it with `namcap`, installs it, and runs `rectus --self-test`.
3. It makes the GitHub release with the source tarball, the package, the PKGBUILD, `checksums.txt`, and a build provenance attestation. GitHub writes the release notes from the merged pull requests.
4. It pushes the new PKGBUILD and `.SRCINFO` to the AUR.

A tag with a "-", such as `v0.3.0-rc.1`, makes a prerelease. A prerelease does not change the AUR package.

To make a release:

1. Set the new version with `scripts/version.sh 0.2.0`. The script changes `package.json`, `package-lock.json`, and `packaging/PKGBUILD`.
2. Merge the change to `main` through a pull request.
3. Tag the merge commit and push the tag: `git tag v0.2.0 && git push origin v0.2.0`.

To check that a file comes from the release workflow, run `gh attestation verify <file> --repo juthrbog/rectus`.

The AUR step needs the `AUR_SSH_KEY` secret in this repository. The secret is the private SSH key of the AUR account that maintains `rectus`. If the secret is not set, the workflow skips the AUR step and shows a warning.

A pull request that changes `packaging/`, `scripts/`, or the release workflow runs a snapshot. A snapshot builds, installs, and runs the package, but it publishes nothing.

## Security

Each page runs in the Chromium sandbox with context isolation and without Node.js. Rectus has no preload script. Rectus gives linear.app only these permissions: notifications, clipboard write, and full screen. All other permissions are denied. Other websites open in your browser, except login pages during a login. A popup window cannot open more popup windows.

## License

MIT. See `LICENSE`.
