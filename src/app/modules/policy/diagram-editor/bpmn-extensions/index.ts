import CustomPaletteProvider from './custom-palette.provider';
import CustomContextPadProvider from './custom-context-pad.provider';
import CustomRules from './custom-rules';
import customModdleDescriptor from './custom-moddle.json';

export const customModule = {
  __init__: [
    'customPaletteProvider',
    'customContextPadProvider',
    'customRules'
  ],
  customPaletteProvider: ['type', CustomPaletteProvider],
  customContextPadProvider: ['type', CustomContextPadProvider],
  customRules: ['type', CustomRules]
};

export { customModdleDescriptor };
