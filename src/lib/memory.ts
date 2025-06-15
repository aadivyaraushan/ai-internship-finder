let resumeContextText: string | null = null;

export function setResumeContext(text: string) {
  resumeContextText = text;
}

export function getResumeContext(): string | null {
  return resumeContextText;
}
