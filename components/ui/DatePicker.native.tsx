import React from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';

interface DatePickerProps {
  value: Date;
  onChange: (date: Date | undefined) => void;
}

export const DatePicker: React.FC<DatePickerProps> = ({ value, onChange }) => (
  <DateTimePicker
    value={value}
    mode="date"
    onChange={(_, date) => onChange(date)}
  />
);
