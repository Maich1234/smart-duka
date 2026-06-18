import React from 'react';
import { View } from 'react-native';

// Base file — TypeScript resolves types from here.
// Metro replaces this with DatePicker.native.tsx on iOS/Android and DatePicker.web.tsx on web.
interface DatePickerProps {
  value: Date;
  onChange: (date: Date | undefined) => void;
}

export const DatePicker: React.FC<DatePickerProps> = () => <View />;
