# Topoloom ELK source provenance

This Relia1 release builds the merged master branch: geometric layout plus
upstream elkjs 0.13 development changes, compiled against ELK's 0.13.0-SNAPSHOT
development line and the Relia1 Java changes.
The package version identifies this fork; it is not an upstream ELK 0.13 release.

- Package: `@relia1-platform/elkjs@0.13.0-topoloom.2`
- Relia1 elkjs source: <https://github.com/Relia1-platform/elkjs/tree/v0.13.0-topoloom.2>
- Upstream elkjs base: `cc8008397885250fb7004b3e42c975c5535ac443` (<https://github.com/kieler/elkjs>)
- Relia1 ELK Java commit: `3fb134f5f09e65ca3364c1670c91dc8aee37fe9a`
- Relia1 ELK Java source: <https://github.com/Relia1-platform/elk/tree/3fb134f5f09e65ca3364c1670c91dc8aee37fe9a>
- Upstream ELK Java base: `8aaa3c145c2a18a38aabbc725aa3791ddc517a76` (<https://github.com/eclipse-elk/elk>)
- CI runtimes: Temurin 17 and Node.js 24
- Release workflow: `.github/workflows/topoloom-release.yml` at the release tag

The release asset `source-revisions.json` records the exact elkjs commit, Java
commit, version, and GitHub Actions run ID. The workflow verifies the Java pin,
package version, tag, and elkjs ancestry before building and testing. Its npm
package tarball is accompanied by a CycloneDX SBOM, SHA-256 checksums, and GitHub
build provenance attestation. Consumers install the versioned GitHub Release
tarball; this distribution does not require npm registry publication.

The distributed package elects the Eclipse Public License 2.0 branch of the
upstream dual-license expression. The complete text is included as `LICENSE.md`.
