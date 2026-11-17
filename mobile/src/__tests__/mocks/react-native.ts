import React from 'react';

export const Platform = {
  OS: 'android',
  Version: 34,
  select: (obj: any) => obj.android ?? obj.default ?? obj,
};

export const StyleSheet = {
  create: (styles: any) => styles,
  flatten: (style: any) => style,
};

export const Dimensions = {
  get: () => ({ width: 390, height: 844, scale: 2.75, fontScale: 1 }),
  addEventListener: () => ({ remove: () => {} }),
};

export const Alert = {
  alert: (_title: string, _message?: string, _buttons?: any[]) => {},
};

export const Linking = {
  openURL: async () => true,
  canOpenURL: async () => true,
  addEventListener: () => ({ remove: () => {} }),
};

export const useColorScheme = () => 'light';

// Component stubs
const createComponent = (name: string) => {
  const Component = ({ children, ...props }: any) =>
    React.createElement('div', { 'data-testid': props.testID, ...props }, children);
  Component.displayName = name;
  return Component;
};

export const View = createComponent('View');
export const Text = createComponent('Text');
export const TouchableOpacity = createComponent('TouchableOpacity');
export const ScrollView = createComponent('ScrollView');
export const TextInput = createComponent('TextInput');
export const ActivityIndicator = createComponent('ActivityIndicator');
export const Modal = createComponent('Modal');
export const KeyboardAvoidingView = createComponent('KeyboardAvoidingView');
export const Image = createComponent('Image');
export const FlatList = createComponent('FlatList');
export const RefreshControl = createComponent('RefreshControl');
export const SafeAreaView = createComponent('SafeAreaView');

export default {
  Platform,
  StyleSheet,
  Dimensions,
  Alert,
  Linking,
  useColorScheme,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Image,
  FlatList,
  RefreshControl,
  SafeAreaView,
};
