import PropTypes from "prop-types";

const VARIANT_CLASSES = {
  error:   "text-conexa-danger",
  success: "text-conexa-green",
};

function InlineAlert({ message, variant }) {
  if (!message) return null;

  return (
    <p
      className={`text-sm ${VARIANT_CLASSES[variant]}`}
      role={variant === "error" ? "alert" : "status"}
    >
      {message}
    </p>
  );
}

InlineAlert.propTypes = {
  message: PropTypes.string,
  variant: PropTypes.oneOf(["error", "success"]).isRequired,
};

export default InlineAlert;
