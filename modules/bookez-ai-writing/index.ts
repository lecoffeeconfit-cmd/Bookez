// Re-export the native module. On web, it will be resolved to BookezAIWritingModule.web.ts
// and on native platforms to BookezAIWritingModule.ts
export { default } from './src/BookezAIWritingModule';
export * from './src/BookezAIWriting.types';
