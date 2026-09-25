export async function loadMistakes(): Promise<unknown> {
  const response = await fetch('/data/mistakes.json');
  if (!response.ok) {
    throw new Error(`Couldn't load mistakes: ${response.status}`);
  }
  return response.json();
}