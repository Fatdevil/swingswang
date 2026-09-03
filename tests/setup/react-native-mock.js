// Lightweight React Native mock for jsdom-based component tests
// Provides the minimum API surface needed by our components

const React = require('react');

const mockComponent = (name) => {
  const Component = ({ children, ...props }) => {
    return React.createElement(name, props, children);
  };
  Component.displayName = name;
  return Component;
};

module.exports = {
  // Core components
  View: mockComponent('View'),
  Text: mockComponent('Text'),
  Pressable: ({ children, onPress, ...props }) => {
    const element = React.createElement('Pressable', { ...props, onClick: onPress }, children);
    return element;
  },
  TouchableOpacity: mockComponent('TouchableOpacity'),
  ScrollView: mockComponent('ScrollView'),
  FlatList: ({ data, renderItem, keyExtractor, ...props }) => {
    const items = (data || []).map((item, index) => {
      const key = keyExtractor ? keyExtractor(item, index) : String(index);
      return React.createElement(React.Fragment, { key }, renderItem({ item, index, separators: {} }));
    });
    return React.createElement('FlatList', props, ...items);
  },
  SafeAreaView: mockComponent('SafeAreaView'),
  Modal: mockComponent('Modal'),
  TextInput: (props) => React.createElement('TextInput', props),
  ActivityIndicator: mockComponent('ActivityIndicator'),
  Alert: {
    alert: jest.fn(),
  },
  
  // APIs
  StyleSheet: {
    create: (styles) => styles,
    flatten: (style) => {
      if (Array.isArray(style)) {
        return Object.assign({}, ...style.filter(Boolean));
      }
      return style || {};
    },
    hairlineWidth: 1,
  },
  Dimensions: {
    get: () => ({ width: 375, height: 812 }),
    addEventListener: jest.fn(),
  },
  Platform: {
    OS: 'ios',
    select: (obj) => obj.ios || obj.default,
  },
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: 'active',
  },
};
