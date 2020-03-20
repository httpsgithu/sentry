import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {t} from 'app/locale';
import TextField from 'app/components/forms/textField';
import TextOverflow from 'app/components/textOverflow';
import Tooltip from 'app/components/tooltip';
import {defined} from 'app/utils';

import {
  selectors,
  valueSelectors,
  booleanSelectors,
  Suggestion,
  Suggestions,
} from './dataPrivacyRulesPanelSelectorFieldTypes';

type State = {
  showOptions: boolean;
  suggestions: Suggestions;
  fieldValues: Array<Suggestion | string>;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  onBlur?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
};

class DataPrivacyRulesPanelSelectorField extends React.Component<Props, State> {
  state: State = {
    suggestions: [],
    fieldValues: [],
    showOptions: false,
  };

  componentWillMount() {
    document.addEventListener('mousedown', this.handleClickOutside, false);
  }

  componentDidMount() {
    this.loadFieldValues(this.props.value);
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClickOutside, false);
  }

  selectorField = React.createRef<HTMLDivElement>();

  loadFieldValues = (newValue: string) => {
    const splittedValue = newValue.split(' ');
    const fieldValues: Array<Suggestion | string> = [];

    for (const index in splittedValue) {
      const value = splittedValue[index];
      const selector = selectors.find(s => s.value === value);
      fieldValues.push(selector ? selector : value);
    }

    const newSuggestions = this.getNewSuggestions(fieldValues);

    this.setState({
      fieldValues,
      suggestions: newSuggestions,
    });
  };

  getNewSuggestions = (fieldValues: Array<Suggestion | string>) => {
    const lastFieldValue = fieldValues[fieldValues.length - 1];
    const penultimateFieldValue = fieldValues[fieldValues.length - 2];

    if (!defined(lastFieldValue)) {
      return [];
    }

    if (
      typeof penultimateFieldValue === 'object' &&
      penultimateFieldValue.type === 'boolean'
    ) {
      return valueSelectors;
    }

    if (fieldValues.length > 1 && typeof lastFieldValue === 'string' && !lastFieldValue) {
      return booleanSelectors;
    }

    const value =
      typeof lastFieldValue === 'object' ? lastFieldValue.value : lastFieldValue;

    const filteredSuggestions = selectors.filter(
      s => s.value.indexOf(value.toLowerCase()) > -1
    );

    return filteredSuggestions;
  };

  handleChange = (newValue: string) => {
    this.loadFieldValues(newValue);
    this.props.onChange(newValue);
  };

  handleClickOutside = (event: MouseEvent) => {
    if (
      event.target instanceof HTMLElement &&
      this.selectorField.current &&
      this.selectorField.current.contains(event.target)
    ) {
      return;
    }

    this.setState({
      showOptions: false,
    });
  };

  handleClickSuggestionItem = (suggestion: Suggestion) => () => {
    let fieldValues = [...this.state.fieldValues];
    const lastFieldValue = fieldValues[fieldValues.length - 1];

    if (defined(lastFieldValue)) {
      fieldValues[fieldValues.length - 1] = suggestion;
    }

    if (!defined(lastFieldValue)) {
      fieldValues = [suggestion];
    }

    this.setState(
      {
        fieldValues,
        showOptions: false,
      },
      () => {
        this.handleChangeParentValue();
      }
    );
  };

  handleChangeParentValue = () => {
    const {onChange} = this.props;
    const {fieldValues} = this.state;
    const newValue: Array<string> = [];

    for (const index in fieldValues) {
      const fieldValue = fieldValues[index];
      if (typeof fieldValue !== 'string') {
        newValue.push(fieldValue.value);
        continue;
      }
      newValue.push(fieldValue);
    }

    onChange(newValue.join(' '));
  };

  handleFocus = () => {
    this.setState({
      showOptions: true,
    });
  };

  handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const {fieldValues} = this.state;

    if (event.keyCode === 32) {
      this.setState({
        fieldValues: [...fieldValues, ' '],
      });
    }
  };

  render() {
    const {error, onBlur, disabled, value} = this.props;
    const {showOptions, suggestions} = this.state;

    return (
      <Wrapper ref={this.selectorField}>
        <StyledTextField
          name="from"
          placeholder={t('ex. strings, numbers, custom')}
          onChange={this.handleChange}
          autoComplete="off"
          autoFocus
          value={value}
          onKeyDown={this.handleKeyDown}
          error={error}
          onBlur={onBlur}
          onFocus={this.handleFocus}
          disabled={disabled}
        />
        {showOptions && suggestions.length > 0 && (
          <SuggestionsWrapper>
            {suggestions.map(suggestion => (
              <SuggestionItemWrapper
                key={suggestion.value}
                onClick={this.handleClickSuggestionItem(suggestion)}
              >
                <Tooltip
                  title={`${suggestion.value} ${suggestion?.description &&
                    `(${suggestion.description})`}`}
                  position="top"
                >
                  <SuggestionItem>
                    <TextOverflow>{suggestion.value}</TextOverflow>
                    {suggestion?.description && (
                      <SuggestionDescription>
                        (<TextOverflow>{suggestion.description}</TextOverflow>)
                      </SuggestionDescription>
                    )}
                  </SuggestionItem>
                </Tooltip>
              </SuggestionItemWrapper>
            ))}
          </SuggestionsWrapper>
        )}
      </Wrapper>
    );
  }
}

export default DataPrivacyRulesPanelSelectorField;

const Wrapper = styled('div')`
  position: relative;
  width: 100%;
`;

const StyledTextField = styled(TextField)<{error?: string}>`
  width: 100%;
  height: 40px;
  > * {
    height: 100%;
    min-height: 100%;
  }
  ${p =>
    !p.error &&
    `
      margin-bottom: 0;
    `}
`;

const SuggestionsWrapper = styled('ul')`
  position: absolute;
  width: 100%;
  padding-left: 0;
  list-style: none;
  margin-bottom: 0;
  box-shadow: 0 2px 0 rgba(37, 11, 54, 0.04);
  border: 1px solid ${p => p.theme.borderDark};
  border-radius: 0 0 ${space(0.5)} ${space(0.5)};
  background: ${p => p.theme.white};
  top: 35px;
  z-index: 1001;
  overflow: hidden;
  max-height: 200px;
  overflow-y: auto;
`;

const SuggestionItemWrapper = styled('li')`
  border-bottom: 1px solid ${p => p.theme.borderLight};
  padding: ${space(1)} ${space(2)};
  font-size: ${p => p.theme.fontSizeSmall};
  font-family: ${p => p.theme.text.familyMono};
  cursor: pointer;
  :hover {
    background: ${p => p.theme.offWhite};
  }
`;

const SuggestionItem = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr;
  grid-gap: ${space(1)};
`;

const SuggestionDescription = styled('div')`
  display: flex;
  overflow: hidden;
`;
