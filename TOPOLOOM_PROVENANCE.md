# Topoloom ELK source provenance

This release is the first Topoloom-maintained build of elkjs 0.12.0.

- Package: `@relia1-platform/elkjs@0.12.0-topoloom.1`
- Upstream elkjs repository: <https://github.com/kieler/elkjs>
- Upstream elkjs commit: `ff5771d7165445c42c408bb8a090c8035272218c`
- Relia1 elkjs source: <https://github.com/Relia1-platform/elkjs/tree/topoloom/0.12.0-topoloom.1>
- Upstream ELK Java repository: <https://github.com/eclipse-elk/elk>
- Upstream ELK Java commit: `323312916048544e4e594eab3303cdb0d01e2929`
- Relia1 ELK Java source: <https://github.com/Relia1-platform/elk/tree/topoloom/0.12.0>
- Java runtime used by CI: Temurin 17
- Node.js runtime used by CI: Node.js 24

The distributed package elects the Eclipse Public License 2.0 branch of the
upstream dual-license expression. The complete EPL-2.0 text is included as
`LICENSE.md`. Import into Topoloom remains subject to Relia1 compliance
approval.

The worker is generated from the adjacent, commit-pinned ELK Java checkout by
the upstream Gradle/GWT build. CI verifies both source revisions before running
`npm ci`, `npm run build`, and `npm test`.
