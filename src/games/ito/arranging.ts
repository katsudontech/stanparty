export async function saveHintThenSelectCard(
  hint: string,
  saveHint: (hint: string) => Promise<void>,
  selectCard: () => void,
): Promise<void> {
  await saveHint(hint);
  selectCard();
}
