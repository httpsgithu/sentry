const valueSelectors: Suggestions = [
  {
    type: 'value',
    value: '$string',
    description: 'Any string in the event',
  },
  {
    type: 'value',
    value: '$number',
    description: 'Any number in the event',
  },
  {
    type: 'value',
    value: '$boolean',
    description: 'Any boolean in the event',
  },
  {
    type: 'value',
    value: '$datetime',
    description: 'Any datetime in the event',
  },
  {
    type: 'value',
    value: '$array',
    description: 'Any array in the event',
  },
  {
    type: 'value',
    value: '$object',
    description: 'Any object in the event',
  },
  {
    type: 'value',
    value: '$event',
    description: 'Any event in the event',
  },
  {
    type: 'value',
    value: '$exception',
    description: 'Any exception in the event',
  },
  {
    type: 'value',
    value: '$stacktrace',
    description: 'Any stacktrace in the event',
  },
  {
    type: 'value',
    value: '$frame',
    description: 'Any frame in the event',
  },
  {
    type: 'value',
    value: '$request',
    description: 'Any request in the event',
  },
  {
    type: 'value',
    value: '$user',
    description: 'Any user in the event',
  },
  {
    type: 'value',
    value: '$logentry',
    description: 'Any logentry in the event',
  },
  {
    type: 'value',
    value: '$thread',
    description: 'Any thread in the event',
  },
  {
    type: 'value',
    value: '$breadcrumb',
    description: 'Any breadcrumb in the event',
  },
  {
    type: 'value',
    value: '$span',
    description: 'Any span in the event',
  },
  {
    type: 'value',
    value: '$sdkv',
    description: 'Any sdkv in the event',
  },
];

const booleanSelectors: Suggestions = [
  {
    type: 'boolean',
    value: '&&',
  },
  {
    type: 'boolean',
    value: '||',
  },
  {
    type: 'boolean',
    value: '!',
  },
];

const selectors: Suggestions = [...valueSelectors, ...booleanSelectors];

type SuggestionType = 'value' | 'boolean';

export type Suggestions = Array<Suggestion>;
export type Suggestion = {
  type: SuggestionType;
  value: string;
  description?: string;
};

export {selectors, valueSelectors, booleanSelectors};
