export const fuzzyMatch = (query: string, target: string): number | null => {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  let qi = 0
  let score = 0
  let prevMatchIdx = -1
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += (ti === prevMatchIdx + 1) ? 2 : 1
      if (ti === 0 || t[ti - 1] === ' ' || t[ti - 1] === '-') score += 1
      prevMatchIdx = ti
      qi++
    }
  }
  return qi === q.length ? score : null
}
