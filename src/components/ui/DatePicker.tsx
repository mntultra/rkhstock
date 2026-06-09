import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLElement>) => void;
}

export const DatePicker = forwardRef<any, DatePickerProps>(
  ({ value, onChange, className, placeholder, disabled, onKeyDown }, ref) => {
    // Parsing the YYYY-MM-DD string into a local Date object without time shifts
    const selectedDate = value ? new Date(value + 'T00:00:00') : null;
    const pickerRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      focus: () => {
        pickerRef.current?.setFocus();
      },
      type: 'date'
    }));

    const handleChange = (date: Date | null) => {
      if (!date) {
        onChange('');
      } else {
        // Local time formatted as yyyy-mm-dd
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        onChange(`${year}-${month}-${day}`);
      }
    };

    return (
      <ReactDatePicker
        ref={pickerRef}
        selected={selectedDate}
        onChange={handleChange}
        dateFormat="dd/MM/yyyy"
        className={className}
        placeholderText={placeholder || "dd/mm/yyyy"}
        disabled={disabled}
        wrapperClassName="w-full"
        onKeyDown={onKeyDown}
      />
    );
  }
);

DatePicker.displayName = 'DatePicker';
