import PropTypes from "prop-types";

function SectionHeading({ children }) {
  return (
    <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-conexa-blue-medium">
      {children}
    </h3>
  );
}

SectionHeading.propTypes = {
  children: PropTypes.node.isRequired,
};

export default SectionHeading;
