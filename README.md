# Bundle Registry

This repository is the source of truth for Cordiverse bundle metadata. Files in `bundles/` are validated and combined into `registry.json`; CI publishes that file to the `registry` branch as a single root commit.

## Bundle YAML spec

Each `.yaml` or `.yml` file in `bundles/` describes one bundle:

```yaml
name: owner/bundle
description: Human-readable description
versions:
  - version: 1.0.0
    url: https://example.com/bundle-1.0.0.zip
    hash: sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

- `name`: unique, non-empty bundle identifier.
- `description`: non-empty bundle description.
- `versions`: non-empty list; version strings must be unique within the bundle.
- `version`: non-empty version identifier.
- `url`: absolute HTTPS download URL.
- `hash`: lowercase SHA-256 digest prefixed by `sha256:`.

## registry.json spec

The generated document has this shape:

```json
{
  "schemaVersion": 1,
  "bundles": [
    {
      "name": "owner/bundle",
      "description": "Human-readable description",
      "versions": [
        {
          "version": "1.0.0",
          "url": "https://example.com/bundle-1.0.0.zip",
          "hash": "sha256:..."
        }
      ]
    }
  ]
}
```

Bundles are ordered by source filename. The generated file must not be edited manually. Run `npm install`, then `npm run build`; use `npm run check` to verify it is current.
