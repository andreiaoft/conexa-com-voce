import PropTypes from "prop-types";

function Card({ children, className }) {
  return (
    <section
      className={`rounded-xl border border-conexa-blue-light bg-white p-5 shadow-md ${className ?? ""}`}
    >
      {children}
    </section>
  );
}

Card.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

export default Card;
