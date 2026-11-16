# orca-zlocal

A personal build of [Orca](https://github.com/stablyai/orca): the latest upstream release plus a few
feature branches, on the `dist` branch. This is not a fork for contributions and ships no releases.

The `ci` branch holds one manually started workflow. For one `dist` commit it runs the typecheck,
lint and tests, builds the JavaScript bundle on Linux and the macOS Swift helpers on a macOS runner,
and uploads both with build-provenance attestations. Packaging, signing and notarization happen on
the owner's Mac; this repository holds no secrets.
