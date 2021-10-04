"use strict";

export default function labelsKey(labels) {
  if (!labels) {
    return "no-labels";
  }
  return JSON.stringify(labels, Object.keys(labels).sort());
}
