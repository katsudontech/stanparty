export function getSharedRank(score: number, allScores: number[]): number {
  return 1 + allScores.filter((otherScore) => otherScore > score).length;
}
