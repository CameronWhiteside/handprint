# The Human Provenance Covenant

handprint measures human judgment, meaning the decisions a person makes while working with AI. A tool that records who decided what must not become a tool that erases them. This Covenant states how handprint may be used, and it is the basis on which access to the hosted hub is granted.

It applies alongside the code license:

- **handprint CLI and `@handprint/types`:** open source under Apache-2.0. Run them, fork them, build on them.
- **handprint hub (`handprint.sh` and its API):** a hosted service, governed by this Covenant, and aggressively rate-limited by default. See *Hub access* below.

It is also a Hippocratic-style ethical commitment we ask every user and contributor to uphold wherever the code runs:

> **Do not use this software, or the provenance data it produces, to harm the interests of the humans whose decisions it records. This includes using their provenance to build or train systems that displace them, route around them, or cut them out of the loop they are being credited in.**

## The line

**Encouraged, with the human kept in the loop and given direct benefit:**

- **Respect human data and controls:** the person who made a decision owns its provenance. Honor their consent, visibility, deletion, and portability choices.
- **Credit and surface the human:** use a person's handprints to attribute their judgment, build their reputation, and make their contribution visible.
- **Create opportunity for the human:** find and connect people to opportunities based on what they have shared and decided. Provenance should open doors for the person it belongs to.

**Conditioned, and not ready yet:**

- **Displacement:** using handprint provenance to train or operate AI systems that replace, route around, or cut out the humans whose decisions are being measured.
- **Loop removal:** any use that strips the human from the loop they are being credited in, or that treats their provenance as raw material for their own displacement.

These uses are not banned. They do not earn elevated access. They stay at the floor tier until they can show the human still benefits.

## Hub access

The handprint hub is rate-limited by default, deliberately and aggressively.

- **Default tier:** every account starts heavily rate-limited.
- **Raising limits:** discretionary, and conditional on a human-benefit review. A qualifying use must demonstrably respect the data and controls of the humans whose provenance it consumes, and deliver direct benefit to those humans by surfacing them, crediting them, or connecting them to opportunity.
- **Displacement uses:** stay at the floor tier. If the purpose is to learn from people's decisions in order to operate without them, access is not elevated.

We would rather throttle a promising use early than help build the outcome this project exists to prevent.

## For contributors

By contributing you agree your contributions ship under Apache-2.0 and that you support the intent of this Covenant. Please do not propose features whose primary purpose is to defeat the human-in-the-loop principle above. See [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md).

## Questions

Unsure whether a use qualifies for elevated hub access? Ask first by opening a discussion or emailing the maintainer. Good-faith questions are welcome.
