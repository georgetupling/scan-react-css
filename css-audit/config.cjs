const STATE_CLASS_PATTERNS = [/^(is|has)-[a-z0-9][a-z0-9_-]*$/i];

const IGNORED_CLASS_NAMES = new Set([]);

const IGNORED_CLASS_PATTERNS = [/^js-[a-z0-9_-]+$/i];

function isStateClassName(className) {
  return STATE_CLASS_PATTERNS.some((pattern) => pattern.test(className));
}

function isIgnoredClassName(className) {
  if (IGNORED_CLASS_NAMES.has(className)) {
    return true;
  }

  return IGNORED_CLASS_PATTERNS.some((pattern) => pattern.test(className));
}

module.exports = {
  IGNORED_CLASS_NAMES,
  IGNORED_CLASS_PATTERNS,
  STATE_CLASS_PATTERNS,
  isIgnoredClassName,
  isStateClassName,
};
