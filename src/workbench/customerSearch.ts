export function matchesCustomerSearch(query: string, candidates: string[]) {
  const terms = query.trim().split(/\s+/).map(normalizeSearchText).filter(Boolean);
  if (terms.length === 0) return true;

  const normalizedCandidates = candidates.map(normalizeSearchText).filter(Boolean);
  return terms.every((term) =>
    normalizedCandidates.some((candidate) => candidate.includes(term) || isSubsequence(term, candidate)),
  );
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

function isSubsequence(needle: string, haystack: string) {
  let needleIndex = 0;
  for (const character of haystack) {
    if (character === needle[needleIndex]) needleIndex += 1;
    if (needleIndex === needle.length) return true;
  }
  return false;
}
