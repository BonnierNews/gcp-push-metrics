/**
 * Calculates the Cartesian product of a number of values
 *
 * @template T
 * @param {...T[]} values - Any number of arrays to combine to a product
 * @returns {T[]} - The cartesian product of the values
 *
 * @example cartesianProduct([17])
 * //=> [17]
 * @example cartesianProduct([17], [4711])
 * //=> [17, 4711]
 * @example cartesianProduct([17, 4711], [42, 1])
 * //=> [[17, 42], [17, 1], [4711, 42], [4711, 1]]
 */
const cartesianProduct = (...values) =>
  values.reduce((product, value) =>
    product.flatMap((previous) => value.map((v) => [ previous, v ].flat()))
  );

/**
 * Combines all given labels with all values
 *
 * @template T
 * @param {{[key: string]: T[]}} labels - An object mapping labels to values
 * @returns {{[key: string]: T}[]}
 *
 * @example combination({})
 * //=> []
 * @example combination({foo: [17]})
 * //=> [{foo: 17}]
 * @example combination({foo: [17, 4711]})
 * //=> [{foo: 17}, {foo: 4711}]
 * @example combination({
 *   foo: [17, 4711]
 * })
 * //=> [{foo: 17}, {foo: 4711}]
 * @example combination({
 *   foo: [17, 4711],
 *   bar: [42, 1]
 * })
 * //=> [{
 *   foo: 17, bar: 42
 * }, {
 *   foo: 17, bar: 1
 * }, {
 *   foo: 4711, bar: 42
 * }, {
 *   foo: 4711, bar: 1
 * }]
 */
export default function labelCombinations(labels) {
  const values = Object.values(labels);

  if (values.length === 0) return [];

  return cartesianProduct(...values).map((value) =>
    Object.fromEntries(
      Object.keys(labels).map((label, index) => [
        label,
        Array.isArray(value) ? value[index] : value,
      ])
    )
  );
}
