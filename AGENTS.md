# Agents Coding Guidelines

## TypeScript Import Rules

- **Do NOT use dynamic imports for types or interfaces.**
  - Always use static imports at the top of the file for all types and
    interfaces.
  - Example (correct):
    ```ts
    import { MyType } from "../types/my-type.ts";
    ```
  - Example (incorrect):
    ```ts
    // ❌ Do not use dynamic import for types
    foo: import("../types/my-type.ts").MyType;
    ```

- This rule ensures better type safety, IDE support, and maintainability.
