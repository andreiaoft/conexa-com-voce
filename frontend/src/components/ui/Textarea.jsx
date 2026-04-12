import { forwardRef } from "react";
import PropTypes from "prop-types";

const Textarea = forwardRef(function Textarea(
  { value, onChange, placeholder, disabled, minHeight, required },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={`w-full rounded border border-conexa-blue-light bg-white px-3 py-2 text-sm text-conexa-text-primary placeholder:text-conexa-text-secondary transition-colors duration-150 focus:border-conexa-blue-medium focus:outline-none focus:ring-1 focus:ring-conexa-blue-medium disabled:cursor-not-allowed disabled:opacity-50 ${minHeight ?? "min-h-[120px]"}`}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
    />
  );
});

Textarea.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  minHeight: PropTypes.string,
  required: PropTypes.bool,
};

export default Textarea;
