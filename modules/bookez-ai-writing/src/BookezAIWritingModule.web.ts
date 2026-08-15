import { registerWebModule, NativeModule } from 'expo';

// BookezAIWritingModule is not available on the web platform.
class BookezAIWritingModule extends NativeModule<{}> {}

export default registerWebModule(BookezAIWritingModule, 'BookezAIWriting');
