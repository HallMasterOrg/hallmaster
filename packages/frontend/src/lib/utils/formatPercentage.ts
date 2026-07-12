// oxlint-disable-next-line typescript/unbound-method
const formatPercentage = new Intl.NumberFormat("default", {
  style: "percent",
  maximumFractionDigits: 1,
}).format;

export default formatPercentage;
