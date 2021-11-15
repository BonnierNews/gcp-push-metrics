// The below code has been copied, and modified to suite our needs, from
// https://github.com/brycebaril/node-stats-lite which at the time
// (2021-10-04) was MIT licensed.

export function nsort(vals) {
  return vals.sort((a, b) => a - b);
}

export function percentile(sortedValues, ptile) {
  if (sortedValues.length === 0 || !ptile || ptile < 0) return NaN;

  // Fudge anything over 100 to 1.0
  if (ptile > 1) ptile = 1;
  const i = sortedValues.length * ptile - 0.5;
  if ((i | 0) === i) return sortedValues[i];
  // interpolated percentile -- using Estimation method
  const int_part = i | 0;
  const fract = i - int_part;
  return (
    (1 - fract) * sortedValues[int_part] +
    fract * sortedValues[Math.min(int_part + 1, sortedValues.length - 1)]
  );
}
