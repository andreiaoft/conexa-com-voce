import PropTypes from "prop-types";

const BASE =
  "rounded font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTS = {
  primary:        "bg-conexa-blue-dark text-white hover:bg-conexa-blue-medium",
  outlined:       "border border-conexa-blue-dark bg-white text-conexa-blue-dark hover:bg-conexa-blue-light",
  ghost:          "border border-conexa-blue-medium text-conexa-blue-medium hover:bg-conexa-blue-light",
  "ghost-danger": "border border-conexa-danger text-conexa-danger hover:bg-white",
};

const SIZES = {
  sm:  "px-4 py-2 text-sm",
  xs:  "px-3 py-1 text-xs",
  "2xs": "px-2 py-0.5 text-xs",
};

function Button({ children, variant = "primary", size = "sm", className, ...props }) {
  return (
    <button
      className={[BASE, VARIANTS[variant], SIZES[size], className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}

Button.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(["primary", "outlined", "ghost", "ghost-danger"]),
  size: PropTypes.oneOf(["sm", "xs", "2xs"]),
  className: PropTypes.string,
};

export default Button;
