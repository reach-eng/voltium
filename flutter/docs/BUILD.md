# Building the Flutter Rider App

This document covers the production APK build for the Voltium rider app.
For Flutter development workflow, see the top-level `README.md` and
`TESTING.md` in this directory.

## Production APK (CI)

The `Build Release APK` job in `.github/workflows/flutter-ci-cd.yml` runs
on every push to `main` and produces per-ABI release APKs.

### Build command

```bash
flutter build apk \
  --release \
  --split-per-abi \
  --obfuscate \
  --split-debug-info=build/symbols/
```

| Flag                  | Why                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `--release`           | Optimized, tree-shaken, minified build.                                                        |
| `--split-per-abi`     | Emits one APK per Android ABI instead of a single universal APK. ~60% size reduction per APK.  |
| `--obfuscate`         | Renames Dart symbols in the AOT snapshot — makes reverse engineering harder.                   |
| `--split-debug-info`  | Writes the symbol map under `build/symbols/` for crash deobfuscation. **Commit/ship separately.** |

### Output artifacts

After the build, the following files are written to
`build/app/outputs/flutter-apk/`:

| File                              | Target                                | Approx. size |
| --------------------------------- | ------------------------------------- | ------------ |
| `app-arm64-v8a-release.apk`       | Modern Android phones / tablets       | ~14 MB       |
| `app-armeabi-v7a-release.apk`     | Older 32-bit ARM devices              | ~13 MB       |
| `app-x86_64-release.apk`          | Android emulators (x86_64)            | ~15 MB       |

For reference, a single universal APK (no `--split-per-abi`) ships all three
ABIs in one file and weighs ~35 MB. Per-ABI APKs let the Play Store and
sideloaded installs deliver only the native libraries the device actually
needs.

### Distribution

| Device / channel       | Install this file                |
| ---------------------- | -------------------------------- |
| Real ARM64 device      | `app-arm64-v8a-release.apk`      |
| Older ARMv7 device     | `app-armeabi-v7a-release.apk`    |
| x86_64 emulator        | `app-x86_64-release.apk`         |
| Play Store upload      | Upload all three as a single bundle (use AAB for store distribution). |

The CI uploads all three APKs as the single artifact
`voltium-release.apk` (the `actions/upload-artifact` `name` is just the
artifact label; the contents are the three per-ABI files).

### Signing

The release job decodes a base64 keystore from the `KEYSTORE_BASE64` secret,
writes `android/app/key.properties`, runs the build, then overwrites the
keystore with random bytes and deletes both files. See the
`Prepare Android release signing` and `Clean up keystore` steps in
`.github/workflows/flutter-ci-cd.yml`.

### Local release build

To reproduce a release build locally you need the same signing material
the CI uses (or your own). The build command is identical — just drop the
`--release` flag for an unsigned debug build:

```bash
# Debug (no signing, fast)
flutter build apk --debug

# Release, signed with android/app/key.properties
flutter build apk --release --split-per-abi \
  --obfuscate --split-debug-info=build/symbols/
```

### References

- PR-28 in `docs/AUDIT_FIX_PLAN_2026-08-03.md`
- Rider audit finding N6 in `docs/AUDIT_RIDER_APP_2026-08-03.md`
- Flutter docs: <https://docs.flutter.dev/deployment/android#build-an-apk>
