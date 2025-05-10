// Type definitions for Node.js
// This file is used to resolve TypeScript errors in connect-mongo

/// <reference lib="es2018" />
/// <reference lib="es2019.array" />

// Global objects available in Node.js
declare var process: NodeJS.Process;
declare var console: Console;
declare var Buffer: BufferConstructor;

declare namespace NodeJS {
  interface Process {
    env: ProcessEnv;
    // Add other process properties as needed
  }

  interface ProcessEnv {
    [key: string]: string | undefined;
  }
}

// This is a minimal definition to satisfy the TypeScript compiler
// The actual Node.js types are much more comprehensive
