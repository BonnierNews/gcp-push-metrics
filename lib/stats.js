"use strict";

// The below code has been copied, and modified to suite our needs, from
// https://github.com/brycebaril/node-stats-lite which at the time
// (2021-10-04) was MIT licensed.

export function nsort(vals) {
  return vals.sort((a, b) => {
    return a - b;
  });
}

export function percentile(sortedValues, ptile) {
  if (sortedValues.length === 0 || ptile == null || ptile < 0) return NaN;

  // Fudge anything over 100 to 1.0
  if (ptile > 1) ptile = 1;
  var i = sortedValues.length * ptile - 0.5;
  if ((i | 0) === i) return sortedValues[i];
  // interpolated percentile -- using Estimation method
  var int_part = i | 0;
  var fract = i - int_part;
  return (
    (1 - fract) * sortedValues[int_part] +
    fract * sortedValues[Math.min(int_part + 1, sortedValues.length - 1)]
  );
}
