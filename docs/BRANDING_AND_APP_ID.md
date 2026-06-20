# Voltium Branding and App IDs

Voltium is the final public brand. The old scaffold/codename must not appear in public beta packages, app metadata, documentation, CI artifact names, or user-facing copy.

## Public names

| Surface | Name |
| --- | --- |
| Rider app | Voltium |
| Admin console | Voltium Admin Console |
| Company/brand | Voltium Electric Mobility |
| Backend/web package | voltium-electric-mobility |
| Flutter Dart package | voltium_rider |

`voltium_rider` is kept only as the internal Dart package name so existing imports remain stable. It is not the public app title.

## Production app identifiers

| Platform | Identifier |
| --- | --- |
| Android applicationId | `com.voltiumelectric.voltium` |
| Android namespace | `com.voltiumelectric.voltium` |
| iOS bundle ID | `com.voltiumelectric.voltium` |
| macOS bundle ID | `com.voltiumelectric.voltium` |
| Linux application ID | `com.voltiumelectric.voltium` |

## Enforcement

Run this before creating any beta build:

```bash
cd web
npm run check:branding
```

The check fails if any old scaffold/codename or example app identifiers are reintroduced.
