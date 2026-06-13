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

const parseRawDateString = (text: string): Date | null => {
  const trimmed = text.trim();
  const parts = trimmed.split(/[\/\-\.\s]+/);

  let day = 0, month = 0, year = 0;
  const currentYear = new Date().getFullYear();

  if (parts.length === 3) {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    const yearStr = parts[2].trim();
    if (yearStr.length === 2) {
      let yy = parseInt(yearStr, 10);
      if (yy >= 40) {
        year = 1957 + yy; // B.E. 25yy -> A.D.
      } else {
        year = 2000 + yy; // A.D. 20yy
      }
    } else if (yearStr.length === 4) {
      let yyyy = parseInt(yearStr, 10);
      if (yyyy > 2400) {
        year = yyyy - 543; // B.E. -> A.D.
      } else {
        year = yyyy;
      }
    } else {
      return null;
    }
  } else if (parts.length === 2) {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = currentYear;
  } else if (parts.length === 1) {
    const clean = parts[0].replace(/\D/g, '');
    if (clean.length === 4) {
      day = parseInt(clean.substring(0, 2), 10);
      month = parseInt(clean.substring(2, 4), 10);
      year = currentYear;
    } else if (clean.length === 6) {
      day = parseInt(clean.substring(0, 2), 10);
      month = parseInt(clean.substring(2, 4), 10);
      let yy = parseInt(clean.substring(4, 6), 10);
      if (yy >= 40) {
        year = 1957 + yy; // B.E. 25yy -> A.D.
      } else {
        year = 2000 + yy; // A.D. 20yy
      }
    } else if (clean.length === 8) {
      day = parseInt(clean.substring(0, 2), 10);
      month = parseInt(clean.substring(2, 4), 10);
      let yyyy = parseInt(clean.substring(4, 8), 10);
      if (yyyy > 2400) {
        year = yyyy - 543; // B.E. -> A.D.
      } else {
        year = yyyy;
      }
    } else {
      return null;
    }
  } else {
    return null;
  }

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const dateObj = new Date(year, month - 1, day);
  if (
    dateObj.getFullYear() !== year ||
    dateObj.getMonth() !== month - 1 ||
    dateObj.getDate() !== day
  ) {
    return null;
  }

  return dateObj;
};

export const DatePicker = forwardRef<any, DatePickerProps>(
  ({ value, onChange, className, placeholder, disabled, onKeyDown }, ref) => {
    // Parsing the YYYY-MM-DD string into a local Date object without time shifts
    const parsedDate = (typeof value === 'string' && value) ? new Date(value + 'T00:00:00') : null;
    const selectedDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null;
    const pickerRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      focus: () => {
        pickerRef.current?.setFocus();
      },
      type: 'date'
    }));

    const handleChange = (date: Date | null) => {
      if (!date || isNaN(date.getTime())) {
        onChange('');
      } else {
        // Local time formatted as yyyy-mm-dd
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        onChange(`${year}-${month}-${day}`);
      }
    };

    const handleRawParsing = (text: string) => {
      const parsed = parseRawDateString(text);
      if (parsed) {
        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const day = String(parsed.getDate()).padStart(2, '0');
        onChange(`${year}-${month}-${day}`);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      handleRawParsing(e.target.value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Enter') {
        handleRawParsing((e.target as HTMLInputElement).value);
      }
      if (onKeyDown) {
        onKeyDown(e);
      }
    };

    return (
      <ReactDatePicker
        ref={pickerRef}
        selected={selectedDate}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        dateFormat="dd/MM/yyyy"
        className={className}
        placeholderText={placeholder || "dd/mm/yyyy"}
        disabled={disabled}
        wrapperClassName="w-full"
      />
    );
  }
);

DatePicker.displayName = 'DatePicker';
