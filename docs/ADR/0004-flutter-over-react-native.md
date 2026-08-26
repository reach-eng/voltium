# ADR 0004: Flutter over React Native

## Status
Accepted

## Context
Voltium requires a cross-platform mobile application for its riders (iOS and Android). The primary contenders for cross-platform mobile development were React Native and Flutter.

## Decision
We chose **Flutter**.

## Consequences
- **Pros**: Flutter provides a highly consistent rendering engine across all devices, eliminating OEM-specific UI bugs. It compiles to native ARM code, yielding superior performance for animations and heavy maps integration.
- **Cons**: Dart is a niche language compared to JavaScript/TypeScript. Ecosystem for certain native integrations is slightly smaller than React Native.
